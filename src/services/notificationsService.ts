import { db } from '../db/sqlite-simulation.ts';
import { supabase } from '../supabaseClient.ts';
import type { StoreNotification } from '../types/index.ts';
import { normalizePhoneForAuth } from '../utils/phoneAuth.ts';

export const STORE_NOTIFICATIONS_SETUP_SQL = `create table if not exists public.store_notifications (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  title text not null,
  message text not null,
  kind text not null check (kind in ('reminder', 'message', 'system')) default 'message',
  sender text not null default 'إدارة التطبيق',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
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
    exists (select 1 from public.stores s where s.id = store_notifications.store_id and s.owner_user_id = (select auth.uid()))
    or (select private.is_store_member(store_id))
    or (select private.is_platform_owner())
  );
drop policy if exists "merchants mark own notifications read" on public.store_notifications;
create policy "merchants mark own notifications read"
  on public.store_notifications for update to authenticated
  using (
    exists (select 1 from public.stores s where s.id = store_notifications.store_id and s.owner_user_id = (select auth.uid()))
    or (select private.is_store_member(store_id))
  )
  with check (
    exists (select 1 from public.stores s where s.id = store_notifications.store_id and s.owner_user_id = (select auth.uid()))
    or (select private.is_store_member(store_id))
  );
drop policy if exists "platform owner inserts notifications" on public.store_notifications;
create policy "platform owner inserts notifications"
  on public.store_notifications for insert to authenticated
  with check ((select private.is_platform_owner()));
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
notify pgrst, 'reload schema';`;

export interface CloudErrorInfo {
  code: string;
  message: string;
  details: string;
  hint: string;
}

export class CloudNotificationError extends Error {
  public readonly code: string;
  public readonly needsMigrationSql: boolean;

  constructor(message: string, options?: { code?: string; needsMigrationSql?: boolean }) {
    super(message);
    this.name = 'CloudNotificationError';
    this.code = options?.code || '';
    this.needsMigrationSql = Boolean(options?.needsMigrationSql);
  }
}

export function extractCloudErrorInfo(err: unknown): CloudErrorInfo {
  if (!err) return { code: '', message: '', details: '', hint: '' };
  if (typeof err === 'string') return { code: '', message: err, details: '', hint: '' };
  if (err instanceof Error) {
    const rec = err as unknown as Record<string, unknown>;
    return {
      code: String(rec.code || ''),
      message: err.message || '',
      details: String(rec.details || ''),
      hint: String(rec.hint || ''),
    };
  }
  if (typeof err === 'object') {
    const rec = err as Record<string, unknown>;
    return {
      code: String(rec.code || ''),
      message: String(rec.message || rec.error_description || rec.error || ''),
      details: String(rec.details || ''),
      hint: String(rec.hint || ''),
    };
  }
  return { code: '', message: String(err), details: '', hint: '' };
}

export function isMissingTableError(info: CloudErrorInfo): boolean {
  const combined = `${info.code} ${info.message} ${info.details}`.toLowerCase();
  return (
    info.code === 'PGRST205' ||
    info.code === '42P01' ||
    combined.includes('could not find the table') ||
    (combined.includes('relation') && combined.includes('does not exist'))
  );
}

export function isMissingColumnError(info: CloudErrorInfo): boolean {
  const combined = `${info.code} ${info.message} ${info.details}`.toLowerCase();
  return (
    info.code === 'PGRST204' ||
    info.code === '42703' ||
    combined.includes('could not find the') ||
    (combined.includes('column') && combined.includes('does not exist'))
  );
}

export function isMissingFunctionError(info: CloudErrorInfo): boolean {
  const combined = `${info.code} ${info.message} ${info.details}`.toLowerCase();
  return (
    info.code === 'PGRST202' ||
    info.code === '42883' ||
    combined.includes('could not find the function') ||
    (combined.includes('function') && combined.includes('does not exist'))
  );
}

export function isNotNullLegacySenderRoleError(info: CloudErrorInfo): boolean {
  const combined = `${info.code} ${info.message} ${info.details}`.toLowerCase();
  return info.code === '23502' && combined.includes('sender_role');
}

export function isPermissionError(info: CloudErrorInfo): boolean {
  const combined = `${info.code} ${info.message} ${info.details}`.toLowerCase();
  return (
    info.code === '42501' ||
    info.code === '401' ||
    info.code === '403' ||
    combined.includes('row-level security') ||
    combined.includes('permission denied') ||
    combined.includes('platform owner permission required') ||
    combined.includes('jwt')
  );
}

export function formatCloudNotificationError(err: unknown): CloudNotificationError {
  if (err instanceof CloudNotificationError) return err;
  const info = extractCloudErrorInfo(err);

  if (isMissingTableError(info)) {
    return new CloudNotificationError(
      'جدول رسائل إدارة التطبيق (store_notifications) غير مهيأ بعد في قاعدة Supabase. انسخ كود SQL ونفّذه مرة واحدة في Supabase SQL Editor.',
      { code: info.code, needsMigrationSql: true },
    );
  }
  if (isPermissionError(info)) {
    return new CloudNotificationError(
      'تعذر إرسال الرسالة لعدم توفر صلاحية مالك التطبيق (platform_owner) أو انتهاء الجلسة. أعد تسجيل الدخول في بوابة المالك وتأكد من تنفيذ سياسات جدول store_notifications.',
      { code: info.code, needsMigrationSql: false },
    );
  }
  if (isMissingColumnError(info) || isNotNullLegacySenderRoleError(info)) {
    return new CloudNotificationError(
      'هيكل جدول الإشعارات في Supabase يحتاج تحديثاً ليتطابق مع الحقول الجديدة. نفّذ كود SQL المرفق في Supabase SQL Editor.',
      { code: info.code, needsMigrationSql: true },
    );
  }

  return new CloudNotificationError(
    info.message || 'تعذر إرسال الرسالة سحابياً. تحقق من الاتصال بالإنترنت وحالة حساب الإدارة.',
    { code: info.code },
  );
}

function generateNotificationUuid(): string | undefined {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return undefined;
}

export function buildStoreNotificationInsertPayload(
  cloudStoreId: string,
  input: {
    id?: string;
    created_at?: string;
    title: string;
    message: string;
    kind?: StoreNotification['kind'];
    sender?: string;
  },
  legacySchema = false,
): Record<string, unknown> {
  const title = input.title.trim();
  const message = input.message.trim();
  if (!title || !message) {
    throw new CloudNotificationError('عنوان الرسالة ونصها مطلوبان.');
  }
  if (legacySchema) {
    const legacyPayload: Record<string, unknown> = {
      store_id: cloudStoreId,
      title,
      message,
      sender_role: 'platform_owner',
    };
    if (input.id) legacyPayload.id = input.id;
    if (input.created_at) legacyPayload.created_at = input.created_at;
    return legacyPayload;
  }
  const canonicalPayload: Record<string, unknown> = {
    store_id: cloudStoreId,
    title,
    message,
    kind: input.kind || 'message',
    sender: input.sender?.trim() || 'إدارة بقالتي برو',
  };
  if (input.id) canonicalPayload.id = input.id;
  if (input.created_at) canonicalPayload.created_at = input.created_at;
  return canonicalPayload;
}

export const NOTIFICATION_RELAY_PREFIX = '__BAGALATI_ADMIN_MSG__';
export const RELAY_BROADCAST_NAME = `${NOTIFICATION_RELAY_PREFIX}|all`;

export function buildRelayPackageName(scope: 'all' | 'store', cloudStoreId?: string | null): string {
  if (scope === 'all') return RELAY_BROADCAST_NAME;
  const cleanId = String(cloudStoreId || '').trim();
  if (!cleanId) {
    throw new CloudNotificationError('تعذر تحديد معرف المتجر السحابي لإرسال الرسالة.');
  }
  return `${NOTIFICATION_RELAY_PREFIX}|store|${cleanId}`;
}

export function isNotificationRelayPackage(row: { name?: unknown; description?: unknown }): boolean {
  const name = typeof row.name === 'string' ? row.name : '';
  if (name.startsWith(NOTIFICATION_RELAY_PREFIX)) return true;
  if (typeof row.description === 'string' && row.description.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(row.description) as Record<string, unknown>;
      return parsed?.__bagalati_msg === 1;
    } catch {
      return false;
    }
  }
  return false;
}

export function buildRelayNotificationPackageInsert(params: {
  scope: 'all' | 'store';
  cloudStoreId?: string | null;
  title: string;
  message: string;
  kind?: StoreNotification['kind'];
  sender?: string;
  createdAt?: string;
}): {
  name: string;
  duration_days: number;
  price: number;
  description: string;
  is_active: boolean;
} {
  const title = params.title.trim();
  const message = params.message.trim();
  if (!title || !message) {
    throw new CloudNotificationError('عنوان الرسالة ونصها مطلوبان.');
  }
  const kind: StoreNotification['kind'] =
    params.kind === 'reminder' || params.kind === 'system' ? params.kind : 'message';
  const sender = params.sender?.trim() || 'إدارة بقالتي برو';
  const createdAt = params.createdAt || new Date().toISOString();
  const targetStoreId = params.scope === 'store' ? String(params.cloudStoreId || '').trim() || null : null;

  return {
    name: buildRelayPackageName(params.scope, targetStoreId),
    duration_days: 1,
    price: 0,
    description: JSON.stringify({
      __bagalati_msg: 1,
      scope: params.scope,
      target_store_id: targetStoreId,
      title,
      message,
      kind,
      sender,
      created_at: createdAt,
    }),
    is_active: true,
  };
}

export function parseRelayNotificationPackage(
  row: Record<string, unknown>,
  targetCloudStoreId: string,
  localStoreId: number,
  fallbackId: number,
): ReturnType<typeof mapCloudNotificationRow> | null {
  if (!isNotificationRelayPackage(row)) return null;
  const rawDesc = typeof row.description === 'string' ? row.description : '';
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(rawDesc) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!parsed || parsed.__bagalati_msg !== 1) return null;

  const scope = parsed.scope === 'all' ? 'all' : 'store';
  const rowTargetStoreId = parsed.target_store_id ? String(parsed.target_store_id) : '';
  if (scope === 'store' && rowTargetStoreId !== targetCloudStoreId) {
    return null;
  }

  const kindRaw = String(parsed.kind || 'message');
  const kind: StoreNotification['kind'] =
    kindRaw === 'reminder' || kindRaw === 'system' ? kindRaw : 'message';
  const createdAt = String(parsed.created_at || row.created_at || new Date().toISOString());

  return {
    fallback_id: fallbackId,
    store_id: localStoreId,
    cloud_id: `pkg:${String(row.id || `${targetCloudStoreId}-${createdAt}`)}`,
    cloud_store_id: targetCloudStoreId,
    title: String(parsed.title || 'رسالة من إدارة التطبيق'),
    message: String(parsed.message || ''),
    kind,
    sender: String(parsed.sender || 'إدارة بقالتي برو'),
    created_at: createdAt,
    read_at: null,
  };
}

export function buildBroadcastNotificationPayloads(
  storeIds: string[],
  input: {
    title: string;
    message: string;
    kind?: StoreNotification['kind'];
    sender?: string;
    created_at?: string;
  },
  legacySchema = false,
): Record<string, unknown>[] {
  const uniqueIds = Array.from(new Set(storeIds.map((id) => id.trim()).filter(Boolean)));
  if (!uniqueIds.length) {
    throw new CloudNotificationError('لا توجد متاجر مسجلة لإرسال الرسالة الجماعية إليها حالياً.');
  }
  return uniqueIds.map((storeId) =>
    buildStoreNotificationInsertPayload(
      storeId,
      {
        ...input,
        id: generateNotificationUuid(),
      },
      legacySchema,
    ),
  );
}

export function mapCloudNotificationRow(
  row: Record<string, unknown>,
  localStoreId: number,
  fallbackId: number,
): {
  cloud_id: string;
  cloud_store_id: string | null;
  title: string;
  message: string;
  kind: StoreNotification['kind'];
  sender: string;
  created_at: string;
  read_at: string | null;
  fallback_id: number;
  store_id: number;
} {
  const kindRaw = String(row.kind || 'message');
  const kind: StoreNotification['kind'] =
    kindRaw === 'reminder' || kindRaw === 'system' ? kindRaw : 'message';
  const createdAt = String(row.created_at || new Date().toISOString());
  const readAt = row.read_at
    ? String(row.read_at)
    : row.is_read
      ? createdAt
      : null;

  return {
    fallback_id: fallbackId,
    store_id: localStoreId,
    cloud_id: String(row.id || `${localStoreId}-${createdAt}`),
    cloud_store_id: row.store_id ? String(row.store_id) : null,
    title: String(row.title || 'رسالة من إدارة التطبيق'),
    message: String(row.message || ''),
    kind,
    sender: String(row.sender || (row.sender_role === 'platform_owner' ? 'إدارة التطبيق' : 'إدارة التطبيق')),
    created_at: createdAt,
    read_at: readAt,
  };
}

function mirrorLocalStoreNotification(params: {
  cloudStoreId: string;
  storePhone?: string;
  title: string;
  message: string;
  kind?: StoreNotification['kind'];
  sender?: string;
  cloudId?: string | null;
  createdAt?: string;
}) {
  if (!params.storePhone) return;
  const targetPhone = normalizePhoneForAuth(params.storePhone);
  const localUser =
    db.findUserByPhone(targetPhone) ||
    db.getAllStores().find((u) => normalizePhoneForAuth(u.phone) === targetPhone);
  if (!localUser) return;
  db.sendStoreNotification(localUser.id, {
    title: params.title,
    message: params.message,
    kind: params.kind || 'message',
    sender: params.sender || 'إدارة بقالتي برو',
    cloudStoreId: params.cloudStoreId,
    cloudId: params.cloudId ?? null,
    createdAt: params.createdAt,
  });
}

async function requireActiveOwnerCloudSession() {
  if (!supabase) {
    throw new CloudNotificationError('الاتصال السحابي غير مهيأ في هذه النسخة.');
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new CloudNotificationError('لا يوجد اتصال بالإنترنت لإرسال الرسالة سحابياً.');
  }
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    throw new CloudNotificationError(
      'انتهت جلسة الدخول السحابية. أغلق لوحة المالك وأعد فتحها وتسجيل الدخول.',
    );
  }
  return supabase;
}

async function insertRelayNotificationIntoPackages(params: {
  scope: 'all' | 'store';
  cloudStoreId?: string | null;
  title: string;
  message: string;
  kind?: StoreNotification['kind'];
  sender?: string;
  createdAt?: string;
}): Promise<{ cloudId: string | null }> {
  const client = await requireActiveOwnerCloudSession();
  const payload = buildRelayNotificationPackageInsert(params);
  const { data, error } = await client
    .from('subscription_packages')
    .insert(payload)
    .select('id')
    .single();
  if (error) {
    throw formatCloudNotificationError(error);
  }
  return { cloudId: data?.id ? `pkg:${String(data.id)}` : null };
}

export async function sendCloudStoreNotification(params: {
  cloudStoreId: string;
  storePhone?: string;
  title: string;
  message: string;
  kind?: StoreNotification['kind'];
  sender?: string;
}): Promise<{ cloudId: string | null }> {
  const client = await requireActiveOwnerCloudSession();
  const generatedId = generateNotificationUuid();
  const createdAt = new Date().toISOString();
  let finalCloudId: string | null = generatedId || null;

  // Insert without chaining .select() so PostgreSQL does not require SELECT RLS on insert
  const canonicalPayload = buildStoreNotificationInsertPayload(
    params.cloudStoreId,
    { ...params, id: generatedId, created_at: createdAt },
    false,
  );

  const firstAttempt = await client.from('store_notifications').insert(canonicalPayload);
  if (firstAttempt.error) {
    const firstInfo = extractCloudErrorInfo(firstAttempt.error);
    if (isMissingTableError(firstInfo)) {
      const relayRes = await insertRelayNotificationIntoPackages({
        scope: 'store',
        cloudStoreId: params.cloudStoreId,
        title: params.title,
        message: params.message,
        kind: params.kind,
        sender: params.sender,
        createdAt,
      });
      finalCloudId = relayRes.cloudId;
    } else if (isMissingColumnError(firstInfo) || isNotNullLegacySenderRoleError(firstInfo)) {
      const legacyPayload = buildStoreNotificationInsertPayload(
        params.cloudStoreId,
        { ...params, id: generatedId, created_at: createdAt },
        true,
      );
      const retryAttempt = await client.from('store_notifications').insert(legacyPayload);
      if (retryAttempt.error) {
        const retryInfo = extractCloudErrorInfo(retryAttempt.error);
        if (isMissingTableError(retryInfo) || isMissingColumnError(retryInfo) || isNotNullLegacySenderRoleError(retryInfo)) {
          const relayRes = await insertRelayNotificationIntoPackages({
            scope: 'store',
            cloudStoreId: params.cloudStoreId,
            title: params.title,
            message: params.message,
            kind: params.kind,
            sender: params.sender,
            createdAt,
          });
          finalCloudId = relayRes.cloudId;
        } else {
          throw formatCloudNotificationError(retryAttempt.error);
        }
      }
    } else {
      throw formatCloudNotificationError(firstAttempt.error);
    }
  }

  mirrorLocalStoreNotification({
    cloudStoreId: params.cloudStoreId,
    storePhone: params.storePhone,
    title: params.title,
    message: params.message,
    kind: params.kind,
    sender: params.sender,
    cloudId: finalCloudId,
    createdAt,
  });

  return { cloudId: finalCloudId };
}

export async function sendCloudBroadcastNotification(params: {
  stores?: Array<{ id: string; phone?: string }>;
  title: string;
  message: string;
  kind?: StoreNotification['kind'];
  sender?: string;
}): Promise<{ sentCount: number; method: 'rpc' | 'batch' | 'relay' }> {
  const client = await requireActiveOwnerCloudSession();
  const title = params.title.trim();
  const message = params.message.trim();
  const sender = params.sender?.trim() || 'إدارة بقالتي برو';
  const kind = params.kind || 'message';

  if (!title || !message) {
    throw new CloudNotificationError('عنوان الرسالة ونصها مطلوبان.');
  }

  // Always load the authoritative cloud stores list if available so filtered UI views never skip a user
  let targetStores: Array<{ id: string; phone?: string }> = params.stores || [];
  const freshStoresRes = await client.from('stores').select('id,phone');
  if (!freshStoresRes.error && Array.isArray(freshStoresRes.data)) {
    targetStores = freshStoresRes.data.map((row) => ({
      id: String(row.id),
      phone: row.phone ? String(row.phone) : undefined,
    }));
  }

  const createdAt = new Date().toISOString();

  // Prefer server-side RPC for atomic all-stores insertion
  const rpcRes = await client.rpc('admin_broadcast_store_notification', {
    p_title: title,
    p_message: message,
    p_kind: kind,
    p_sender: sender,
  });

  if (!rpcRes.error) {
    const sentCount = Number(rpcRes.data ?? targetStores.length);
    for (const store of targetStores) {
      mirrorLocalStoreNotification({
        cloudStoreId: store.id,
        storePhone: store.phone,
        title,
        message,
        kind,
        sender,
        createdAt,
      });
    }
    return { sentCount, method: 'rpc' };
  }

  const rpcInfo = extractCloudErrorInfo(rpcRes.error);
  if (!isMissingFunctionError(rpcInfo) && !isMissingTableError(rpcInfo)) {
    throw formatCloudNotificationError(rpcRes.error);
  }

  const sendViaRelay = async (): Promise<{ sentCount: number; method: 'relay' }> => {
    const relayRes = await insertRelayNotificationIntoPackages({
      scope: 'all',
      title,
      message,
      kind,
      sender,
      createdAt,
    });
    for (const store of targetStores) {
      mirrorLocalStoreNotification({
        cloudStoreId: store.id,
        storePhone: store.phone,
        title,
        message,
        kind,
        sender,
        cloudId: relayRes.cloudId,
        createdAt,
      });
    }
    return { sentCount: targetStores.length || 1, method: 'relay' };
  };

  if (isMissingTableError(rpcInfo)) {
    return sendViaRelay();
  }

  // Fallback 1: chunked batch insert into store_notifications when RPC is not installed yet
  const storeIds = targetStores.map((s) => s.id);
  const canonicalRows = buildBroadcastNotificationPayloads(
    storeIds,
    { title, message, kind, sender, created_at: createdAt },
    false,
  );

  const chunkSize = 100;
  let useLegacy = false;
  const legacyRows = buildBroadcastNotificationPayloads(
    storeIds,
    { title, message, kind, sender, created_at: createdAt },
    true,
  );

  for (let i = 0; i < canonicalRows.length; i += chunkSize) {
    const batch = (useLegacy ? legacyRows : canonicalRows).slice(i, i + chunkSize);
    const attempt = await client.from('store_notifications').insert(batch);
    if (attempt.error) {
      const info = extractCloudErrorInfo(attempt.error);
      if (isMissingTableError(info)) {
        return sendViaRelay();
      }
      if (!useLegacy && (isMissingColumnError(info) || isNotNullLegacySenderRoleError(info))) {
        useLegacy = true;
        const retry = await client.from('store_notifications').insert(legacyRows.slice(i, i + chunkSize));
        if (retry.error) {
          const retryInfo = extractCloudErrorInfo(retry.error);
          if (isMissingTableError(retryInfo) || isMissingColumnError(retryInfo) || isNotNullLegacySenderRoleError(retryInfo)) {
            return sendViaRelay();
          }
          throw formatCloudNotificationError(retry.error);
        }
      } else {
        throw formatCloudNotificationError(attempt.error);
      }
    }
  }

  const activePayloads = useLegacy ? legacyRows : canonicalRows;
  targetStores.forEach((store, idx) => {
    const rowId = activePayloads[idx]?.id ? String(activePayloads[idx].id) : null;
    mirrorLocalStoreNotification({
      cloudStoreId: store.id,
      storePhone: store.phone,
      title,
      message,
      kind,
      sender,
      cloudId: rowId,
      createdAt,
    });
  });

  return { sentCount: activePayloads.length, method: 'batch' };
}

export async function resolveCloudStoreId(localStoreId?: number): Promise<string | null> {
  const prefs = db.getSharedPreferences();
  if (prefs.cloud_store_id) return prefs.cloud_store_id;
  if (!supabase || (typeof navigator !== 'undefined' && !navigator.onLine)) return null;

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return null;

  const { data: storeRow } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_user_id', userId)
    .maybeSingle();

  if (storeRow?.id) {
    const resolved = String(storeRow.id);
    if (!localStoreId || !prefs.store_id || prefs.store_id === localStoreId) {
      db.saveSharedPreferences({ cloud_store_id: resolved });
    }
    return resolved;
  }
  return null;
}

export async function syncCloudStoreNotifications(
  localStoreId: number,
  cloudStoreId?: string | null,
  options?: { throwOnError?: boolean },
): Promise<StoreNotification[]> {
  if (!supabase || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    if (options?.throwOnError && supabase && typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new CloudNotificationError('لا يوجد اتصال بالإنترنت لتحديث الرسائل من السحابة.');
    }
    return db.getStoreNotifications(localStoreId);
  }

  const resolvedCloudStoreId = cloudStoreId || (await resolveCloudStoreId(localStoreId));
  if (!resolvedCloudStoreId) {
    return db.getStoreNotifications(localStoreId);
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    return db.getStoreNotifications(localStoreId);
  }

  let rows: Record<string, unknown>[] = [];
  const canonicalSelect = await supabase
    .from('store_notifications')
    .select('id,store_id,title,message,kind,sender,read_at,created_at')
    .eq('store_id', resolvedCloudStoreId)
    .order('created_at', { ascending: false });

  if (canonicalSelect.error) {
    const info = extractCloudErrorInfo(canonicalSelect.error);
    if (isMissingTableError(info)) {
      rows = [];
    } else if (isMissingColumnError(info)) {
      const legacySelect = await supabase
        .from('store_notifications')
        .select('id,store_id,title,message,sender_role,is_read,created_at')
        .eq('store_id', resolvedCloudStoreId)
        .order('created_at', { ascending: false });
      if (legacySelect.error) {
        const legacyInfo = extractCloudErrorInfo(legacySelect.error);
        if (!isMissingTableError(legacyInfo) && options?.throwOnError) {
          throw formatCloudNotificationError(legacySelect.error);
        }
      } else if (legacySelect.data) {
        rows = legacySelect.data as Record<string, unknown>[];
      }
    } else if (options?.throwOnError) {
      throw formatCloudNotificationError(canonicalSelect.error);
    }
  } else if (canonicalSelect.data) {
    rows = canonicalSelect.data as Record<string, unknown>[];
  }

  const relaySelect = await supabase
    .from('subscription_packages')
    .select('id,name,description,is_active,created_at')
    .eq('is_active', true)
    .in('name', [RELAY_BROADCAST_NAME, buildRelayPackageName('store', resolvedCloudStoreId)])
    .order('created_at', { ascending: false });

  const mappedPrimary = rows.map((row, idx) => mapCloudNotificationRow(row, localStoreId, 900000 + idx));
  const mappedRelay = (!relaySelect.error && Array.isArray(relaySelect.data) ? relaySelect.data : [])
    .map((row, idx) =>
      parseRelayNotificationPackage(
        row as Record<string, unknown>,
        resolvedCloudStoreId,
        localStoreId,
        950000 + idx,
      ),
    )
    .filter((item): item is ReturnType<typeof mapCloudNotificationRow> => Boolean(item));

  const combined = [...mappedPrimary, ...mappedRelay];
  if (!combined.length) {
    return db.getStoreNotifications(localStoreId);
  }

  return db.upsertCloudNotifications(localStoreId, combined);
}

export async function markCloudNotificationRead(
  localStoreId: number,
  notification: Pick<StoreNotification, 'id' | 'cloud_id'>,
): Promise<void> {
  const updated = db.markStoreNotificationRead(localStoreId, notification.id);
  const cloudId = notification.cloud_id || updated?.cloud_id;
  if (!supabase || !cloudId || cloudId.startsWith('pkg:') || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return;

  const nowIso = updated?.read_at || new Date().toISOString();
  const res = await supabase
    .from('store_notifications')
    .update({ read_at: nowIso })
    .eq('id', cloudId);

  if (res.error && isMissingColumnError(extractCloudErrorInfo(res.error))) {
    await supabase.from('store_notifications').update({ is_read: true }).eq('id', cloudId);
  }
}

export async function markAllCloudNotificationsRead(
  localStoreId: number,
  notifications: StoreNotification[],
): Promise<StoreNotification[]> {
  const unreadCloudIds = notifications
    .filter((n) => !n.read_at && Boolean(n.cloud_id) && !String(n.cloud_id).startsWith('pkg:'))
    .map((n) => String(n.cloud_id));

  const updatedList = db.markAllStoreNotificationsRead(localStoreId);

  if (!supabase || !unreadCloudIds.length || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return updatedList;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return updatedList;

  const nowIso = new Date().toISOString();
  const res = await supabase
    .from('store_notifications')
    .update({ read_at: nowIso })
    .in('id', unreadCloudIds);

  if (res.error && isMissingColumnError(extractCloudErrorInfo(res.error))) {
    await supabase.from('store_notifications').update({ is_read: true }).in('id', unreadCloudIds);
  }

  return updatedList;
}

export function subscribeToStoreNotifications(
  localStoreId: number,
  cloudStoreId: string | null | undefined,
  onNotificationsChanged: (list: StoreNotification[]) => void,
): () => void {
  const handleLocalEvent = (event: Event) => {
    const custom = event as CustomEvent<{ storeId?: number }>;
    if (!custom.detail?.storeId || custom.detail.storeId === localStoreId) {
      onNotificationsChanged(db.getStoreNotifications(localStoreId));
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('bagalati:notifications-changed', handleLocalEvent);
  }

  let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
  if (supabase && cloudStoreId) {
    channel = supabase
      .channel(`store-notifications-${cloudStoreId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'store_notifications',
          filter: `store_id=eq.${cloudStoreId}`,
        },
        () => {
          void syncCloudStoreNotifications(localStoreId, cloudStoreId).then(onNotificationsChanged).catch(() => undefined);
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscription_packages',
        },
        () => {
          void syncCloudStoreNotifications(localStoreId, cloudStoreId).then(onNotificationsChanged).catch(() => undefined);
        },
      )
      .subscribe();
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('bagalati:notifications-changed', handleLocalEvent);
    }
    if (channel && supabase) {
      void supabase.removeChannel(channel);
    }
  };
}
