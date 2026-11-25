import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NOTIFICATION_RELAY_PREFIX,
  RELAY_BROADCAST_NAME,
  STORE_NOTIFICATIONS_SETUP_SQL,
  buildBroadcastNotificationPayloads,
  buildRelayNotificationPackageInsert,
  buildRelayPackageName,
  buildStoreNotificationInsertPayload,
  extractCloudErrorInfo,
  formatCloudNotificationError,
  isMissingColumnError,
  isMissingFunctionError,
  isMissingTableError,
  isNotNullLegacySenderRoleError,
  isNotificationRelayPackage,
  isPermissionError,
  mapCloudNotificationRow,
  parseRelayNotificationPackage,
} from './notificationsService.ts';

test('buildStoreNotificationInsertPayload produces canonical schema fields without sender_role', () => {
  const payload = buildStoreNotificationInsertPayload('store-uuid-1', {
    title: 'رسالة من الإدارة',
    message: 'مرحباً بكم في التحديث الجديد',
    kind: 'message',
    sender: 'إدارة بقالتي برو',
  });
  assert.deepEqual(payload, {
    store_id: 'store-uuid-1',
    title: 'رسالة من الإدارة',
    message: 'مرحباً بكم في التحديث الجديد',
    kind: 'message',
    sender: 'إدارة بقالتي برو',
  });
  assert.equal('sender_role' in payload, false);
});

test('buildStoreNotificationInsertPayload rejects empty title or message', () => {
  assert.throws(
    () => buildStoreNotificationInsertPayload('store-uuid-1', { title: '   ', message: 'مرحباً' }),
    /مطلوبان/,
  );
  assert.throws(
    () => buildStoreNotificationInsertPayload('store-uuid-1', { title: 'تنبيه', message: '  ' }),
    /مطلوبان/,
  );
});

test('buildBroadcastNotificationPayloads deduplicates stores and supports canonical & legacy schemas', () => {
  const canonical = buildBroadcastNotificationPayloads(
    ['store-1', 'store-2', 'store-1', '  '],
    {
      title: 'إعلان هام',
      message: 'تحديث جديد للتطبيق متاح الآن',
      kind: 'message',
      sender: 'إدارة بقالتي برو',
      created_at: '2026-11-25T12:00:00.000Z',
    },
    false,
  );
  assert.equal(canonical.length, 2);
  assert.deepEqual(canonical.map((p) => p.store_id), ['store-1', 'store-2']);
  assert.equal(canonical[0].title, 'إعلان هام');
  assert.equal(canonical[0].sender, 'إدارة بقالتي برو');
  assert.equal('sender_role' in canonical[0], false);

  const legacy = buildBroadcastNotificationPayloads(
    ['store-1'],
    {
      title: 'إعلان قديم',
      message: 'محتوى',
    },
    true,
  );
  assert.equal(legacy.length, 1);
  assert.equal(legacy[0].sender_role, 'platform_owner');
});

test('buildBroadcastNotificationPayloads rejects empty store list or empty content', () => {
  assert.throws(
    () => buildBroadcastNotificationPayloads([], { title: 'إعلان', message: 'نص' }),
    /لا توجد متاجر/,
  );
  assert.throws(
    () => buildBroadcastNotificationPayloads(['store-1'], { title: '  ', message: 'نص' }),
    /مطلوبان/,
  );
});

test('relay package helpers encode, isolate, and decode individual & broadcast notifications cleanly', () => {
  assert.equal(buildRelayPackageName('all'), RELAY_BROADCAST_NAME);
  assert.equal(buildRelayPackageName('store', 'store-abc'), `${NOTIFICATION_RELAY_PREFIX}|store|store-abc`);

  const normalPkg = { name: 'الباقة الشهرية', description: 'اشتراك لمدة 30 يوماً' };
  assert.equal(isNotificationRelayPackage(normalPkg), false);

  const storeRelay = buildRelayNotificationPackageInsert({
    scope: 'store',
    cloudStoreId: 'store-abc',
    title: 'تنبيه خاص',
    message: 'مرحباً بمتجركم',
    kind: 'reminder',
    sender: 'إدارة بقالتي برو',
    createdAt: '2026-11-25T13:00:00.000Z',
  });
  assert.equal(isNotificationRelayPackage(storeRelay), true);
  assert.equal(storeRelay.duration_days, 1);
  assert.equal(storeRelay.price, 0);
  assert.equal(storeRelay.is_active, true);

  const parsedForTarget = parseRelayNotificationPackage(
    { id: 'pkg-uuid-1', ...storeRelay },
    'store-abc',
    1,
    950000,
  );
  assert.ok(parsedForTarget);
  assert.equal(parsedForTarget.cloud_id, 'pkg:pkg-uuid-1');
  assert.equal(parsedForTarget.title, 'تنبيه خاص');
  assert.equal(parsedForTarget.kind, 'reminder');

  // Must not leak store-scoped relay message to another store
  const parsedForOtherStore = parseRelayNotificationPackage(
    { id: 'pkg-uuid-1', ...storeRelay },
    'store-xyz',
    2,
    950000,
  );
  assert.equal(parsedForOtherStore, null);

  // Broadcast relay must decode for every store
  const broadcastRelay = buildRelayNotificationPackageInsert({
    scope: 'all',
    title: 'إعلان جماعي',
    message: 'رسالة لجميع المستخدمين',
    kind: 'message',
    sender: 'إدارة بقالتي برو',
    createdAt: '2026-11-25T13:05:00.000Z',
  });
  const parsedBroadcast = parseRelayNotificationPackage(
    { id: 'pkg-uuid-2', ...broadcastRelay },
    'store-xyz',
    2,
    950001,
  );
  assert.ok(parsedBroadcast);
  assert.equal(parsedBroadcast.cloud_id, 'pkg:pkg-uuid-2');
  assert.equal(parsedBroadcast.message, 'رسالة لجميع المستخدمين');
});

test('extractCloudErrorInfo handles Supabase PostgrestError plain objects (not instanceof Error)', () => {
  const postgrestErr = {
    code: 'PGRST204',
    message: "Could not find the 'sender_role' column of 'store_notifications' in the schema cache",
    details: null,
    hint: null,
  };
  const info = extractCloudErrorInfo(postgrestErr);
  assert.equal(info.code, 'PGRST204');
  assert.equal(isMissingColumnError(info), true);
  assert.equal(isMissingTableError(info), false);
});

test('isMissingFunctionError and isNotNullLegacySenderRoleError detect RPC and legacy schema constraints', () => {
  assert.equal(
    isMissingFunctionError(
      extractCloudErrorInfo({
        code: 'PGRST202',
        message: 'Could not find the function public.admin_broadcast_store_notification',
      }),
    ),
    true,
  );
  assert.equal(
    isMissingFunctionError(
      extractCloudErrorInfo({
        code: '42883',
        message: 'function public.admin_broadcast_store_notification does not exist',
      }),
    ),
    true,
  );

  const senderRoleInfo = extractCloudErrorInfo({
    code: '23502',
    message: 'null value in column "sender_role" of relation "store_notifications" violates not-null constraint',
  });
  assert.equal(isNotNullLegacySenderRoleError(senderRoleInfo), true);
  assert.equal(formatCloudNotificationError(senderRoleInfo).needsMigrationSql, true);
});

test('formatCloudNotificationError flags missing table PGRST205 with needsMigrationSql and includes broadcast RPC', () => {
  const formatted = formatCloudNotificationError({
    code: 'PGRST205',
    message: "Could not find the table 'public.store_notifications' in the schema cache",
  });
  assert.equal(formatted.needsMigrationSql, true);
  assert.match(formatted.message, /store_notifications/);
  assert.ok(STORE_NOTIFICATIONS_SETUP_SQL.includes('grant select, insert, update on public.store_notifications to authenticated'));
  assert.ok(STORE_NOTIFICATIONS_SETUP_SQL.includes('admin_broadcast_store_notification'));
  assert.ok(STORE_NOTIFICATIONS_SETUP_SQL.includes('alter column sender_role drop not null'));
});

test('formatCloudNotificationError surfaces clear RLS permission error without needsMigrationSql', () => {
  const info = extractCloudErrorInfo({
    code: '42501',
    message: 'new row violates row-level security policy for table "store_notifications"',
  });
  assert.equal(isPermissionError(info), true);
  const formatted = formatCloudNotificationError(info);
  assert.equal(formatted.needsMigrationSql, false);
  assert.match(formatted.message, /platform_owner/);
});

test('mapCloudNotificationRow normalizes both canonical and legacy columns', () => {
  const canonical = mapCloudNotificationRow(
    {
      id: 'uuid-1',
      store_id: 'cloud-store-1',
      title: 'عنوان',
      message: 'محتوى',
      kind: 'reminder',
      sender: 'مالك التطبيق',
      read_at: null,
      created_at: '2026-11-25T10:00:00.000Z',
    },
    1,
    900000,
  );
  assert.equal(canonical.cloud_id, 'uuid-1');
  assert.equal(canonical.kind, 'reminder');
  assert.equal(canonical.read_at, null);

  const legacy = mapCloudNotificationRow(
    {
      id: 'uuid-2',
      store_id: 'cloud-store-1',
      title: 'قديم',
      message: 'نص قديم',
      sender_role: 'platform_owner',
      is_read: true,
      created_at: '2026-11-25T11:00:00.000Z',
    },
    1,
    900001,
  );
  assert.equal(legacy.cloud_id, 'uuid-2');
  assert.equal(legacy.read_at, '2026-11-25T11:00:00.000Z');
  assert.equal(legacy.kind, 'message');
});
