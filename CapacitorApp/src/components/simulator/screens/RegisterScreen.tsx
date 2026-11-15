/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowRight, Store, User, Phone, Lock, MapPin, KeyRound, Check } from 'lucide-react';
import { db } from '../../../db/sqlite-simulation.ts';
import { useTheme } from '../../../context/ThemeContext.tsx';
import { saveBiometricCredentials, isBiometricReady } from '../../../utils/nativeServices.ts';
import { registerMerchant } from '../../../services/authService.ts';

interface RegisterScreenProps {
  onNavigate: (screen: string, params?: Record<string, unknown>) => void;
}


export const RegisterScreen: React.FC<RegisterScreenProps> = ({ onNavigate }) => {
  const { theme, isDarkMode } = useTheme();
  const [storeName, setStoreName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [district, setDistrict] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [biometricMessage, setBiometricMessage] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinCode, setPinCode] = useState('');
  const [registeredStoreId, setRegisteredStoreId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [pinError, setPinError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!storeName.trim() || !ownerName.trim() || !phone.trim() || !password.trim() || !governorate.trim() || !district.trim() || !neighborhood.trim()) {
      setError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    setBusy(true);
    try {
      const newUser = await registerMerchant({ storeName, ownerName, phone, password, governorate, district, neighborhood });
      setPhone(newUser.phone);
      setRegisteredStoreId(newUser.id);
      setShowPinModal(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر إنشاء الحساب. تحقق من الاتصال وإعدادات الهاتف.');
    } finally { setBusy(false); }
  };

  const handleSavePinAndFinish = () => {
    const finalPin = pinCode.trim();
    if (!/^\d{4,6}$/.test(finalPin)) { setPinError('أدخل رمزاً من 4 إلى 6 أرقام للمتابعة.'); return; }
    if (registeredStoreId) {
      db.updateUserProfile(registeredStoreId, { pin_code: finalPin });
      db.saveSharedPreferences({
        user_id: registeredStoreId,
        store_id: registeredStoreId,
        status: 'active',
        current_pin: finalPin,
      });
      onNavigate('dashboard', {
        storeName,
        isSuspended: false,
      });
    }
  };

  return (
    <div className={`flex-1 flex flex-col ${theme.screenBg} ${theme.textPrimary}`}>
      {/* Top Header */}
      <div className="bg-[#0B3D2E] text-white p-4 flex items-center justify-between shadow-md border-b border-[#C9A961]/30">
        <button
          onClick={() => onNavigate('login')}
          className="p-1 hover:bg-white/10 rounded-full"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
        <h2 className="font-bold text-sm">إنشاء حساب بقالة جديد</h2>
        <div className="w-5" />
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={`block text-xs font-bold mb-1 ${theme.textPrimary}`}>اسم البقالة / المتجر:</label>
            <div className="relative">
              <input
                type="text"
                placeholder="مثال: بقالة النور الحديثة"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className={`w-full ${theme.inputBg} border ${theme.borderColor} ${theme.textPrimary} rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#C9A961]`}
                required
              />
              <Store className="w-4 h-4 text-[#C9A961] absolute left-3 top-2.5" />
            </div>
          </div>

          <div>
            <label className={`block text-xs font-bold mb-1 ${theme.textPrimary}`}>اسم المالك:</label>
            <div className="relative">
              <input
                type="text"
                placeholder="اسم المالك الكامل"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className={`w-full ${theme.inputBg} border ${theme.borderColor} ${theme.textPrimary} rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#C9A961]`}
                required
              />
              <User className="w-4 h-4 text-[#C9A961] absolute left-3 top-2.5" />
            </div>
          </div>

          <div>
            <label className={`block text-xs font-bold mb-1 ${theme.textPrimary}`}>رقم الهاتف:</label>
            <div className="relative">
              <input
                type="tel"
                placeholder="مثال: 775001122"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`w-full text-right ${theme.inputBg} border ${theme.borderColor} ${theme.textPrimary} rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#C9A961]`}
                required
              />
              <Phone className="w-4 h-4 text-[#C9A961] absolute left-3 top-2.5" />
            </div>
          </div>

          <div>
            <label className={`block text-xs font-bold mb-1 ${theme.textPrimary}`}>كلمة المرور:</label>
            <div className="relative">
              <input
                type="password"
                placeholder="كلمة مرور الدخول"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full ${theme.inputBg} border ${theme.borderColor} ${theme.textPrimary} rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#C9A961]`}
                required
              />
              <Lock className="w-4 h-4 text-[#C9A961] absolute left-3 top-2.5" />
            </div>
          </div>

          <div className="space-y-2 pt-1">
            {[['المحافظة', governorate, setGovernorate, 'اكتب اسم المحافظة'], ['المديرية', district, setDistrict, 'اكتب اسم المديرية'], ['الحارة', neighborhood, setNeighborhood, 'اكتب اسم الحارة']].map(([label, value, setter, placeholder]: any) => <div key={label}><label className={`block text-[11px] font-bold mb-1 ${theme.textPrimary}`}>{label} (مطلوب):</label><input type="text" value={value} onChange={e => setter(e.target.value)} placeholder={placeholder} className={`w-full ${theme.inputBg} border ${theme.borderColor} ${theme.textPrimary} rounded-xl p-2 text-xs`} required /></div>)}
          </div>

          {error && (
            <p className="text-xs text-[#8B2E2E] font-bold bg-red-50 p-2 rounded-xl">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-[#0B3D2E] text-white py-3 rounded-xl font-bold text-xs hover:bg-[#06231A] active:scale-98 transition shadow-md mt-4 border border-[#C9A961]/40 disabled:opacity-60"
          >
            {busy ? 'جارٍ إنشاء الحساب…' : 'إنشاء الحساب ومتابعة إعداد PIN'}
          </button>
        </form>
      </div>

      {/* PIN Creation Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className={`${theme.cardBg} rounded-3xl w-full max-w-xs p-5 shadow-2xl border ${isDarkMode ? 'border-emerald-800' : 'border-[#C9A961]'} text-center`}>
            <div className={`w-12 h-12 ${isDarkMode ? 'bg-emerald-950/80 text-emerald-300' : 'bg-emerald-100 text-[#0B3D2E]'} rounded-full flex items-center justify-center mx-auto mb-3`}>
              <KeyRound className="w-6 h-6 text-[#C9A961]" />
            </div>
            <h3 className={`font-bold text-sm ${theme.textPrimary}`}>إنشاء رمز الأمان (PIN)</h3>
            <p className={`text-xs ${theme.textSecondary} mt-1 mb-4`}>
              أدخل رمزاً مكوناً من 4 أرقام لتأكيد العمليات الحساسة
            </p>

            <input
              type="password"
              maxLength={6}
              inputMode="numeric"
              placeholder="••••"
              value={pinCode}
              onChange={(e) => setPinCode(e.target.value)}
              className={`w-full text-center tracking-widest text-lg font-mono border ${theme.borderColor} rounded-xl p-2.5 ${theme.inputBg} ${theme.textPrimary} mb-4 focus:outline-none focus:border-[#C9A961]`}
            />
            {pinError && <p role="alert" className="text-[10px] text-red-700 mb-2">{pinError}</p>}

            <button type="button" onClick={async () => { try { const ready = await isBiometricReady(); if (!ready) { setBiometricMessage('لا توجد بصمة مسجلة أو أن التطبيق يعمل خارج Android. يمكنك تفعيلها لاحقاً من الإعدادات.'); return; } await saveBiometricCredentials(phone.trim(), password.trim()); db.saveSharedPreferences({ biometric_enabled: true }); setBiometricMessage('تم تفعيل الدخول ببصمة الهاتف.'); } catch (e) { setBiometricMessage(e instanceof Error ? e.message : 'تعذر تفعيل البصمة'); } }} className="w-full border border-emerald-600 text-emerald-800 py-2 rounded-xl font-bold text-xs mb-2">تفعيل الدخول ببصمة الهاتف (اختياري)</button>
            {biometricMessage && <p className="text-[10px] text-amber-700 mb-2">{biometricMessage}</p>}
            <button
              onClick={handleSavePinAndFinish}
              className="w-full bg-[#0B3D2E] text-white py-2.5 rounded-xl font-bold text-xs hover:bg-[#06231A] border border-[#C9A961]/40"
            >
              حفظ ودخول الشاشة الرئيسية
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
