/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Store, Phone, Lock, Sparkles, Key, AlertCircle } from 'lucide-react';
import { db } from '../../../db/sqlite-simulation.ts';
import { checkSecretTaps } from '../../../utils/pureLogic.ts';
import { useTheme } from '../../../context/ThemeContext.tsx';
import { loginWithBiometrics } from '../../../utils/nativeServices.ts';
import { signInMerchant } from '../../../services/authService.ts';

interface LoginScreenProps {
  onNavigate: (screen: string, params?: Record<string, unknown>) => void;
  onOpenOwnerDoor: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onNavigate, onOpenOwnerDoor }) => {
  const { isDarkMode, theme } = useTheme();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tapTimestamps, setTapTimestamps] = useState<number[]>([]);
  const [biometricEnabled, setBiometricEnabled] = useState(!!db.getSharedPreferences().biometric_enabled);
  const [busyBiometric, setBusyBiometric] = useState(false);
  const [busyLogin, setBusyLogin] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  React.useEffect(() => { const timer = window.setTimeout(() => setShowWelcome(false), 4500); return () => window.clearTimeout(timer); }, []);
  React.useEffect(() => {
    const prefs = db.getSharedPreferences();
    if (prefs.last_phone) setPhone(prefs.last_phone);
    setBiometricEnabled(!!prefs.biometric_enabled);
  }, []);

  // Stealth 10-tap secret detection on the logo (no visual feedback, no counter)
  const handleLogoClick = () => {
    const now = Date.now();
    const newTaps = [...tapTimestamps, now];
    setTapTimestamps(newTaps);

    const isSecretTriggered = checkSecretTaps(newTaps, 500, 10);
    if (isSecretTriggered) {
      setTapTimestamps([]);
      onOpenOwnerDoor();
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusyLogin(true);
    try {
      const user = await signInMerchant(phone, password);
      const isSuspended = user.status === 'suspended';
      onNavigate('dashboard', { isSuspended, suspension_reason: user.suspension_reason, storeName: user.store_name });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تسجيل الدخول. تحقق من الهاتف وكلمة المرور والاتصال.');
    } finally { setBusyLogin(false); }
  };

  const handleBiometricLogin = async () => {
    setBusyBiometric(true);
    setError(null);
    try {
      const credentials = await loginWithBiometrics();
      const user = await signInMerchant(credentials.username, credentials.password, true);
      db.saveSharedPreferences({ username: credentials.username, last_phone: credentials.username });
      onNavigate('dashboard', { isSuspended: user.status === 'suspended', suspension_reason: user.suspension_reason, storeName: user.store_name });
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      if (/no protected credentials|no credentials found/i.test(message)) setError('لم تُحفظ بيانات البصمة لهذا الحساب. ادخل بكلمة المرور ثم عطّل البصمة وأعد تفعيلها من الإعدادات.');
      else if (/cancel|canceled|cancelled/i.test(message)) setError('تم إلغاء التحقق؛ يمكنك الدخول بكلمة المرور بدلاً من ذلك.');
      else setError(message || 'تعذر الدخول بالبصمة؛ استخدم كلمة المرور أو أعد تفعيل البصمة من الإعدادات.');
    } finally { setBusyBiometric(false); }
  };

  return (
    <div className={`flex-1 flex flex-col justify-between p-6 overflow-y-auto transition-colors duration-300 ${theme.screenBg}`}>
      {/* Top Branding Section */}
      <div className="flex flex-col items-center pt-6 text-center">
        {/* Stealth Logo with silent 10-taps detector */}
        <div className="mb-3 select-none">
          <button type="button" onClick={handleLogoClick} aria-label="بقالتي برو" className="w-24 h-24 rounded-2xl overflow-hidden bg-[#0B3D2E] shadow-lg border-2 border-[#C9A961]/50 cursor-default select-none outline-none">
            <img src="/assets/bagalati-pro-logo.jpg" alt="شعار بقالتي برو" className="w-full h-full object-cover" />
          </button>
        </div>

        <h1 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-[#0B3D2E]'}`}>بقالتي برو (Grocery POS)</h1>
        <p className={`text-xs mt-0.5 ${theme.textSecondary}`}>نظام إدارة المبيعات والمخزون والديون</p>
        {showWelcome && <div role="status" className="mt-3 rounded-full border border-[#C9A961]/50 bg-[#0B3D2E] px-4 py-2 text-xs font-bold text-[#F4D98B] shadow-md animate-in fade-in">مرحباً بك في متجرك الذكي</div>}
      </div>

      {/* Login Card (CardView) */}
      <div className={`rounded-2xl p-5 shadow-md border my-4 transition-colors duration-300 ${theme.cardBg}`}>
        <form onSubmit={handleLogin} className="space-y-3.5">
          <div>
            <label className={`block text-xs font-bold mb-1 ${theme.textSecondary}`}>
              رقم الهاتف:
            </label>
            <div className="relative">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="أدخل رقم هاتفك..."
                dir="ltr"
                className={`w-full text-right rounded-xl px-3 py-2.5 pl-9 text-xs font-semibold focus:outline-none border ${theme.inputBg}`}
                required
              />
              <Phone className="w-4 h-4 text-[#C9A961] absolute left-3 top-3" />
            </div>
          </div>

          <div>
            <label className={`block text-xs font-bold mb-1 ${theme.textSecondary}`}>
              كلمة المرور:
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة المرور..."
                dir="ltr"
                className={`w-full text-right rounded-xl px-3 py-2.5 pl-9 text-xs font-semibold focus:outline-none border ${theme.inputBg}`}
                required
              />
              <Lock className="w-4 h-4 text-[#C9A961] absolute left-3 top-3" />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-1.5 p-2 bg-red-950/40 text-red-300 border border-red-800 rounded-xl text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={busyLogin}
            className="w-full bg-[#0B3D2E] text-white py-3 rounded-xl font-bold text-xs hover:bg-[#06231A] active:scale-98 transition shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <span>{busyLogin ? 'جارٍ التحقق…' : 'دخول'}</span>
          </button>
          {biometricEnabled && <button type="button" onClick={handleBiometricLogin} disabled={busyBiometric} className="w-full border border-[#C9A961] text-[#0B3D2E] py-2.5 rounded-xl font-bold text-xs disabled:opacity-50">{busyBiometric ? 'جارٍ التحقق…' : 'الدخول ببصمة الهاتف'}</button>}
        </form>
      </div>

      {/* Footer Registration Link */}
      <div className="text-center pb-2">
        <button
          type="button"
          onClick={() => onNavigate('register')}
          className="text-xs font-bold text-[#C9A961] hover:underline"
        >
          ليس لديك حساب؟ إنشاء حساب
        </button>
        <p className="mt-3 text-xs text-gray-500">للتواصل مع مالك التطبيق، انقر على رقم الهاتف</p>
        <a href="https://wa.me/967778228995" target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-[#C9A961] hover:underline">+967778228995</a>
      </div>
    </div>
  );
};
