import type { User as SupabaseUser } from '@supabase/supabase-js';
import { db } from '../db/sqlite-simulation.ts';
import type { User } from '../types/index.ts';
import { supabase } from '../supabaseClient.ts';
import { authAliasForPhone, normalizePhoneForAuth } from '../utils/phoneAuth.ts';
import { validateFullNameParts } from '../utils/appRules.ts';
import { clearBiometricCredentials } from '../utils/nativeServices.ts';

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
  created_at?: string;
};

const STORE_FIELDS = 'id,owner_user_id,local_store_id,store_name,owner_name,phone,governorate,district,neighborhood,status,subscription_end,subscription_price,suspension_reason,created_at';

function tryNormalizePhone(phoneInput?: string | null): string {
  if (!phoneInput) return '';
  try {
    return normalizePhoneForAuth(phoneInput);
  } catch {
    return '';
  }
}

export function validatePasswordChangeInput(currentPassword: string, newPassword: string, confirmPassword?: string): void {
  if (!currentPassword) {
    throw new Error('أدخل كلمة المرور الحالية أو المؤقتة.');
  }
  if (newPassword.length < 8) {
    throw new Error('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.');
  }
  if (newPassword.length > 72) {
    throw new Error('كلمة المرور الجديدة يجب ألا تتجاوز 72 حرفاً.');
  }
  if (newPassword === currentPassword) {
    throw new Error('كلمة المرور الجديدة يجب أن تختلف عن كلمة المرور الحالية.');
  }
  if (confirmPassword !== undefined && newPassword !== confirmPassword) {
    throw new Error('تأكيد كلمة المرور الجديدة غير مطابق.');
  }
}

export function translatePasswordChangeError(message: string): string {
  const lower = (message || '').toLowerCase();
  if (!lower) return 'تعذر تغيير كلمة المرور حالياً. أعد المحاولة.';
  if (lower.includes('same_password') || lower.includes('different from the old password')) {
    return 'كلمة المرور الجديدة يجب أن تختلف عن كلمة المرور الحالية.';
  }
  if (lower.includes('invalid login credentials') || lower.includes('invalid_credentials')) {
    return 'كلمة المرور الحالية أو المؤقتة غير صحيحة.';
  }
  if (lower.includes('weak') || lower.includes('should be at least')) {
    return 'كلمة المرور الجديدة ضعيفة؛ استخدم 8 أحرف على الأقل تحتوي على حروف وأرقام.';
  }
  if (
    lower.includes('session')
    || lower.includes('jwt')
    || lower.includes('not authenticated')
    || lower.includes('refresh token')
    || lower.includes('user from sub claim')
  ) {
    return 'انتهت جلسة الدخول. سجّل الدخول مجدداً ثم أعد المحاولة.';
  }
  if (lower.includes('network') || lower.includes('failed to fetch') || lower.includes('timeout')) {
    return 'تعذر الاتصال بالخادم. تحقق من اتصال الإنترنت وأعد المحاولة.';
  }
  return message;
}

function getStoredOfflinePasswordHash(phone: string): string | undefined {
  const prefs = db.getSharedPreferences();
  const normalized = tryNormalizePhone(phone);
  if (normalized && prefs.offline_password_hashes?.[normalized]) {
    return prefs.offline_password_hashes[normalized];
  }
  const lastNormalized = tryNormalizePhone(prefs.last_phone);
  if (prefs.offline_password_hash && (!lastNormalized || !normalized || lastNormalized === normalized)) {
    return prefs.offline_password_hash;
  }
  return undefined;
}

function persistOfflineCredentialState(phone: string, hash: string, mustChange?: boolean, updateActivePrefs = true) {
  const prefs = db.getSharedPreferences();
  const normalized = tryNormalizePhone(phone);
  const nextHashes = { ...(prefs.offline_password_hashes || {}) };
  if (normalized) nextHashes[normalized] = hash;

  const nextMustChangePhones = { ...(prefs.must_change_password_phones || {}) };
  if (normalized && mustChange !== undefined) {
    nextMustChangePhones[normalized] = mustChange;
  }

  const updates: Partial<typeof prefs> = {
    offline_password_hashes: nextHashes,
    ...(mustChange !== undefined ? { must_change_password_phones: nextMustChangePhones } : {}),
  };

  if (updateActivePrefs) {
    updates.offline_password_hash = hash;
    if (mustChange !== undefined) updates.must_change_password = mustChange;
  }

  db.saveSharedPreferences(updates);
}

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
    created_at: store.created_at,
  };

  const existing = db.findUserByPhone(phone);
  let localUser: User;
  if (existing) {
    db.updateUserProfile(existing.id, profile);
    localUser = { ...existing, ...profile };
  } else {
    localUser = db.registerUser({ ...profile }, { skipNamePartsCheck: true, created_at: store.created_at });
    db.updateUserProfile(localUser.id, { subscription_end: profile.subscription_end, status: profile.status, suspension_reason: profile.suspension_reason, created_at: store.created_at });
    localUser = db.findUserById(localUser.id) || localUser;
  }
  const prefs = db.getSharedPreferences();
  const normalized = tryNormalizePhone(phone);
  const hashToStore = offlinePasswordHash || getStoredOfflinePasswordHash(phone) || prefs.offline_password_hash;
  const mustChange = Boolean(authUser.user_metadata?.must_change_password ?? prefs.must_change_password_phones?.[normalized]);

  db.saveSharedPreferences({
    user_id: localUser.id,
    store_id: localUser.id,
    cloud_user_id: authUser.id,
    cloud_store_id: store.id,
    status: store.status,
    is_suspended_flag: store.status === 'suspended',
    last_phone: phone,
    must_change_password: mustChange,
    must_change_password_phones: normalized
      ? { ...(prefs.must_change_password_phones || {}), [normalized]: mustChange }
      : prefs.must_change_password_phones,
    ...(hashToStore
      ? {
          offline_password_hash: hashToStore,
          offline_password_hashes: normalized
            ? { ...(prefs.offline_password_hashes || {}), [normalized]: hashToStore }
            : prefs.offline_password_hashes,
        }
      : {}),
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

export async function grantLocalStoreTemporaryPassword(phoneInput: string, tempPassword: string): Promise<void> {
  if (tempPassword.length < 8 || tempPassword.length > 72) {
    throw new Error('كلمة المرور المؤقتة يجب أن تكون بين 8 و 72 حرفاً.');
  }
  const phone = normalizePhoneForAuth(phoneInput);
  const targetStore = db.findUserByPhone(phone);
  if (!targetStore) {
    throw new Error('لا يوجد متجر مسجل بهذا الرقم على هذا الجهاز.');
  }
  const tempHash = await hashOfflineCredential(phone, tempPassword);
  const prefs = db.getSharedPreferences();
  const isActiveStore = tryNormalizePhone(prefs.last_phone) === phone || prefs.store_id === targetStore.id;
  persistOfflineCredentialState(phone, tempHash, true, isActiveStore);
}

export async function registerMerchant(input: {
  storeName: string; ownerName: string; phone: string; password: string;
  governorate: string; district: string; neighborhood: string;
}): Promise<User> {
  const nameCheck = validateFullNameParts(input.ownerName);
  if (!nameCheck.isValid) {
    throw new Error(nameCheck.error);
  }
  const phone = normalizePhoneForAuth(input.phone);
  if (!supabase) {
    const offlinePasswordHash = await hashOfflineCredential(phone, input.password);
    let local = db.findUserByPhone(phone);
    if (local) {
      throw new Error('رقم الهاتف مسجل مسبقاً. سجّل الدخول مباشرة.');
    }
    local = db.registerUser({
      store_name: input.storeName.trim(),
      owner_name: nameCheck.normalized,
      phone,
      password: '',
      governorate: input.governorate.trim(),
      district: input.district.trim(),
      neighborhood: input.neighborhood.trim(),
      pin_code: '',
    });
    const prefs = db.getSharedPreferences();
    db.saveSharedPreferences({
      user_id: local.id,
      store_id: local.id,
      status: local.status,
      is_suspended_flag: local.status === 'suspended',
      last_phone: phone,
      offline_password_hash: offlinePasswordHash,
      offline_password_hashes: { ...(prefs.offline_password_hashes || {}), [phone]: offlinePasswordHash },
      must_change_password: false,
      must_change_password_phones: { ...(prefs.must_change_password_phones || {}), [phone]: false },
    });
    return local;
  }
  const client = requireSupabase();
  const { data, error } = await client.auth.signUp({
    email: authAliasForPhone(phone),
    password: input.password,
    options: { data: {
      phone,
      store_name: input.storeName.trim(), owner_name: nameCheck.normalized, governorate: input.governorate.trim(),
      district: input.district.trim(), neighborhood: input.neighborhood.trim(),
      must_change_password: false,
    } },
  });
  if (error) throw new Error(error.message);
  if (!data.user || !data.session) {
    throw new Error('لم يكتمل تسجيل الدخول تلقائياً. تحقق من إعدادات Supabase Auth ثم أعد المحاولة.');
  }
  let local = db.findUserByPhone(phone);
  if (!local) {
    local = db.registerUser({
      store_name: input.storeName.trim(), owner_name: nameCheck.normalized, phone, password: '',
      governorate: input.governorate.trim(), district: input.district.trim(), neighborhood: input.neighborhood.trim(), pin_code: '',
    });
  } else {
    db.updateUserProfile(local.id, { store_name: input.storeName.trim(), owner_name: nameCheck.normalized, phone, password: '', governorate: input.governorate.trim(), district: input.district.trim(), neighborhood: input.neighborhood.trim() });
  }
  const store = await findOrCreateStore(data.user, phone);
  const offlinePasswordHash = await hashOfflineCredential(phone, input.password);
  return localProfile(store, data.user, phone, offlinePasswordHash);
}

export async function updateCloudStoreProfile(storeId: number, updates: {
  store_name: string;
  phone: string;
  governorate: string;
  district: string;
  neighborhood: string;
}): Promise<void> {
  db.updateUserProfile(storeId, updates);
  const prefs = db.getSharedPreferences();
  if (!supabase || !prefs.cloud_store_id || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return;
  }
  const { error } = await supabase
    .from('stores')
    .update({
      store_name: updates.store_name,
      phone: updates.phone,
      governorate: updates.governorate,
      district: updates.district,
      neighborhood: updates.neighborhood,
    })
    .eq('id', prefs.cloud_store_id);
  if (error) throw error;
}

export async function signOutMerchantSession(): Promise<void> {
  if (supabase) {
    await supabase.auth.signOut().catch(() => undefined);
  }
}

export async function changeMerchantPassword(
  storeId: number,
  currentPassword: string,
  newPassword: string,
  confirmPassword?: string,
): Promise<{ biometricCleared: boolean }> {
  validatePasswordChangeInput(currentPassword, newPassword, confirmPassword);
  const prefs = db.getSharedPreferences();
  const localStore = db.findUserById(storeId);
  const fallbackPhone = tryNormalizePhone(localStore?.phone) || tryNormalizePhone(prefs.last_phone);

  if (!supabase) {
    if (!fallbackPhone) {
      throw new Error('تعذر تحديد رقم هاتف الحساب المسجل لتغيير كلمة المرور.');
    }
    const storedHash = getStoredOfflinePasswordHash(fallbackPhone);
    if (storedHash) {
      const currentHash = await hashOfflineCredential(fallbackPhone, currentPassword);
      if (currentHash !== storedHash) {
        throw new Error('كلمة المرور الحالية أو المؤقتة غير صحيحة.');
      }
    }
    const newHash = await hashOfflineCredential(fallbackPhone, newPassword);
    persistOfflineCredentialState(fallbackPhone, newHash, false, true);

    let biometricCleared = false;
    if (prefs.biometric_enabled) {
      await clearBiometricCredentials().catch(() => undefined);
      db.saveSharedPreferences({ biometric_enabled: false });
      biometricCleared = true;
    }
    return { biometricCleared };
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('يتطلب تغيير كلمة المرور اتصالاً بالإنترنت لتحديث الحساب السحابي.');
  }

  const client = requireSupabase();
  let currentUser: SupabaseUser | null = null;
  const { data: userRes, error: userErr } = await client.auth.getUser();
  if (!userErr && userRes.user) {
    currentUser = userRes.user;
  } else {
    const { data: sessionRes } = await client.auth.getSession();
    currentUser = sessionRes.session?.user ?? null;
  }

  if (!currentUser) {
    throw new Error('انتهت جلسة الدخول. سجّل الدخول مجدداً ثم أعد المحاولة.');
  }

  const emailLocalPart = currentUser.email?.split('@')[0] || '';
  const aliasPhone = /^p\d+$/.test(emailLocalPart) ? tryNormalizePhone(`+${emailLocalPart.slice(1)}`) : '';
  const resolvedPhone =
    tryNormalizePhone(String(currentUser.user_metadata?.phone || ''))
    || tryNormalizePhone(currentUser.phone)
    || aliasPhone
    || fallbackPhone;

  const reauthCredentials = currentUser.email
    ? { email: currentUser.email, password: currentPassword }
    : currentUser.phone
      ? { phone: currentUser.phone, password: currentPassword }
      : resolvedPhone
        ? { email: authAliasForPhone(resolvedPhone), password: currentPassword }
        : null;

  if (!reauthCredentials) {
    throw new Error('انتهت جلسة الدخول. سجّل الدخول مجدداً ثم أعد المحاولة.');
  }

  const reauth = await client.auth.signInWithPassword(reauthCredentials);
  if (reauth.error) {
    throw new Error('كلمة المرور الحالية أو المؤقتة غير صحيحة.');
  }
  if (reauth.data.user?.id !== currentUser.id) {
    throw new Error('تعذر التحقق من الحساب الحالي بأمان.');
  }

  const { error: updateError } = await client.auth.updateUser({
    password: newPassword,
    data: {
      ...(currentUser.user_metadata || {}),
      must_change_password: false,
    },
  });
  if (updateError) {
    throw new Error(translatePasswordChangeError(updateError.message));
  }

  if (resolvedPhone) {
    const offlineHash = await hashOfflineCredential(resolvedPhone, newPassword);
    persistOfflineCredentialState(resolvedPhone, offlineHash, false, true);
  } else {
    db.saveSharedPreferences({ must_change_password: false });
  }

  let biometricCleared = false;
  if (prefs.biometric_enabled) {
    await clearBiometricCredentials().catch(() => undefined);
    db.saveSharedPreferences({ biometric_enabled: false });
    biometricCleared = true;
  }
  return { biometricCleared };
}

export async function signInMerchant(phoneInput: string, password: string, allowCachedBiometric = false): Promise<User> {
  const phone = normalizePhoneForAuth(phoneInput);
  const offlineHash = await hashOfflineCredential(phone, password);
  const prefs = db.getSharedPreferences();
  const local = db.findUserByPhone(phone);
  const storedHash = getStoredOfflinePasswordHash(phone);
  const offlineAllowed = typeof navigator !== 'undefined' && !navigator.onLine;
  if (offlineAllowed || !supabase) {
    if (storedHash && storedHash === offlineHash && local) {
      db.saveSharedPreferences({
        user_id: local.id,
        store_id: local.id,
        status: local.status,
        is_suspended_flag: local.status === 'suspended',
        last_phone: phone,
        offline_password_hash: storedHash,
        must_change_password: Boolean(prefs.must_change_password_phones?.[phone]),
      });
      return local;
    }
    if (!supabase) {
      throw new Error('بيانات الدخول غير مطابقة للحساب المسجل على هذا الجهاز، أو أنشئ حساباً جديداً.');
    }
    throw new Error('لا يوجد اتصال بالإنترنت وبيانات الدخول غير محفوظة لهذا الجهاز. اتصل بالإنترنت مرة واحدة ثم أعد المحاولة.');
  }
  const client = requireSupabase();
  try {
    const { data, error } = await client.auth.signInWithPassword({ email: authAliasForPhone(phone), password });
    if (error) throw new Error(translatePasswordChangeError(error.message));
    if (!data.user) throw new Error('تعذر التحقق من الحساب.');
    const store = await findOrCreateStore(data.user, phone);
    return localProfile(store, data.user, phone, offlineHash);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    const isAuthRejection = msg.includes('غير صحيحة') || /invalid/i.test(msg);
    if (!isAuthRejection && storedHash && storedHash === offlineHash && local) {
      db.saveSharedPreferences({
        user_id: local.id,
        store_id: local.id,
        last_phone: phone,
        offline_password_hash: storedHash,
      });
      return local;
    }
    if (allowCachedBiometric) {
      const { data: cached } = await client.auth.getSession();
      const latestPrefs = db.getSharedPreferences();
      if (cached.session?.user.id && cached.session.user.id === latestPrefs.cloud_user_id && tryNormalizePhone(latestPrefs.last_phone) === phone && latestPrefs.store_id) {
        const cachedUser = db.findUserById(latestPrefs.store_id);
        if (cachedUser) return cachedUser;
      }
    }
    throw error;
  }
}
