/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { AlertTriangle, LockKeyhole, Phone, ShieldCheck, X } from 'lucide-react';
import { supabase } from '../../supabaseClient.ts';
import { normalizePhoneForAuth } from '../../utils/phoneAuth.ts';

interface OwnerSecretDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const OwnerSecretDialog: React.FC<OwnerSecretDialogProps> = ({ isOpen, onClose, onSuccess }) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setPhone('');
      setPassword('');
      setError(null);
      setBusy(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const close = () => {
    setError(null);
    onClose();
  };

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!supabase) {
      setError('خدمة الإدارة السحابية غير مهيأة بعد. يلزم إعداد Supabase قبل تسجيل الدخول.');
      return;
    }
    if (!phone.trim() || !password) {
      setError('أدخل رقم الهاتف وكلمة المرور.');
      return;
    }

    setBusy(true);
    try {
      const normalizedPhone = normalizePhoneForAuth(phone);
      const { data: loginData, error: loginError } = await supabase.functions.invoke('owner-sign-in-by-phone', {
        body: { phone: normalizedPhone, password },
      });
      if (loginError || !loginData?.access_token || !loginData?.refresh_token) {
        setError(loginData?.error || 'تعذر تسجيل الدخول. تحقق من الرقم وكلمة المرور أو إعدادات حساب الإدارة.');
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: loginData.access_token,
        refresh_token: loginData.refresh_token,
      });
      if (sessionError || !sessionData.user) {
        setError('تم التحقق من الحساب لكن تعذر إنشاء جلسة آمنة. أعد المحاولة.');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('platform_role')
        .eq('user_id', sessionData.user.id)
        .maybeSingle();

      if (profileError || profile?.platform_role !== 'platform_owner') {
        await supabase.auth.signOut();
        setError('هذا الحساب لا يملك صلاحية مالك التطبيق.');
        return;
      }

      setPassword('');
      onClose();
      onSuccess();
    } catch {
      setError('تعذر الاتصال بخدمة الإدارة. تحقق من الإنترنت ثم أعد المحاولة.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-[#FAF8F3] rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border-2 border-[#C9A961]">
        <div className="bg-[#0B3D2E] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#C9A961]" />
            <h3 className="font-bold text-sm">بوابة مالك التطبيق</h3>
          </div>
          <button type="button" onClick={close} aria-label="إغلاق" className="p-1 text-white/80 hover:text-white rounded-full hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleVerify} className="p-5 space-y-4">
          <p className="text-xs text-gray-600 leading-5">
            الدخول مخصص لحساب المنصة الموثق، وتُحدد الصلاحية من خدمة الإدارة الآمنة.
          </p>
          <div>
            <label htmlFor="owner-phone" className="block text-xs font-bold text-gray-700 mb-1">رقم هاتف حساب الإدارة</label>
            <div className="relative">
              <input id="owner-phone" type="tel" dir="ltr" autoComplete="username" required value={phone} onChange={(event) => { setPhone(event.target.value); setError(null); }} placeholder="+967…" className="w-full border border-gray-300 rounded-xl p-3 pl-10 bg-white focus:outline-none focus:border-[#0B3D2E]" />
              <Phone className="w-4 h-4 text-[#C9A961] absolute left-3 top-3.5" />
            </div>
          </div>
          <div>
            <label htmlFor="owner-password" className="block text-xs font-bold text-gray-700 mb-1">كلمة المرور</label>
            <div className="relative">
              <input id="owner-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => { setPassword(event.target.value); setError(null); }} className="w-full border border-gray-300 rounded-xl p-3 pl-10 bg-white focus:outline-none focus:border-[#0B3D2E]" />
              <LockKeyhole className="w-4 h-4 text-[#C9A961] absolute left-3 top-3.5" />
            </div>
          </div>
          {error && (
            <div role="alert" className="text-xs text-[#8B2E2E] flex items-start gap-1 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="flex-1 bg-[#0B3D2E] disabled:opacity-60 text-white py-2.5 rounded-xl font-bold text-xs hover:bg-[#06231A] transition shadow-md">
              {busy ? 'جارٍ التحقق…' : 'التحقق والدخول'}
            </button>
            <button type="button" onClick={close} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-bold text-xs transition">إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  );
};
