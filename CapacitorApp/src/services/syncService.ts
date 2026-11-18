import { db } from '../db/sqlite-simulation.ts';
import type { DatabaseState, } from '../db/sqlite-simulation.ts';
import type { SharedPreferences } from '../types/index.ts';
import { supabase } from '../supabaseClient.ts';

type Entity = 'product' | 'customer' | 'sale' | 'sale_item' | 'return' | 'expense' | 'quick_product' | 'store_preferences' | 'customer_payment' | 'customer_ledger' | 'customer_payment_plan' | 'customer_communication' | 'customer_merge' | 'drawer_shift';
type SyncRow = { store_id: string; entity: Entity; record_id: string; record_data: Record<string, unknown>; device_id: string; updated_at?: string; deleted_at?: string | null };
type SyncResult = { uploaded: number; downloaded: number; completedAt: string };

const getUuid = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  throw new Error('هذا الجهاز لا يدعم إنشاء معرّفات آمنة للمزامنة.');
};
const idFor = (row: { sync_id?: string }) => row.sync_id || getUuid();
const chunk = <T,>(rows: T[], size: number) => Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size));
const numericId = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const syncTime = (data: Record<string, unknown>, fallback?: string) => String(data._sync_updated_at || fallback || '1970-01-01T00:00:00.000Z');

function attachSyncIds(state: DatabaseState, storeId: number) {
  for (const entity of ['products', 'customers', 'sales', 'sale_items', 'returns', 'expenses', 'customer_payments', 'customer_ledger', 'customer_payment_plans', 'customer_communications', 'customer_merge_records', 'drawer_shifts'] as const) {
    const list = state[entity] as Array<{ sync_id?: string; store_id?: number }>;
    for (const row of list) if (row.store_id === undefined || row.store_id === storeId) row.sync_id = idFor(row);
  }
  state.quick_products = (state.quick_products || []).map((row) => ({ ...row, sync_id: row.sync_id || getUuid() }));
}

function buildRows(state: DatabaseState, preferences: SharedPreferences, cloudStoreId: string, localStoreId: number, deviceId: string): SyncRow[] {
  const productSync = new Map(state.products.map((x) => [x.id, x.sync_id!]));
  const customerSync = new Map(state.customers.map((x) => [x.id, x.sync_id!]));
  const saleSync = new Map(state.sales.map((x) => [x.id, x.sync_id!]));
  const rows: SyncRow[] = [];
  const append = (entity: Entity, syncId: string, data: Record<string, unknown>) => {
    const updatedAt = syncTime(data, new Date().toISOString());
    rows.push({ store_id: cloudStoreId, entity, record_id: syncId, record_data: { ...data, _sync_updated_at: updatedAt }, device_id: deviceId, updated_at: updatedAt });
  };

  for (const row of state.products.filter((x) => x.store_id === localStoreId)) append('product', row.sync_id!, { ...row, store_id: localStoreId });
  for (const row of state.customers.filter((x) => x.store_id === localStoreId)) append('customer', row.sync_id!, { ...row, store_id: localStoreId });
  for (const row of state.sales.filter((x) => x.store_id === localStoreId)) append('sale', row.sync_id!, {
    ...row, _customer_sync_id: row.customer_id ? customerSync.get(row.customer_id) || null : null,
  });
  for (const row of state.sale_items.filter((x) => saleSync.has(x.sale_id))) append('sale_item', row.sync_id!, {
    ...row, _sale_sync_id: saleSync.get(row.sale_id) || null, _product_sync_id: productSync.get(row.product_id) || null,
  });
  for (const row of state.returns.filter((x) => x.store_id === localStoreId)) append('return', row.sync_id!, {
    ...row, _sale_sync_id: row.sale_id ? saleSync.get(row.sale_id) || null : null,
    _product_sync_id: productSync.get(row.product_id) || null,
    _customer_sync_id: row.customer_id ? customerSync.get(row.customer_id) || null : null,
  });
  for (const row of (state.expenses || []).filter((x) => x.store_id === localStoreId)) append('expense', row.sync_id!, { ...row });
  for (const row of (state.customer_payments || []).filter((x) => x.store_id === localStoreId)) append('customer_payment', row.sync_id || idFor(row), { ...row, _customer_sync_id: row.customer_id ? customerSync.get(row.customer_id) || null : null });
  for (const row of (state.customer_ledger || []).filter((x) => x.store_id === localStoreId)) append('customer_ledger', row.sync_id || idFor(row), { ...row, _customer_sync_id: row.customer_id ? customerSync.get(row.customer_id) || null : null });
  for (const row of (state.customer_payment_plans || []).filter((x) => x.store_id === localStoreId)) append('customer_payment_plan', row.sync_id || idFor(row), { ...row, _customer_sync_id: row.customer_id ? customerSync.get(row.customer_id) || null : null });
  for (const row of (state.customer_communications || []).filter((x) => x.store_id === localStoreId)) append('customer_communication', row.sync_id || idFor(row), { ...row, _customer_sync_id: row.customer_id ? customerSync.get(row.customer_id) || null : null });
  for (const row of (state.customer_merge_records || []).filter((x) => x.store_id === localStoreId)) append('customer_merge', row.sync_id || idFor(row), { ...row });
  for (const row of (state.drawer_shifts || []).filter((x) => x.store_id === localStoreId)) append('drawer_shift', row.sync_id || idFor(row), { ...row });
  for (const row of (state.quick_products || []).filter((x) => x.store_id === localStoreId)) append('quick_product', row.sync_id!, {
    ...row, _product_sync_id: productSync.get(row.product_id) || null,
  });

  const preferenceId = preferences.store_preferences_sync_id || getUuid();
  const preferenceRecord = {
    currency_symbol: preferences.currency_symbol || 'ر.ي',
    receipt_footer: preferences.receipt_footer || '',
    receipt_width_mm: preferences.receipt_width_mm || '80',
    low_stock_alerts_enabled: preferences.low_stock_alerts_enabled !== false,
  };
  append('store_preferences', preferenceId, { ...preferenceRecord, _sync_updated_at: preferences.store_preferences_updated_at || '1970-01-01T00:00:00.000Z' });
  return rows;
}

function mergeRemote(state: DatabaseState, remoteRows: SyncRow[], localStoreId: number) {
  const byEntity = new Map<Entity, SyncRow[]>();
  for (const row of remoteRows) byEntity.set(row.entity, [...(byEntity.get(row.entity) || []), row]);
  const productMap = new Map<string, number>();
  const customerMap = new Map<string, number>();
  const saleMap = new Map<string, number>();
  const nextId = (items: Array<{ id: number }>) => items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;

  const mergeEntity = <T extends { id: number; sync_id?: string; store_id?: number }>(
    local: T[], remote: SyncRow[], map: Map<string, number>, kind: 'product' | 'customer' | 'sale',
  ) => {
    const index = new Map(local.map((row, i) => [row.sync_id, i]));
    for (const remoteRow of remote) {
      const data = remoteRow.record_data || {};
      const syncId = remoteRow.record_id;
      const existingIndex = index.get(syncId);
      const existing = existingIndex === undefined ? undefined : local[existingIndex];
      const id = existing?.id ?? nextId(local);
      const remoteIsNewer = !existing || syncTime(data, remoteRow.updated_at) > syncTime(existing as Record<string, unknown>);
      if (existing && !remoteIsNewer) { map.set(syncId, id); continue; }
      const merged = { ...data, id, sync_id: syncId, store_id: localStoreId } as T;
      if (kind === 'sale') {
        const customerSyncId = String(data._customer_sync_id || '');
        (merged as Record<string, unknown>).customer_id = customerSyncId ? customerMap.get(customerSyncId) ?? null : null;
      }
      if (existingIndex === undefined) { local.push(merged); index.set(syncId, local.length - 1); }
      else local[existingIndex] = merged;
      map.set(syncId, id);
    }
  };

  mergeEntity(state.products as Array<{ id: number; sync_id?: string; store_id?: number }>, byEntity.get('product') || [], productMap, 'product');
  mergeEntity(state.customers as Array<{ id: number; sync_id?: string; store_id?: number }>, byEntity.get('customer') || [], customerMap, 'customer');
  mergeEntity(state.sales as Array<{ id: number; sync_id?: string; store_id?: number }>, byEntity.get('sale') || [], saleMap, 'sale');

  const mergeDependent = <T extends { id: number; sync_id?: string; store_id?: number }>(
    local: T[], remote: SyncRow[], setRelations: (record: Record<string, unknown>) => void,
  ) => {
    const index = new Map(local.map((row, i) => [row.sync_id, i]));
    for (const remoteRow of remote) {
      const data = { ...remoteRow.record_data };
      setRelations(data);
      const syncId = remoteRow.record_id;
      const existingIndex = index.get(syncId);
      const existing = existingIndex === undefined ? undefined : local[existingIndex];
      const remoteIsNewer = !existing || syncTime(data, remoteRow.updated_at) > syncTime(existing as Record<string, unknown>);
      if (existing && !remoteIsNewer) continue;
      const merged = { ...data, id: existing?.id ?? nextId(local), sync_id: syncId, store_id: localStoreId } as T;
      if (existingIndex === undefined) { local.push(merged); index.set(syncId, local.length - 1); }
      else local[existingIndex] = merged;
    }
  };

  mergeDependent(state.sale_items as Array<{ id: number; sync_id?: string; store_id?: number }>, byEntity.get('sale_item') || [], (data) => {
    data.sale_id = saleMap.get(String(data._sale_sync_id || '')) ?? numericId(data.sale_id, 0);
    data.product_id = productMap.get(String(data._product_sync_id || '')) ?? numericId(data.product_id, 0);
    delete data._sale_sync_id; delete data._product_sync_id;
  });
  mergeDependent(state.returns as Array<{ id: number; sync_id?: string; store_id?: number }>, byEntity.get('return') || [], (data) => {
    data.sale_id = data._sale_sync_id ? saleMap.get(String(data._sale_sync_id)) ?? null : null;
    data.product_id = productMap.get(String(data._product_sync_id || '')) ?? numericId(data.product_id, 0);
    data.customer_id = data._customer_sync_id ? customerMap.get(String(data._customer_sync_id)) ?? null : null;
    delete data._sale_sync_id; delete data._product_sync_id; delete data._customer_sync_id;
  });
  mergeDependent(state.expenses as Array<{ id: number; sync_id?: string; store_id?: number }>, byEntity.get('expense') || [], () => {});
  mergeDependent((state.customer_payments || []) as Array<{ id: number; sync_id?: string; store_id?: number }>, byEntity.get('customer_payment') || [], (data) => {
    data.customer_id = data._customer_sync_id ? customerMap.get(String(data._customer_sync_id)) ?? null : null; delete data._customer_sync_id;
  });
  mergeDependent((state.customer_ledger || []) as Array<{ id: number; sync_id?: string; store_id?: number }>, byEntity.get('customer_ledger') || [], (data) => {
    data.customer_id = data._customer_sync_id ? customerMap.get(String(data._customer_sync_id)) ?? null : null; delete data._customer_sync_id;
  });
  mergeDependent((state.customer_payment_plans || []) as Array<{ id: number; sync_id?: string; store_id?: number }>, byEntity.get('customer_payment_plan') || [], (data) => {
    data.customer_id = data._customer_sync_id ? customerMap.get(String(data._customer_sync_id)) ?? null : null; delete data._customer_sync_id;
  });
  mergeDependent((state.customer_communications || []) as Array<{ id: number; sync_id?: string; store_id?: number }>, byEntity.get('customer_communication') || [], (data) => {
    data.customer_id = data._customer_sync_id ? customerMap.get(String(data._customer_sync_id)) ?? null : null; delete data._customer_sync_id;
  });
  mergeDependent((state.customer_merge_records || []) as Array<{ id: number; sync_id?: string; store_id?: number }>, byEntity.get('customer_merge') || [], () => {});
  mergeDependent((state.drawer_shifts || []) as Array<{ id: number; sync_id?: string; store_id?: number }>, byEntity.get('drawer_shift') || [], () => {});

  const quickLocal = state.quick_products || [];
  const quickIndex = new Map(quickLocal.map((row, i) => [row.sync_id, i]));
  for (const remoteRow of byEntity.get('quick_product') || []) {
    const data = remoteRow.record_data;
    const syncId = remoteRow.record_id;
    const productId = productMap.get(String(data._product_sync_id || '')) ?? numericId(data.product_id, 0);
    const merged = { store_id: localStoreId, product_id: productId, sync_id: syncId };
    const oldIndex = quickIndex.get(syncId);
    if (oldIndex === undefined) { quickLocal.push(merged); quickIndex.set(syncId, quickLocal.length - 1); }
    else quickLocal[oldIndex] = merged;
  }
  state.quick_products = quickLocal;

  const prefRow = (byEntity.get('store_preferences') || []).sort((a, b) => syncTime(b.record_data, b.updated_at).localeCompare(syncTime(a.record_data, a.updated_at)))[0];
  return prefRow && syncTime(prefRow.record_data, prefRow.updated_at) > (db.getSharedPreferences().store_preferences_updated_at || '')
    ? { ...prefRow.record_data, _sync_updated_at: syncTime(prefRow.record_data, prefRow.updated_at) }
    : undefined;
}

let activeSync: Promise<SyncResult> | null = null;

export type CloudSnapshotResult = { id: string; createdAt: string; recordCount: number };

export async function createCloudSnapshot(): Promise<CloudSnapshotResult> {
  if (!supabase) throw new Error('الاتصال السحابي غير مهيأ.');
  const prefs = db.getSharedPreferences();
  if (!prefs.cloud_store_id) throw new Error('سجّل دخول المتجر وسجّل المزامنة السحابية أولاً.');
  await synchronizeStore();
  const raw = db.getRawState();
  const snapshot = {
    ...JSON.parse(JSON.stringify(raw)) as DatabaseState,
    users: raw.users.map((user) => ({ ...user, password: '', pin_code: '' })),
  };
  const recordCount = ['users','products','customers','sales','sale_items','returns','expenses','customer_payments','customer_ledger','customer_payment_plans','customer_communications','customer_merge_records','drawer_shifts'].reduce((count, key) => count + (Array.isArray((raw as unknown as Record<string, unknown>)[key]) ? ((raw as unknown as Record<string, unknown>)[key] as unknown[]).length : 0), 0);
  const { data, error } = await supabase.from('cloud_backups').insert({
    store_id: prefs.cloud_store_id,
    name: `نسخة ${new Date().toLocaleString('ar-YE')}`,
    payload: snapshot,
    record_count: recordCount,
  }).select('id,created_at,record_count').single();
  if (error) throw error;
  return { id: String(data.id), createdAt: String(data.created_at), recordCount: Number(data.record_count || recordCount) };
}

export async function restoreCloudSnapshot(): Promise<CloudSnapshotResult> {
  if (!supabase) throw new Error('الاتصال السحابي غير مهيأ.');
  const prefs = db.getSharedPreferences();
  if (!prefs.cloud_store_id) throw new Error('سجّل دخول المتجر وسجّل المزامنة السحابية أولاً.');
  const { data, error } = await supabase.from('cloud_backups').select('id,created_at,record_count,payload').eq('store_id', prefs.cloud_store_id).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('لا توجد نسخة سحابية كاملة محفوظة لهذا المتجر.');
  const restored = data.payload as unknown as DatabaseState;
  if (!restored || !Array.isArray(restored.users) || !Array.isArray(restored.products) || !Array.isArray(restored.sales)) {
    throw new Error('النسخة السحابية غير صالحة أو غير مكتملة؛ لم يتم تغيير البيانات المحلية.');
  }
  const localUsers = db.getRawState().users;
  const users = restored.users.map((user) => {
    const localUser = localUsers.find((candidate) => candidate.id === user.id || candidate.phone === user.phone);
    return localUser ? { ...user, password: localUser.password, pin_code: localUser.pin_code } : user;
  });
  db.restoreFromRawState({ ...restored, users });
  await synchronizeStore();
  return { id: String(data.id), createdAt: String(data.created_at), recordCount: Number(data.record_count || 0) };
}

export async function synchronizeStore(): Promise<SyncResult> {
  if (activeSync) return activeSync;
  activeSync = (async () => {
    if (!supabase) throw new Error('الاتصال السحابي غير مهيأ.');
    if (!navigator.onLine) throw new Error('الجهاز غير متصل بالإنترنت؛ ستتم المزامنة عند عودة الاتصال.');
    const prefs = db.getSharedPreferences();
    const cloudStoreId = prefs.cloud_store_id;
    const localStoreId = prefs.store_id;
    if (!cloudStoreId || !localStoreId) throw new Error('سجّل الدخول إلى المتجر قبل المزامنة.');

    const state = JSON.parse(JSON.stringify(db.getRawState())) as DatabaseState;
    const deviceId = prefs.sync_device_id || getUuid();
    const preferenceId = prefs.store_preferences_sync_id || getUuid();
    db.saveSharedPreferences({ sync_device_id: deviceId, store_preferences_sync_id: preferenceId });
    attachSyncIds(state, localStoreId);
    db.restoreFromRawState(state);

    const downloadedRows: SyncRow[] = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase.from('sync_records').select('store_id,entity,record_id,record_data,device_id,updated_at,deleted_at').eq('store_id', cloudStoreId).order('updated_at', { ascending: true }).range(offset, offset + pageSize - 1);
      if (error) throw error;
      downloadedRows.push(...(data as SyncRow[] || []));
      if (!data || data.length < pageSize) break;
    }

    const mergedState = JSON.parse(JSON.stringify(db.getRawState())) as DatabaseState;
    const remotePreferences = mergeRemote(mergedState, downloadedRows, localStoreId);
    db.restoreFromRawState(mergedState);
    if (remotePreferences && typeof remotePreferences === 'object') {
      const remote = remotePreferences as Record<string, unknown>;
      db.saveSharedPreferences({
        currency_symbol: String(remote.currency_symbol || prefs.currency_symbol || 'ر.ي'),
        receipt_footer: String(remote.receipt_footer || ''),
        receipt_width_mm: remote.receipt_width_mm === '58' ? '58' : '80',
        low_stock_alerts_enabled: remote.low_stock_alerts_enabled !== false,
        store_preferences_updated_at: String(remote._sync_updated_at || ''),
      });
    }

    const rows = buildRows(db.getRawState(), db.getSharedPreferences(), cloudStoreId, localStoreId, deviceId);
    const remoteByKey = new Map(downloadedRows.map((row) => [`${row.entity}:${row.record_id}`, row]));
    const newerLocalRows = rows.filter((row) => {
      const remote = remoteByKey.get(`${row.entity}:${row.record_id}`);
      return !remote || syncTime(row.record_data, row.updated_at) > syncTime(remote.record_data, remote.updated_at);
    });
    let uploaded = 0;
    for (const batch of chunk(newerLocalRows, 100)) {
      const { error } = await supabase.from('sync_records').upsert(batch, { onConflict: 'store_id,entity,record_id' });
      if (error) throw error;
      uploaded += batch.length;
    }
    return { uploaded, downloaded: downloadedRows.length, completedAt: new Date().toISOString() };
  })();
  try { return await activeSync; }
  finally { activeSync = null; }
}

export function startAutoSync(onResult?: (result: SyncResult | null, error?: Error) => void, intervalMs = 60_000) {
  let running = false;
  const run = async () => {
    if (running || !navigator.onLine) return;
    running = true;
    try { const result = await synchronizeStore(); onResult?.(result); }
    catch (error) { onResult?.(null, error instanceof Error ? error : new Error(String(error))); }
    finally { running = false; }
  };
  const onOnline = () => { void run(); };
  const onVisible = () => { if (document.visibilityState === 'visible') void run(); };
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  const timer = window.setInterval(() => { void run(); }, intervalMs);
  void run();
  return () => {
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
    window.clearInterval(timer);
  };
}
