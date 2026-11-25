-- Public RPCs rely on caller identity and RLS; they must not run with elevated privileges.
create or replace function public.create_store_for_current_user(p_local_store_id text,p_store_name text,p_owner_name text,p_phone text,p_governorate text,p_district text,p_neighborhood text)
returns uuid language plpgsql security invoker set search_path = ''
as $$
declare v_user_id uuid := (select auth.uid()); v_store_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if coalesce(trim(p_store_name),'') = '' or coalesce(trim(p_owner_name),'') = '' or coalesce(trim(p_phone),'') = '' then raise exception 'Store name, owner name and phone are required'; end if;
  select s.id into v_store_id from public.stores s where s.owner_user_id = v_user_id;
  if v_store_id is not null then return v_store_id; end if;
  insert into public.stores(owner_user_id,local_store_id,store_name,owner_name,phone,governorate,district,neighborhood)
  values (v_user_id,p_local_store_id,trim(p_store_name),trim(p_owner_name),trim(p_phone),trim(p_governorate),trim(p_district),trim(p_neighborhood)) returning id into v_store_id;
  insert into public.store_memberships(store_id,user_id,role) values(v_store_id,v_user_id,'owner') on conflict(store_id,user_id) do nothing;
  return v_store_id;
end;
$$;

create or replace function public.admin_update_store_subscription(p_store_id uuid,p_subscription_end timestamptz,p_subscription_price numeric,p_status text,p_suspension_reason text default null,p_action text default 'extended',p_note text default '')
returns void language plpgsql security invoker set search_path = ''
as $$
declare v_previous_end timestamptz;
begin
  if not (select private.is_platform_owner()) then raise exception 'Platform owner permission required'; end if;
  if p_status not in ('active','suspended') then raise exception 'Invalid store status'; end if;
  if p_subscription_price < 0 then raise exception 'Subscription price cannot be negative'; end if;
  select s.subscription_end into v_previous_end from public.stores s where s.id=p_store_id for update;
  if not found then raise exception 'Store not found'; end if;
  update public.stores set subscription_end=p_subscription_end,subscription_price=p_subscription_price,status=p_status,suspension_reason=case when p_status='active' then null else coalesce(p_suspension_reason,'') end,updated_at=now() where id=p_store_id;
  insert into public.subscription_events(store_id,actor_user_id,action,previous_end,new_end,days_changed,amount,note)
  values(p_store_id,(select auth.uid()),p_action,v_previous_end,p_subscription_end,round(extract(epoch from (p_subscription_end-v_previous_end))/86400)::integer,p_subscription_price,coalesce(p_note,''));
end;
$$;

revoke all on function public.create_store_for_current_user(text,text,text,text,text,text,text) from public,anon;
revoke all on function public.admin_update_store_subscription(uuid,timestamptz,numeric,text,text,text,text) from public,anon;
grant execute on function public.create_store_for_current_user(text,text,text,text,text,text,text) to authenticated;
grant execute on function public.admin_update_store_subscription(uuid,timestamptz,numeric,text,text,text,text) to authenticated;
grant insert on public.subscription_events to authenticated;

create policy stores_select_owner_or_member_or_admin on public.stores for select to authenticated
  using (owner_user_id=(select auth.uid()) or (select private.is_store_member(id)) or (select private.is_platform_owner()));
