/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  Store,
  Shield,
  Fingerprint,
  KeyRound,
  Download,
  Upload,
  Mail,
  PhoneCall,
  MessageSquare,
  Send,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Moon,
  Sun,
} from 'lucide-react';
import { db } from '../../../db/sqlite-simulation.ts';
import { getSubscriptionStatus } from '../../../utils/pureLogic.ts';
import { BiometricPromptModal } from '../BiometricPromptModal.tsx';
import { useTheme } from '../../../context/ThemeContext.tsx';
import JSZip from 'jszip';
import { saveBiometricCredentials, clearBiometricCredentials, createLocalBackup, shareBackupEverywhere } from '../../../utils/nativeServices.ts';

interface SettingsScreenProps {
  storeId: number;
  onNavigate: (screen: string, params?: Record<string, unknown>) => void;
}

const SUPPORT_PHONE = '+967778228995';

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ storeId, onNavigate }) => {
  const { isDarkMode, toggleDarkMode, setDarkMode, theme } = useTheme();
  const [storeName, setStoreName] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [district, setDistrict] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [pin, setPin] = useState('1234');
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [subscriptionEnd, setSubscriptionEnd] = useState(Date.now() + 60 * 24 * 60 * 60 * 1000);
  const [currencySymbol, setCurrencySymbol] = useState('ر.ي');
  const [receiptFooter, setReceiptFooter] = useState('شكراً لتسوقكم معنا ونسعد بخدمتكم دائماً');
  const [receiptWidth, setReceiptWidth] = useState<'58' | '80'>('58');
  const [lowStockAlertsEnabled, setLowStockAlertsEnabled] = useState(true);

  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [showBiometricPasswordModal, setShowBiometricPasswordModal] = useState(false);
  const [biometricPassword, setBiometricPassword] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [newPinInput, setNewPinInput] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, [storeId]);

  const loadSettings = () => {
    const user = db.findUserById(storeId);
    if (user) {
      setStoreName(user.store_name);
      setGovernorate(user.governorate);
      setDistrict(user.district || '');
      setNeighborhood(user.neighborhood || '');
      setPin(user.pin_code || '1234');
      setSubscriptionEnd(user.subscription_end);
    }
    const prefs = db.getSharedPreferences();
    setBiometricEnabled(!!prefs.biometric_enabled);
    setCurrencySymbol(prefs.currency_symbol || 'ر.ي');
    setReceiptFooter(prefs.receipt_footer ?? 'شكراً لتسوقكم معنا ونسعد بخدمتكم دائماً');
    setReceiptWidth(prefs.receipt_width_mm || '58');
    setLowStockAlertsEnabled(prefs.low_stock_alerts_enabled !== false);
  };

  const handleSaveBusinessSettings = () => {
    db.saveSharedPreferences({
      currency_symbol: currencySymbol.trim() || 'ر.ي',
      receipt_footer: receiptFooter.trim(),
      receipt_width_mm: receiptWidth,
      low_stock_alerts_enabled: lowStockAlertsEnabled,
    });
    setNotice('تم حفظ العملة وتنسيق الإيصال والتنبيهات');
    setTimeout(() => setNotice(null), 3000);
  };

  const handleUpdateStoreProfile = (e: React.FormEvent) => {
    e.preventDefault();
    db.updateUserProfile(storeId, {
      store_name: storeName.trim(),
      governorate: governorate.trim(),
      district: district.trim(),
      neighborhood: neighborhood.trim(),
    });
    setNotice('تم تحديث بيانات المتجر بنجاح!');
    setTimeout(() => setNotice(null), 3000);
  };

  const handleBiometricToggle = async () => {
    if (biometricEnabled) { await clearBiometricCredentials(); setBiometricEnabled(false); db.saveSharedPreferences({ biometric_enabled: false }); setNotice('تم تعطيل الدخول بالبصمة'); return; }
    setBiometricPassword('');
    setShowBiometricPasswordModal(true);
  };

  const handleSaveBiometricCredentials = async (event: React.FormEvent) => {
    event.preventDefault();
    const user = db.findUserById(storeId);
    if (!user || !biometricPassword) return;
    try {
      await saveBiometricCredentials(user.phone, biometricPassword);
      setBiometricEnabled(true);
      db.saveSharedPreferences({ biometric_enabled: true });
      setNotice('تم التحقق من بصمة الهاتف وتفعيل الدخول السريع');
      setShowBiometricPasswordModal(false);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر تفعيل البصمة على هذا الجهاز');
    } finally {
      setBiometricPassword('');
      setTimeout(() => setNotice(null), 4000);
    }
  };

  const handleBiometricSuccess = () => {}; 

  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPinInput.trim().length >= 4) {
      db.updateUserProfile(storeId, { pin_code: newPinInput.trim() });
      db.saveSharedPreferences({ current_pin: newPinInput.trim() });
      setPin(newPinInput.trim());
      setShowPinModal(false);
      setNewPinInput('');
      setNotice('تم تغيير رمز الأمان (PIN) بنجاح!');
      setTimeout(() => setNotice(null), 3000);
    }
  };

  const handleBackupToEmail = async () => {
    try { const message = await createLocalBackup(storeId); setNotice(message); setTimeout(() => setNotice(null), 4500); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'تعذر حفظ النسخة الاحتياطية'); }
  };
  const handleShareBackup = async () => { try { await shareBackupEverywhere(storeId); setNotice('تم فتح قائمة المشاركة لإرسال النسخة عبر تطبيق تختاره'); } catch (e) { setNotice(e instanceof Error ? e.message : 'تعذرت مشاركة النسخة'); } };


  // Restore SQLite database from file
  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        // If it is JSON or extracted zip
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(text);
          db.restoreFromRawState(parsed.data || parsed);
          setNotice('تم استرجاع قاعدة البيانات بنجاح!');
          loadSettings();
        } else if (file.name.endsWith('.zip')) {
          const zip = await JSZip.loadAsync(file);
          const jsonFile = zip.file('grocery_pos_database.json');
          if (jsonFile) {
            const jsonText = await jsonFile.async('text');
            const parsed = JSON.parse(jsonText);
            db.restoreFromRawState(parsed.data || parsed);
            setNotice('تم فك ضغط النسخة الاحتياطية واسترجاع قاعدة البيانات!');
            loadSettings();
          } else {
            setNotice('الملف المضغوط لا يحتوي على بيانات صالحة');
          }
        }
      } catch {
        setNotice('فشل قراءة ملف النسخة الاحتياطية');
      }
    };
    reader.readAsText(file);
  };

  const subStatus = getSubscriptionStatus(subscriptionEnd);
  const expiryDate = new Date(subscriptionEnd).toLocaleDateString('ar-YE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className={`flex-1 flex flex-col overflow-hidden transition-colors duration-300 ${theme.screenBg}`}>
      {/* Header */}
      <div className="bg-[#0B3D2E] text-white p-3.5 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('dashboard')}
            className="p-1 hover:bg-white/10 rounded-full"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <h2 className="font-bold text-sm">الإعدادات والمظهر والنسخ الاحتياطي</h2>
        </div>
        <Store className="w-5 h-5 text-[#C9A961]" />
      </div>

      {notice && (
        <div className="bg-emerald-700 text-white p-2.5 text-xs text-center font-bold flex items-center justify-center gap-1.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-[#C9A961]" />
          <span>{notice}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 1. قسم المظهر والشاشة والوضع الداكن */}
        <div className={`rounded-2xl p-4 border transition-colors duration-300 space-y-3 ${theme.cardBg}`}>
          <div className="flex items-center justify-between">
            <h3 className={`font-bold text-xs ${isDarkMode ? 'text-[#C9A961]' : 'text-[#0B3D2E]'} flex items-center gap-1.5`}>
              {isDarkMode ? <Moon className="w-4 h-4 text-[#C9A961]" /> : <Sun className="w-4 h-4 text-amber-500" />}
              <span>المظهر والشاشة (Dark Mode)</span>
            </h3>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isDarkMode
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : 'bg-amber-100 text-amber-900 border border-amber-200'
              }`}
            >
              {isDarkMode ? 'الوضع الداكن مفعّل 🌙' : 'الوضع الفاتح مفعّل ☀️'}
            </span>
          </div>

          <div className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${theme.secondaryBox}`}>
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                  isDarkMode ? 'bg-emerald-950 text-[#C9A961]' : 'bg-amber-50 text-amber-600'
                }`}
              >
                {isDarkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </div>
              <div>
                <p className={`font-bold text-xs ${theme.textPrimary}`}>الوضع الداكن المريح للعين</p>
                <p className={`text-[10px] ${theme.textSecondary}`}>
                  تقليل إجهاد العين أثناء العمل ليلاً وتوفير طاقة بطارية الهاتف
                </p>
              </div>
            </div>

            {/* Switch Toggle Button */}
            <button
              type="button"
              onClick={toggleDarkMode}
              className={`w-14 h-7 rounded-full transition-colors relative p-0.5 focus:outline-none ${
                isDarkMode ? 'bg-[#0B3D2E] border border-[#C9A961]/40' : 'bg-gray-300'
              }`}
              title="تبديل الوضع الداكن / الفاتح"
            >
              <div
                className={`w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center transition-transform duration-300 ${
                  isDarkMode ? 'translate-x-[-1.75rem] bg-[#FAF8F3]' : 'translate-x-0'
                }`}
              >
                {isDarkMode ? (
                  <Moon className="w-3.5 h-3.5 text-[#0B3D2E]" />
                ) : (
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                )}
              </div>
            </button>
          </div>

          {/* Quick Dual Switch Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => setDarkMode(false)}
              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                !isDarkMode
                  ? 'bg-[#0B3D2E] text-white border-[#0B3D2E] shadow-xs'
                  : 'bg-[#141F1A] text-gray-300 border-emerald-900/40 hover:bg-[#1a2822]'
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span>الوضع الفاتح (نهاري)</span>
            </button>

            <button
              type="button"
              onClick={() => setDarkMode(true)}
              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                isDarkMode
                  ? 'bg-[#C9A961] text-[#0B3D2E] border-[#C9A961] font-black shadow-xs'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>الوضع الداكن (ليلي)</span>
            </button>
          </div>
        </div>

        {/* 2. قسم بيانات المتجر */}
        <div className={`rounded-2xl p-4 border transition-colors duration-300 ${theme.cardBg}`}>
          <h3 className={`font-bold text-xs ${isDarkMode ? 'text-[#C9A961]' : 'text-[#0B3D2E]'} flex items-center gap-1.5 mb-3`}>
            <Store className="w-4 h-4 text-[#C9A961]" />
            <span>بيانات المتجر</span>
          </h3>

          <form onSubmit={handleUpdateStoreProfile} className="space-y-3">
            <div>
              <label className={`block text-[11px] font-bold mb-1 ${theme.textSecondary}`}>اسم البقالة:</label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className={`w-full rounded-xl px-3 py-2 text-xs border ${theme.inputBg}`}
                required
              />
            </div>
            <div>
              <label className={`block text-[11px] font-bold mb-1 ${theme.textSecondary}`}>المحافظة:</label>
              <input
                type="text"
                value={governorate}
                onChange={(e) => setGovernorate(e.target.value)}
                className={`w-full rounded-xl px-3 py-2 text-xs border ${theme.inputBg}`}
                required
              />
            </div>
            <div><label className={`block text-[11px] font-bold mb-1 ${theme.textSecondary}`}>المديرية:</label><input type="text" value={district} onChange={e=>setDistrict(e.target.value)} className={`w-full rounded-xl px-3 py-2 text-xs border ${theme.inputBg}`} required /></div>
            <div><label className={`block text-[11px] font-bold mb-1 ${theme.textSecondary}`}>الحارة:</label><input type="text" value={neighborhood} onChange={e=>setNeighborhood(e.target.value)} className={`w-full rounded-xl px-3 py-2 text-xs border ${theme.inputBg}`} required /></div>
            <button
              type="submit"
              className="w-full bg-[#0B3D2E] hover:bg-[#06231A] text-white py-2 rounded-xl text-xs font-bold transition shadow-xs"
            >
              حفظ التعديلات
            </button>
          </form>
        </div>

        {/* 3. إعدادات البيع والإيصالات */}
        <div className={`rounded-2xl p-4 border transition-colors duration-300 space-y-3 ${theme.cardBg}`}>
          <h3 className={`font-bold text-xs ${isDarkMode ? 'text-[#C9A961]' : 'text-[#0B3D2E]'}`}>إعدادات البيع والإيصالات</h3>
          <div className="grid grid-cols-2 gap-2">
            <label className={`text-[11px] font-bold ${theme.textSecondary}`}>رمز العملة
              <select value={currencySymbol} onChange={e => setCurrencySymbol(e.target.value)} className={`mt-1 w-full rounded-xl border px-2 py-2 text-xs ${theme.inputBg}`}>
                <option value="ر.ي">الريال اليمني (ر.ي)</option><option value="ر.س">الريال السعودي (ر.س)</option><option value="$">الدولار الأمريكي ($)</option><option value="ر.ع">الريال العماني (ر.ع)</option>
              </select>
            </label>
            <label className={`text-[11px] font-bold ${theme.textSecondary}`}>عرض الإيصال الحراري
              <select value={receiptWidth} onChange={e => setReceiptWidth(e.target.value as '58' | '80')} className={`mt-1 w-full rounded-xl border px-2 py-2 text-xs ${theme.inputBg}`}><option value="58">58 مم</option><option value="80">80 مم</option></select>
            </label>
          </div>
          <label className={`block text-[11px] font-bold ${theme.textSecondary}`}>عبارة أسفل الفاتورة
            <textarea value={receiptFooter} onChange={e => setReceiptFooter(e.target.value)} maxLength={120} rows={2} placeholder="مثال: شكراً لزيارتكم" className={`mt-1 w-full resize-y rounded-xl border px-3 py-2 text-xs ${theme.inputBg}`} />
          </label>
          <label className={`flex items-center justify-between rounded-xl border p-3 ${theme.secondaryBox}`}><span className={`text-xs font-bold ${theme.textPrimary}`}>إظهار تنبيهات انخفاض المخزون</span><input type="checkbox" checked={lowStockAlertsEnabled} onChange={e => setLowStockAlertsEnabled(e.target.checked)} className="h-4 w-4 accent-emerald-700" /></label>
          <button type="button" onClick={handleSaveBusinessSettings} className="w-full rounded-xl bg-[#0B3D2E] py-2 text-xs font-bold text-white">حفظ إعدادات البيع والإيصالات</button>
        </div>

        {/* 3. قسم الأمان والحماية */}
        <div className={`rounded-2xl p-4 border transition-colors duration-300 space-y-3 ${theme.cardBg}`}>
          <h3 className={`font-bold text-xs ${isDarkMode ? 'text-[#C9A961]' : 'text-[#0B3D2E]'} flex items-center gap-1.5`}>
            <Shield className="w-4 h-4 text-[#C9A961]" />
            <span>الأمان والحماية</span>
          </h3>

          {/* Biometrics Toggle */}
          <div className={`flex items-center justify-between p-2.5 rounded-xl border ${theme.secondaryBox}`}>
            <div className="flex items-center gap-2">
              <Fingerprint className="w-5 h-5 text-[#C9A961]" />
              <div>
                <p className={`font-bold text-xs ${theme.textPrimary}`}>تفعيل البصمة (Biometric)</p>
                <p className={`text-[10px] ${theme.textSecondary}`}>حماية الدخول بالبصمة البيومترية</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleBiometricToggle}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                biometricEnabled ? 'bg-[#0B3D2E]' : 'bg-gray-400'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                  biometricEnabled ? 'right-6' : 'right-0.5'
                }`}
              />
            </button>
          </div>

          {/* Change PIN button */}
          <div className={`flex items-center justify-between p-2.5 rounded-xl border ${theme.secondaryBox}`}>
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-[#C9A961]" />
              <div>
                <p className={`font-bold text-xs ${theme.textPrimary}`}>رمز الأمان السري (PIN)</p>
                <p className={`text-[10px] ${theme.textSecondary} font-mono`}>الرمز الحالي: {pin.replace(/./g, '•')}</p>
              </div>
            </div>
            <button
              onClick={() => setShowPinModal(true)}
              className={`text-xs border font-bold px-3 py-1.5 rounded-lg transition ${
                isDarkMode ? 'bg-[#141F1A] border-emerald-800 text-gray-200 hover:bg-[#1a2822]' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              تغيير
            </button>
          </div>
        </div>

        {/* 4. قسم النسخ الاحتياطي والاسترجاع */}
        <div className={`rounded-2xl p-4 border transition-colors duration-300 space-y-3 ${theme.cardBg}`}>
          <h3 className={`font-bold text-xs ${isDarkMode ? 'text-[#C9A961]' : 'text-[#0B3D2E]'} flex items-center gap-1.5`}>
            <Download className="w-4 h-4 text-[#C9A961]" />
            <span>النسخ الاحتياطي لقاعدة البيانات</span>
          </h3>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleBackupToEmail}
              className={`p-3 border rounded-xl text-center flex flex-col items-center transition ${
                isDarkMode ? 'bg-emerald-950/40 hover:bg-emerald-950/70 border-emerald-800/80' : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300'
              }`}
            >
              <Download className="w-5 h-5 text-[#C9A961] mb-1" />
              <span className={`font-bold text-xs ${theme.textPrimary}`}>حفظ نسخة على الهاتف</span>
              <span className={`text-[9px] ${theme.textSecondary}`}>حفظ ZIP مؤرّخ في مجلد التطبيق</span>
            </button>

            <label
              className={`p-3 border rounded-xl text-center flex flex-col items-center cursor-pointer transition ${
                isDarkMode ? 'bg-blue-950/40 hover:bg-blue-950/70 border-blue-800/80' : 'bg-blue-50 hover:bg-blue-100 border-blue-300'
              }`}
            >
              <Upload className="w-5 h-5 text-blue-400 mb-1" />
              <span className={`font-bold text-xs ${theme.textPrimary}`}>استرجاع من ملف</span>
              <span className={`text-[9px] ${theme.textSecondary}`}>رفع .zip أو .json</span>
              <input
                type="file"
                accept=".zip,.json"
                onChange={handleRestoreFile}
                className="hidden"
              />
            </label>
          </div>
          <button onClick={handleShareBackup} className="w-full p-2.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900 font-bold text-xs">مشاركة نسخة احتياطية عبر تطبيق آخر</button>

          <button
            onClick={() => {
              if (confirm('سيتم حذف جميع بيانات المتجر المحلية (المنتجات والعملاء والفواتير والمصروفات) من هذا الجهاز. تأكد من حفظ نسخة احتياطية قبل المتابعة. هل تريد المتابعة؟')) {
                db.resetToDefaults();
                loadSettings();
                setNotice('تم مسح بيانات المتجر المحلية وإعادة ضبط التطبيق');
              }
            }}
            className="w-full text-center text-[11px] text-gray-400 hover:text-red-400 font-semibold py-1 flex items-center justify-center gap-1 transition"
          >
            <RefreshCw className="w-3 h-3" />
            <span>مسح بيانات المتجر من هذا الجهاز</span>
          </button>
        </div>

        {/* 5. قسم الاشتراك والدعم الفني */}
        <div className={`rounded-2xl p-4 border transition-colors duration-300 space-y-3 ${theme.cardBg}`}>
          <div className="flex justify-between items-center">
            <h3 className={`font-bold text-xs ${isDarkMode ? 'text-[#C9A961]' : 'text-[#0B3D2E]'}`}>حالة الاشتراك والترخيص</h3>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                subStatus.isExpired
                  ? 'bg-red-950 text-red-300 border border-red-800'
                  : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
              }`}
            >
              {subStatus.isExpired ? 'منتهي' : `نشط (متبقي ${subStatus.daysRemaining} يوم)`}
            </span>
          </div>

          <p className={`text-xs ${theme.textSecondary}`}>
            تاريخ انتهاء الاشتراك: <span className={`font-bold ${theme.textPrimary}`}>{expiryDate}</span>
          </p>

          <div className={`p-3 rounded-xl border space-y-2 ${theme.secondaryBox}`}>
            <p className={`text-[11px] font-bold ${theme.textSecondary}`}>تجديد الاشتراك والتواصل المباشر:</p>
            <div className="grid grid-cols-3 gap-1.5">
              <a
                href={`tel:${SUPPORT_PHONE}`}
                className="p-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-center text-xs font-bold flex items-center justify-center gap-1 transition"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>اتصال</span>
              </a>

              <a
                href={`https://api.whatsapp.com/send?phone=${SUPPORT_PHONE}&text=${encodeURIComponent(
                  'أهلاً، أريد تجديد اشتراك تطبيق إدارة البقالة للمتجر: ' + storeName
                )}`}
                target="_blank"
                rel="noreferrer"
                className="p-2 bg-[#25D366] hover:bg-[#20ba59] text-white rounded-xl text-center text-xs font-bold flex items-center justify-center gap-1 transition"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>واتساب</span>
              </a>

              <a
                href={`sms:${SUPPORT_PHONE}?body=${encodeURIComponent('طلب تجديد اشتراك تطبيق البقالة')}`}
                className="p-2 bg-gray-800 hover:bg-black text-white rounded-xl text-center text-xs font-bold flex items-center justify-center gap-1 transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>SMS</span>
              </a>
            </div>
            <p className="text-[10px] text-gray-500 text-center font-mono">{SUPPORT_PHONE}</p>
          </div>
        </div>
      </div>

      {/* Change PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className={`rounded-3xl w-full max-w-xs p-5 shadow-2xl border border-[#C9A961] space-y-3 ${isDarkMode ? 'bg-[#18221E] text-white' : 'bg-[#FAF8F3] text-gray-900'}`}>
            <h3 className="font-bold text-sm text-[#C9A961]">تغيير رمز الأمان (PIN)</h3>
            <form onSubmit={handleChangePin} className="space-y-3">
              <input
                type="password"
                maxLength={4}
                placeholder="أدخل 4 أرقام جديدة"
                value={newPinInput}
                onChange={(e) => setNewPinInput(e.target.value)}
                autoFocus
                className={`w-full text-center text-lg font-mono tracking-widest border rounded-xl p-2.5 ${theme.inputBg}`}
                required
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-[#0B3D2E] text-white py-2 rounded-xl text-xs font-bold hover:bg-[#06231A]"
                >
                  حفظ الرمز
                </button>
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className={`px-3 py-2 border rounded-xl text-xs font-bold transition ${isDarkMode ? 'border-emerald-800 text-gray-300 hover:bg-[#121B17]' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showBiometricPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className={`rounded-3xl w-full max-w-xs p-5 shadow-2xl border border-[#C9A961] space-y-3 ${isDarkMode ? 'bg-[#18221E] text-white' : 'bg-[#FAF8F3] text-gray-900'}`}>
            <h3 className="font-bold text-sm text-[#C9A961]">تفعيل الدخول بالبصمة</h3>
            <p className={`text-xs ${theme.textSecondary}`}>أدخل كلمة المرور الحالية لحفظ بيانات الدخول في مخزن Android الآمن.</p>
            <form onSubmit={handleSaveBiometricCredentials} className="space-y-3">
              <input type="password" autoComplete="current-password" value={biometricPassword} onChange={e => setBiometricPassword(e.target.value)} placeholder="كلمة المرور الحالية" className={`w-full border rounded-xl p-3 text-sm ${theme.inputBg}`} required autoFocus />
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-[#0B3D2E] text-white py-2.5 rounded-xl text-xs font-bold">حفظ وتفعيل</button>
                <button type="button" onClick={() => { setShowBiometricPasswordModal(false); setBiometricPassword(''); }} className={`px-3 py-2 border rounded-xl text-xs font-bold ${theme.borderColor}`}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
