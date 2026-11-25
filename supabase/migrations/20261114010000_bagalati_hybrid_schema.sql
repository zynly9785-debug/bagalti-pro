-- Baqalati Pro hybrid cloud schema. Tenant business payloads remain client-encrypted in local SQLite;
-- cloud rows are isolated by authenticated store membership (RLS).

create schema if not exists private;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone text unique,
  display_name text,
  platform_role text not null default 'merchant' check (platform_role in ('merchant','platform_owner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users(id) on delete restrict,
  local_store_id text,
  store_name text not null,
  owner_name text not null,
  phone text not null,
  governorate text not null default '',
  district text not null default '',
  neighborhood text not null default '',
  status text not null default 'active' check (status in ('active','suspended')),
  subscription_end timestamptz not null default (now() + interval '60 days'),
  subscription_price numeric(14,2) not null default 0 check (subscription_price >= 0),
  suspension_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.store_memberships (
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','manager','cashier')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (store_id,user_id)
);

create table public.subscription_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  duration_days integer not null check (duration_days > 0 and duration_days <= 36500),
  price numeric(14,2) not null check (price >= 0),
  description text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('activated','extended','reset','suspended','unsuspended','payment_recorded','profile_updated')),
  previous_end timestamptz,
  new_end timestamptz,
  days_changed integer,
  amount numeric(14,2) not null default 0 check (amount >= 0),
  payment_method text not null default 'manual',
  note text not null default '',
  created_at timestamptz not null default now()
);

-- Generic change rows provide idempotent, record-level sync without replacing the whole store snapshot.
-- Each payload is one business record and every row is scoped to one authenticated tenant.
create table public.sync_records (
  store_id uuid not null references public.stores(id) on delete cascade,
  entity text not null check (entity in ('product','customer','sale','sale_item','return','expense','quick_product','store_preferences')),
  record_id uuid not null,
  record_data jsonb not null check (jsonb_typeof(record_data) = 'object'),
  device_id uuid not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (store_id, entity, record_id)
);
create index sync_records_store_updated_idx on public.sync_records(store_id, updated_at);
create index stores_subscription_end_idx on public.stores(subscription_end);
create index subscription_events_store_created_idx on public.subscription_events(store_id, created_at desc);

create or replace function private.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid()) and p.platform_role = 'platform_owner'
  );
$$;

create or replace function private.is_store_member(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.store_memberships m
    where m.store_id = p_store_id and m.user_id = (select auth.uid()) and m.is_active
  );
$$;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(user_id, phone, display_name)
  values (new.id, nullif(new.phone,''), coalesce(new.raw_user_meta_data->>'owner_name',''))
  on conflict (user_id) do update
    set phone = coalesce(excluded.phone, public.profiles.phone),
        display_name = coalesce(nullif(excluded.display_name,''), public.profiles.display_name),
        updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_created_bagalati
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

create or replace function public.create_store_for_current_user(
  p_local_store_id text,
  p_store_name text,
  p_owner_name text,
  p_phone text,
  p_governorate text,
  p_district text,
  p_neighborhood text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_store_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if coalesce(trim(p_store_name),'') = '' or coalesce(trim(p_owner_name),'') = '' or coalesce(trim(p_phone),'') = '' then
    raise exception 'Store name, owner name and phone are required';
  end if;

  select s.id into v_store_id from public.stores s where s.owner_user_id = v_user_id;
  if v_store_id is not null then return v_store_id; end if;

  insert into public.stores(owner_user_id,local_store_id,store_name,owner_name,phone,governorate,district,neighborhood)
  values (v_user_id,p_local_store_id,trim(p_store_name),trim(p_owner_name),trim(p_phone),trim(p_governorate),trim(p_district),trim(p_neighborhood))
  returning id into v_store_id;

  insert into public.store_memberships(store_id,user_id,role)
  values (v_store_id,v_user_id,'owner')
  on conflict (store_id,user_id) do nothing;

  return v_store_id;
end;
$$;

create or replace function public.admin_update_store_subscription(
  p_store_id uuid,
  p_subscription_end timestamptz,
  p_subscription_price numeric,
  p_status text,
  p_suspension_reason text default null,
  p_action text default 'extended',
  p_note text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous_end timestamptz;
begin
  if not private.is_platform_owner() then raise exception 'Platform owner permission required'; end if;
  if p_status not in ('active','suspended') then raise exception 'Invalid store status'; end if;
  if p_subscription_price < 0 then raise exception 'Subscription price cannot be negative'; end if;

  select s.subscription_end into v_previous_end from public.stores s where s.id = p_store_id for update;
  if not found then raise exception 'Store not found'; end if;

  update public.stores
  set subscription_end = p_subscription_end,
      subscription_price = p_subscription_price,
      status = p_status,
      suspension_reason = case when p_status = 'active' then null else coalesce(p_suspension_reason,'') end,
      updated_at = now()
  where id = p_store_id;

  insert into public.subscription_events(store_id,actor_user_id,action,previous_end,new_end,days_changed,amount,note)
  values (p_store_id,(select auth.uid()),p_action,v_previous_end,p_subscription_end,
          round(extract(epoch from (p_subscription_end-v_previous_end))/86400)::integer,
          p_subscription_price,coalesce(p_note,''));
end;
$$;

alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.store_memberships enable row level security;
alter table public.subscription_packages enable row level security;
alter table public.subscription_events enable row level security;
alter table public.sync_records enable row level security;

revoke all on public.profiles,public.stores,public.store_memberships,public.subscription_packages,public.subscription_events,public.sync_records from anon;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select,insert on public.stores to authenticated;
grant update (store_name,owner_name,governorate,district,neighborhood) on public.stores to authenticated;
grant update (status,subscription_end,subscription_price,suspension_reason) on public.stores to authenticated;
grant select,insert,update,delete on public.store_memberships to authenticated;
grant select,insert,update,delete on public.subscription_packages to authenticated;
grant select on public.subscription_events to authenticated;
grant select,insert,update,delete on public.sync_records to authenticated;

grant usage on schema private to authenticated;
grant execute on function private.is_platform_owner() to authenticated;
grant execute on function private.is_store_member(uuid) to authenticated;
grant execute on function public.create_store_for_current_user(text,text,text,text,text,text,text) to authenticated;
grant execute on function public.admin_update_store_subscription(uuid,timestamptz,numeric,text,text,text,text) to authenticated;

create policy profiles_select_self_or_admin on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_platform_owner()));
create policy profiles_update_self on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy stores_select_member_or_admin on public.stores for select to authenticated
  using ((select private.is_store_member(id)) or (select private.is_platform_owner()));
create policy stores_insert_self on public.stores for insert to authenticated
  with check (owner_user_id = (select auth.uid()));
create policy stores_update_member_profile on public.stores for update to authenticated
  using ((select private.is_store_member(id))) with check ((select private.is_store_member(id)));
create policy stores_update_platform_owner on public.stores for update to authenticated
  using ((select private.is_platform_owner())) with check ((select private.is_platform_owner()));

create policy memberships_select_member_or_self on public.store_memberships for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_store_member(store_id)) or (select private.is_platform_owner()));
create policy memberships_manage_owner on public.store_memberships for all to authenticated
  using (exists (select 1 from public.stores s where s.id = store_id and s.owner_user_id = (select auth.uid())) or (select private.is_platform_owner()))
  with check (exists (select 1 from public.stores s where s.id = store_id and s.owner_user_id = (select auth.uid())) or (select private.is_platform_owner()));

create policy packages_read_active_or_admin on public.subscription_packages for select to authenticated
  using (is_active or (select private.is_platform_owner()));
create policy packages_manage_admin on public.subscription_packages for all to authenticated
  using ((select private.is_platform_owner())) with check ((select private.is_platform_owner()));

create policy subscription_events_admin_only on public.subscription_events for select to authenticated
  using ((select private.is_platform_owner()));

create policy sync_records_store_member_only on public.sync_records for select to authenticated
  using ((select private.is_store_member(store_id)));
create policy sync_records_insert_store_member on public.sync_records for insert to authenticated
  with check ((select private.is_store_member(store_id)));
create policy sync_records_update_store_member on public.sync_records for update to authenticated
  using ((select private.is_store_member(store_id))) with check ((select private.is_store_member(store_id)));
create policy sync_records_delete_store_member on public.sync_records for delete to authenticated
  using ((select private.is_store_member(store_id)));

create policy subscription_events_insert_admin on public.subscription_events for insert to authenticated
  with check ((select private.is_platform_owner()));
