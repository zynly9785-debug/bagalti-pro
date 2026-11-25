import test from 'node:test';
import assert from 'node:assert/strict';
import { authAliasForPhone, normalizePhoneForAuth } from '../utils/phoneAuth.ts';

const storage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
};

const { db } = await import('../db/sqlite-simulation.ts');
const {
  validatePasswordChangeInput,
  translatePasswordChangeError,
  registerMerchant,
  grantLocalStoreTemporaryPassword,
  signInMerchant,
  changeMerchantPassword,
} = await import('./authService.ts');

test('normalizes Yemeni local phone input to E.164', () => {
  assert.equal(normalizePhoneForAuth('0778 228 995'), '+967778228995');
  assert.equal(normalizePhoneForAuth('967778228995'), '+967778228995');
  assert.equal(normalizePhoneForAuth('+967 778-228-995'), '+967778228995');
});

test('generates a deterministic non-deliverable auth alias without exposing the phone', () => {
  const alias = authAliasForPhone('+967778228995');
  assert.equal(alias, 'p967778228995@login.baqalati-pro.app');
  assert.ok(!alias.includes('+'));
  assert.equal(authAliasForPhone('0778228995'), alias);
});

test('rejects malformed phone numbers before any authentication request', () => {
  assert.throws(() => normalizePhoneForAuth('abc'), /رقم هاتف صحيح/);
  assert.throws(() => authAliasForPhone('123'), /رقم هاتف صحيح/);
});

test('validatePasswordChangeInput enforces current, length, difference, and confirmation rules', () => {
  assert.throws(() => validatePasswordChangeInput('', 'StrongPass123', 'StrongPass123'), /كلمة المرور الحالية/);
  assert.throws(() => validatePasswordChangeInput('OldPass123', 'short', 'short'), /8 أحرف/);
  assert.throws(() => validatePasswordChangeInput('OldPass123', 'a'.repeat(73), 'a'.repeat(73)), /72 حرفاً/);
  assert.throws(() => validatePasswordChangeInput('SamePass123', 'SamePass123', 'SamePass123'), /تختلف/);
  assert.throws(() => validatePasswordChangeInput('OldPass123', 'NewPass123', 'Mismatch123'), /غير مطابق/);
  assert.doesNotThrow(() => validatePasswordChangeInput('OldPass123', 'NewStrong123', 'NewStrong123'));
});

test('translatePasswordChangeError maps Supabase English errors to clear Arabic guidance', () => {
  assert.match(translatePasswordChangeError('New password should be different from the old password.'), /تختلف/);
  assert.match(translatePasswordChangeError('Invalid login credentials'), /غير صحيحة/);
  assert.match(translatePasswordChangeError('Password should be at least 8 characters'), /ضعيفة/);
  assert.match(translatePasswordChangeError('Auth session missing!'), /انتهت جلسة الدخول/);
  assert.match(translatePasswordChangeError('Failed to fetch'), /اتصال الإنترنت/);
});

test('owner grants temporary password -> merchant logs in -> changes password securely from settings', async () => {
  storage.clear();
  db.restoreFromRawState({
    users: [],
    products: [],
    customers: [],
    sales: [],
    sale_items: [],
    returns: [],
    subscription_packages: [],
    parked_sales: [],
    expenses: [],
    customer_payments: [],
    customer_ledger: [],
    customer_payment_plans: [],
    customer_communications: [],
    customer_merge_records: [],
    drawer_shifts: [],
    quick_products: [],
    share_outbox: [],
    store_notifications: [],
    drawer_close_reports: [],
  } as any);
  db.saveSharedPreferences({
    user_id: null,
    store_id: null,
    offline_password_hash: undefined,
    offline_password_hashes: {},
    must_change_password: false,
    must_change_password_phones: {},
    biometric_enabled: true,
  });

  const registered = await registerMerchant({
    storeName: 'بقالة الخير',
    ownerName: 'أحمد علي محمد صالح',
    phone: '0771234567',
    password: 'InitialPassword1',
    governorate: 'صنعاء',
    district: 'السبعين',
    neighborhood: 'حدة',
  });
  assert.equal(db.getSharedPreferences().must_change_password, false);

  // Owner grants temporary password after merchant forgot theirs
  await grantLocalStoreTemporaryPassword('0771234567', 'TempOwnerPass99');
  assert.equal(db.getSharedPreferences().must_change_password, true);
  assert.ok(!storage.get('baqalati_pro_prefs')?.includes('TempOwnerPass99'));

  // Old password is rejected; temporary owner password logs in with must_change_password active
  await assert.rejects(() => signInMerchant('0771234567', 'InitialPassword1'), /غير مطابقة/);
  const signedIn = await signInMerchant('0771234567', 'TempOwnerPass99');
  assert.equal(signedIn.id, registered.id);
  assert.equal(db.getSharedPreferences().must_change_password, true);

  // Wrong current password is rejected
  await assert.rejects(
    () => changeMerchantPassword(signedIn.id, 'WrongCurrent1', 'MerchantSecret99', 'MerchantSecret99'),
    /غير صحيحة/,
  );

  // Merchant updates to personal password using temporary password
  const changeResult = await changeMerchantPassword(signedIn.id, 'TempOwnerPass99', 'MerchantSecret99', 'MerchantSecret99');
  assert.equal(changeResult.biometricCleared, true);
  assert.equal(db.getSharedPreferences().biometric_enabled, false);
  assert.equal(db.getSharedPreferences().must_change_password, false);
  assert.ok(!storage.get('grocery_pos_shared_prefs_clean_prod_v1')?.includes('MerchantSecret99'));

  // Temporary password no longer works; new personal password succeeds
  await assert.rejects(() => signInMerchant('0771234567', 'TempOwnerPass99'), /غير مطابقة/);
  const relogin = await signInMerchant('0771234567', 'MerchantSecret99');
  assert.equal(relogin.id, registered.id);
  assert.equal(db.getSharedPreferences().must_change_password, false);
});
