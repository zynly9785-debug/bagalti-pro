create table if not exists public.admin_security_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  store_id uuid not null references public.stores(id) on delete restrict,
  action text not null check (action in ('merchant_password_reset')),
  created_at timestamptz not null default now()
);

create index if not exists admin_security_events_created_at_idx
  on public.admin_security_events(created_at desc);

alter table public.admin_security_events enable row level security;
revoke all on public.admin_security_events from anon, authenticated;
grant select on public.admin_security_events to authenticated;
grant insert on public.admin_security_events to service_role;
grant usage, select on sequence public.admin_security_events_id_seq to service_role;
create policy admin_security_events_select_platform_owner
  on public.admin_security_events for select to authenticated
  using ((select private.is_platform_owner()));
