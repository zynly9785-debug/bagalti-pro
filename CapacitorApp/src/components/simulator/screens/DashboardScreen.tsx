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
  Printer,
  Calendar,
  Layers,
  Archive,
} from 'lucide-react';
import { db } from '../../../db/sqlite-simulation.ts';
import { formatCurrency, checkItemExpiryStatus } from '../../../utils/pureLogic.ts';
import { Product } from '../../../types/index.ts';
import { useTheme } from '../../../context/ThemeContext.tsx';
import { createLocalBackup } from '../../../utils/nativeServices.ts';

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

  // Z-Report Modal
  const [isZReportOpen, setIsZReportOpen] = useState(false);
  const [zReportData, setZReportData] = useState<any>(null);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const [isOpenShiftModal, setIsOpenShiftModal] = useState(false);
  const [shiftUserName, setShiftUserName] = useState('');
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [archiveTab, setArchiveTab] = useState<'sales'|'customers'|'products'>('sales');
  const [activeShift, setActiveShift] = useState(db.getActiveDrawerShift(storeId));

  useEffect(() => {
    loadData();
  }, [storeId]);

  const loadData = () => {
    setActiveShift(db.getActiveDrawerShift(storeId));
    const s = db.getDashboardStats(storeId);
    setStats(s);

    const user = db.findUserById(storeId);
    if (user) {
      setStoreName(user.store_name);
    }

    const sales = db.getActiveSales(storeId).slice(0, 5);
    setRecentSales(sales);

    // Check expiring products
    const allProducts = db.getProducts(storeId);
    const expiring = allProducts.filter((p) => {
      const exp = checkItemExpiryStatus(p.expiry_date, 60);
      return exp.isExpired || exp.isNearExpiry;
    });
    setExpiringProducts(expiring);
  };

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
      setBackupNotice(`تم إغلاق الدرج للمستخدم ${closed.operator_name} وإنشاء تقرير الوردية`);
      window.setTimeout(() => setBackupNotice(null), 6000);
    } catch (error) {
      setBackupNotice(error instanceof Error ? error.message : 'تعذر إغلاق الدرج');
      window.setTimeout(() => setBackupNotice(null), 5000);
    }
  };

  return (
    <div className={`flex-1 flex flex-col overflow-hidden transition-colors duration-300 ${theme.screenBg}`}>
      {/* Top Toolbar */}
      <div className="bg-[#0B3D2E] text-white p-3.5 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#C9A961] font-bold">
            🏪
          </div>
          <div>
            <h2 className="font-bold text-sm leading-tight">{storeName}</h2>
            <p className="text-[10px] text-emerald-200">لوحة التحكم والمؤشرات اليومية</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleOpenDrawer}
            disabled={!!activeShift}
            className="bg-white/15 hover:bg-white/25 disabled:opacity-50 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl flex items-center gap-1 border border-white/20"
            title="فتح الدرج وبدء وردية المستخدم"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{activeShift ? 'الدرج مفتوح' : 'فتح الدرج'}</span>
          </button>

          <button
            onClick={handleOpenZReport}
            className="bg-white/15 hover:bg-white/25 text-[#C9A961] text-xs font-bold px-2.5 py-1.5 rounded-xl flex items-center gap-1 border border-[#C9A961]/30 shadow-xs transition"
            title="تقرير إغلاق الدرج والوردية اليومية"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>إغلاق الدرج</span>
          </button>

          <button
            onClick={() => setIsArchiveOpen(true)}
            className="bg-white/15 hover:bg-white/25 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl flex items-center gap-1 border border-white/20"
            title="عرض العناصر والأرشيف"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>الأرشيف</span>
          </button>

          <button
            onClick={() => onNavigate('pos')}
            className="bg-[#C9A961] hover:bg-[#e0be75] text-[#0B3D2E] text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-sm transition"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>نقطة POS</span>
          </button>
        </div>
      </div>

      {backupNotice && <div className="bg-emerald-700 text-white text-xs text-center p-2 font-bold">{backupNotice}</div>}
      {/* Red Suspension Banner if isSuspended */}
      {isSuspended && (
        <div className="bg-[#8B2E2E] text-white px-4 py-2.5 flex items-center gap-2 shadow-inner text-xs font-bold animate-pulse">
          <AlertOctagon className="w-4 h-4 shrink-0" />
          <div className="flex-1">
            <span>الحساب موقوف: </span>
            <span className="font-normal">{suspensionReason || 'يرجى تجديد الاشتراك مع الإدارة'}</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {/* 4 Dashboard Cards (CardView) */}
        <div className="grid grid-cols-2 gap-3">
          {/* 1. مبيعات اليوم */}
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

          {/* 2. الديون */}
          <div className={`rounded-2xl p-3.5 border flex flex-col justify-between transition-colors duration-300 ${theme.cardBg}`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold ${theme.textSecondary}`}>إجمالي الديون</span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-red-950 text-red-300' : 'bg-red-50 text-[#8B2E2E]'}`}>
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <p className="text-sm font-extrabold text-[#EF4444]">
                {formatCurrency(stats.totalDebt)}
              </p>
              <p className="text-[9px] text-red-400 font-semibold mt-0.5">ديون مستحقة على الزبائن</p>
            </div>
          </div>

          {/* 3. عدد الفواتير */}
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

          {/* 4. صافي الربح */}
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

        {/* Expiry Warning Alert if products are expiring */}
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

        {/* Quick Shortcut Buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onNavigate('pos')}
            className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center ${
              isDarkMode
                ? 'bg-[#18221E] border-emerald-900/60 hover:bg-[#1e2d27] text-gray-200'
                : 'bg-white border-gray-200 hover:bg-emerald-50 text-gray-800'
            }`}
          >
            <ShoppingCart className={`w-5 h-5 mb-1 ${isDarkMode ? 'text-emerald-400' : 'text-[#0B3D2E]'}`} />
            <span className="text-[11px] font-bold">فاتورة بيع</span>
          </button>
          <button
            onClick={() => onNavigate('addProduct')}
            className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center ${
              isDarkMode
                ? 'bg-[#18221E] border-emerald-900/60 hover:bg-[#1e2d27] text-gray-200'
                : 'bg-white border-gray-200 hover:bg-emerald-50 text-gray-800'
            }`}
          >
            <PlusCircle className="w-5 h-5 text-[#C9A961] mb-1" />
            <span className="text-[11px] font-bold">إضافة صنف</span>
          </button>
          <button
            onClick={() => onNavigate('returns')}
            className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center ${
              isDarkMode
                ? 'bg-[#18221E] border-emerald-900/60 hover:bg-[#1e2d27] text-gray-200'
                : 'bg-white border-gray-200 hover:bg-emerald-50 text-gray-800'
            }`}
          >
            <RotateCcw className="w-5 h-5 text-[#EF4444] mb-1" />
            <span className="text-[11px] font-bold">المرتجعات</span>
          </button>
          <button onClick={() => onNavigate('reports')} className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center ${isDarkMode ? 'bg-[#18221E] border-emerald-900/60 text-gray-200' : 'bg-white border-gray-200 text-gray-800'}`}><FileSpreadsheet className="w-5 h-5 text-[#C9A961] mb-1"/><span className="text-[11px] font-bold">التقارير</span></button>
          <button onClick={() => onNavigate('expenses')} className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center ${isDarkMode ? 'bg-[#18221E] border-emerald-900/60 text-gray-200' : 'bg-white border-gray-200 text-gray-800'}`}><Receipt className="w-5 h-5 text-red-500 mb-1"/><span className="text-[11px] font-bold">المصروفات</span></button>
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
                <div
                  key={s.id}
                  className={`p-2.5 rounded-xl flex items-center justify-between text-xs border ${theme.secondaryBox}`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${theme.textPrimary}`}>فاتورة #{s.id}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-semibold ${
                        s.payment_type === 'نقداً'
                          ? isDarkMode ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-emerald-100 text-emerald-800'
                          : isDarkMode ? 'bg-red-950 text-red-300 border border-red-800' : 'bg-red-100 text-[#8B2E2E]'
                      }`}>
                        {s.payment_type}
                      </span>
                      {s.customer_name && (
                        <span className={`text-[10px] font-semibold ${theme.textSecondary}`}>({s.customer_name})</span>
                      )}
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

      {isOpenShiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-[#FAF8F3] rounded-3xl w-full max-w-sm p-5 border-2 border-[#C9A961] space-y-3">
            <h3 className="font-bold text-sm text-[#0B3D2E]">فتح الدرج وبدء وردية عمل</h3>
            <div>
              <label className="block text-xs font-bold mb-1 text-gray-700">اسم المستخدم / الكاشير:</label>
              <input value={shiftUserName} onChange={(e)=>setShiftUserName(e.target.value)} placeholder="اكتب اسم الموظف" className="w-full rounded-xl border border-gray-300 p-2.5 text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-gray-700">قيمة النقد عند فتح الوردية:</label>
              <input type="number" min="0" value={openingCash} onChange={(e)=>setOpeningCash(e.target.value)} placeholder="مثال: 5000" className="w-full rounded-xl border border-gray-300 p-2.5 text-sm font-mono" required />
            </div>
            <div className="flex gap-2"><button onClick={confirmOpenDrawer} className="flex-1 bg-[#0B3D2E] text-white py-2.5 rounded-xl text-xs font-bold">فتح الدرج وبدء الوردية</button><button onClick={()=>setIsOpenShiftModal(false)} className="px-4 border border-gray-300 rounded-xl text-xs">إلغاء</button></div>
          </div>
        </div>
      )}

      {/* Daily Shift Closing / Z-Report Modal */}
      {isZReportOpen && zReportData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#FAF8F3] rounded-3xl w-full max-w-sm p-5 shadow-2xl border-2 border-[#C9A961] space-y-3">
            <div className="flex items-center justify-between border-b border-gray-200 pb-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#0B3D2E]" />
                <h3 className="font-bold text-sm text-[#0B3D2E]">
                  تقرير إغلاق الوردية والدرج (Z-Report)
                </h3>
              </div>
              <button
                onClick={() => setIsZReportOpen(false)}
                className="text-xs font-bold text-gray-500 hover:text-gray-800"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-gray-500 font-mono">
              المتجر: {storeName} | المستخدم: {zReportData.shift?.operator_name || '-'}<br/>
              فتح الوردية: {zReportData.shift?.opening_at?.replace('T',' ').slice(0,19) || '-'} | قيمة البداية: {formatCurrency(zReportData.openingAmount)}
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
              {zReportData.totalNetworkSales > 0 && (
                <div className="flex justify-between items-center text-blue-800">
                  <span>مدفوعات شبكة / بطاقات:</span>
                  <span>{formatCurrency(zReportData.totalNetworkSales)}</span>
                </div>
              )}
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

              {/* Net Cash expected in Drawer */}
              <div className="pt-2 border-t-2 border-[#0B3D2E] flex justify-between items-center text-[#0B3D2E] text-sm font-bold">
                <span>النقدية الفعلية الواجب توفرها بالدرج:</span>
                <span className="text-base text-emerald-700">
                  {formatCurrency(zReportData.netCashInDrawer)}
                </span>
              </div>
            </div>

            <div className="max-h-32 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 text-[10px] space-y-1">
              <p className="font-bold text-[#0B3D2E]">عمليات الوردية</p>
              {zReportData.sales?.length ? zReportData.sales.map((sale: any) => (
                <div key={`sale-${sale.id}`} className="flex justify-between"><span>فاتورة #{sale.id} — {sale.operator_name || zReportData.shift?.operator_name}</span><b>{formatCurrency(sale.total_amount)}</b></div>
              )) : <p className="text-gray-400">لا توجد فواتير في هذه الوردية.</p>}
              {zReportData.payments?.map((payment: any) => <div key={`pay-${payment.id}`} className="flex justify-between text-emerald-700"><span>سند قبض #{payment.receipt_number}</span><b>{formatCurrency(payment.amount)}</b></div>)}
              {zReportData.returns?.map((r: any) => <div key={`ret-${r.id}`} className="flex justify-between text-amber-700"><span>مرتجع #{r.id}</span><b>{formatCurrency(r.amount)}</b></div>)}
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-gray-700">النقدية الفعلية عند الإغلاق:</label>
              <input type="number" min="0" value={closingCash} onChange={(e)=>setClosingCash(e.target.value)} placeholder={`المتوقع: ${zReportData.expectedCash || 0}`} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm font-mono" />
            </div>

            <button
              onClick={confirmCloseDrawer}
              disabled={!closingCash || Number(closingCash) < 0}
              className="w-full bg-[#0B3D2E] text-white py-2.5 rounded-xl font-bold text-xs disabled:opacity-50"
            >
              إتمام الإغلاق وتوليد تقرير الوردية
            </button>
          </div>
        </div>
      )}

      {isArchiveOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md max-h-[88vh] overflow-hidden rounded-3xl border border-[#C9A961] bg-[#FAF8F3] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b p-4"><div><h3 className="font-bold text-sm text-[#0B3D2E]">الأرشيف والبيانات المخفية</h3><p className="text-[10px] text-gray-500">الفواتير والعملاء والأصناف المؤرشفة</p></div><button onClick={()=>setIsArchiveOpen(false)} className="rounded-full px-2 py-1 text-lg text-gray-500">×</button></div>
            <div className="flex gap-2 p-3 text-xs">{([['sales','الفواتير'],['customers','العملاء'],['products','الأصناف']] as const).map(([tab,label])=><button key={tab} onClick={()=>setArchiveTab(tab)} className={`flex-1 rounded-xl border py-2 font-bold ${archiveTab===tab?'bg-[#0B3D2E] text-white border-[#C9A961]':''}`}>{label}</button>)}</div>
            <div className="flex-1 overflow-y-auto space-y-2 p-3">
              {archiveTab==='sales' && db.getArchivedSales(storeId).map(sale=><div key={sale.id} className="rounded-xl border bg-white p-3 flex items-center justify-between"><div><b className="text-xs">فاتورة #{sale.id}</b><p className="text-[10px] text-gray-500">{sale.created_at} • {formatCurrency(sale.total_amount)}</p></div><button onClick={()=>{db.restoreSale(storeId,sale.id);setIsArchiveOpen(false);loadData();}} className="rounded-lg border border-emerald-300 px-3 py-1.5 text-[10px] font-bold text-emerald-700">استعادة</button></div>)}
              {archiveTab==='sales' && db.getArchivedSales(storeId).length===0 && <p className="py-10 text-center text-xs text-gray-400">لا توجد فواتير مؤرشفة.</p>}
              {archiveTab==='customers' && db.getArchivedCustomers(storeId).map(customer=><div key={customer.id} className="rounded-xl border bg-white p-3 flex items-center justify-between"><div><b className="text-xs">{customer.name}</b><p className="text-[10px] text-gray-500">رقم العميل #{customer.id} • {customer.phone||'بدون هاتف'}</p></div><button onClick={()=>{db.restoreCustomer(storeId,customer.id);loadData();}} className="rounded-lg border border-emerald-300 px-3 py-1.5 text-[10px] font-bold text-emerald-700">استعادة</button></div>)}
              {archiveTab==='customers' && db.getArchivedCustomers(storeId).length===0 && <p className="py-10 text-center text-xs text-gray-400">لا يوجد عملاء مؤرشفون.</p>}
              {archiveTab==='products' && db.getArchivedProducts(storeId).map(product=><div key={product.id} className="rounded-xl border bg-white p-3 flex items-center justify-between"><div><b className="text-xs">{product.name}</b><p className="text-[10px] text-gray-500">باركود {product.barcode}</p></div><button onClick={()=>{db.restoreProduct(storeId,product.id);loadData();}} className="rounded-lg border border-emerald-300 px-3 py-1.5 text-[10px] font-bold text-emerald-700">استعادة</button></div>)}
              {archiveTab==='products' && db.getArchivedProducts(storeId).length===0 && <p className="py-10 text-center text-xs text-gray-400">لا توجد أصناف مؤرشفة.</p>}
            </div>
          </div>
        </div>
      )}

      {/* BottomNavigationView (الرئيسية، البيع POS، المخزون، العملاء، الإعدادات) */}
      <div className="bg-white border-t border-gray-200 px-2 py-1.5 flex items-center justify-around shadow-lg">
        <button
          onClick={() => onNavigate('dashboard')}
          className="flex flex-col items-center p-1 text-[#0B3D2E]"
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <TrendingUp className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-bold mt-0.5">الرئيسية</span>
        </button>

        <button
          onClick={() => onNavigate('pos')}
          className="flex flex-col items-center p-1 text-gray-500 hover:text-[#0B3D2E]"
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <ShoppingCart className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-medium mt-0.5">البيع POS</span>
        </button>

        <button
          onClick={() => onNavigate('inventory')}
          className="flex flex-col items-center p-1 text-gray-500 hover:text-[#0B3D2E]"
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <Package className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-medium mt-0.5">المخزون</span>
        </button>

        <button
          onClick={() => onNavigate('customers')}
          className="flex flex-col items-center p-1 text-gray-500 hover:text-[#0B3D2E]"
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-medium mt-0.5">العملاء</span>
        </button>

        <button
          onClick={() => onNavigate('settings')}
          className="flex flex-col items-center p-1 text-gray-500 hover:text-[#0B3D2E]"
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <Settings className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-medium mt-0.5">الإعدادات</span>
        </button>
      </div>
    </div>
  );
};
