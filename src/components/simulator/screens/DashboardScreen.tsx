/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Receipt,
  Users,
  Coins,
  AlertOctagon,
  ShoppingCart,
  Package,
  Settings,
  PlusCircle,
  Clock,
  RotateCcw,
  FileSpreadsheet,
  AlertTriangle,
  Archive,
  RefreshCw,
  Calculator,
  Bell,
  X,
  Delete,
  KeyRound,
  Share2,
} from 'lucide-react';
import { db } from '../../../db/sqlite-simulation.ts';
import { formatCurrency, checkItemExpiryStatus } from '../../../utils/pureLogic.ts';
import { evaluateCalculatorExpression } from '../../../utils/appRules.ts';
import { synchronizeStore } from '../../../services/syncService.ts';
import { subscribeToStoreNotifications, syncCloudStoreNotifications } from '../../../services/notificationsService.ts';
import { Product } from '../../../types/index.ts';
import { useTheme } from '../../../context/ThemeContext.tsx';
import { createLocalBackup, formatShareOutcomeToast, shareTextEverywhere } from '../../../utils/nativeServices.ts';

interface DashboardScreenProps {
  storeId: number;
  isSuspended: boolean;
  suspensionReason?: string | null;
  onNavigate: (screen: string, params?: Record<string, unknown>) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  storeId,
  isSuspended,
  suspensionReason,
  onNavigate,
}) => {
  const { isDarkMode, theme } = useTheme();
  const [stats, setStats] = useState({
    todaySalesTotal: 0,
    totalDebt: 0,
    invoiceCount: 0,
    netProfit: 0,
  });
  const [storeName, setStoreName] = useState('بقالة الأمانة');
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [expiringProducts, setExpiringProducts] = useState<Product[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [mustChangePassword, setMustChangePassword] = useState(() => !!db.getSharedPreferences().must_change_password);
  const [restriction, setRestriction] = useState(() => db.getStoreRestriction(storeId));

  // Refresh sync state
  const [refreshing, setRefreshing] = useState(false);

  // Calculator Modal
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [calcExpression, setCalcExpression] = useState('');
  const [calcResult, setCalcResult] = useState('0');
  const [calcError, setCalcError] = useState<string | null>(null);

  const [isZReportOpen, setIsZReportOpen] = useState(false);
  const [zReportData, setZReportData] = useState<any>(null);
  const [zReportShareNotice, setZReportShareNotice] = useState<string | null>(null);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const [isOpenShiftModal, setIsOpenShiftModal] = useState(false);
  const [shiftUserName, setShiftUserName] = useState('');
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [archiveTab, setArchiveTab] = useState<'sales' | 'customers' | 'products'>('sales');
  const [activeShift, setActiveShift] = useState(db.getActiveDrawerShift(storeId));

  useEffect(() => {
    loadData();
    const prefs = db.getSharedPreferences();
    void syncCloudStoreNotifications(storeId, prefs.cloud_store_id).then((list) => {
      setUnreadNotificationsCount(list.filter((n) => !n.read_at).length);
    });
    return subscribeToStoreNotifications(storeId, prefs.cloud_store_id, (list) => {
      setUnreadNotificationsCount(list.filter((n) => !n.read_at).length);
    });
  }, [storeId]);

  const loadData = () => {
    setActiveShift(db.getActiveDrawerShift(storeId));
    setStats(db.getDashboardStats(storeId));
    setRestriction(db.getStoreRestriction(storeId));
    setMustChangePassword(!!db.getSharedPreferences().must_change_password);
    setUnreadNotificationsCount(db.getStoreNotifications(storeId).filter((n) => !n.read_at).length);

    const user = db.findUserById(storeId);
    if (user) {
      setStoreName(user.store_name);
    }

    const sales = db.getActiveSales(storeId).slice(0, 5);
    setRecentSales(sales);

    const allProducts = db.getProducts(storeId);
    const expiring = allProducts.filter((p) => {
      const exp = checkItemExpiryStatus(p.expiry_date, 60);
      return exp.isExpired || exp.isNearExpiry;
    });
    setExpiringProducts(expiring);
  };

  const handleRefreshMyData = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const prefs = db.getSharedPreferences();
      if (prefs.cloud_store_id) {
        await synchronizeStore().catch(() => undefined);
      }
      await syncCloudStoreNotifications(storeId, prefs.cloud_store_id).catch(() => undefined);
      loadData();
      setBackupNotice('تم تحديث بيانات المتجر بنجاح');
      window.setTimeout(() => setBackupNotice(null), 3000);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCalcPress = (token: string) => {
    setCalcError(null);
    if (token === 'C') {
      setCalcExpression('');
      setCalcResult('0');
      return;
    }
    if (token === 'BACK') {
      setCalcExpression((prev) => prev.slice(0, -1));
      return;
    }
    if (token === '=') {
      const evalRes = evaluateCalculatorExpression(calcExpression || calcResult);
      if (evalRes.ok) {
        setCalcResult(evalRes.value);
        setCalcExpression(evalRes.value);
      } else {
        setCalcError(evalRes.error);
      }
      return;
    }
    setCalcExpression((prev) => {
      const next = `${prev}${token}`;
      const preview = evaluateCalculatorExpression(next);
      if (preview.ok && !/[+\-×÷.]$/.test(next)) {
        setCalcResult(preview.value);
      }
      return next;
    });
  };

  const isRestricted = isSuspended || restriction.restricted;

  const handleOpenZReport = () => {
    if (!activeShift) {
      setBackupNotice('افتح الدرج أولاً وأدخل اسم المستخدم وقيمة الوردية');
      window.setTimeout(() => setBackupNotice(null), 4000);
      return;
    }
    const report = db.getDrawerShiftReport(storeId, activeShift.id);
    setZReportData(report);
    setIsZReportOpen(true);
  };

  const handleOpenDrawer = () => {
    setShiftUserName(activeShift?.operator_name || '');
    setOpeningCash(String(activeShift?.opening_amount ?? ''));
    setIsOpenShiftModal(true);
  };

  const confirmOpenDrawer = () => {
    try {
      const shift = db.openDrawerShift(storeId, shiftUserName, Number(openingCash) || 0);
      setActiveShift(shift);
      setIsOpenShiftModal(false);
      setBackupNotice(`تم فتح الدرج للمستخدم ${shift.operator_name}`);
      window.setTimeout(() => setBackupNotice(null), 4000);
    } catch (error) {
      setBackupNotice(error instanceof Error ? error.message : 'تعذر فتح الدرج');
      window.setTimeout(() => setBackupNotice(null), 4000);
    }
  };

  const confirmCloseDrawer = async () => {
    try {
      const closing = Number(closingCash);
      const closed = db.closeDrawerShift(storeId, closing, activeShift?.operator_name);
      setZReportData(closed.report);
      setActiveShift(null);
      setClosingCash('');
      await createLocalBackup(storeId).catch(() => undefined);
      setBackupNotice(`تم إغلاق الدرج للمستخدم ${closed.operator_name} وحفظ التقرير في قسم التقارير`);
      window.setTimeout(() => setBackupNotice(null), 6000);
    } catch (error) {
      setBackupNotice(error instanceof Error ? error.message : 'تعذر إغلاق الدرج');
      window.setTimeout(() => setBackupNotice(null), 5000);
    }
  };

  return (
    <div className={`flex-1 flex flex-col overflow-hidden transition-colors duration-300 ${theme.screenBg}`}>
      {/* Top Toolbar */}
      <div className="bg-[#0B3D2E] text-white px-3 py-2.5 flex flex-col gap-2 shadow-md">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#C9A961] font-bold shrink-0">
              🏪
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-sm leading-tight truncate">{storeName}</h2>
              <p className="text-[10px] text-emerald-200 truncate">لوحة التحكم والمؤشرات اليومية</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleRefreshMyData()}
            disabled={refreshing}
            className="bg-[#C9A961] hover:bg-[#e0be75] text-[#0B3D2E] text-[11px] font-bold px-2.5 py-1.5 rounded-xl flex items-center gap-1 shadow-sm transition disabled:opacity-70 shrink-0"
            title="تحديث بيانات المتجر والحالة"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>تحديث بياناتي</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={handleOpenDrawer}
            disabled={!!activeShift || isRestricted}
            className="bg-white/15 hover:bg-white/25 disabled:opacity-50 text-white text-[11px] font-bold px-2 py-1.5 rounded-xl flex items-center justify-center gap-1 border border-white/20"
            title="فتح الدرج وبدء وردية المستخدم"
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{activeShift ? 'الدرج مفتوح' : 'فتح الدرج'}</span>
          </button>

          <button
            onClick={handleOpenZReport}
            className="bg-white/15 hover:bg-white/25 text-[#C9A961] text-[11px] font-bold px-2 py-1.5 rounded-xl flex items-center justify-center gap-1 border border-[#C9A961]/30 shadow-xs transition"
            title="تقرير إغلاق الدرج والوردية اليومية"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">إغلاق الدرج</span>
          </button>

          <button
            onClick={() => setIsArchiveOpen(true)}
            className="bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold px-2 py-1.5 rounded-xl flex items-center justify-center gap-1 border border-white/20"
            title="عرض العناصر والأرشيف"
          >
            <Archive className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">الأرشيف</span>
          </button>
        </div>
      </div>

      {backupNotice && <div role="status" className="bg-emerald-700 text-white text-xs text-center p-2 font-bold">{backupNotice}</div>}

      {/* Restriction / Suspension Banner */}
      {isRestricted && (
        <div className="bg-[#8B2E2E] text-white px-4 py-2.5 flex items-center gap-2 shadow-inner text-xs font-bold">
          <AlertOctagon className="w-4 h-4 shrink-0" />
          <div className="flex-1">
            <span>{restriction.reason === 'expired' ? 'انتهت صلاحية الاشتراك: ' : 'الحساب موقوف: '}</span>
            <span className="font-normal">
              {suspensionReason || restriction.message || 'تصفح التقارير والنسخ الاحتياطي وإدارة العملاء والديون فقط متاحة حالياً.'}
            </span>
          </div>
        </div>
      )}

      {/* Temporary Password Change Reminder Banner */}
      {mustChangePassword && (
        <div role="alert" className="mx-4 mt-2.5 rounded-xl border border-amber-500 bg-amber-50 dark:bg-amber-950/60 px-3 py-2.5 flex items-center justify-between gap-2 text-xs text-amber-950 dark:text-amber-100">
          <div className="flex items-center gap-2 min-w-0">
            <KeyRound className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="font-bold leading-snug">كلمة مرورك مؤقتة من الإدارة — غيّرها الآن لضمان أمان حسابك</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('settings', { section: 'security', openPasswordModal: true })}
            className="shrink-0 rounded-lg bg-[#0B3D2E] text-white px-2.5 py-1.5 text-[11px] font-bold hover:bg-[#06231A]"
          >
            تغيير كلمة المرور
          </button>
        </div>
      )}

      {/* Unread Owner Notification Pill */}
      {unreadNotificationsCount > 0 && (
        <button
          type="button"
          onClick={() => onNavigate('settings', { section: 'notifications' })}
          className="mx-4 mt-2.5 rounded-xl border border-[#C9A961] bg-amber-50 dark:bg-amber-950/50 px-3 py-2 flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-200"
        >
          <span className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#C9A961]" />
            <span>لديك {unreadNotificationsCount} إشعار غير مقروء من الإدارة</span>
          </span>
          <span className="underline text-[11px]">عرض</span>
        </button>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <div className={`rounded-2xl p-3.5 border flex flex-col justify-between transition-colors duration-300 ${theme.cardBg}`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold ${theme.textSecondary}`}>مبيعات اليوم</span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-emerald-950 text-emerald-300' : 'bg-emerald-50 text-[#0B3D2E]'}`}>
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <p className={`text-sm font-extrabold ${isDarkMode ? 'text-emerald-300' : 'text-[#0B3D2E]'}`}>
                {formatCurrency(stats.todaySalesTotal)}
              </p>
              <p className={`text-[9px] font-semibold mt-0.5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>إجمالي المبيعات المسجلة</p>
            </div>
          </div>

          <div className={`rounded-2xl p-3.5 border flex flex-col justify-between transition-colors duration-300 ${theme.cardBg}`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold ${theme.textSecondary}`}>إجمالي الديون</span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-red-950 text-red-300' : 'bg-red-50 text-[#8B2E2E]'}`}>
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <p className="text-sm font-extrabold text-[#EF4444]">{formatCurrency(stats.totalDebt)}</p>
              <p className="text-[9px] text-red-400 font-semibold mt-0.5">ديون مستحقة على الزبائن</p>
            </div>
          </div>

          <div className={`rounded-2xl p-3.5 border flex flex-col justify-between transition-colors duration-300 ${theme.cardBg}`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold ${theme.textSecondary}`}>عدد الفواتير</span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-amber-950 text-[#C9A961]' : 'bg-amber-50 text-[#C9A961]'}`}>
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <p className={`text-base font-extrabold ${theme.textPrimary}`}>
                {stats.invoiceCount} <span className={`text-xs font-normal ${theme.textSecondary}`}>فاتورة</span>
              </p>
              <p className="text-[9px] text-[#C9A961] font-semibold mt-0.5">فواتير اليوم الصادرة</p>
            </div>
          </div>

          <div className={`rounded-2xl p-3.5 border flex flex-col justify-between transition-colors duration-300 ${theme.cardBg}`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold ${theme.textSecondary}`}>صافي الربح</span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-emerald-950 text-emerald-300' : 'bg-emerald-50 text-[#0B3D2E]'}`}>
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <p className={`text-sm font-extrabold ${isDarkMode ? 'text-emerald-300' : 'text-[#0B3D2E]'}`}>
                {formatCurrency(stats.netProfit)}
              </p>
              <p className={`text-[9px] font-semibold mt-0.5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-800'}`}>هامش الربح التقديري</p>
            </div>
          </div>
        </div>

        {expiringProducts.length > 0 && (
          <div className={`border rounded-2xl p-3 flex items-center justify-between text-xs ${isDarkMode ? 'bg-amber-950/40 border-amber-800 text-amber-200' : 'bg-amber-50 border-amber-300 text-amber-900'}`}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <p className="font-bold">تنبيه صلاحية الأصناف ({expiringProducts.length} أصناف)</p>
                <p className={`text-[10px] ${isDarkMode ? 'text-amber-300' : 'text-amber-700'}`}>توجد بضائع أوشكت على انتهاء الصلاحية أو منتهية في المخزن</p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('inventory')}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-2.5 py-1 rounded-xl text-[11px] shrink-0 transition"
            >
              معاينة
            </button>
          </div>
        )}

        {/* Quick Shortcut Buttons (3x2 grid including Calculator) */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onNavigate('pos')}
            className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center ${
              isDarkMode ? 'bg-[#18221E] border-emerald-900/60 hover:bg-[#1e2d27] text-gray-200' : 'bg-white border-gray-200 hover:bg-emerald-50 text-gray-800'
            }`}
          >
            <ShoppingCart className={`w-5 h-5 mb-1 ${isDarkMode ? 'text-emerald-400' : 'text-[#0B3D2E]'}`} />
            <span className="text-[11px] font-bold">فاتورة بيع</span>
          </button>

          <button
            onClick={() => onNavigate('addProduct')}
            className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center ${
              isDarkMode ? 'bg-[#18221E] border-emerald-900/60 hover:bg-[#1e2d27] text-gray-200' : 'bg-white border-gray-200 hover:bg-emerald-50 text-gray-800'
            }`}
          >
            <PlusCircle className="w-5 h-5 text-[#C9A961] mb-1" />
            <span className="text-[11px] font-bold">إضافة صنف</span>
          </button>

          <button
            onClick={() => onNavigate('returns')}
            className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center ${
              isDarkMode ? 'bg-[#18221E] border-emerald-900/60 hover:bg-[#1e2d27] text-gray-200' : 'bg-white border-gray-200 hover:bg-emerald-50 text-gray-800'
            }`}
          >
            <RotateCcw className="w-5 h-5 text-[#EF4444] mb-1" />
            <span className="text-[11px] font-bold">المرتجعات</span>
          </button>

          <button
            onClick={() => onNavigate('reports')}
            className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center ${
              isDarkMode ? 'bg-[#18221E] border-emerald-900/60 text-gray-200' : 'bg-white border-gray-200 text-gray-800'
            }`}
          >
            <FileSpreadsheet className="w-5 h-5 text-[#C9A961] mb-1" />
            <span className="text-[11px] font-bold">التقارير</span>
          </button>

          <button
            onClick={() => onNavigate('expenses')}
            className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center ${
              isDarkMode ? 'bg-[#18221E] border-emerald-900/60 text-gray-200' : 'bg-white border-gray-200 text-gray-800'
            }`}
          >
            <Receipt className="w-5 h-5 text-red-500 mb-1" />
            <span className="text-[11px] font-bold">المصروفات</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCalcOpen(true)}
            className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center ${
              isDarkMode ? 'bg-[#18221E] border-emerald-900/60 text-gray-200 hover:bg-[#1e2d27]' : 'bg-white border-gray-200 text-gray-800 hover:bg-emerald-50'
            }`}
          >
            <Calculator className="w-5 h-5 text-emerald-600 mb-1" />
            <span className="text-[11px] font-bold">آلة حاسبة</span>
          </button>
        </div>

        {/* Recent Invoices List */}
        <div className={`rounded-2xl p-4 border transition-colors duration-300 ${theme.cardBg}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className={`font-bold text-xs flex items-center gap-1.5 ${theme.textPrimary}`}>
              <Clock className="w-4 h-4 text-[#C9A961]" />
              <span>آخر الفواتير الصادرة</span>
            </h3>
            <button
              onClick={() => onNavigate('pos')}
              className={`text-[10px] font-bold hover:underline ${isDarkMode ? 'text-[#C9A961]' : 'text-[#0B3D2E]'}`}
            >
              فتح POS
            </button>
          </div>

          {recentSales.length === 0 ? (
            <p className={`text-xs text-center py-4 ${theme.textMuted}`}>لا توجد فواتير مسجلة اليوم حتى الآن</p>
          ) : (
            <div className="space-y-2">
              {recentSales.map((s) => (
                <div key={s.id} className={`p-2.5 rounded-xl flex items-center justify-between text-xs border ${theme.secondaryBox}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${theme.textPrimary}`}>فاتورة #{s.id}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-md font-semibold ${
                          s.payment_type === 'نقداً'
                            ? isDarkMode
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-emerald-100 text-emerald-800'
                            : isDarkMode
                              ? 'bg-red-950 text-red-300 border border-red-800'
                              : 'bg-red-100 text-[#8B2E2E]'
                        }`}
                      >
                        {s.payment_type}
                      </span>
                      {s.customer_name && <span className={`text-[10px] font-semibold ${theme.textSecondary}`}>({s.customer_name})</span>}
                    </div>
                    <span className={`text-[10px] font-mono ${theme.textMuted}`}>{s.created_at}</span>
                  </div>

                  <div className={`text-left font-mono font-bold ${isDarkMode ? 'text-[#C9A961]' : 'text-[#0B3D2E]'}`}>
                    {formatCurrency(s.total_amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Calculator Modal */}
      {isCalcOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className={`${theme.cardBg} rounded-3xl w-full max-w-xs p-4 shadow-2xl border-2 border-[#C9A961] space-y-3`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-[#C9A961]" />
                <h3 className={`font-bold text-sm ${theme.textPrimary}`}>الآلة الحاسبة السريعة</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCalcOpen(false)}
                aria-label="إغلاق الآلة الحاسبة"
                className="p-1 rounded-full hover:bg-gray-500/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className={`rounded-2xl border p-3 text-left font-mono ${theme.inputBg}`} dir="ltr">
              <div className="text-xs text-gray-400 min-h-4 truncate">{calcExpression || '0'}</div>
              <div data-testid="calc-display" className={`text-2xl font-black truncate mt-1 ${theme.textPrimary}`}>
                {calcResult}
              </div>
              {calcError && <div className="text-[11px] font-sans font-bold text-red-500 mt-1 text-right">{calcError}</div>}
            </div>

            <div className="grid grid-cols-4 gap-2 font-mono text-sm font-bold" dir="ltr">
              {[
                { label: 'C', action: 'C', style: 'bg-red-50 text-red-700 border-red-200' },
                { label: '⌫', action: 'BACK', style: 'bg-amber-50 text-amber-800 border-amber-200' },
                { label: '÷', action: '÷', style: 'bg-emerald-50 text-[#0B3D2E] border-emerald-200' },
                { label: '×', action: '×', style: 'bg-emerald-50 text-[#0B3D2E] border-emerald-200' },
                { label: '7', action: '7' },
                { label: '8', action: '8' },
                { label: '9', action: '9' },
                { label: '-', action: '-', style: 'bg-emerald-50 text-[#0B3D2E] border-emerald-200' },
                { label: '4', action: '4' },
                { label: '5', action: '5' },
                { label: '6', action: '6' },
                { label: '+', action: '+', style: 'bg-emerald-50 text-[#0B3D2E] border-emerald-200' },
                { label: '1', action: '1' },
                { label: '2', action: '2' },
                { label: '3', action: '3' },
                { label: '=', action: '=', style: 'row-span-2 bg-[#0B3D2E] text-white border-[#C9A961]' },
                { label: '0', action: '0', style: 'col-span-2' },
                { label: '.', action: '.' },
              ].map((btn) => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={() => handleCalcPress(btn.action)}
                  className={`py-3 rounded-xl border transition active:scale-95 flex items-center justify-center ${
                    btn.style || (isDarkMode ? 'bg-[#141F1A] border-emerald-900/60 text-white' : 'bg-white border-gray-200 text-gray-900')
                  }`}
                >
                  {btn.action === 'BACK' ? <Delete className="w-4 h-4" /> : btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {isOpenShiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-[#FAF8F3] rounded-3xl w-full max-w-sm p-5 border-2 border-[#C9A961] space-y-3 text-gray-900">
            <h3 className="font-bold text-sm text-[#0B3D2E]">فتح الدرج وبدء وردية عمل</h3>
            <div>
              <label className="block text-xs font-bold mb-1 text-gray-700">اسم المستخدم / الكاشير:</label>
              <input value={shiftUserName} onChange={(e) => setShiftUserName(e.target.value)} placeholder="اكتب اسم الموظف" className="w-full rounded-xl border border-gray-300 p-2.5 text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-gray-700">قيمة النقد عند فتح الوردية:</label>
              <input type="number" min="0" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} placeholder="مثال: 5000" className="w-full rounded-xl border border-gray-300 p-2.5 text-sm font-mono" required />
            </div>
            <div className="flex gap-2">
              <button onClick={confirmOpenDrawer} className="flex-1 bg-[#0B3D2E] text-white py-2.5 rounded-xl text-xs font-bold">
                فتح الدرج وبدء الوردية
              </button>
              <button onClick={() => setIsOpenShiftModal(false)} className="px-4 border border-gray-300 rounded-xl text-xs">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Daily Shift Closing / Z-Report Modal */}
      {isZReportOpen && zReportData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#FAF8F3] rounded-3xl w-full max-w-sm p-5 shadow-2xl border-2 border-[#C9A961] space-y-3 text-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 pb-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#0B3D2E]" />
                <h3 className="font-bold text-sm text-[#0B3D2E]">تقرير إغلاق الوردية والدرج (Z-Report)</h3>
              </div>
              <button onClick={() => setIsZReportOpen(false)} className="text-xs font-bold text-gray-500 hover:text-gray-800">
                ✕
              </button>
            </div>

            <p className="text-[11px] text-gray-500 font-mono">
              المتجر: {storeName} | المستخدم: {zReportData.shift?.operator_name || '-'}
              <br />
              فتح الوردية: {zReportData.shift?.opening_at?.replace('T', ' ').slice(0, 19) || '-'} | قيمة البداية: {formatCurrency(zReportData.openingAmount)}
            </p>

            <div className="bg-white rounded-2xl p-3 border border-gray-200 space-y-2 text-xs font-mono">
              <div className="flex justify-between items-center text-emerald-800">
                <span className="font-bold">المقبوض نقداً (كاش الدرج):</span>
                <span className="font-bold">{formatCurrency(zReportData.totalCashSales)}</span>
              </div>
              <div className="flex justify-between items-center text-[#8B2E2E]">
                <span>المبيعات الآجلة (المتبقي ديون):</span>
                <span>{formatCurrency(zReportData.totalCreditSales)}</span>
              </div>
              <div className="flex justify-between items-center text-amber-800">
                <span>مرتجعات نقدية مخصومة:</span>
                <span>{formatCurrency(zReportData.totalReturnsAmount)}</span>
              </div>
              <div className="flex justify-between items-center text-gray-700 pt-1 border-t border-gray-100 font-bold">
                <span>إجمالي حجم المبيعات الكامل:</span>
                <span>{formatCurrency(zReportData.totalSalesVolume)}</span>
              </div>
              <div className="flex justify-between items-center text-gray-500">
                <span>عدد العمليات المنفذة:</span>
                <span>{zReportData.totalSalesCount} فاتورة</span>
              </div>
              <div className="pt-2 border-t-2 border-[#0B3D2E] flex justify-between items-center text-[#0B3D2E] text-sm font-bold">
                <span>النقدية الفعلية الواجب توفرها بالدرج:</span>
                <span className="text-base text-emerald-700">{formatCurrency(zReportData.netCashInDrawer)}</span>
              </div>
            </div>

            <div className="max-h-32 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 text-[10px] space-y-1">
              <p className="font-bold text-[#0B3D2E]">عمليات الوردية</p>
              {zReportData.sales?.length ? (
                zReportData.sales.map((sale: any) => (
                  <div key={`sale-${sale.id}`} className="flex justify-between">
                    <span>
                      فاتورة #{sale.id} — {sale.operator_name || zReportData.shift?.operator_name}
                    </span>
                    <b>{formatCurrency(sale.total_amount)}</b>
                  </div>
                ))
              ) : (
                <p className="text-gray-400">لا توجد فواتير في هذه الوردية.</p>
              )}
              {zReportData.payments?.map((payment: any) => (
                <div key={`pay-${payment.id}`} className="flex justify-between text-emerald-700">
                  <span>سند قبض #{payment.receipt_number}</span>
                  <b>{formatCurrency(payment.amount)}</b>
                </div>
              ))}
              {zReportData.returns?.map((r: any) => (
                <div key={`ret-${r.id}`} className="flex justify-between text-amber-700">
                  <span>مرتجع #{r.id}</span>
                  <b>{formatCurrency(r.amount)}</b>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-gray-700">النقدية الفعلية عند الإغلاق:</label>
              <input
                type="number"
                min="0"
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                placeholder={`المتوقع: ${zReportData.expectedCash || 0}`}
                className="w-full rounded-xl border border-gray-300 p-2.5 text-sm font-mono"
              />
            </div>

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => {
                  const reportText = [
                    `تقرير الوردية والدرج - ${storeName}`,
                    `الموظف: ${zReportData.shift?.operator_name || '-'}`,
                    `فتح الوردية: ${zReportData.shift?.opening_at?.replace('T', ' ').slice(0, 19) || '-'}`,
                    `قيمة البداية: ${formatCurrency(zReportData.openingAmount)}`,
                    `المقبوض نقداً: ${formatCurrency(zReportData.totalCashSales)}`,
                    `المبيعات الآجلة: ${formatCurrency(zReportData.totalCreditSales)}`,
                    `المرتجعات: ${formatCurrency(zReportData.totalReturnsAmount)}`,
                    `إجمالي المبيعات: ${formatCurrency(zReportData.totalSalesVolume)}`,
                    `النقد المتوقع بالدرج: ${formatCurrency(zReportData.netCashInDrawer)}`,
                  ].join('\n');
                  void shareTextEverywhere(`تقرير الوردية - ${storeName}`, reportText)
                    .then((outcome) => {
                      const msg = formatShareOutcomeToast(outcome, 'تقرير الوردية');
                      setZReportShareNotice(msg);
                      setBackupNotice(msg);
                      window.setTimeout(() => setZReportShareNotice(null), 3500);
                    })
                    .catch(() => undefined);
                }}
                className="w-full bg-[#1F9D55] hover:bg-[#198748] text-white py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <Share2 className="w-4 h-4" />
                <span>مشاركة تقرير الوردية (بدون إنترنت)</span>
              </button>
              {zReportShareNotice && (
                <p role="status" className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-2 text-center">
                  {zReportShareNotice}
                </p>
              )}

              <button
                onClick={confirmCloseDrawer}
                disabled={!closingCash || Number(closingCash) < 0 || isRestricted}
                className="w-full bg-[#0B3D2E] text-white py-2.5 rounded-xl font-bold text-xs disabled:opacity-50"
              >
                إتمام الإغلاق وحفظ تقرير الوردية
              </button>
            </div>
          </div>
        </div>
      )}

      {isArchiveOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md max-h-[88vh] overflow-hidden rounded-3xl border border-[#C9A961] bg-[#FAF8F3] shadow-2xl flex flex-col text-gray-900">
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <h3 className="font-bold text-sm text-[#0B3D2E]">الأرشيف والبيانات المخفية</h3>
                <p className="text-[10px] text-gray-500">الفواتير والعملاء والأصناف المؤرشفة</p>
              </div>
              <button onClick={() => setIsArchiveOpen(false)} className="rounded-full px-2 py-1 text-lg text-gray-500">
                ×
              </button>
            </div>
            <div className="flex gap-2 p-3 text-xs">
              {(
                [
                  ['sales', 'الفواتير'],
                  ['customers', 'العملاء'],
                  ['products', 'الأصناف'],
                ] as const
              ).map(([tab, label]) => (
                <button
                  key={tab}
                  onClick={() => setArchiveTab(tab)}
                  className={`flex-1 rounded-xl border py-2 font-bold ${archiveTab === tab ? 'bg-[#0B3D2E] text-white border-[#C9A961]' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 p-3">
              {archiveTab === 'sales' &&
                db.getArchivedSales(storeId).map((sale) => (
                  <div key={sale.id} className="rounded-xl border bg-white p-3 flex items-center justify-between">
                    <div>
                      <b className="text-xs">فاتورة #{sale.id}</b>
                      <p className="text-[10px] text-gray-500">
                        {sale.created_at} • {formatCurrency(sale.total_amount)}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        db.restoreSale(storeId, sale.id);
                        setIsArchiveOpen(false);
                        loadData();
                      }}
                      className="rounded-lg border border-emerald-300 px-3 py-1.5 text-[10px] font-bold text-emerald-700"
                    >
                      استعادة
                    </button>
                  </div>
                ))}
              {archiveTab === 'sales' && db.getArchivedSales(storeId).length === 0 && (
                <p className="py-10 text-center text-xs text-gray-400">لا توجد فواتير مؤرشفة.</p>
              )}
              {archiveTab === 'customers' &&
                db.getArchivedCustomers(storeId).map((customer) => (
                  <div key={customer.id} className="rounded-xl border bg-white p-3 flex items-center justify-between">
                    <div>
                      <b className="text-xs">{customer.name}</b>
                      <p className="text-[10px] text-gray-500">
                        رقم العميل #{customer.id} • {customer.phone || 'بدون هاتف'}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        db.restoreCustomer(storeId, customer.id);
                        loadData();
                      }}
                      className="rounded-lg border border-emerald-300 px-3 py-1.5 text-[10px] font-bold text-emerald-700"
                    >
                      استعادة
                    </button>
                  </div>
                ))}
              {archiveTab === 'customers' && db.getArchivedCustomers(storeId).length === 0 && (
                <p className="py-10 text-center text-xs text-gray-400">لا يوجد عملاء مؤرشفون.</p>
              )}
              {archiveTab === 'products' &&
                db.getArchivedProducts(storeId).map((product) => (
                  <div key={product.id} className="rounded-xl border bg-white p-3 flex items-center justify-between">
                    <div>
                      <b className="text-xs">{product.name}</b>
                      <p className="text-[10px] text-gray-500">باركود {product.barcode}</p>
                    </div>
                    <button
                      onClick={() => {
                        db.restoreProduct(storeId, product.id);
                        loadData();
                      }}
                      className="rounded-lg border border-emerald-300 px-3 py-1.5 text-[10px] font-bold text-emerald-700"
                    >
                      استعادة
                    </button>
                  </div>
                ))}
              {archiveTab === 'products' && db.getArchivedProducts(storeId).length === 0 && (
                <p className="py-10 text-center text-xs text-gray-400">لا توجد أصناف مؤرشفة.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BottomNavigationView */}
      <div className="bg-white border-t border-gray-200 px-2 py-1.5 flex items-center justify-around shadow-lg">
        <button onClick={() => onNavigate('dashboard')} className="flex flex-col items-center p-1 text-[#0B3D2E]">
          <div className="w-5 h-5 flex items-center justify-center">
            <TrendingUp className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-bold mt-0.5">الرئيسية</span>
        </button>

        <button onClick={() => onNavigate('pos')} className="flex flex-col items-center p-1 text-gray-500 hover:text-[#0B3D2E]">
          <div className="w-5 h-5 flex items-center justify-center">
            <ShoppingCart className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-medium mt-0.5">البيع POS</span>
        </button>

        <button onClick={() => onNavigate('inventory')} className="flex flex-col items-center p-1 text-gray-500 hover:text-[#0B3D2E]">
          <div className="w-5 h-5 flex items-center justify-center">
            <Package className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-medium mt-0.5">المخزون</span>
        </button>

        <button onClick={() => onNavigate('customers')} className="flex flex-col items-center p-1 text-gray-500 hover:text-[#0B3D2E]">
          <div className="w-5 h-5 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-medium mt-0.5">العملاء</span>
        </button>

        <button onClick={() => onNavigate('settings')} className="relative flex flex-col items-center p-1 text-gray-500 hover:text-[#0B3D2E]">
          <div className="w-5 h-5 flex items-center justify-center relative">
            <Settings className="w-4 h-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -left-1 min-w-[14px] h-[14px] px-0.5 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium mt-0.5">الإعدادات</span>
        </button>
      </div>
    </div>
  );
};
