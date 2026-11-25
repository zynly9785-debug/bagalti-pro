-- Migration for v1.4.6: Store private notifications & immutable drawer close reports

create table if not exists public.store_notifications (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  title text not null,
  message text not null,
  kind text not null check (kind in ('reminder', 'message', 'system')) default 'message',
  sender text not null default 'إدارة التطبيق',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Ensure columns exist even if an earlier draft table existed
alter table public.store_notifications add column if not exists kind text not null default 'message';
alter table public.store_notifications add column if not exists sender text not null default 'إدارة التطبيق';
alter table public.store_notifications add column if not exists read_at timestamptz;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'store_notifications' and column_name = 'sender_role'
  ) then
    alter table public.store_notifications alter column sender_role drop not null;
  end if;
end $$;

create index if not exists store_notifications_store_idx on public.store_notifications(store_id, created_at desc);

alter table public.store_notifications enable row level security;

revoke all on public.store_notifications from anon;
grant select, insert, update on public.store_notifications to authenticated;

drop policy if exists "merchants read own store notifications" on public.store_notifications;
create policy "merchants read own store notifications"
  on public.store_notifications for select to authenticated
  using (
    exists (
      select 1 from public.stores s
      where s.id = store_notifications.store_id and s.owner_user_id = (select auth.uid())
    )
    or (select private.is_store_member(store_id))
    or (select private.is_platform_owner())
  );

drop policy if exists "merchants mark own notifications read" on public.store_notifications;
create policy "merchants mark own notifications read"
  on public.store_notifications for update to authenticated
  using (
    exists (
      select 1 from public.stores s
      where s.id = store_notifications.store_id and s.owner_user_id = (select auth.uid())
    )
    or (select private.is_store_member(store_id))
  )
  with check (
    exists (
      select 1 from public.stores s
      where s.id = store_notifications.store_id and s.owner_user_id = (select auth.uid())
    )
    or (select private.is_store_member(store_id))
  );

drop policy if exists "platform owner inserts notifications" on public.store_notifications;
create policy "platform owner inserts notifications"
  on public.store_notifications for insert to authenticated
  with check (
    (select private.is_platform_owner())
  );

create or replace function public.admin_broadcast_store_notification(
  p_title text,
  p_message text,
  p_kind text default 'message',
  p_sender text default 'إدارة بقالتي برو'
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_title text := trim(coalesce(p_title, ''));
  v_message text := trim(coalesce(p_message, ''));
  v_kind text := case when p_kind in ('reminder', 'message', 'system') then p_kind else 'message' end;
  v_sender text := coalesce(nullif(trim(coalesce(p_sender, '')), ''), 'إدارة بقالتي برو');
  v_inserted integer := 0;
begin
  if not (select private.is_platform_owner()) then
    raise exception 'Platform owner permission required';
  end if;
  if v_title = '' or v_message = '' then
    raise exception 'Notification title and message are required';
  end if;

  insert into public.store_notifications (store_id, title, message, kind, sender)
  select s.id, v_title, v_message, v_kind, v_sender
  from public.stores s;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function public.admin_broadcast_store_notification(text, text, text, text) from public, anon;
grant execute on function public.admin_broadcast_store_notification(text, text, text, text) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.store_notifications;
exception when others then
  null;
end $$;

create table if not exists public.drawer_close_reports (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  shift_id text not null,
  operator_name text not null,
  closed_by text not null,
  opening_at timestamptz not null,
  closing_at timestamptz not null,
  snapshot_json jsonb not null,
  report_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists drawer_close_reports_store_idx on public.drawer_close_reports(store_id, closing_at desc);

alter table public.drawer_close_reports enable row level security;

revoke all on public.drawer_close_reports from anon;
grant select, insert on public.drawer_close_reports to authenticated;

drop policy if exists "merchants read drawer reports" on public.drawer_close_reports;
create policy "merchants read drawer reports"
  on public.drawer_close_reports for select to authenticated
  using (
    exists (
      select 1 from public.stores s
      where s.id = drawer_close_reports.store_id and s.owner_user_id = (select auth.uid())
    )
    or (select private.is_store_member(store_id))
  );

drop policy if exists "merchants insert drawer reports" on public.drawer_close_reports;
create policy "merchants insert drawer reports"
  on public.drawer_close_reports for insert to authenticated
  with check (
    exists (
      select 1 from public.stores s
      where s.id = drawer_close_reports.store_id and s.owner_user_id = (select auth.uid())
    )
    or (select private.is_store_member(store_id))
  );

notify pgrst, 'reload schema';
