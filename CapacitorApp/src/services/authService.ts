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

function requireSupabase() {
  if (!supabase) throw new Error('الاتصال السحابي غير مهيأ في هذه النسخة.');
  return supabase;
}

function localProfile(store: StoreProfile, authUser: SupabaseUser, phone: string): User {
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
  return localProfile(store, data.user, phone);
}

export async function signInMerchant(phoneInput: string, password: string, allowCachedBiometric = false): Promise<User> {
  const client = requireSupabase();
  const phone = normalizePhoneForAuth(phoneInput);
  try {
    const { data, error } = await client.auth.signInWithPassword({ email: authAliasForPhone(phone), password });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('تعذر التحقق من الحساب.');
    const store = await findOrCreateStore(data.user, phone);
    return localProfile(store, data.user, phone);
  } catch (error) {
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
