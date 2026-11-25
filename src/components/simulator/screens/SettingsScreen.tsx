import React, { useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  ArrowRight,
  Store,
  Palette,
  ShoppingCart,
  Shield,
  Database,
  Printer,
  Package,
  Headphones,
  Info,
  Download,
  Upload,
  Sun,
  Moon,
  CheckCircle2,
  PhoneCall,
  MessageSquare,
  Send,
  Bell,
  ClipboardList,
  Share2,
  LogOut,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import JSZip from 'jszip';
import { db } from '../../../db/sqlite-simulation.ts';
import { getSubscriptionStatus, formatCurrency } from '../../../utils/pureLogic.ts';
import {
  APP_VERSION,
  OWNER_SUPPORT_PHONE,
  OWNER_SUPPORT_WHATSAPP_DIGITS,
  buildAppShareMessage,
  buildPackageActivationMessage,
  computeInventoryAudit,
} from '../../../utils/appRules.ts';
import type { StoreNotification, SubscriptionPackage } from '../../../types/index.ts';
import { useTheme } from '../../../context/ThemeContext.tsx';
import {
  saveBiometricCredentials,
  clearBiometricCredentials,
  createLocalBackup,
  shareBackupEverywhere,
  shareTextEverywhere,
} from '../../../utils/nativeServices.ts';
import {
  changeMerchantPassword,
  signOutMerchantSession,
  updateCloudStoreProfile,
} from '../../../services/authService.ts';
import { createCloudSnapshot, restoreCloudSnapshot } from '../../../services/syncService.ts';
import {
  NOTIFICATION_RELAY_PREFIX,
  isNotificationRelayPackage,
  markAllCloudNotificationsRead,
  markCloudNotificationRead,
  subscribeToStoreNotifications,
  syncCloudStoreNotifications,
} from '../../../services/notificationsService.ts';
import { supabase } from '../../../supabaseClient.ts';
import {
  connectBluetoothPrinter,
  listPairedBluetoothPrinters,
  openBluetoothSettings,
  type PairedBluetoothDevice,
} from '../../../services/bluetoothPrinter.ts';

const sections = [
  ['general', 'بيانات المتجر', Store],
  ['notifications', 'رسائل إدارة التطبيق', Bell],
  ['sales', 'البيع والإيصالات', ShoppingCart],
  ['security', 'الأمان والدخول', Shield],
  ['peripherals', 'الأجهزة الطرفية', Printer],
  ['backup', 'النسخ والبيانات', Database],
  ['inventory_audit', 'جرد المخزون', ClipboardList],
  ['financial', 'المالية والضرائب', Package],
  ['subscription', 'الاشتراك والترخيص', Headphones],
  ['about', 'حول التطبيق', Info],
  ['appearance', 'المظهر والشاشة', Palette],
] as const;

export type SettingsSection = (typeof sections)[number][0];

interface Props {
  storeId: number;
  initialSection?: SettingsSection;
  initialOpenPasswordModal?: boolean;
  onNavigate: (screen: string, params?: Record<string, unknown>) => void;
}

export const SettingsScreen: React.FC<Props> = ({
  storeId,
  initialSection,
  initialOpenPasswordModal = false,
  onNavigate,
}) => {
  const { isDarkMode, setDarkMode, theme } = useTheme();
  const [section, setSection] = useState<SettingsSection>(initialSection || 'general');
  const [notice, setNotice] = useState('');
  const [storeName, setStoreName] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [district, setDistrict] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [phone, setPhone] = useState('');
  const [currency, setCurrency] = useState('ر.ي');
  const [receiptWidth, setReceiptWidth] = useState<'58' | '80'>('58');
  const [receiptFooter, setReceiptFooter] = useState('شكراً لتسوقكم معنا');
  const [lowStock, setLowStock] = useState(true);
  const [biometric, setBiometric] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [pin, setPin] = useState('1234');
  const [showPin, setShowPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [autoLock, setAutoLock] = useState<1 | 5 | 15 | 30 | 60>(5);
  const [showPassword, setShowPassword] = useState(initialOpenPasswordModal);
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);

  // In-app confirmation / prompt modals (replaces window.confirm / window.prompt)
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [biometricPwd, setBiometricPwd] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);

  const [printer, setPrinter] = useState('غير مربوط');
  const [barcodeSource, setBarcodeSource] = useState<'camera' | 'external'>('camera');
  const [printerAddress, setPrinterAddress] = useState('');
  const [pairedPrinters, setPairedPrinters] = useState<PairedBluetoothDevice[]>([]);
  const [printerBusy, setPrinterBusy] = useState(false);
  const [cloudFrequency, setCloudFrequency] = useState<'manual' | 'daily' | 'weekly' | 'shift_close'>('manual');
  const [retainCount, setRetainCount] = useState('7');
  const [taxNumber, setTaxNumber] = useState('');
  const [vatEnabled, setVatEnabled] = useState(false);
  const [vatPercent, setVatPercent] = useState('15');
  const [subscriptionStart, setSubscriptionStart] = useState<number | undefined>(undefined);
  const [subscriptionEnd, setSubscriptionEnd] = useState(Date.now());
  const [notifications, setNotifications] = useState<StoreNotification[]>([]);
  const [notifSyncing, setNotifSyncing] = useState(false);
  const [notifError, setNotifError] = useState('');
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);

  const restriction = db.getStoreRestriction(storeId);
  const isRestricted = restriction.restricted;

  const notify = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(''), 4200);
  };

  useEffect(() => {
    if (initialSection) setSection(initialSection);
    if (initialOpenPasswordModal) {
      setSection('security');
      setPasswordError('');
      setShowPassword(true);
    }
  }, [initialSection, initialOpenPasswordModal]);

  const load = () => {
    const u = db.findUserById(storeId);
    if (u) {
      setStoreName(u.store_name || '');
      setPhone(u.phone || '');
      setGovernorate(u.governorate || '');
      setDistrict(u.district || '');
      setNeighborhood(u.neighborhood || '');
      setPin(u.pin_code || '1234');
      setSubscriptionEnd(u.subscription_end || Date.now());
      setSubscriptionStart(u.subscription_start);
    }
    const p = db.getSharedPreferences();
    setCurrency(p.currency_symbol || 'ر.ي');
    setReceiptWidth(p.receipt_width_mm || '58');
    setReceiptFooter(p.receipt_footer || 'شكراً لتسوقكم معنا');
    setLowStock(p.low_stock_alerts_enabled !== false);
    setBiometric(!!p.biometric_enabled);
    setMustChangePassword(!!p.must_change_password);
    setAutoLock(p.auto_lock_minutes || 5);
    setPrinter(p.thermal_printer || 'غير مربوط');
    setPrinterAddress(p.thermal_printer_address || '');
    setBarcodeSource(p.barcode_source || 'camera');
    setCloudFrequency(p.cloud_backup_frequency || 'manual');
    setRetainCount(String(p.backup_retain_count || 7));
    setTaxNumber(p.tax_registration_number || '');
    setVatEnabled(!!p.vat_enabled);
    setVatPercent(String(p.vat_percent || 15));
    setNotifications(db.getStoreNotifications(storeId));
    setPackages(db.getSubscriptionPackages().filter((pkg) => pkg.is_active === 1));
  };

  const refreshNotifications = async (explicit = false) => {
    const prefs = db.getSharedPreferences();
    setNotifError('');
    setNotifSyncing(true);
    try {
      const merged = await syncCloudStoreNotifications(storeId, prefs.cloud_store_id, { throwOnError: explicit });
      setNotifications(merged);
      if (explicit) notify('تم تحديث رسائل إدارة التطبيق');
    } catch (err) {
      setNotifError(err instanceof Error ? err.message : 'تعذر تحديث الرسائل سحابياً.');
      setNotifications(db.getStoreNotifications(storeId));
    } finally {
      setNotifSyncing(false);
    }
  };

  useEffect(() => {
    load();
    // Sync cloud notifications & subscription packages when online
    const prefs = db.getSharedPreferences();
    if (supabase && prefs.cloud_store_id) {
      void supabase.auth.getSession().then(({ data: sessionData }) => {
        if (!sessionData.session || !supabase) return;
        void supabase
          .from('subscription_packages')
          .select('id,name,duration_days,price,description,is_active')
          .eq('is_active', true)
          .not('name', 'like', `${NOTIFICATION_RELAY_PREFIX}%`)
          .then(({ data }) => {
            const visiblePackages = (data || []).filter((pkg: any) => !isNotificationRelayPackage(pkg));
            if (visiblePackages.length) {
              setPackages(
                visiblePackages.map((pkg: any, idx: number) => ({
                  id: Number(pkg.id) || idx + 1,
                  name: String(pkg.name),
                  duration_days: Number(pkg.duration_days),
                  price: Number(pkg.price),
                  description: pkg.description || '',
                  is_active: 1,
                })),
              );
            }
          });
      });
    }
    void refreshNotifications(false);
    return subscribeToStoreNotifications(storeId, prefs.cloud_store_id, (updatedList) => {
      setNotifications(updatedList);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  useEffect(() => {
    if (section === 'notifications') {
      void refreshNotifications(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, storeId]);

  const inventoryAudit = useMemo(
    () => computeInventoryAudit(db.getProducts(storeId), storeName || 'متجري'),
    [storeId, storeName, section],
  );

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const saveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRestricted) {
      notify(restriction.message || 'الحساب مقيد — لا يمكن حفظ التعديلات حالياً');
      return;
    }
    try {
      await updateCloudStoreProfile(storeId, {
        store_name: storeName.trim(),
        governorate: governorate.trim(),
        district: district.trim(),
        neighborhood: neighborhood.trim(),
        phone: phone.trim(),
      });
      load();
      notify('تم حفظ تعديلات بيانات المتجر');
    } catch (err) {
      load();
      notify(err instanceof Error ? `تم الحفظ محلياً (مزامنة لاحقة): ${err.message}` : 'تم حفظ التعديلات محلياً');
    }
  };

  const saveSales = () => {
    if (isRestricted) {
      notify('الحساب مقيد — لا يمكن تعديل إعدادات البيع حالياً');
      return;
    }
    db.saveSharedPreferences({
      currency_symbol: currency,
      receipt_width_mm: receiptWidth,
      receipt_footer: receiptFooter,
      low_stock_alerts_enabled: lowStock,
    });
    notify('تم حفظ إعدادات البيع والإيصالات');
  };

  const toggleBiometric = async () => {
    if (isRestricted) {
      notify('الحساب مقيد — لا يمكن تعديل إعدادات البصمة حالياً');
      return;
    }
    if (biometric) {
      await clearBiometricCredentials().catch(() => undefined);
      setBiometric(false);
      db.saveSharedPreferences({ biometric_enabled: false });
      notify('تم تعطيل البصمة');
      return;
    }
    setBiometricPwd('');
    setShowBiometricPrompt(true);
  };

  const confirmEnableBiometric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!biometricPwd) return;
    try {
      await saveBiometricCredentials(phone, biometricPwd);
      setBiometric(true);
      db.saveSharedPreferences({ biometric_enabled: true });
      setShowBiometricPrompt(false);
      setBiometricPwd('');
      notify('تم تفعيل البصمة');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر تفعيل البصمة');
    }
  };

  const openPasswordModal = () => {
    setPasswordError('');
    setCurrentPassword('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(true);
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordBusy) return;
    setPasswordError('');
    if (!currentPassword) {
      setPasswordError('أدخل كلمة المرور الحالية أو المؤقتة التي منحتك إياها الإدارة.');
      return;
    }
    if (password.length < 8) {
      setPasswordError('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.');
      return;
    }
    if (password.length > 72) {
      setPasswordError('كلمة المرور الجديدة يجب ألا تتجاوز 72 حرفاً.');
      return;
    }
    if (password === currentPassword) {
      setPasswordError('كلمة المرور الجديدة يجب أن تختلف عن كلمة المرور الحالية.');
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError('تأكيد كلمة المرور الجديدة غير مطابق.');
      return;
    }
    setPasswordBusy(true);
    try {
      const result = await changeMerchantPassword(storeId, currentPassword, password, confirmPassword);
      setShowPassword(false);
      setCurrentPassword('');
      setPassword('');
      setConfirmPassword('');
      setPasswordError('');
      setMustChangePassword(false);
      if (result.biometricCleared) {
        setBiometric(false);
        notify('تم تغيير كلمة المرور بنجاح — أعد تفعيل البصمة بكلمة المرور الجديدة عند الحاجة');
      } else {
        notify('تم تغيير كلمة المرور بنجاح وتأمين حسابك');
      }
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'تعذر تغيير كلمة المرور.');
    } finally {
      setPasswordBusy(false);
    }
  };

  const changePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRestricted) return;
    if (!/^\d{4,6}$/.test(newPin)) {
      notify('رمز PIN يجب أن يكون من 4 إلى 6 أرقام');
      return;
    }
    db.updateUserProfile(storeId, { pin_code: newPin });
    db.saveSharedPreferences({ current_pin: newPin });
    setPin(newPin);
    setNewPin('');
    setShowPin(false);
    notify('تم تغيير رمز PIN');
  };

  const restore = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isRestricted) {
      notify('الحساب مقيد — مسموح إنشاء النسخ الاحتياطية فقط');
      e.target.value = '';
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(String(reader.result));
          db.restoreFromRawState(parsed.data || parsed);
        } else {
          const zip = await JSZip.loadAsync(file);
          const entry = zip.file('grocery_pos_database.json');
          if (!entry) throw new Error('الملف لا يحتوي قاعدة بيانات صالحة');
          const parsed = JSON.parse(await entry.async('text'));
          db.restoreFromRawState(parsed.data || parsed);
        }
        load();
        notify('تمت استعادة قاعدة البيانات بنجاح');
      } catch {
        notify('تعذرت قراءة ملف النسخة الاحتياطية');
      }
    };
    reader.readAsText(file);
  };

  const pairPrinter = async () => {
    if (!Capacitor.isNativePlatform()) {
      notify('اقتران الطابعة مدعوم من تطبيق Android.');
      return;
    }
    setPrinterBusy(true);
    try {
      const devices = await listPairedBluetoothPrinters();
      setPairedPrinters(devices);
      if (!devices.length) {
        await openBluetoothSettings();
        notify('لم نعثر على أجهزة مقترنة. اقترن بالطابعة من إعدادات Bluetooth في الهاتف ثم ارجع واضغط البحث مرة أخرى.');
        return;
      }
      notify('اختر الطابعة من قائمة الأجهزة المقترنة.');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'تعذر البحث عن الطابعات');
    } finally {
      setPrinterBusy(false);
    }
  };

  const showBluetoothSettings = async () => {
    try {
      if (!Capacitor.isNativePlatform()) throw new Error('افتح إعدادات Bluetooth في هاتف Android لاقتران الطابعة.');
      await openBluetoothSettings();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'تعذر فتح إعدادات Bluetooth');
    }
  };

  const connectPrinter = async (device: PairedBluetoothDevice) => {
    setPrinterBusy(true);
    try {
      await connectBluetoothPrinter(device.address);
      setPrinter(device.name);
      setPrinterAddress(device.address);
      db.saveSharedPreferences({ thermal_printer: device.name, thermal_printer_address: device.address });
      notify(`تم الاتصال بالطابعة ${device.name}`);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'تعذر الاتصال بالطابعة');
    } finally {
      setPrinterBusy(false);
    }
  };

  const handleConfirmDeleteAccountAndLogout = async () => {
    await clearBiometricCredentials().catch(() => undefined);
    await signOutMerchantSession().catch(() => undefined);
    db.deleteLocalAccountAndLogout(storeId);
    setShowDeleteAccountConfirm(false);
    onNavigate('login');
  };

  const handleShareApp = async () => {
    if (isRestricted) {
      notify('الحساب مقيد — المشاركة غير متاحة حالياً');
      return;
    }
    try {
      const outcome = await shareTextEverywhere('مشاركة تطبيق بقالتي برو', buildAppShareMessage());
      notify(
        outcome === 'shared'
          ? 'تم فتح مشاركة بقالتي برو بدون إنترنت'
          : 'تم نسخ رابط ورسالة تحميل بقالتي برو بدون إنترنت',
      );
    } catch (e) {
      if (!(e instanceof Error && e.name === 'AbortError')) {
        notify('تم تجهيز رابط تحميل بقالتي برو للمشاركة');
      }
    }
  };

  const card = `rounded-2xl border p-4 space-y-4 ${theme.cardBg}`;
  const label = `block text-xs font-bold ${theme.textPrimary}`;
  const input = `mt-1 w-full rounded-xl border px-3 py-2.5 text-sm ${theme.inputBg}`;
  const switchRow = (title: string, subtitle: string, value: boolean, on: () => void, disabled = false) => (
    <div className={`flex items-center justify-between rounded-xl border p-3 ${theme.secondaryBox}`}>
      <div>
        <p className="text-xs font-bold">{title}</p>
        <p className={`mt-1 text-[10px] ${theme.textSecondary}`}>{subtitle}</p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={on}
        className={`relative h-7 w-12 shrink-0 rounded-full disabled:opacity-40 ${value ? 'bg-emerald-700' : 'bg-gray-400'}`}
      >
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition ${value ? 'right-0.5' : 'left-0.5'}`} />
      </button>
    </div>
  );

  const subStatus = getSubscriptionStatus(subscriptionEnd);

  return (
    <div className={`flex-1 flex flex-col overflow-hidden ${theme.screenBg}`}>
      <header className="flex items-center justify-between bg-[#0B3D2E] p-3.5 text-white">
        <div className="flex items-center gap-2">
          <button onClick={() => onNavigate('dashboard')} aria-label="رجوع">
            <ArrowRight className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-sm font-bold">الإعدادات والمظهر والنسخ الاحتياطي</h1>
            <p className="mt-0.5 text-[10px] text-emerald-100">
              {isRestricted
                ? restriction.reason === 'expired'
                  ? 'حالة المتجر: منتهي الاشتراك (النسخ الاحتياطي والتقارير فقط)'
                  : 'حالة المتجر: موقوف (النسخ الاحتياطي والتقارير فقط)'
                : 'حالة المتجر: نشط ومتاح للعمل'}
            </p>
          </div>
        </div>
        <span
          className={`rounded-full border px-2 py-1 text-[10px] font-bold ${
            isRestricted ? 'border-red-300 bg-red-800/80 text-white' : 'border-emerald-300/50 bg-white/10'
          }`}
        >
          {isRestricted ? (restriction.reason === 'expired' ? 'منتهي' : 'موقوف') : 'نشط'}
        </span>
      </header>

      {isRestricted && (
        <div className="bg-[#8B2E2E] text-white px-3 py-2 text-[11px] font-bold flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{restriction.message}</span>
        </div>
      )}

      {notice && (
        <div role="status" className="flex items-center justify-center gap-1.5 bg-emerald-700 px-3 py-2 text-xs font-bold text-white">
          <CheckCircle2 className="h-4 w-4" />
          {notice}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className={`w-[138px] shrink-0 overflow-y-auto border-l p-1.5 ${theme.cardBg} ${theme.borderColor}`}>
          {sections.map(([id, title, Icon]) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={`mb-1 flex w-full items-center justify-between gap-1 rounded-xl px-2 py-2.5 text-right text-[11px] font-bold ${
                section === id ? 'bg-emerald-700 text-white' : ''
              }`}
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <Icon className="h-4 w-4 shrink-0" />
                <span className="leading-tight text-right">{title}</span>
              </span>
              {id === 'notifications' && unreadCount > 0 && (
                <span className="shrink-0 rounded-full bg-red-600 text-white text-[9px] px-1.5 py-0.5 font-mono">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </aside>

        <main className="flex-1 overflow-y-auto p-4 space-y-4">
          {section === 'general' && (
            <div className={card}>
              <h2 className="text-sm font-bold">بيانات المتجر</h2>
              <form onSubmit={(e) => void saveStore(e)} className="grid gap-3 sm:grid-cols-2">
                <label className={label}>
                  اسم البقالة / المتجر
                  <input value={storeName} onChange={(e) => setStoreName(e.target.value)} required className={input} disabled={isRestricted} />
                </label>
                <label className={label}>
                  رقم هاتف المتجر
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" className={input} disabled={isRestricted} />
                </label>
                <label className={label}>
                  المحافظة
                  <input value={governorate} onChange={(e) => setGovernorate(e.target.value)} className={input} disabled={isRestricted} />
                </label>
                <label className={label}>
                  المديرية
                  <input value={district} onChange={(e) => setDistrict(e.target.value)} className={input} disabled={isRestricted} />
                </label>
                <label className={`${label} sm:col-span-2`}>
                  الحارة / الشارع
                  <input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className={input} disabled={isRestricted} />
                </label>
                <button
                  type="submit"
                  disabled={isRestricted}
                  className="sm:col-span-2 rounded-xl bg-emerald-700 py-3 text-xs font-bold text-white disabled:opacity-40"
                >
                  حفظ التعديلات
                </button>
              </form>
            </div>
          )}

          {section === 'notifications' && (
            <div className={card}>
              <div className="flex flex-col gap-2">
                <h2 className="text-sm font-bold leading-snug">رسائل إدارة التطبيق والإشعارات</h2>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <button
                    type="button"
                    disabled={notifSyncing}
                    onClick={() => void refreshNotifications(true)}
                    className="whitespace-nowrap rounded-lg border border-emerald-600/40 bg-emerald-50/70 dark:bg-emerald-950/30 px-2.5 py-1.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5 disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3 h-3 shrink-0 ${notifSyncing ? 'animate-spin' : ''}`} />
                    <span>تحديث الرسائل</span>
                  </button>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        void markAllCloudNotificationsRead(storeId, notifications).then((updated) => {
                          setNotifications(updated);
                        });
                      }}
                      className="whitespace-nowrap text-[11px] font-bold text-emerald-700 underline"
                    >
                      تحديد الكل كمقروء
                    </button>
                  )}
                </div>
              </div>
              {notifError && (
                <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-[11px] font-semibold text-red-800">
                  {notifError}
                </p>
              )}
              {notifications.length === 0 ? (
                <p className={`text-xs py-6 text-center ${theme.textMuted}`}>لا توجد رسائل أو إشعارات من إدارة التطبيق حالياً.</p>
              ) : (
                <div className="space-y-2">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        void markCloudNotificationRead(storeId, n).then(() => {
                          setNotifications(db.getStoreNotifications(storeId));
                        });
                      }}
                      className={`rounded-xl border p-3 cursor-pointer space-y-1 ${
                        n.read_at ? theme.secondaryBox : 'border-[#C9A961] bg-amber-50/70 dark:bg-amber-950/30'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-xs">{n.title}</strong>
                        {!n.read_at && <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.5 rounded-full font-bold">جديد</span>}
                      </div>
                      <p className={`text-xs leading-relaxed ${theme.textPrimary}`}>{n.message}</p>
                      <p className={`text-[10px] font-mono ${theme.textMuted}`}>
                        {n.sender ? `${n.sender} · ` : ''}
                        {n.created_at.replace('T', ' ').slice(0, 16)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {section === 'appearance' && (
            <div className={card}>
              <h2 className="text-sm font-bold">المظهر والشاشة</h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  disabled={isRestricted}
                  onClick={() => setDarkMode(false)}
                  className={`rounded-xl border p-5 text-xs font-bold disabled:opacity-40 ${!isDarkMode ? 'bg-emerald-700 text-white' : ''}`}
                >
                  <Sun className="mx-auto mb-2 h-5 w-5" />
                  الوضع الفاتح
                </button>
                <button
                  disabled={isRestricted}
                  onClick={() => setDarkMode(true)}
                  className={`rounded-xl border p-5 text-xs font-bold disabled:opacity-40 ${isDarkMode ? 'bg-emerald-700 text-white' : ''}`}
                >
                  <Moon className="mx-auto mb-2 h-5 w-5" />
                  الوضع الداكن
                </button>
              </div>
            </div>
          )}

          {section === 'sales' && (
            <div className={card}>
              <h2 className="text-sm font-bold">إعدادات البيع والإيصالات</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={label}>
                  رمز العملة
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={input} disabled={isRestricted}>
                    <option>ر.ي</option>
                    <option>ر.س</option>
                    <option>$</option>
                    <option>ر.ع</option>
                  </select>
                </label>
                <label className={label}>
                  عرض الإيصال الحراري
                  <select value={receiptWidth} onChange={(e) => setReceiptWidth(e.target.value as '58' | '80')} className={input} disabled={isRestricted}>
                    <option value="58">58 مم</option>
                    <option value="80">80 مم</option>
                  </select>
                </label>
                <label className={`${label} sm:col-span-2`}>
                  عبارة أسفل الفاتورة
                  <textarea value={receiptFooter} onChange={(e) => setReceiptFooter(e.target.value)} maxLength={120} rows={3} className={input} disabled={isRestricted} />
                </label>
              </div>
              {switchRow('إظهار تنبيهات انخفاض المخزون', 'تنبيه عند اقتراب نفاد المنتجات', lowStock, () => setLowStock((v) => !v), isRestricted)}
              <button disabled={isRestricted} onClick={saveSales} className="w-full rounded-xl bg-emerald-700 py-3 text-xs font-bold text-white disabled:opacity-40">
                حفظ إعدادات البيع والإيصالات
              </button>
            </div>
          )}

          {section === 'security' && (
            <div className={card}>
              <h2 className="text-sm font-bold">الأمان وحماية الدخول</h2>
              {mustChangePassword && (
                <div role="alert" className="rounded-xl border border-amber-400 bg-amber-50 dark:bg-amber-950/50 p-3 text-xs text-amber-950 dark:text-amber-100 space-y-1">
                  <p className="font-bold">تم تعيين كلمة مرور مؤقتة لحسابك من الإدارة</p>
                  <p className="text-[11px] leading-relaxed">يُنصح بتغيير كلمة المرور المؤقتة الآن إلى كلمة مرور خاصة بك لا تقل عن 8 أحرف لضمان أمان حسابك.</p>
                </div>
              )}
              <button
                type="button"
                onClick={openPasswordModal}
                className="w-full rounded-xl border border-[#C9A961]/60 p-3 text-right text-xs font-bold flex items-center justify-between"
              >
                <span>تغيير كلمة المرور</span>
                {mustChangePassword && <span className="rounded-full bg-amber-600 px-2 py-0.5 text-[10px] text-white">موصى به الآن</span>}
              </button>
              {switchRow('تفعيل البصمة (Biometric)', 'حماية الدخول والتأكيدات الحساسة', biometric, toggleBiometric, isRestricted)}
              <button disabled={isRestricted} onClick={() => setShowPin(true)} className="w-full rounded-xl border p-3 text-right text-xs font-bold flex justify-between disabled:opacity-40">
                <span>رمز الأمان السري (PIN)</span>
                <span className="text-gray-500">تغيير (الحالي: {pin ? '••••' : 'غير مضبوط'})</span>
              </button>
              <label className={label}>
                القفل التلقائي
                <select
                  disabled={isRestricted}
                  value={autoLock}
                  onChange={(e) => {
                    const v = Number(e.target.value) as 1 | 5 | 15 | 30 | 60;
                    setAutoLock(v);
                    db.saveSharedPreferences({ auto_lock_minutes: v });
                  }}
                  className={input}
                >
                  <option value={1}>بعد دقيقة واحدة</option>
                  <option value={5}>بعد 5 دقائق</option>
                  <option value={15}>بعد 15 دقيقة</option>
                  <option value={30}>بعد 30 دقيقة</option>
                  <option value={60}>بعد ساعة</option>
                </select>
              </label>
            </div>
          )}

          {section === 'peripherals' && (
            <div className={card}>
              <h2 className="text-sm font-bold">الأجهزة الطرفية</h2>
              <div className="rounded-xl border p-3">
                <p className="text-xs font-bold">ربط الطابعة الحرارية</p>
                <p className="mt-1 text-[10px] text-gray-500">
                  الطابعة الحالية: {printer}
                  {printerAddress ? ` • ${printerAddress}` : ''}
                </p>
                <button disabled={isRestricted} onClick={() => void showBluetoothSettings()} className="mt-3 w-full rounded-xl border py-2.5 text-xs font-bold disabled:opacity-40">
                  فتح إعدادات اقتران Bluetooth
                </button>
                <button disabled={printerBusy || isRestricted} onClick={() => void pairPrinter()} className="mt-2 w-full rounded-xl bg-emerald-700 py-2.5 text-xs font-bold text-white disabled:opacity-50">
                  {printerBusy ? 'جارٍ البحث…' : 'البحث عن الطابعات المقترنة'}
                </button>
                {pairedPrinters.map((device) => (
                  <button
                    key={device.address}
                    disabled={printerBusy || isRestricted}
                    onClick={() => void connectPrinter(device)}
                    className={`mt-2 w-full rounded-xl border p-2 text-right text-xs ${
                      printerAddress === device.address ? 'border-emerald-600 bg-emerald-50' : 'border-gray-300'
                    }`}
                  >
                    {device.name}
                    <span className="block text-[10px] text-gray-500" dir="ltr">
                      {device.address}
                    </span>
                  </button>
                ))}
              </div>
              <label className={label}>
                إعدادات ماسح الباركود
                <select
                  disabled={isRestricted}
                  value={barcodeSource}
                  onChange={(e) => {
                    const v = e.target.value as 'camera' | 'external';
                    setBarcodeSource(v);
                    db.saveSharedPreferences({ barcode_source: v });
                  }}
                  className={input}
                >
                  <option value="camera">كاميرا الهاتف (مستمر تلقائي)</option>
                  <option value="external">ماسح خارجي</option>
                </select>
              </label>
            </div>
          )}

          {section === 'backup' && (
            <div className={card}>
              <h2 className="text-sm font-bold">النسخ الاحتياطي وقاعدة البيانات</h2>
              <div className="grid gap-2 sm:grid-cols-3">
                <button
                  onClick={async () => {
                    try {
                      notify(await createLocalBackup(storeId));
                    } catch (e) {
                      notify(e instanceof Error ? e.message : 'تعذر حفظ النسخة');
                    }
                  }}
                  className="rounded-xl border border-emerald-600 bg-emerald-50/40 p-3 text-xs font-bold"
                >
                  <Download className="mx-auto mb-2 h-5 w-5 text-emerald-700" />
                  حفظ نسخة على الهاتف
                </button>

                <label className={`rounded-xl border p-3 text-center text-xs font-bold ${isRestricted ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                  <Upload className="mx-auto mb-2 h-5 w-5" />
                  استرجاع من ملف
                  <input type="file" accept=".zip,.json" onChange={restore} className="hidden" disabled={isRestricted} />
                </label>

                <button
                  disabled={isRestricted}
                  onClick={async () => {
                    try {
                      await shareBackupEverywhere(storeId);
                      notify('تم فتح مشاركة النسخة');
                    } catch (e) {
                      notify(e instanceof Error ? e.message : 'تعذرت المشاركة');
                    }
                  }}
                  className="rounded-xl border p-3 text-xs font-bold disabled:opacity-40"
                >
                  <Send className="mx-auto mb-2 h-5 w-5" />
                  مشاركة نسخة احتياطية
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={async () => {
                    try {
                      const r = await createCloudSnapshot();
                      notify(`تم نسخ بياناتي سحابياً: ${r.recordCount} سجل في النسخة ${r.createdAt.slice(0, 10)}`);
                    } catch (e) {
                      notify(e instanceof Error ? e.message : 'تعذر نسخ البيانات سحابياً');
                    }
                  }}
                  className="rounded-xl border border-emerald-300 bg-emerald-50 px-2 py-3 text-xs font-bold text-emerald-800"
                >
                  نسخ بياناتي سحابياً
                </button>

                <button
                  disabled={isRestricted}
                  onClick={async () => {
                    try {
                      const r = await restoreCloudSnapshot();
                      notify(`تمت استعادة بياناتي السحابية: ${r.recordCount} سجل من النسخة ${r.createdAt.slice(0, 10)}`);
                    } catch (e) {
                      notify(e instanceof Error ? e.message : 'تعذر استعادة البيانات السحابية');
                    }
                  }}
                  className="rounded-xl border border-blue-300 bg-blue-50 px-2 py-3 text-xs font-bold text-blue-800 disabled:opacity-40"
                >
                  استعادة بياناتي سحابياً
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSection('inventory_audit')}
                className="w-full rounded-xl border border-[#C9A961] bg-amber-50/70 py-2.5 text-xs font-bold text-[#0B3D2E] flex items-center justify-center gap-1.5"
              >
                <ClipboardList className="w-4 h-4 text-[#C9A961]" />
                <span>جرد المخزون الشامل</span>
              </button>

              <label className={label}>
                تكرار النسخ السحابي التلقائي
                <select
                  disabled={isRestricted}
                  value={cloudFrequency}
                  onChange={(e) => {
                    const v = e.target.value as typeof cloudFrequency;
                    setCloudFrequency(v);
                    db.saveSharedPreferences({ cloud_backup_frequency: v });
                  }}
                  className={input}
                >
                  <option value="manual">متوقف (يدوي فقط)</option>
                  <option value="daily">يومياً تلقائياً</option>
                  <option value="weekly">أسبوعياً</option>
                  <option value="shift_close">بعد كل إغلاق وردية</option>
                </select>
              </label>

              <label className={label}>
                عدد النسخ المحلية للاحتفاظ بها
                <input
                  disabled={isRestricted}
                  type="number"
                  min="1"
                  value={retainCount}
                  onChange={(e) => {
                    setRetainCount(e.target.value);
                    db.saveSharedPreferences({ backup_retain_count: Number(e.target.value) || 7 });
                  }}
                  className={input}
                />
              </label>

              <button
                type="button"
                disabled={isRestricted}
                onClick={() => setShowClearConfirm(true)}
                className="w-full rounded-xl border border-red-300 bg-red-50 py-3 text-xs font-bold text-red-700 disabled:opacity-40"
              >
                مسح بيانات المتجر من هذا الجهاز
              </button>

              <button
                type="button"
                onClick={() => setShowDeleteAccountConfirm(true)}
                className="w-full rounded-xl bg-[#8B2E2E] py-3 text-xs font-bold text-white flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-4 h-4" />
                <span>تسجيل الخروج وحذف حسابي</span>
              </button>
            </div>
          )}

          {section === 'inventory_audit' && (
            <div className={card}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold">جرد المخزون الشامل</h2>
                <button
                  type="button"
                  disabled={isRestricted}
                  onClick={() => {
                    void shareTextEverywhere(`جرد المخزون - ${storeName}`, inventoryAudit.formattedText).then((outcome) =>
                      notify(
                        outcome === 'shared'
                          ? 'تمت مشاركة تقرير الجرد بدون إنترنت'
                          : outcome === 'downloaded'
                            ? 'تم حفظ تقرير الجرد كملف نصي بدون إنترنت'
                            : 'تم نسخ تقرير الجرد للمشاركة بدون إنترنت',
                      ),
                    );
                  }}
                  className="rounded-xl bg-[#0B3D2E] text-white px-3 py-1.5 text-xs font-bold flex items-center gap-1 disabled:opacity-40"
                >
                  <Share2 className="w-3.5 h-3.5 text-[#C9A961]" />
                  <span>مشاركة الجرد</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className={`rounded-xl border p-3 ${theme.secondaryBox}`}>
                  <span className={`text-[10px] block ${theme.textSecondary}`}>الأصناف النشطة</span>
                  <strong className="text-base font-mono">{inventoryAudit.totalSkus} صنف</strong>
                </div>
                <div className={`rounded-xl border p-3 ${theme.secondaryBox}`}>
                  <span className={`text-[10px] block ${theme.textSecondary}`}>إجمالي الوحدات الأساسية</span>
                  <strong className="text-base font-mono">{inventoryAudit.totalBaseUnits}</strong>
                </div>
                <div className={`rounded-xl border p-3 ${theme.secondaryBox}`}>
                  <span className={`text-[10px] block ${theme.textSecondary}`}>قيمة التكلفة</span>
                  <strong className="text-sm font-mono">{formatCurrency(inventoryAudit.totalCostValue)}</strong>
                </div>
                <div className={`rounded-xl border p-3 ${theme.secondaryBox}`}>
                  <span className={`text-[10px] block ${theme.textSecondary}`}>القيمة البيعية</span>
                  <strong className="text-sm font-mono text-[#C9A961]">{formatCurrency(inventoryAudit.totalRetailValue)}</strong>
                </div>
              </div>

              <div className="rounded-xl border border-emerald-400/50 bg-emerald-50/70 dark:bg-emerald-950/30 p-3 flex items-center justify-between text-xs">
                <span className="font-bold">الربح المتوقع من المخزون:</span>
                <strong className="font-mono text-sm text-emerald-700 dark:text-emerald-300">
                  {formatCurrency(inventoryAudit.expectedGrossProfit)}
                </strong>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                <div className="rounded-xl border p-2">
                  <strong className="block font-mono text-amber-600 text-sm">{inventoryAudit.lowStockProducts.length}</strong>
                  <span>منخفض المخزون</span>
                </div>
                <div className="rounded-xl border p-2">
                  <strong className="block font-mono text-red-600 text-sm">{inventoryAudit.expiredProducts.length}</strong>
                  <span>منتهي الصلاحية</span>
                </div>
                <div className="rounded-xl border p-2">
                  <strong className="block font-mono text-amber-500 text-sm">{inventoryAudit.nearExpiryProducts.length}</strong>
                  <span>قريب الانتهاء</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-xs font-bold">ملخص التصنيفات:</h3>
                {inventoryAudit.categories.map((cat) => (
                  <div key={cat.category} className={`rounded-xl border p-2.5 flex items-center justify-between text-xs ${theme.secondaryBox}`}>
                    <div>
                      <b className="block">{cat.category}</b>
                      <span className={`text-[10px] ${theme.textMuted}`}>
                        {cat.productCount} صنف · {cat.totalUnits} وحدة
                      </span>
                    </div>
                    <span className="font-mono font-bold text-[#C9A961]">{formatCurrency(cat.retailValue)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === 'financial' && (
            <div className={card}>
              <h2 className="text-sm font-bold">الإدارة المالية والضرائب</h2>
              <label className={label}>
                الرقم الضريبي / السجل التجاري
                <input disabled={isRestricted} value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} placeholder="أدخل الرقم الرسمي" className={input} />
              </label>
              {switchRow('تفعيل الضريبة النسبية (VAT)', 'إضافة الضريبة إلى الفواتير المحسوبة', vatEnabled, () => setVatEnabled((v) => !v), isRestricted)}
              <label className={label}>
                نسبة الضريبة %
                <input disabled={isRestricted} type="number" min="0" max="100" value={vatPercent} onChange={(e) => setVatPercent(e.target.value)} className={input} />
              </label>
              <button
                disabled={isRestricted}
                onClick={() => {
                  db.saveSharedPreferences({
                    tax_registration_number: taxNumber.trim(),
                    vat_enabled: vatEnabled,
                    vat_percent: Number(vatPercent) || 0,
                  });
                  notify('تم حفظ إعدادات الضريبة والرقم الرسمي');
                }}
                className="w-full rounded-xl bg-emerald-700 py-3 text-xs font-bold text-white disabled:opacity-40"
              >
                حفظ إعدادات الإدارة المالية
              </button>
            </div>
          )}

          {section === 'subscription' && (
            <div className={card}>
              <h2 className="text-sm font-bold">حالة الاشتراك والترخيص والباقات</h2>
              <div className={`rounded-xl border p-3 space-y-1 text-xs ${theme.secondaryBox}`}>
                <p>
                  الحالة الحالية: <b>{isRestricted ? (restriction.reason === 'expired' ? 'منتهي' : 'موقوف') : subStatus.isExpired ? 'منتهي' : 'نشط'}</b>
                </p>
                {subscriptionStart && (
                  <p>
                    تاريخ بدء الاشتراك: <b>{new Date(subscriptionStart).toLocaleDateString('ar-YE')}</b>
                  </p>
                )}
                <p>
                  تاريخ الانتهاء: <b>{new Date(subscriptionEnd).toLocaleDateString('ar-YE')}</b>
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold text-[#C9A961]">الباقات المتاحة للتفعيل:</h3>
                {packages.length === 0 ? (
                  <p className={`text-xs ${theme.textMuted}`}>لا توجد باقات مضافة حالياً.</p>
                ) : (
                  packages.map((pkg) => (
                    <div key={pkg.id} className={`rounded-xl border p-3 flex items-center justify-between gap-2 ${theme.secondaryBox}`}>
                      <div>
                        <b className="text-xs block">{pkg.name}</b>
                        <span className={`text-[10px] ${theme.textSecondary}`}>
                          {pkg.duration_days} يوم · {formatCurrency(pkg.price)}
                        </span>
                        {pkg.description && <p className={`text-[10px] mt-0.5 ${theme.textMuted}`}>{pkg.description}</p>}
                      </div>
                      <a
                        href={`https://wa.me/${OWNER_SUPPORT_WHATSAPP_DIGITS}?text=${encodeURIComponent(
                          buildPackageActivationMessage(pkg.name, pkg.duration_days, pkg.price, storeName),
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 rounded-xl bg-[#25D366] text-white px-3 py-2 text-[11px] font-bold"
                      >
                        تفعيل الباقة
                      </a>
                    </div>
                  ))
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <a href={`tel:${OWNER_SUPPORT_PHONE}`} className="rounded-xl bg-emerald-700 p-3 text-center text-xs font-bold text-white">
                  <PhoneCall className="mx-auto mb-1 h-4 w-4" />
                  اتصال
                </a>
                <a
                  href={`https://wa.me/${OWNER_SUPPORT_WHATSAPP_DIGITS}?text=${encodeURIComponent('أريد تجديد اشتراك متجري: ' + storeName)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-[#25D366] p-3 text-center text-xs font-bold text-white"
                >
                  <MessageSquare className="mx-auto mb-1 h-4 w-4" />
                  واتساب
                </a>
                <a href={`sms:${OWNER_SUPPORT_PHONE}`} className="rounded-xl bg-slate-700 p-3 text-center text-xs font-bold text-white">
                  <Send className="mx-auto mb-1 h-4 w-4" />
                  SMS
                </a>
              </div>
              <p className="text-center text-xs" dir="ltr">
                {OWNER_SUPPORT_PHONE}
              </p>
            </div>
          )}

          {section === 'about' && (
            <div className={card}>
              <h2 className="text-sm font-bold">حول التطبيق والدعم</h2>
              <p className="text-xs">
                رقم إصدار التطبيق الحالي: <b className="font-mono">{APP_VERSION}</b>
              </p>
              <div className="grid gap-2">
                <button
                  type="button"
                  disabled={isRestricted}
                  onClick={() => void handleShareApp()}
                  className="rounded-xl bg-[#0B3D2E] text-white p-3 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <Share2 className="w-4 h-4 text-[#C9A961]" />
                  <span>مشاركة التطبيق (رابط التحميل الرسمي)</span>
                </button>
                <button onClick={() => notify('تطبيق بقالتي برو — نسخة 1.4.6 الموحدة لإدارة المبيعات والمخزون والعملاء')} className="rounded-xl border p-3 text-right text-xs font-bold">
                  دليل الاستخدام السريع
                </button>
                <a
                  href={`https://wa.me/${OWNER_SUPPORT_WHATSAPP_DIGITS}?text=${encodeURIComponent('طلب دعم فني لتطبيق بقالتي برو')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border p-3 text-xs font-bold"
                >
                  التواصل مع الدعم الفني للمنصة (
                  <span dir="ltr" className="inline-block font-mono">
                    {OWNER_SUPPORT_PHONE}
                  </span>
                  )
                </a>
              </div>
            </div>
          )}
        </main>
      </div>

      {showPin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form onSubmit={changePin} className={`${theme.cardBg} w-full max-w-sm rounded-2xl p-5 space-y-3`}>
            <h3 className="font-bold">تغيير رمز PIN</h3>
            <input type="password" inputMode="numeric" maxLength={6} value={newPin} onChange={(e) => setNewPin(e.target.value)} placeholder="4 إلى 6 أرقام" className={input} required />
            <div className="grid grid-cols-2 gap-2">
              <button className="rounded-xl bg-emerald-700 py-2.5 text-xs font-bold text-white">حفظ</button>
              <button type="button" onClick={() => setShowPin(false)} className="rounded-xl border py-2.5 text-xs">
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {showBiometricPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form onSubmit={(e) => void confirmEnableBiometric(e)} className={`${theme.cardBg} w-full max-w-sm rounded-2xl p-5 space-y-3`}>
            <h3 className="font-bold text-sm">تفعيل بصمة الدخول</h3>
            <p className="text-xs text-gray-500">أدخل كلمة المرور الحالية لتأكيد تفعيل الدخول ببصمة الهاتف.</p>
            <input type="password" value={biometricPwd} onChange={(e) => setBiometricPwd(e.target.value)} placeholder="كلمة المرور الحالية" className={input} required />
            <div className="grid grid-cols-2 gap-2">
              <button className="rounded-xl bg-emerald-700 py-2.5 text-xs font-bold text-white">تفعيل البصمة</button>
              <button type="button" onClick={() => setShowBiometricPrompt(false)} className="rounded-xl border py-2.5 text-xs">
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className={`${theme.cardBg} w-full max-w-sm rounded-2xl p-5 space-y-3 border border-red-400`}>
            <h3 className="font-bold text-sm text-red-600">تأكيد مسح البيانات المحلية</h3>
            <p className="text-xs leading-relaxed">سيتم حذف كافة بيانات المتجر المحلية من هذا الجهاز وإعادته للوضع الافتراضي دون المساس بالنسخ السحابية.</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  db.resetToDefaults();
                  load();
                  setShowClearConfirm(false);
                  notify('تم مسح بيانات المتجر المحلية');
                }}
                className="rounded-xl bg-red-700 py-2.5 text-xs font-bold text-white"
              >
                موافق، امسح
              </button>
              <button type="button" onClick={() => setShowClearConfirm(false)} className="rounded-xl border py-2.5 text-xs font-bold">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteAccountConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className={`${theme.cardBg} w-full max-w-sm rounded-2xl p-5 space-y-3 border-2 border-red-600`}>
            <h3 className="font-bold text-sm text-red-600">تسجيل الخروج وحذف الحساب محلياً</h3>
            <p className="text-xs leading-relaxed">
              تنبيه: سيؤدي هذا الإجراء إلى حذف جميع بيانات هذا الحساب من هذا الجهاز وتسجيل الخروج فوراً. لن يؤثر ذلك على بيانات السحابة إن وُجدت نسخة سحابية محفوظة مسبقاً.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void handleConfirmDeleteAccountAndLogout()}
                className="rounded-xl bg-[#8B2E2E] py-2.5 text-xs font-bold text-white"
              >
                موافق
              </button>
              <button type="button" onClick={() => setShowDeleteAccountConfirm(false)} className="rounded-xl border py-2.5 text-xs font-bold">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {showPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form onSubmit={changePassword} className={`${theme.cardBg} w-full max-w-sm rounded-2xl p-5 space-y-3 border border-[#C9A961]/40`}>
            <h3 className="font-bold text-sm">تغيير كلمة المرور</h3>
            <p className={`text-xs leading-relaxed ${theme.textSecondary}`}>
              أدخل كلمة المرور الحالية أو المؤقتة التي منحتك إياها الإدارة، ثم اختر كلمة مرور جديدة قوية من 8 أحرف على الأقل لحماية حسابك.
            </p>
            {passwordError && (
              <div role="alert" className="rounded-xl border border-red-400 bg-red-50 dark:bg-red-950/60 p-2.5 text-xs font-bold text-red-700 dark:text-red-200">
                {passwordError}
              </div>
            )}
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                if (passwordError) setPasswordError('');
              }}
              placeholder="كلمة المرور الحالية أو المؤقتة"
              className={input}
              required
            />
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError('');
              }}
              placeholder="كلمة المرور الجديدة (8 أحرف على الأقل)"
              className={input}
              required
            />
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (passwordError) setPasswordError('');
              }}
              placeholder="تأكيد كلمة المرور الجديدة"
              className={input}
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <button type="submit" disabled={passwordBusy} className="rounded-xl bg-emerald-700 py-2.5 text-xs font-bold text-white disabled:opacity-50">
                {passwordBusy ? 'جارٍ التغيير…' : 'حفظ كلمة المرور'}
              </button>
              <button
                type="button"
                disabled={passwordBusy}
                onClick={() => {
                  setShowPassword(false);
                  setPasswordError('');
                }}
                className="rounded-xl border py-2.5 text-xs font-bold"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
