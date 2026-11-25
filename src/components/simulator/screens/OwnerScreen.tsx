/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useEffect } from 'react';
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  Ban,
  AlertTriangle,
  Store,
  Edit,
  Plus,
  Trash2,
  Package,
  Clock,
  Coins,
  Check,
  MessageSquare,
  Bell,
  Megaphone,
  KeyRound,
} from 'lucide-react';
import { db } from '../../../db/sqlite-simulation.ts';
import { User, SubscriptionPackage } from '../../../types/index.ts';
import { formatCurrency, validatePackageInput } from '../../../utils/pureLogic.ts';
import { useTheme } from '../../../context/ThemeContext.tsx';
import { grantLocalStoreTemporaryPassword } from '../../../services/authService.ts';

interface OwnerScreenProps {
  onNavigate: (screen: string, params?: Record<string, unknown>) => void;
}

type StoreFilter = 'all' | 'active' | 'expired' | 'suspended' | 'soon';

export const OwnerScreen: React.FC<OwnerScreenProps> = ({ onNavigate }) => {
  const { theme, isDarkMode } = useTheme();
  const [activeTab, setActiveTab] = useState<'stores' | 'packages'>('stores');
  const [storeFilter, setStoreFilter] = useState<StoreFilter>('all');
  const [stores, setStores] = useState<User[]>([]);
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [stats, setStats] = useState({ trialCount: 0, paidCount: 0, totalStores: 0 });

  // Store Edit / Activation Modal
  const [editingStore, setEditingStore] = useState<User | null>(null);
  const [editDaysToAdd, setEditDaysToAdd] = useState<string>('30');
  const [editDaysError, setEditDaysError] = useState<string | null>(null);
  const [editSubscriptionPrice, setEditSubscriptionPrice] = useState<string>('');
  const [editMode, setEditMode] = useState<'custom' | 'package'>('custom');
  const [selectedPackageId, setSelectedPackageId] = useState<number | ''>('');
  const [editStatus, setEditStatus] = useState<'active' | 'suspended'>('active');
  const [editCalculationMode, setEditCalculationMode] = useState<'reset' | 'append'>('reset');

  // Suspension dialog state
  const [suspendingStore, setSuspendingStore] = useState<User | null>(null);
  const [suspensionReasonInput, setSuspensionReasonInput] = useState('');

  // Send Private Notification / Message Modal
  const [messageTarget, setMessageTarget] = useState<User | null>(null);
  const [msgTitle, setMsgTitle] = useState('إشعار من إدارة بقالتي برو');
  const [msgBody, setMsgBody] = useState('');

  // Send Broadcast Notification Modal
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('إعلان هام من إدارة بقالتي برو');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastError, setBroadcastError] = useState('');

  // Grant Temporary Password Modal
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetBusy, setResetBusy] = useState(false);

  // Package Management Modals
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState<number | null>(null);
  const [pkgName, setPkgName] = useState('');
  const [pkgDays, setPkgDays] = useState('30');
  const [pkgPrice, setPkgPrice] = useState('5000');
  const [pkgDesc, setPkgDesc] = useState('');
  const [pkgError, setPkgError] = useState<string | null>(null);
  const [deletePackageCandidate, setDeletePackageCandidate] = useState<SubscriptionPackage | null>(null);

  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = () => {
    setStores(db.getAllStores());
    setPackages(db.getSubscriptionPackages());
    setStats(db.getOwnerStats());
  };

  const showNotification = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  const filteredStores = useMemo(() => {
    const now = Date.now();
    return stores.filter((s) => {
      const daysLeft = Math.ceil((s.subscription_end - now) / (1000 * 60 * 60 * 24));
      if (storeFilter === 'all') return true;
      if (storeFilter === 'suspended') return s.status === 'suspended';
      if (storeFilter === 'expired') return s.status === 'active' && daysLeft <= 0;
      if (storeFilter === 'soon') return s.status === 'active' && daysLeft > 0 && daysLeft <= 10;
      return s.status === 'active' && daysLeft > 0;
    });
  }, [stores, storeFilter]);

  const openEditStoreModal = (store: User, forceActiveReset = false) => {
    setEditingStore(store);
    const currentLeft = Math.ceil((store.subscription_end - Date.now()) / (1000 * 60 * 60 * 24));
    setEditDaysToAdd(String(forceActiveReset ? 30 : Math.max(1, currentLeft)));
    setEditDaysError(null);
    setEditSubscriptionPrice(store.subscription_price ? store.subscription_price.toString() : '5000');
    setEditStatus(forceActiveReset ? 'active' : store.status);
    setEditMode('custom');
    setEditCalculationMode('reset');
    setSelectedPackageId(packages[0] ? packages[0].id : '');
  };

  const handleApplyPackageToStore = (pkgId: number) => {
    setSelectedPackageId(pkgId);
    const pkg = packages.find((p) => p.id === pkgId);
    if (pkg) {
      setEditDaysToAdd(pkg.duration_days.toString());
      setEditSubscriptionPrice(pkg.price.toString());
    }
  };

  const handleSaveStoreSubscriptionEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStore) return;

    const days = Number(editDaysToAdd);
    if (!Number.isInteger(days) || days < 1 || days > 36500) {
      setEditDaysError('أدخل عدداً صحيحاً من الأيام بين 1 و36500.');
      return;
    }
    setEditDaysError(null);
    const price = Math.max(0, Number(editSubscriptionPrice) || 0);

    if (editCalculationMode === 'reset') {
      db.updateStoreSubscriptionManual(editingStore.id, {
        exactDaysRemaining: days,
        price,
        status: editStatus,
      });
      showNotification(`تم تفعيل واعتماد ${days} يوماً جديدة لمتجر "${editingStore.store_name}" بسعر ${formatCurrency(price)}.`);
    } else {
      db.updateStoreSubscriptionManual(editingStore.id, {
        daysToAdd: days,
        price,
        status: editStatus,
      });
      showNotification(`تم تمديد اشتراك متجر "${editingStore.store_name}" بإضافة ${days} يوماً بسعر ${formatCurrency(price)}.`);
    }

    setEditingStore(null);
    loadAll();
  };

  const handleConfirmSuspension = () => {
    if (!suspendingStore) return;
    const reason = suspensionReasonInput.trim() || 'تم إيقاف الحساب من قبل الإدارة لمراجعة السجلات';
    db.suspendStore(suspendingStore.id, reason);
    showNotification(`تم إيقاف حساب متجر "${suspendingStore.store_name}"!`);
    setSuspendingStore(null);
    setSuspensionReasonInput('');
    loadAll();
  };

  const handleUnsuspend = (store: User) => {
    db.unsuspendStore(store.id);
    showNotification(`تم إلغاء إيقاف متجر "${store.store_name}" واستعادة كامل صلاحياته.`);
    loadAll();
  };

  const handleSendReminderNotification = (store: User) => {
    const daysLeft = Math.max(0, Math.ceil((store.subscription_end - Date.now()) / (1000 * 60 * 60 * 24)));
    db.sendStoreNotification(store.id, {
      title: 'تذكير قرب انتهاء الاشتراك',
      message: `مرحباً ${store.owner_name}، متبقي لاشتراك متجر "${store.store_name}" ${daysLeft} يوم. يرجى التواصل لتجديد الباقة وضمان استمرار الخدمة.`,
      kind: 'reminder',
      sender: 'مالك التطبيق',
    });
    showNotification(`تم إرسال إشعار تذكير خاص إلى متجر "${store.store_name}".`);
  };

  const handleSendPrivateMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageTarget || !msgBody.trim()) return;
    db.sendStoreNotification(messageTarget.id, {
      title: msgTitle.trim() || 'رسالة من الإدارة',
      message: msgBody.trim(),
      kind: 'message',
      sender: 'مالك التطبيق',
    });
    showNotification(`تم إرسال الرسالة إلى متجر "${messageTarget.store_name}" حصراً.`);
    setMessageTarget(null);
    setMsgBody('');
  };

  const handleSendBroadcastMessage = (e: React.FormEvent) => {
    e.preventDefault();
    setBroadcastError('');
    if (!broadcastBody.trim()) return;
    try {
      const sentCount = db.sendBroadcastNotification({
        title: broadcastTitle.trim() || 'إعلان هام من إدارة بقالتي برو',
        message: broadcastBody.trim(),
        kind: 'message',
        sender: 'إدارة بقالتي برو',
      });
      setBroadcastOpen(false);
      setBroadcastBody('');
      showNotification(`تم إرسال الرسالة الجماعية بنجاح إلى جميع مستخدمي بقالتي برو (${sentCount} متجر).`);
    } catch (err) {
      setBroadcastError(err instanceof Error ? err.message : 'تعذر إرسال الرسالة الجماعية.');
    }
  };

  const handleGrantTemporaryPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget || resetBusy) return;
    setResetError('');
    if (resetPassword.length < 8 || resetPassword.length > 72) {
      setResetError('كلمة المرور المؤقتة يجب أن تكون بين 8 و 72 حرفاً.');
      return;
    }
    if (resetPassword !== confirmResetPassword) {
      setResetError('تأكيد كلمة المرور غير مطابق.');
      return;
    }
    setResetBusy(true);
    try {
      await grantLocalStoreTemporaryPassword(resetTarget.phone, resetPassword);
      const targetName = resetTarget.store_name;
      setResetTarget(null);
      setResetPassword('');
      setConfirmResetPassword('');
      showNotification(`تم منح كلمة مرور مؤقتة لمتجر "${targetName}". يمكنه الدخول بها الآن وتغييرها من الإعدادات.`);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'تعذر تعيين كلمة المرور المؤقتة.');
    } finally {
      setResetBusy(false);
    }
  };

  // Package Management Functions
  const handleOpenCreatePackage = () => {
    setEditingPackageId(null);
    setPkgName('');
    setPkgDays('30');
    setPkgPrice('5000');
    setPkgDesc('');
    setPkgError(null);
    setShowPackageModal(true);
  };

  const handleOpenEditPackage = (pkg: SubscriptionPackage) => {
    setEditingPackageId(pkg.id);
    setPkgName(pkg.name);
    setPkgDays(pkg.duration_days.toString());
    setPkgPrice(pkg.price.toString());
    setPkgDesc(pkg.description || '');
    setPkgError(null);
    setShowPackageModal(true);
  };

  const handleSavePackage = (e: React.FormEvent) => {
    e.preventDefault();
    setPkgError(null);

    const daysNum = Number(pkgDays);
    const priceNum = Number(pkgPrice);

    const validation = validatePackageInput(pkgName, daysNum, priceNum);
    if (!validation.isValid) {
      setPkgError(validation.error || 'بيانات الباقة غير صحيحة');
      return;
    }

    if (editingPackageId) {
      db.updateSubscriptionPackage(editingPackageId, {
        name: pkgName.trim(),
        duration_days: daysNum,
        price: priceNum,
        description: pkgDesc.trim(),
      });
      showNotification(`تم تحديث باقة "${pkgName}" بنجاح!`);
    } else {
      db.insertSubscriptionPackage({
        name: pkgName.trim(),
        duration_days: daysNum,
        price: priceNum,
        description: pkgDesc.trim(),
        is_active: 1,
      });
      showNotification(`تم إنشاء باقة الاشتراك الجديدة "${pkgName}" بنجاح!`);
    }

    setShowPackageModal(false);
    loadAll();
  };

  const confirmDeletePackage = () => {
    if (!deletePackageCandidate) return;
    db.deleteSubscriptionPackage(deletePackageCandidate.id);
    showNotification(`تم حذف باقة "${deletePackageCandidate.name}" بنجاح`);
    setDeletePackageCandidate(null);
    loadAll();
  };

  return (
    <div className={`flex-1 flex flex-col ${theme.screenBg} ${theme.textPrimary} overflow-hidden relative`}>
      <div className="bg-[#0B3D2E] text-white p-3.5 flex items-center justify-between shadow-md border-b border-[#C9A961]/30">
        <div className="flex items-center gap-2">
          <button onClick={() => onNavigate('dashboard')} className="p-1 hover:bg-white/10 rounded-full">
            <ArrowRight className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-5 h-5 text-[#C9A961]" />
            <h2 className="font-bold text-sm">لوحة المالك الإدارية (Owner)</h2>
          </div>
        </div>
        <span className="text-[10px] bg-[#C9A961] text-[#0B3D2E] px-2.5 py-0.5 rounded-full font-bold">ADMIN</span>
      </div>

      {notice && (
        <div role="status" className="bg-emerald-700 text-white p-2 text-xs text-center font-bold flex items-center justify-center gap-1.5">
          <Check className="w-4 h-4 text-[#C9A961]" />
          <span>{notice}</span>
        </div>
      )}

      <div className={`p-3 ${theme.cardBg} border-b ${theme.borderColor} flex gap-2`}>
        <button
          onClick={() => setActiveTab('stores')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            activeTab === 'stores'
              ? 'bg-[#0B3D2E] text-white shadow-sm border border-[#C9A961]/40'
              : isDarkMode
                ? 'bg-[#182520] text-gray-300'
                : 'bg-[#FAF8F3] text-gray-700'
          }`}
        >
          <Store className="w-4 h-4" />
          <span>المتاجر والاشتراكات ({stores.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('packages')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            activeTab === 'packages'
              ? 'bg-[#0B3D2E] text-white shadow-sm border border-[#C9A961]/40'
              : isDarkMode
                ? 'bg-[#182520] text-gray-300'
                : 'bg-[#FAF8F3] text-gray-700'
          }`}
        >
          <Package className="w-4 h-4 text-[#C9A961]" />
          <span>باقات الاشتراكات ({packages.length})</span>
        </button>
      </div>

      {activeTab === 'stores' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div className={`${isDarkMode ? 'bg-amber-950/40 border-amber-800/60 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-900'} border rounded-2xl p-3 text-center`}>
              <span className="text-[11px] font-bold block">المشتركون التجريبيون</span>
              <span className="text-xl font-extrabold text-[#C9A961] font-mono">
                {stats.trialCount} <span className="text-xs font-normal">متجر</span>
              </span>
            </div>

            <div className={`${isDarkMode ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200' : 'bg-emerald-50 border-emerald-200 text-emerald-900'} border rounded-2xl p-3 text-center`}>
              <span className="text-[11px] font-bold block">المشتركون المدفوعون</span>
              <span className="text-xl font-extrabold text-emerald-400 font-mono">
                {stats.paidCount} <span className="text-xs font-normal">متجر</span>
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setBroadcastError('');
              setBroadcastTitle('إعلان هام من إدارة بقالتي برو');
              setBroadcastBody('');
              setBroadcastOpen(true);
            }}
            className="w-full rounded-2xl bg-gradient-to-l from-[#0B3D2E] to-[#145943] text-white border border-[#C9A961]/70 py-2.5 px-3 text-xs font-bold flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition"
          >
            <Megaphone className="w-4 h-4 text-[#C9A961] shrink-0" />
            <span>إرسال رسالة جماعية لكل مستخدمي بقالتي برو ({stores.length})</span>
          </button>

          {/* Filters: الكل، النشطة، المنتهية، الموقوفة، قريبة الانتهاء */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 text-[11px] font-bold">
            {(
              [
                ['all', 'الكل'],
                ['active', 'النشطة'],
                ['expired', 'المنتهية اشتراكاتها'],
                ['suspended', 'الموقوفة'],
                ['soon', 'قريبة الانتهاء (≤ 10 أيام)'],
              ] as [StoreFilter, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setStoreFilter(id)}
                className={`shrink-0 px-3 py-1.5 rounded-xl border transition ${
                  storeFilter === id
                    ? 'bg-[#0B3D2E] text-white border-[#C9A961]'
                    : `${theme.cardBg} ${theme.borderColor} ${theme.textSecondary}`
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredStores.length === 0 ? (
              <p className={`text-xs text-center py-8 ${theme.textMuted}`}>لا توجد متاجر في هذا التصنيف حالياً.</p>
            ) : (
              filteredStores.map((store) => {
                const daysLeft = Math.ceil((store.subscription_end - Date.now()) / (1000 * 60 * 60 * 24));
                const isSuspended = store.status === 'suspended';
                const isExpired = !isSuspended && daysLeft <= 0;
                const isNearExpiry = !isSuspended && daysLeft > 0 && daysLeft <= 10;
                const startDateTs = store.subscription_start || (store.created_at ? Date.parse(store.created_at) : undefined);

                return (
                  <div
                    key={store.id}
                    className={`${theme.cardBg} rounded-2xl p-3.5 shadow-xs border transition ${
                      isSuspended || isExpired ? 'border-red-400/70' : `${theme.borderColor} hover:border-[#C9A961]`
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className={`font-bold text-xs ${theme.textPrimary}`}>{store.store_name}</h4>
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                              isSuspended
                                ? 'bg-red-100 text-[#8B2E2E]'
                                : isExpired
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {isSuspended ? 'موقوف' : isExpired ? 'منتهي الاشتراك' : 'نشط'}
                          </span>
                        </div>

                        <p className={`text-[11px] ${theme.textSecondary} mt-1`}>
                          المالك: <span className={`font-semibold ${theme.textPrimary}`}>{store.owner_name}</span> | هاتف: {store.phone}
                        </p>
                        <p className={`text-[10px] ${theme.textSecondary} font-mono mt-0.5`}>
                          بدء الاشتراك: {startDateTs ? new Date(startDateTs).toLocaleDateString('ar-YE') : 'غير مسجل'} · انتهاء الاشتراك:{' '}
                          {new Date(store.subscription_end).toLocaleDateString('ar-YE')}
                        </p>
                        {isSuspended && store.suspension_reason && (
                          <p className="text-[10px] text-[#8B2E2E] bg-red-50 p-1.5 rounded-lg mt-1 font-semibold">
                            سبب الإيقاف: {store.suspension_reason}
                          </p>
                        )}
                      </div>

                      <div className="text-left font-mono shrink-0">
                        <span className={`text-[10px] ${theme.textSecondary} block`}>المتبقي:</span>
                        <span className={`text-xs font-bold ${daysLeft <= 0 ? 'text-[#8B2E2E]' : isNearExpiry ? 'text-amber-500' : 'text-emerald-500'}`}>
                          {daysLeft > 0 ? `${daysLeft} يوم` : 'منتهي'}
                        </span>
                      </div>
                    </div>

                    <div className={`grid grid-cols-2 gap-1.5 mt-3 pt-2.5 border-t ${theme.borderColor} text-[11px]`}>
                      <button
                        type="button"
                        onClick={() => openEditStoreModal(store, isExpired)}
                        className="py-1.5 px-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl font-bold flex items-center justify-center gap-1"
                      >
                        <Edit className="w-3.5 h-3.5 text-[#C9A961]" />
                        <span>{isExpired ? 'تفعيل الاشتراك' : 'تعديل الاشتراك'}</span>
                      </button>

                      {isSuspended ? (
                        <button
                          type="button"
                          onClick={() => handleUnsuspend(store)}
                          className="py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-1"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>إلغاء إيقاف المستخدم</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSuspendingStore(store);
                            setSuspensionReasonInput(store.suspension_reason || '');
                          }}
                          className="py-1.5 px-2 bg-red-50 hover:bg-red-100 text-[#8B2E2E] border border-red-300 rounded-xl font-bold flex items-center justify-center gap-1"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>إيقاف المستخدم</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setMessageTarget(store);
                          setMsgTitle('رسالة من إدارة بقالتي برو');
                          setMsgBody('');
                        }}
                        className="py-1.5 px-2 bg-[#0B3D2E] text-white rounded-xl font-bold flex items-center justify-center gap-1"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-[#C9A961]" />
                        <span>إرسال رسالة للمستخدم</span>
                      </button>

                      {isNearExpiry ? (
                        <button
                          type="button"
                          onClick={() => handleSendReminderNotification(store)}
                          className="py-1.5 px-2 bg-amber-500 text-white rounded-xl font-bold flex items-center justify-center gap-1"
                        >
                          <Bell className="w-3.5 h-3.5" />
                          <span>تذكير بقرب الانتهاء</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            db.activateStore(store.id, 30);
                            showNotification(`تم تفعيل متجر "${store.store_name}" وإضافة 30 يوماً`);
                            loadAll();
                          }}
                          className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-[#0B3D2E] border border-emerald-300 rounded-xl font-bold flex items-center justify-center gap-1"
                        >
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>تفعيل سريع (+30 يوم)</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setResetTarget(store);
                          setResetPassword('');
                          setConfirmResetPassword('');
                          setResetError('');
                        }}
                        className="col-span-2 py-1.5 px-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl font-bold flex items-center justify-center gap-1"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-[#C9A961]" />
                        <span>منح كلمة مرور جديدة</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'packages' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-xs text-[#C9A961] flex items-center gap-1.5">
                <Package className="w-4 h-4 text-[#C9A961]" />
                <span>باقات الاشتراكات المنشأة:</span>
              </h3>
              <p className={`text-[11px] ${theme.textSecondary}`}>تظهر هذه الباقات للمستخدمين داخل قسم الاشتراك في الإعدادات</p>
            </div>
            <button onClick={handleOpenCreatePackage} className="bg-[#0B3D2E] text-white hover:bg-[#06231A] px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 shadow-md border border-[#C9A961]/40">
              <Plus className="w-4 h-4 text-[#C9A961]" />
              <span>إنشاء باقة</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {packages.map((pkg) => (
              <div key={pkg.id} className={`${theme.cardBg} rounded-2xl p-4 shadow-xs border ${theme.borderColor}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className={`font-bold text-sm ${theme.textPrimary}`}>{pkg.name}</h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-50 text-[#0B3D2E] border-emerald-200">
                        {pkg.duration_days} يوم
                      </span>
                    </div>
                    {pkg.description && <p className={`text-xs ${theme.textSecondary} mt-1`}>{pkg.description}</p>}
                  </div>
                  <span className="text-base font-extrabold text-[#C9A961] font-mono">{formatCurrency(pkg.price)}</span>
                </div>
                <div className={`flex items-center justify-end gap-2 mt-3 pt-2.5 border-t ${theme.borderColor}`}>
                  <button onClick={() => handleOpenEditPackage(pkg)} className="p-1.5 bg-gray-50 hover:bg-emerald-50 text-emerald-800 border border-gray-200 rounded-lg text-xs font-bold flex items-center gap-1">
                    <Edit className="w-3.5 h-3.5 text-[#C9A961]" />
                    <span>تعديل</span>
                  </button>
                  <button onClick={() => setDeletePackageCandidate(pkg)} className="p-1.5 bg-gray-50 hover:bg-red-50 text-red-600 border border-gray-200 rounded-lg text-xs font-bold flex items-center gap-1">
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Send Broadcast Message */}
      {broadcastOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <form onSubmit={handleSendBroadcastMessage} className={`${theme.cardBg} rounded-3xl w-full max-w-sm p-5 shadow-2xl border-2 border-[#C9A961] space-y-3`}>
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm flex items-center gap-1.5">
                <Megaphone className="w-4 h-4 text-[#C9A961]" />
                <span>إرسال رسالة جماعية لكل المستخدمين</span>
              </h3>
              <button type="button" onClick={() => setBroadcastOpen(false)} aria-label="إغلاق">
                ✕
              </button>
            </div>
            <p className={`text-[11px] rounded-xl border p-2 ${isDarkMode ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
              ستصل هذه الرسالة إلى قسم «رسائل إدارة التطبيق» لدى جميع مستخدمي بقالتي برو ({stores.length} متجر).
            </p>
            {broadcastError && (
              <p role="alert" className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl p-2">
                {broadcastError}
              </p>
            )}
            <div>
              <label className="block text-xs font-bold mb-1">عنوان الرسالة:</label>
              <input value={broadcastTitle} onChange={(e) => setBroadcastTitle(e.target.value)} className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-xl p-2 text-xs`} required />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">نص الرسالة الجماعية:</label>
              <textarea rows={4} value={broadcastBody} onChange={(e) => setBroadcastBody(e.target.value)} placeholder="اكتب رسالتك لجميع مستخدمي بقالتي برو..." className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-xl p-2 text-xs`} required />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-[#0B3D2E] text-white py-2.5 rounded-xl font-bold text-xs">
                إرسال للجميع الآن
              </button>
              <button type="button" onClick={() => setBroadcastOpen(false)} className="px-4 py-2.5 rounded-xl border text-xs font-bold">
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Send Private Message / Notification */}
      {messageTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <form onSubmit={handleSendPrivateMessage} className={`${theme.cardBg} rounded-3xl w-full max-w-sm p-5 shadow-2xl border-2 border-[#C9A961] space-y-3`}>
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm">إرسال رسالة خاصة إلى: {messageTarget.store_name}</h3>
              <button type="button" onClick={() => setMessageTarget(null)} aria-label="إغلاق">
                ✕
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">عنوان الإشعار:</label>
              <input value={msgTitle} onChange={(e) => setMsgTitle(e.target.value)} className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-xl p-2 text-xs`} required />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">نص الرسالة (سيصل لهذا المتجر فقط):</label>
              <textarea rows={3} value={msgBody} onChange={(e) => setMsgBody(e.target.value)} placeholder="اكتب رسالتك لصاحب المتجر..." className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-xl p-2 text-xs`} required />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-[#0B3D2E] text-white py-2.5 rounded-xl font-bold text-xs">
                إرسال الإشعار للمتجر
              </button>
              <button type="button" onClick={() => setMessageTarget(null)} className="px-4 py-2.5 rounded-xl border text-xs font-bold">
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Edit Store Subscription */}
      {editingStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className={`${theme.cardBg} rounded-3xl w-full max-w-sm p-5 shadow-2xl border-2 border-[#C9A961] space-y-4 max-h-[90vh] overflow-y-auto`}>
            <div className={`flex items-center justify-between pb-2 border-b ${theme.borderColor}`}>
              <h3 className="font-bold text-sm">تعديل / تفعيل اشتراك: {editingStore.store_name}</h3>
              <button onClick={() => setEditingStore(null)}>✕</button>
            </div>
            <form onSubmit={handleSaveStoreSubscriptionEdit} className="space-y-3.5">
              <div className="flex gap-2 p-1 bg-gray-200/60 rounded-xl text-xs font-bold">
                <button type="button" onClick={() => setEditMode('custom')} className={`flex-1 py-1.5 rounded-lg ${editMode === 'custom' ? 'bg-[#0B3D2E] text-white' : ''}`}>
                  إدخال يدوي مخصص
                </button>
                <button type="button" onClick={() => setEditMode('package')} className={`flex-1 py-1.5 rounded-lg ${editMode === 'package' ? 'bg-[#0B3D2E] text-white' : ''}`}>
                  من الباقات
                </button>
              </div>

              {editMode === 'package' && (
                <select value={selectedPackageId} onChange={(e) => handleApplyPackageToStore(Number(e.target.value))} className={`w-full ${theme.inputBg} border rounded-xl p-2.5 text-xs font-bold`}>
                  <option value="">-- اختر باقة --</option>
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.duration_days} يوم - {p.price} ر.ي)
                    </option>
                  ))}
                </select>
              )}

              <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
                <label className={`p-2 rounded-xl border cursor-pointer ${editCalculationMode === 'reset' ? 'border-[#0B3D2E] bg-emerald-50 text-[#0B3D2E]' : ''}`}>
                  <input type="radio" checked={editCalculationMode === 'reset'} onChange={() => setEditCalculationMode('reset')} className="ml-1" />
                  تعيين من اليوم
                </label>
                <label className={`p-2 rounded-xl border cursor-pointer ${editCalculationMode === 'append' ? 'border-[#C9A961] bg-amber-50 text-[#0B3D2E]' : ''}`}>
                  <input type="radio" checked={editCalculationMode === 'append'} onChange={() => setEditCalculationMode('append')} className="ml-1" />
                  تمديد تراكمي
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">عدد الأيام المعتمدة:</label>
                <div className="relative">
                  <input type="number" min="1" max="36500" value={editDaysToAdd} onChange={(e) => setEditDaysToAdd(e.target.value)} className={`w-full ${theme.inputBg} border rounded-xl px-3 py-2 text-xs font-mono font-bold`} required />
                  <Clock className="w-4 h-4 text-gray-400 absolute left-3 top-2" />
                </div>
                {editDaysError && <p className="text-xs text-red-500 mt-1">{editDaysError}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">سعر الاشتراك (ر.ي):</label>
                <div className="relative">
                  <input type="number" min="0" value={editSubscriptionPrice} onChange={(e) => setEditSubscriptionPrice(e.target.value)} className={`w-full ${theme.inputBg} border rounded-xl px-3 py-2 text-xs font-mono font-bold`} required />
                  <Coins className="w-4 h-4 text-[#C9A961] absolute left-3 top-2" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">حالة المتجر:</label>
                <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as 'active' | 'suspended')} className={`w-full ${theme.inputBg} border rounded-xl p-2 text-xs font-bold`}>
                  <option value="active">نشط (صالح للعمل)</option>
                  <option value="suspended">موقوف</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-[#0B3D2E] text-white py-2.5 rounded-xl font-bold text-xs">
                  حفظ وتفعيل الاشتراك
                </button>
                <button type="button" onClick={() => setEditingStore(null)} className="px-3 py-2.5 border rounded-xl text-xs font-bold">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create/Edit Package */}
      {showPackageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className={`${theme.cardBg} rounded-3xl w-full max-w-sm p-5 shadow-2xl border-2 border-[#C9A961] space-y-3.5`}>
            <div className="flex items-center justify-between pb-2 border-b">
              <h3 className="font-bold text-sm">{editingPackageId ? 'تعديل باقة الاشتراك' : 'إنشاء باقة اشتراك جديدة'}</h3>
              <button onClick={() => setShowPackageModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSavePackage} className="space-y-3">
              <input type="text" placeholder="اسم الباقة" value={pkgName} onChange={(e) => setPkgName(e.target.value)} className={`w-full ${theme.inputBg} border rounded-xl p-2.5 text-xs font-bold`} required />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" min="1" placeholder="الأيام" value={pkgDays} onChange={(e) => setPkgDays(e.target.value)} className={`w-full ${theme.inputBg} border rounded-xl p-2 text-xs font-mono font-bold`} required />
                <input type="number" min="0" placeholder="السعر" value={pkgPrice} onChange={(e) => setPkgPrice(e.target.value)} className={`w-full ${theme.inputBg} border rounded-xl p-2 text-xs font-mono font-bold`} required />
              </div>
              <textarea rows={2} placeholder="وصف الباقة (اختياري)" value={pkgDesc} onChange={(e) => setPkgDesc(e.target.value)} className={`w-full ${theme.inputBg} border rounded-xl p-2 text-xs`} />
              {pkgError && (
                <div className="p-2 bg-red-950/60 text-red-300 border border-red-900 rounded-xl text-xs font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{pkgError}</span>
                </div>
              )}
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-[#0B3D2E] text-white py-2.5 rounded-xl font-bold text-xs">
                  {editingPackageId ? 'حفظ التعديلات' : 'إنشاء الباقة'}
                </button>
                <button type="button" onClick={() => setShowPackageModal(false)} className="px-3 py-2.5 border rounded-xl text-xs font-bold">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Package Confirmation */}
      {deletePackageCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
          <div className={`${theme.cardBg} rounded-3xl w-full max-w-xs p-5 border border-red-400 space-y-3 text-center`}>
            <h3 className="font-bold text-sm text-red-600">حذف باقة "{deletePackageCandidate.name}"؟</h3>
            <p className="text-xs text-gray-500">سيتم إزالة الباقة من قائمة الباقات المتاحة للمتاجر.</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={confirmDeletePackage} className="bg-red-700 text-white py-2.5 rounded-xl text-xs font-bold">
                تأكيد الحذف
              </button>
              <button type="button" onClick={() => setDeletePackageCandidate(null)} className="border py-2.5 rounded-xl text-xs font-bold">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Suspension Dialog */}
      {suspendingStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className={`${theme.cardBg} rounded-3xl w-full max-w-xs p-5 shadow-2xl border border-red-500/80 space-y-3`}>
            <h3 className="font-bold text-sm text-red-500 text-center">إيقاف متجر: {suspendingStore.store_name}</h3>
            <textarea
              rows={3}
              placeholder="سبب الإيقاف..."
              value={suspensionReasonInput}
              onChange={(e) => setSuspensionReasonInput(e.target.value)}
              className={`w-full ${theme.inputBg} border rounded-xl p-2.5 text-xs`}
            />
            <div className="flex gap-2">
              <button onClick={handleConfirmSuspension} className="flex-1 bg-[#8B2E2E] text-white py-2.5 rounded-xl font-bold text-xs">
                تأكيد الإيقاف
              </button>
              <button onClick={() => setSuspendingStore(null)} className="px-3 py-2.5 border rounded-xl text-xs font-bold">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Grant Temporary Password */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <form onSubmit={handleGrantTemporaryPassword} className={`${theme.cardBg} rounded-3xl w-full max-w-sm p-5 shadow-2xl border-2 border-[#C9A961] space-y-3`}>
            <div className="flex items-center justify-between pb-2 border-b">
              <h3 className="font-bold text-sm">منح كلمة مرور مؤقتة: {resetTarget.store_name}</h3>
              <button
                type="button"
                onClick={() => {
                  setResetTarget(null);
                  setResetPassword('');
                  setConfirmResetPassword('');
                  setResetError('');
                }}
              >
                ✕
              </button>
            </div>
            <p className={`text-xs leading-relaxed ${theme.textSecondary}`}>
              أدخل كلمة مرور مؤقتة (8 أحرف على الأقل) وأرسلها لصاحب المتجر للدخول وتغييرها فوراً من الإعدادات.
            </p>
            <input
              type="password"
              required
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder="كلمة المرور المؤقتة الجديدة"
              className={`w-full ${theme.inputBg} border rounded-xl p-2.5 text-xs`}
            />
            <input
              type="password"
              required
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              value={confirmResetPassword}
              onChange={(e) => setConfirmResetPassword(e.target.value)}
              placeholder="تأكيد كلمة المرور المؤقتة"
              className={`w-full ${theme.inputBg} border rounded-xl p-2.5 text-xs`}
            />
            {resetError && (
              <div role="alert" className="p-2 bg-red-950/60 text-red-200 border border-red-800 rounded-xl text-xs font-bold">
                {resetError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button type="submit" disabled={resetBusy} className="bg-[#0B3D2E] text-white py-2.5 rounded-xl font-bold text-xs disabled:opacity-60">
                {resetBusy ? 'جارٍ الحفظ…' : 'تأكيد منح كلمة المرور'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setResetTarget(null);
                  setResetPassword('');
                  setConfirmResetPassword('');
                  setResetError('');
                }}
                className="border py-2.5 rounded-xl text-xs font-bold"
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
