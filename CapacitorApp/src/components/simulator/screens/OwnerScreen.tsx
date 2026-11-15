/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  Ban,
  AlertTriangle,
  Calendar,
  Store,
  Edit,
  Plus,
  Trash2,
  Package,
  Clock,
  Coins,
  Check,
  Sparkles,
} from 'lucide-react';
import { db } from '../../../db/sqlite-simulation.ts';
import { User, SubscriptionPackage } from '../../../types/index.ts';
import { formatCurrency, validatePackageInput } from '../../../utils/pureLogic.ts';
import { useTheme } from '../../../context/ThemeContext.tsx';

interface OwnerScreenProps {
  onNavigate: (screen: string, params?: Record<string, unknown>) => void;
}

export const OwnerScreen: React.FC<OwnerScreenProps> = ({ onNavigate }) => {
  const { theme, isDarkMode } = useTheme();
  const [activeTab, setActiveTab] = useState<'stores' | 'packages'>('stores');
  const [stores, setStores] = useState<User[]>([]);
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [stats, setStats] = useState({ trialCount: 0, paidCount: 0, totalStores: 0 });

  // Store Edit / Manual subscription duration and price modal
  const [editingStore, setEditingStore] = useState<User | null>(null);
  const [editDaysToAdd, setEditDaysToAdd] = useState<string>('30');
  const [editDaysError, setEditDaysError] = useState<string | null>(null);
  const [editSubscriptionPrice, setEditSubscriptionPrice] = useState<string>('');
  const [editMode, setEditMode] = useState<'custom' | 'package'>('custom');
  const [selectedPackageId, setSelectedPackageId] = useState<number | ''>('');
  const [editStatus, setEditStatus] = useState<'active' | 'suspended'>('active');
  const [editCalculationMode, setEditCalculationMode] = useState<'reset' | 'append'>('reset');

  // Quick Activation dialog state
  const [activatingStore, setActivatingStore] = useState<User | null>(null);

  // Suspension dialog state
  const [suspendingStore, setSuspendingStore] = useState<User | null>(null);
  const [suspensionReasonInput, setSuspensionReasonInput] = useState('');

  // Package Management Modals
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState<number | null>(null);
  const [pkgName, setPkgName] = useState('');
  const [pkgDays, setPkgDays] = useState('30');
  const [pkgPrice, setPkgPrice] = useState('5000');
  const [pkgDesc, setPkgDesc] = useState('');
  const [pkgError, setPkgError] = useState<string | null>(null);

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

  // Open Edit Store Subscription Modal
  const openEditStoreModal = (store: User) => {
    setEditingStore(store);
    setEditDaysToAdd(String(Math.max(1, Math.ceil((store.subscription_end - Date.now()) / (1000 * 60 * 60 * 24)))));
    setEditDaysError(null);
    setEditSubscriptionPrice(store.subscription_price ? store.subscription_price.toString() : '5000');
    setEditStatus(store.status);
    setEditMode('custom');
    setEditCalculationMode('reset'); // افتراضياً: تصفير الأيام السابقة وتعيين الرصيد الجديد مباشرة
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

  // Save Manual Subscription Edit
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
      // تصفير واستبدال: إلغاء الأيام السابقة وتعيين الرصيد الجديد مباشرة من اليوم
      db.updateStoreSubscriptionManual(editingStore.id, {
        exactDaysRemaining: days,
        price: price,
        status: editStatus,
      });

      showNotification(
        `تم تصفير الأيام السابقة واعتماد ${days} يوماً جديدة ابتداءً من اليوم لمتجر "${editingStore.store_name}" بسعر ${formatCurrency(price)} بنجاح!`
      );
    } else {
      // تمديد تراكمي: يضاف فوق الرصيد الحالي
      db.updateStoreSubscriptionManual(editingStore.id, {
        daysToAdd: days,
        price: price,
        status: editStatus,
      });

      showNotification(
        `تم تمديد اشتراك متجر "${editingStore.store_name}": إضافة ${days} يوماً فوق الرصيد السابق بسعر ${formatCurrency(price)} بنجاح!`
      );
    }

    setEditingStore(null);
    loadAll();
  };

  // Suspension confirmation
  const handleConfirmSuspension = () => {
    if (!suspendingStore) return;
    const reason = suspensionReasonInput.trim() || 'تم إيقاف الحساب من قبل الإدارة لمراجعة السجلات';
    db.suspendStore(suspendingStore.id, reason);
    showNotification(`تم إيقاف حساب متجر "${suspendingStore.store_name}"!`);
    setSuspendingStore(null);
    setSuspensionReasonInput('');
    loadAll();
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

  const handleDeletePackage = (pkgId: number, name: string) => {
    if (confirm(`هل أنت متأكد من حذف باقة "${name}"؟`)) {
      db.deleteSubscriptionPackage(pkgId);
      showNotification(`تم حذف الباقة بنجاح`);
      loadAll();
    }
  };

  return (
    <div className={`flex-1 flex flex-col ${theme.screenBg} ${theme.textPrimary} overflow-hidden relative`}>
      {/* Header */}
      <div className="bg-[#0B3D2E] text-white p-3.5 flex items-center justify-between shadow-md border-b border-[#C9A961]/30">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('dashboard')}
            className="p-1 hover:bg-white/10 rounded-full"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-5 h-5 text-[#C9A961]" />
            <h2 className="font-bold text-sm">لوحة المالك الإدارية السرية (Owner)</h2>
          </div>
        </div>
        <span className="text-[10px] bg-[#C9A961] text-[#0B3D2E] px-2.5 py-0.5 rounded-full font-bold">
          ADMIN
        </span>
      </div>

      {notice && (
        <div className="bg-emerald-700 text-white p-2 text-xs text-center font-bold animate-in fade-in flex items-center justify-center gap-1.5">
          <Check className="w-4 h-4 text-[#C9A961]" />
          <span>{notice}</span>
        </div>
      )}

      {/* Segmented Top Navigation: المتاجر vs الباقات */}
      <div className={`p-3 ${theme.cardBg} border-b ${theme.borderColor} flex gap-2`}>
        <button
          onClick={() => setActiveTab('stores')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            activeTab === 'stores'
              ? 'bg-[#0B3D2E] text-white shadow-sm border border-[#C9A961]/40'
              : isDarkMode
              ? 'bg-[#182520] text-gray-300 hover:bg-[#20322B]'
              : 'bg-[#FAF8F3] text-gray-700 hover:bg-gray-100'
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
              ? 'bg-[#182520] text-gray-300 hover:bg-[#20322B]'
              : 'bg-[#FAF8F3] text-gray-700 hover:bg-gray-100'
          }`}
        >
          <Package className="w-4 h-4 text-[#C9A961]" />
          <span>إدارة باقات الاشتراكات ({packages.length})</span>
        </button>
      </div>

      {/* Main Tab 1: المتاجر والاشتراكات */}
      {activeTab === 'stores' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Top Stats Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`${
              isDarkMode ? 'bg-amber-950/40 border-amber-800/60 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-900'
            } border rounded-2xl p-3 text-center`}>
              <span className={`text-[11px] font-bold block ${isDarkMode ? 'text-amber-300' : 'text-amber-900'}`}>المشتركون التجريبيون</span>
              <span className="text-xl font-extrabold text-[#C9A961] font-mono">
                {stats.trialCount} <span className="text-xs font-normal">متجر</span>
              </span>
              <span className={`text-[9px] block mt-0.5 ${isDarkMode ? 'text-amber-400/80' : 'text-amber-600'}`}>فترة التجربة (≤ 60 يوم)</span>
            </div>

            <div className={`${
              isDarkMode ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            } border rounded-2xl p-3 text-center`}>
              <span className={`text-[11px] font-bold block ${isDarkMode ? 'text-emerald-300' : 'text-emerald-900'}`}>المشتركون المدفوعون</span>
              <span className="text-xl font-extrabold text-emerald-400 font-mono">
                {stats.paidCount} <span className="text-xs font-normal">متجر</span>
              </span>
              <span className={`text-[9px] block mt-0.5 ${isDarkMode ? 'text-emerald-400/80' : 'text-emerald-600'}`}>اشتراك باقة سنوية أو مخصصة</span>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className={`font-bold text-xs ${theme.textPrimary} flex items-center gap-1`}>
              <Store className="w-4 h-4 text-[#C9A961]" />
              <span>قائمة المتاجر وإدارة الاشتراكات:</span>
            </h3>

            {stores.map((store) => {
              const daysLeft = Math.ceil((store.subscription_end - Date.now()) / (1000 * 60 * 60 * 24));
              const isSuspended = store.status === 'suspended';

              return (
                <div
                  key={store.id}
                  className={`${theme.cardBg} rounded-2xl p-3.5 shadow-xs border transition ${
                    isSuspended
                      ? isDarkMode ? 'border-red-900 bg-red-950/20' : 'border-red-300 bg-red-50/20'
                      : `${theme.borderColor} hover:border-[#C9A961]`
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className={`font-bold text-xs ${theme.textPrimary}`}>{store.store_name}</h4>
                        <span
                          className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                            isSuspended
                              ? isDarkMode ? 'bg-red-950 text-red-300 border border-red-800' : 'bg-red-100 text-[#8B2E2E]'
                              : isDarkMode ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isSuspended ? 'موقوف' : 'نشط'}
                        </span>
                      </div>

                      <p className={`text-[11px] ${theme.textSecondary} mt-1`}>
                        المالك: <span className={`font-semibold ${theme.textPrimary}`}>{store.owner_name}</span> | هاتف: {store.phone}
                      </p>
                      <p className={`text-[10px] ${theme.textSecondary} font-mono mt-0.5`}>
                        الموقع: {store.governorate} - {store.district}
                      </p>

                      {store.subscription_price !== undefined && store.subscription_price > 0 && (
                        <p className="text-[10px] text-emerald-400 font-bold font-mono mt-0.5">
                          سعر الاشتراك المسجل: {formatCurrency(store.subscription_price)}
                        </p>
                      )}

                      {isSuspended && store.suspension_reason && (
                        <p className={`text-[10px] text-[#8B2E2E] ${isDarkMode ? 'bg-red-950/60 border border-red-900/60' : 'bg-red-50'} p-1.5 rounded-lg mt-1 font-semibold`}>
                          سبب الإيقاف: {store.suspension_reason}
                        </p>
                      )}
                    </div>

                    <div className="text-left font-mono">
                      <span className={`text-[10px] ${theme.textSecondary} block`}>الصلاحية:</span>
                      <span
                        className={`text-xs font-bold ${
                          daysLeft <= 0 ? 'text-[#8B2E2E]' : 'text-emerald-400'
                        }`}
                      >
                        {daysLeft > 0 ? `${daysLeft} يوم متبقي` : 'منتهي الصلاحية'}
                      </span>
                    </div>
                  </div>

                  {/* 3 Action Buttons: [تعديل الاشتراك]، [تفعيل سريع]، [إيقاف] */}
                  <div className={`grid grid-cols-3 gap-1.5 mt-3 pt-2.5 border-t ${theme.borderColor} text-xs`}>
                    {/* [تعديل] زر تعديل السعر ومدة الأيام يدوياً */}
                    <button
                      onClick={() => openEditStoreModal(store)}
                      className={`py-1.5 px-2 ${
                        isDarkMode ? 'bg-amber-950/60 hover:bg-amber-900/70 text-amber-300 border-amber-800' : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                      } rounded-xl font-bold flex items-center justify-center gap-1 border transition`}
                      title="تعديل مدة الأيام وسعر الاشتراك يدوياً"
                    >
                      <Edit className="w-3.5 h-3.5 text-[#C9A961]" />
                      <span>تعديل الاشتراك</span>
                    </button>

                    {/* [تفعيل] */}
                    <button
                      onClick={() => {
                        db.activateStore(store.id, 30);
                        showNotification(`تم تفعيل متجر "${store.store_name}" وإضافة 30 يوم`);
                        loadAll();
                      }}
                      className={`py-1.5 px-2 ${
                        isDarkMode ? 'bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-300 border-emerald-800' : 'bg-emerald-50 hover:bg-emerald-100 text-[#0B3D2E] border-emerald-300'
                      } rounded-xl font-bold flex items-center justify-center gap-1 border transition`}
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span>تفعيل (+30 يوم)</span>
                    </button>

                    {/* [إيقاف] */}
                    <button
                      onClick={() => {
                        setSuspendingStore(store);
                        setSuspensionReasonInput(store.suspension_reason || '');
                      }}
                      className={`py-1.5 px-2 ${
                        isDarkMode ? 'bg-red-950/60 hover:bg-red-900/70 text-red-300 border-red-800' : 'bg-red-50 hover:bg-red-100 text-[#8B2E2E] border-red-300'
                      } rounded-xl font-bold flex items-center justify-center gap-1 border transition`}
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>إيقاف</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Tab 2: إدارة باقات الاشتراكات (Packages Created by Owner) */}
      {activeTab === 'packages' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-xs text-[#C9A961] flex items-center gap-1.5">
                <Package className="w-4 h-4 text-[#C9A961]" />
                <span>باقات الاشتراكات المنشأة يدوياً:</span>
              </h3>
              <p className={`text-[11px] ${theme.textSecondary}`}>
                يمكنك هنا إنشاء باقات جديدة بالأسعار والمدد التي تحددها بنفسك
              </p>
            </div>

            <button
              onClick={handleOpenCreatePackage}
              className="bg-[#0B3D2E] text-white hover:bg-[#06231A] px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 shadow-md border border-[#C9A961]/40"
            >
              <Plus className="w-4 h-4 text-[#C9A961]" />
              <span>إنشاء باقة جديدة</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className={`${theme.cardBg} rounded-2xl p-4 shadow-xs border ${theme.borderColor} flex flex-col justify-between hover:border-[#C9A961] transition`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className={`font-bold text-sm ${theme.textPrimary}`}>{pkg.name}</h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isDarkMode ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-emerald-50 text-[#0B3D2E] border-emerald-200'
                      }`}>
                        {pkg.duration_days} يوم
                      </span>
                    </div>
                    {pkg.description && (
                      <p className={`text-xs ${theme.textSecondary} mt-1`}>{pkg.description}</p>
                    )}
                  </div>

                  <div className="text-left font-mono shrink-0">
                    <span className="text-base font-extrabold text-[#C9A961]">
                      {formatCurrency(pkg.price)}
                    </span>
                  </div>
                </div>

                <div className={`flex items-center justify-end gap-2 mt-3 pt-2.5 border-t ${theme.borderColor}`}>
                  <button
                    onClick={() => handleOpenEditPackage(pkg)}
                    className={`p-1.5 ${
                      isDarkMode ? 'bg-[#182520] hover:bg-[#22352D] text-emerald-300 border-emerald-900/60' : 'bg-gray-50 hover:bg-emerald-50 text-emerald-800 border-gray-200'
                    } rounded-lg text-xs font-bold flex items-center gap-1 border`}
                  >
                    <Edit className="w-3.5 h-3.5 text-[#C9A961]" />
                    <span>تعديل الباقة</span>
                  </button>

                  <button
                    onClick={() => handleDeletePackage(pkg.id, pkg.name)}
                    className={`p-1.5 ${
                      isDarkMode ? 'bg-[#182520] hover:bg-red-950/60 text-red-400 border-red-900/60' : 'bg-gray-50 hover:bg-red-50 text-red-600 border-gray-200'
                    } rounded-lg text-xs font-bold flex items-center gap-1 border`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: Dialog تعديل الاشتراك للمتجر (سعر الاشتراك + مدة الأيام يدوياً) */}
      {editingStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className={`${theme.cardBg} rounded-3xl w-full max-w-sm p-5 shadow-2xl border-2 ${isDarkMode ? 'border-emerald-800' : 'border-[#C9A961]'} space-y-4 max-h-[90vh] overflow-y-auto`}>
            <div className={`flex items-center justify-between pb-2 border-b ${theme.borderColor}`}>
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-[#C9A961]" />
                <h3 className={`font-bold text-sm ${theme.textPrimary}`}>
                  تعديل اشتراك: {editingStore.store_name}
                </h3>
              </div>
              <button
                onClick={() => setEditingStore(null)}
                className={`${theme.textSecondary} hover:text-white font-bold text-sm`}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStoreSubscriptionEdit} className="space-y-3.5">
              {/* Option Mode: Custom manual vs choose created package */}
              <div className={`flex gap-2 p-1 ${isDarkMode ? 'bg-[#121B17]' : 'bg-gray-200/60'} rounded-xl text-xs font-bold`}>
                <button
                  type="button"
                  onClick={() => setEditMode('custom')}
                  className={`flex-1 py-1.5 rounded-lg transition ${
                    editMode === 'custom'
                      ? 'bg-[#0B3D2E] text-white shadow border border-[#C9A961]/40'
                      : theme.textSecondary
                  }`}
                >
                  إدخال يدوي مخصص
                </button>
                <button
                  type="button"
                  onClick={() => setEditMode('package')}
                  className={`flex-1 py-1.5 rounded-lg transition ${
                    editMode === 'package'
                      ? 'bg-[#0B3D2E] text-white shadow border border-[#C9A961]/40'
                      : theme.textSecondary
                  }`}
                >
                  اختيار من الباقات الجاهزة
                </button>
              </div>

              {editMode === 'package' && (
                <div>
                  <label className={`block text-xs font-bold ${theme.textPrimary} mb-1`}>
                    اختر الباقة المنشأة مسبقاً:
                  </label>
                  <select
                    value={selectedPackageId}
                    onChange={(e) => handleApplyPackageToStore(Number(e.target.value))}
                    className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-xl p-2.5 text-xs font-bold text-[#C9A961]`}
                  >
                    <option value="" className={isDarkMode ? 'bg-[#15201C] text-gray-100' : 'bg-white text-gray-900'}>-- اختر باقة لتعبئة الأيام والسعر تلقائياً --</option>
                    {packages.map((p) => (
                      <option key={p.id} value={p.id} className={isDarkMode ? 'bg-[#15201C] text-gray-100' : 'bg-white text-gray-900'}>
                        {p.name} - ({p.duration_days} يوم) بسعر {p.price} ر.ي
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* طريقة احتساب الأيام: تصفير واستبدال أم تمديد تراكمي */}
              <div>
                <label className={`block text-xs font-bold ${theme.textPrimary} mb-1.5`}>
                  طريقة تطبيق الأيام المعدلة:
                </label>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <label
                    className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition font-bold ${
                      editCalculationMode === 'reset'
                        ? isDarkMode
                          ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300 shadow-xs'
                          : 'bg-emerald-50 border-[#0B3D2E] text-[#0B3D2E] shadow-xs'
                        : isDarkMode
                        ? 'bg-[#141F1A] border-emerald-900/60 text-gray-400 hover:bg-[#1A2822]'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="calcMode"
                      checked={editCalculationMode === 'reset'}
                      onChange={() => setEditCalculationMode('reset')}
                      className="accent-[#0B3D2E]"
                    />
                    <div>
                      <div>تصفير واستبدال</div>
                      <div className={`text-[9px] ${theme.textSecondary} font-normal`}>تعيين {editDaysToAdd || 0} يوماً بالضبط وإلغاء القديم</div>
                    </div>
                  </label>

                  <label
                    className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition font-bold ${
                      editCalculationMode === 'append'
                        ? isDarkMode
                          ? 'bg-amber-950/80 border-amber-700 text-amber-300 shadow-xs'
                          : 'bg-amber-50 border-[#C9A961] text-[#0B3D2E] shadow-xs'
                        : isDarkMode
                        ? 'bg-[#141F1A] border-emerald-900/60 text-gray-400 hover:bg-[#1A2822]'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="calcMode"
                      checked={editCalculationMode === 'append'}
                      onChange={() => setEditCalculationMode('append')}
                      className="accent-[#C9A961]"
                    />
                    <div>
                      <div>تمديد تراكمي (+)</div>
                      <div className={`text-[9px] ${theme.textSecondary} font-normal`}>إضافة {editDaysToAdd || 0} يوماً فوق الرصيد الحالي</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Manual Input: Number of days */}
              <div>
                <label className={`block text-xs font-bold ${theme.textPrimary} mb-1 flex items-center justify-between`}>
                  <span>
                    {editCalculationMode === 'reset'
                      ? 'إجمالي الأيام المعتمدة للاشتراك (من اليوم):'
                      : 'عدد الأيام المراد إضافتها فوق الرصيد الحالي:'}
                  </span>
                  <span className={`text-[10px] ${theme.textSecondary} font-normal`}>
                    {editCalculationMode === 'reset' ? '(يصفر القديم ويعتمد الجديد)' : '(تضاف فوق الأيام السابقة)'}
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="36500"
                    placeholder="مثال: 30 أو 90 أو 365"
                    value={editDaysToAdd}
                    onChange={(e) => {
                      setEditDaysToAdd(e.target.value);
                      setEditDaysError(null);
                    }}
                    className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#C9A961] focus:outline-none focus:border-[#C9A961]`}
                    required
                  />
                  <Clock className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                </div>
                {editDaysError && (
                  <p role="alert" className="mt-1 text-xs font-bold text-red-500">{editDaysError}</p>
                )}
              </div>

              {/* Manual Input: Subscription Price */}
              <div>
                <label className={`block text-xs font-bold ${theme.textPrimary} mb-1`}>
                  سعر الاشتراك المحصل من المتجر (ر.ي):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    placeholder="مثال: 5000"
                    value={editSubscriptionPrice}
                    onChange={(e) => setEditSubscriptionPrice(e.target.value)}
                    className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-[#C9A961]`}
                    required
                  />
                  <Coins className="w-4 h-4 text-[#C9A961] absolute left-3 top-2.5" />
                </div>
              </div>

              {/* Status Select */}
              <div>
                <label className={`block text-xs font-bold ${theme.textPrimary} mb-1`}>
                  حالة حساب المتجر بعد التعديل:
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-xl p-2 text-xs font-bold ${theme.textPrimary}`}
                >
                  <option value="active" className={isDarkMode ? 'bg-[#15201C] text-gray-100' : 'bg-white text-gray-900'}>نشط (مفعل وصالح للبيع)</option>
                  <option value="suspended" className={isDarkMode ? 'bg-[#15201C] text-gray-100' : 'bg-white text-gray-900'}>موقوف (معطل عن البيع)</option>
                </select>
              </div>

              <div className={`flex gap-2 pt-2 border-t ${theme.borderColor}`}>
                <button
                  type="submit"
                  className="flex-1 bg-[#0B3D2E] text-white py-2.5 rounded-xl font-bold text-xs hover:bg-[#06231A] shadow-md transition border border-[#C9A961]/40"
                >
                  حفظ وتطبيق التعديلات
                </button>
                <button
                  type="button"
                  onClick={() => setEditingStore(null)}
                  className={`px-3 py-2.5 border ${theme.borderColor} rounded-xl text-xs font-bold ${theme.textSecondary} hover:bg-gray-500/10`}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: إنشاء أو تعديل باقة اشتراك جديدة يدوياً بواسطة المالك */}
      {showPackageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className={`${theme.cardBg} rounded-3xl w-full max-w-sm p-5 shadow-2xl border-2 ${isDarkMode ? 'border-emerald-800' : 'border-[#C9A961]'} space-y-3.5`}>
            <div className={`flex items-center justify-between pb-2 border-b ${theme.borderColor}`}>
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-[#C9A961]" />
                <h3 className={`font-bold text-sm ${theme.textPrimary}`}>
                  {editingPackageId ? 'تعديل باقة الاشتراك' : 'إنشاء باقة اشتراك جديدة يدوياً'}
                </h3>
              </div>
              <button
                onClick={() => setShowPackageModal(false)}
                className={`${theme.textSecondary} hover:text-white font-bold text-sm`}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePackage} className="space-y-3">
              <div>
                <label className={`block text-xs font-bold ${theme.textPrimary} mb-1`}>اسم الباقة:</label>
                <input
                  type="text"
                  placeholder="مثال: باقة 4 أشهر المميزة"
                  value={pkgName}
                  onChange={(e) => setPkgName(e.target.value)}
                  className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-xl p-2.5 text-xs font-bold ${theme.textPrimary}`}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`block text-xs font-bold ${theme.textPrimary} mb-1`}>المدة بالأيام:</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="30"
                    value={pkgDays}
                    onChange={(e) => setPkgDays(e.target.value)}
                    className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-xl p-2 text-xs font-mono font-bold ${theme.textPrimary}`}
                    required
                  />
                </div>

                <div>
                  <label className={`block text-xs font-bold ${theme.textPrimary} mb-1`}>السعر (ر.ي):</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="5000"
                    value={pkgPrice}
                    onChange={(e) => setPkgPrice(e.target.value)}
                    className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-xl p-2 text-xs font-mono font-bold text-[#C9A961]`}
                    required
                  />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-bold ${theme.textPrimary} mb-1`}>
                  وصف ومميزات الباقة (اختياري):
                </label>
                <textarea
                  rows={2}
                  placeholder="مثال: خصم خاص للبقالات الكبيرة مع ترقية مجانية"
                  value={pkgDesc}
                  onChange={(e) => setPkgDesc(e.target.value)}
                  className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-xl p-2 text-xs ${theme.textPrimary}`}
                />
              </div>

              {pkgError && (
                <div className="p-2 bg-red-950/60 text-red-300 border border-red-900 rounded-xl text-xs font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{pkgError}</span>
                </div>
              )}

              <div className={`flex gap-2 pt-2 border-t ${theme.borderColor}`}>
                <button
                  type="submit"
                  className="flex-1 bg-[#0B3D2E] text-white py-2.5 rounded-xl font-bold text-xs hover:bg-[#06231A] shadow-md transition border border-[#C9A961]/40"
                >
                  {editingPackageId ? 'حفظ التعديلات' : 'إنشاء وحفظ الباقة'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPackageModal(false)}
                  className={`px-3 py-2.5 border ${theme.borderColor} rounded-xl text-xs font-bold ${theme.textSecondary} hover:bg-gray-500/10`}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Suspension Dialog */}
      {suspendingStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className={`${theme.cardBg} rounded-3xl w-full max-w-xs p-5 shadow-2xl border border-red-500/80 space-y-3`}>
            <div className="w-10 h-10 rounded-full bg-red-950/80 text-red-400 flex items-center justify-center mx-auto border border-red-800">
              <Ban className="w-5 h-5" />
            </div>

            <h3 className="font-bold text-sm text-red-400 text-center">
              إيقاف متجر: {suspendingStore.store_name}
            </h3>

            <div>
              <label className={`block text-xs font-bold ${theme.textPrimary} mb-1`}>
                سبب الإيقاف (سيظهر لصاحب المتجر باللون الأحمر):
              </label>
              <textarea
                rows={3}
                placeholder="مثال: انتهت فترة الاشتراك التجريبي، يرجى التواصل لتجديد الباقة"
                value={suspensionReasonInput}
                onChange={(e) => setSuspensionReasonInput(e.target.value)}
                className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-xl p-2.5 text-xs ${theme.textPrimary} focus:outline-none focus:border-red-500`}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleConfirmSuspension}
                className="flex-1 bg-[#8B2E2E] text-white py-2.5 rounded-xl font-bold text-xs hover:bg-red-800 border border-red-600/40"
              >
                تأكيد الإيقاف الفوري
              </button>
              <button
                onClick={() => setSuspendingStore(null)}
                className={`px-3 py-2.5 border ${theme.borderColor} rounded-xl text-xs font-bold ${theme.textSecondary} hover:bg-gray-500/10`}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
