import type { User as SupabaseUser } from '@supabase/supabase-js';
import { db } from '../db/sqlite-simulation.ts';
import type { User } from '../types/index.ts';
import { supabase } from '../supabaseClient.ts';
import { authAliasForPhone, normalizePhoneForAuth } from '../utils/phoneAuth.ts';

export type StoreProfile = {
  id: string;
  owner_user_id: string;
  local_store_id: string | null;
  store_name: string;
  owner_name: string;
  phone: string;
  governorate: string;
  district: string;
  neighborhood: string;
  status: 'active' | 'suspended';
  subscription_end: string;
  subscription_price: number;
  suspension_reason: string | null;
};

const STORE_FIELDS = 'id,owner_user_id,local_store_id,store_name,owner_name,phone,governorate,district,neighborhood,status,subscription_end,subscription_price,suspension_reason';

async function hashOfflineCredential(phone: string, password: string): Promise<string> {
  const value = `${normalizePhoneForAuth(phone)}\n${password}`;
  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(value);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function requireSupabase() {
  if (!supabase) throw new Error('الاتصال السحابي غير مهيأ في هذه النسخة.');
  return supabase;
}

function localProfile(store: StoreProfile, authUser: SupabaseUser, phone: string, offlinePasswordHash?: string): User {
  const profile = {
    store_name: store.store_name,
    owner_name: store.owner_name,
    phone,
    password: '',
    governorate: store.governorate || '',
    district: store.district || '',
    neighborhood: store.neighborhood || '',
    pin_code: '',
    subscription_end: new Date(store.subscription_end).getTime(),
    role: 'merchant' as const,
    status: store.status,
    suspension_reason: store.suspension_reason,
    subscription_price: Number(store.subscription_price) || 0,
  };

  const existing = db.findUserByPhone(phone);
  let localUser: User;
  if (existing) {
    db.updateUserProfile(existing.id, profile);
    localUser = { ...existing, ...profile };
  } else {
    localUser = db.registerUser({ ...profile });
    db.updateUserProfile(localUser.id, { subscription_end: profile.subscription_end, status: profile.status, suspension_reason: profile.suspension_reason });
    localUser = db.findUserById(localUser.id) || localUser;
  }
  db.saveSharedPreferences({
    user_id: localUser.id,
    store_id: localUser.id,
    cloud_user_id: authUser.id,
    cloud_store_id: store.id,
    status: store.status,
    is_suspended_flag: store.status === 'suspended',
    last_phone: phone,
    offline_password_hash: offlinePasswordHash || db.getSharedPreferences().offline_password_hash,
  });
  return localUser;
}

async function findOrCreateStore(authUser: SupabaseUser, phone: string): Promise<StoreProfile> {
  const client = requireSupabase();
  const { data: found, error: findError } = await client.from('stores').select(STORE_FIELDS).eq('owner_user_id', authUser.id).maybeSingle();
  if (findError) throw findError;
  if (found) return found as StoreProfile;

  const metadata = authUser.user_metadata || {};
  const local = db.findUserByPhone(phone);
  const storeName = String(metadata.store_name || local?.store_name || '').trim();
  const ownerName = String(metadata.owner_name || local?.owner_name || '').trim();
  if (!storeName || !ownerName) throw new Error('لم يُنشأ ملف المتجر لهذا الحساب. أعد التسجيل أو تواصل مع الدعم.');
  const { data: newStoreId, error: createError } = await client.rpc('create_store_for_current_user', {
    p_local_store_id: String(local?.id || '1'),
    p_store_name: storeName,
    p_owner_name: ownerName,
    p_phone: phone,
    p_governorate: String(metadata.governorate || local?.governorate || ''),
    p_district: String(metadata.district || local?.district || ''),
    p_neighborhood: String(metadata.neighborhood || local?.neighborhood || ''),
  });
  if (createError) throw createError;
  const { data: created, error: reloadError } = await client.from('stores').select(STORE_FIELDS).eq('id', newStoreId).single();
  if (reloadError) throw reloadError;
  return created as StoreProfile;
}

export async function registerMerchant(input: {
  storeName: string; ownerName: string; phone: string; password: string;
  governorate: string; district: string; neighborhood: string;
}): Promise<User> {
  const client = requireSupabase();
  const phone = normalizePhoneForAuth(input.phone);
  const { data, error } = await client.auth.signUp({
    email: authAliasForPhone(phone),
    password: input.password,
    options: { data: {
      phone,
      store_name: input.storeName.trim(), owner_name: input.ownerName.trim(), governorate: input.governorate.trim(),
      district: input.district.trim(), neighborhood: input.neighborhood.trim(),
    } },
  });
  if (error) throw new Error(error.message);
  if (!data.user || !data.session) {
    throw new Error('لم يكتمل تسجيل الدخول تلقائياً. تحقق من إعدادات Supabase Auth ثم أعد المحاولة.');
  }
  let local = db.findUserByPhone(phone);
  if (!local) {
    local = db.registerUser({
      store_name: input.storeName.trim(), owner_name: input.ownerName.trim(), phone, password: '',
      governorate: input.governorate.trim(), district: input.district.trim(), neighborhood: input.neighborhood.trim(), pin_code: '',
    });
  } else {
    db.updateUserProfile(local.id, { store_name: input.storeName.trim(), owner_name: input.ownerName.trim(), phone, password: '', governorate: input.governorate.trim(), district: input.district.trim(), neighborhood: input.neighborhood.trim() });
  }
  const store = await findOrCreateStore(data.user, phone);
  const offlinePasswordHash = await hashOfflineCredential(phone, input.password);
  return localProfile(store, data.user, phone, offlinePasswordHash);
}

export async function changeMerchantPassword(storeId: number, currentPassword: string, newPassword: string): Promise<void> {
  const client = requireSupabase();
  if (newPassword.length < 8) throw new Error('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.');
  if (!currentPassword) throw new Error('أدخل كلمة المرور الحالية.');
  const { data: current, error: currentError } = await client.auth.getUser();
  if (currentError || !current.user?.email) throw new Error('انتهت جلسة الدخول. سجّل الدخول مجدداً ثم أعد المحاولة.');
  const reauth = await client.auth.signInWithPassword({ email: current.user.email, password: currentPassword });
  if (reauth.error) throw new Error('كلمة المرور الحالية غير صحيحة.');
  if (reauth.data.user?.id !== current.user.id) throw new Error('تعذر التحقق من الحساب الحالي بأمان.');
  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
  const aliasLocalPart = current.user.email.split('@')[0];
  const localPhone = /^p\d+$/.test(aliasLocalPart)
    ? `+${aliasLocalPart.slice(1)}`
    : String(current.user.user_metadata?.phone || db.findUserById(storeId)?.phone || '');
  const offlineHash = await hashOfflineCredential(localPhone, newPassword);
  db.saveSharedPreferences({ offline_password_hash: offlineHash });
}

export async function signInMerchant(phoneInput: string, password: string, allowCachedBiometric = false): Promise<User> {
  const phone = normalizePhoneForAuth(phoneInput);
  const offlineHash = await hashOfflineCredential(phone, password);
  const prefs = db.getSharedPreferences();
  const local = db.findUserByPhone(phone);
  const offlineAllowed = typeof navigator !== 'undefined' && !navigator.onLine;
  if (offlineAllowed) {
    if (prefs.offline_password_hash && prefs.offline_password_hash === offlineHash && local) return local;
    throw new Error('لا يوجد اتصال بالإنترنت وبيانات الدخول غير محفوظة لهذا الجهاز. اتصل بالإنترنت مرة واحدة ثم أعد المحاولة.');
  }
  const client = requireSupabase();
  try {
    const { data, error } = await client.auth.signInWithPassword({ email: authAliasForPhone(phone), password });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('تعذر التحقق من الحساب.');
    const store = await findOrCreateStore(data.user, phone);
    return localProfile(store, data.user, phone, offlineHash);
  } catch (error) {
    if (prefs.offline_password_hash && prefs.offline_password_hash === offlineHash && local) return local;
    if (allowCachedBiometric) {
      const { data: cached } = await client.auth.getSession();
      const prefs = db.getSharedPreferences();
      if (cached.session?.user.id && cached.session.user.id === prefs.cloud_user_id && normalizePhoneForAuth(prefs.last_phone || '') === phone && prefs.store_id) {
        const local = db.findUserById(prefs.store_id);
        if (local) return local;
      }
    }
    throw error;
  }
}
