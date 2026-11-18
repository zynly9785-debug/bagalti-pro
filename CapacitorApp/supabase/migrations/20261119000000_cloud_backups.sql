-- Full, tenant-scoped cloud snapshots for merchant manual and scheduled backup/restore.
create table if not exists public.cloud_backups (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  record_count integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists cloud_backups_store_created_idx
  on public.cloud_backups(store_id, created_at desc);

alter table public.cloud_backups enable row level security;
revoke all on public.cloud_backups from anon;
grant select, insert, delete on public.cloud_backups to authenticated;

create policy cloud_backups_store_member_select on public.cloud_backups
  for select to authenticated
  using ((select private.is_store_member(store_id)));

create policy cloud_backups_store_member_insert on public.cloud_backups
  for insert to authenticated
  with check ((select private.is_store_member(store_id)));

create policy cloud_backups_store_member_delete on public.cloud_backups
  for delete to authenticated
  using ((select private.is_store_member(store_id)));
