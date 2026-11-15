import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import {
  ArrowRight, BarChart3, CalendarDays, Clipboard, Package, Share2,
  TrendingUp, Wallet, AlertTriangle, Users, RefreshCw,
} from 'lucide-react';
import { db } from '../../../db/sqlite-simulation.ts';
import type { Customer, Product, ReturnItem, Sale, SaleItem } from '../../../types/index.ts';
import { formatCurrency } from '../../../utils/pureLogic.ts';

interface ReportsScreenProps {
  storeId: number;
  onNavigate: (screen: string, params?: Record<string, unknown>) => void;
}

interface ProductSales {
  id: number;
  name: string;
  qty: number;
  revenue: number;
}

const todayString = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

const asDate = (value: string, end = false) => `${value}${end ? ' 23:59:59' : ' 00:00:00'}`;

export const ReportsScreen: React.FC<ReportsScreenProps> = ({ storeId, onNavigate }) => {
  const [fromDate, setFromDate] = useState(todayString);
  const [toDate, setToDate] = useState(todayString);
  const [sales, setSales] = useState<Sale[]>([]);
  const [returns, setReturns] = useState<ReturnItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salesItems, setSalesItems] = useState<SaleItem[]>([]);
  const [toast, setToast] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2800);
  }, []);

  const loadReport = useCallback(() => {
    try {
      const start = asDate(fromDate);
      const end = asDate(toDate, true);
      const selectedSales = db.getSales(storeId).filter((sale) => sale.created_at >= start && sale.created_at <= end);
      const selectedReturns = db.getReturns(storeId).filter((item) => item.created_at >= start && item.created_at <= end);
      setSales(selectedSales);
      setReturns(selectedReturns);
      setProducts(db.getProducts(storeId));
      setCustomers(db.getCustomers(storeId));
      setSalesItems(selectedSales.flatMap((sale) => db.getSaleItems(sale.id)));
    } catch (error) {
      console.error('تعذر تحميل التقرير', error);
      notify('تعذر تحميل بيانات التقرير');
    }
  }, [storeId, fromDate, toDate, notify]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const totals = useMemo(() => {
    const salesAmount = sales.reduce((sum, sale) => sum + sale.total_amount, 0);
    const returnsAmount = returns.reduce((sum, item) => sum + item.amount, 0);
    const productCosts = new Map(products.map((product) => [product.id, product.cost_price]));
    const estimatedProfit = salesItems.reduce((sum, item) => sum + (item.price - (productCosts.get(item.product_id) ?? 0)) * item.qty, 0);
    return { salesAmount, returnsAmount, net: salesAmount - returnsAmount, estimatedProfit, count: sales.length };
  }, [sales, returns, products, salesItems]);

  const bestSellers = useMemo(() => {
    const map = new Map<number, ProductSales>();
    salesItems.forEach((item) => {
      const current = map.get(item.product_id) ?? {
        id: item.product_id,
        name: item.product_name || products.find((product) => product.id === item.product_id)?.name || `صنف #${item.product_id}`,
        qty: 0,
        revenue: 0,
      };
      current.qty += item.qty;
      current.revenue += item.qty * item.price;
      map.set(item.product_id, current);
    });
    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 7);
  }, [salesItems, products]);

  const lowStock = useMemo(() => products.filter((product) => product.quantity <= product.min_stock).sort((a, b) => a.quantity - b.quantity), [products]);
  const debtors = useMemo(() => customers.filter((customer) => customer.total_debt > 0).sort((a, b) => b.total_debt - a.total_debt), [customers]);
  const debtTotal = debtors.reduce((sum, customer) => sum + customer.total_debt, 0);

  const reportText = useMemo(() => {
    const lines = [
      'تقرير المتجر', `الفترة: ${fromDate} — ${toDate}`, '',
      `عدد الفواتير: ${totals.count}`, `إجمالي المبيعات: ${formatCurrency(totals.salesAmount)}`,
      `إجمالي المرتجعات: ${formatCurrency(totals.returnsAmount)}`, `صافي المبيعات: ${formatCurrency(totals.net)}`,
      `الربح التقديري: ${formatCurrency(totals.estimatedProfit)}`, '', 'أكثر المنتجات مبيعاً:',
      ...(bestSellers.length ? bestSellers.map((item, index) => `${index + 1}. ${item.name}: ${item.qty} وحدة (${formatCurrency(item.revenue)})`) : ['لا توجد مبيعات خلال الفترة']),
      '', 'المخزون المنخفض:', ...(lowStock.length ? lowStock.map((product) => `• ${product.name}: متبقي ${product.quantity} ${product.unit_type} (الحد ${product.min_stock})`) : ['لا توجد أصناف منخفضة']),
      '', `مديونيات العملاء (الإجمالي ${formatCurrency(debtTotal)}):`,
      ...(debtors.length ? debtors.map((customer) => `• ${customer.name}: ${formatCurrency(customer.total_debt)}`) : ['لا توجد مديونيات']),
    ];
    return lines.join('\n');
  }, [fromDate, toDate, totals, bestSellers, lowStock, debtors, debtTotal]);

  const copyFallback = async (text: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(field);
    if (!copied) throw new Error('clipboard unavailable');
  };

  const handleCopy = async () => {
    setIsWorking(true);
    try {
      await copyFallback(reportText);
      notify('تم نسخ التقرير إلى الحافظة');
    } catch (error) {
      console.error('تعذر نسخ التقرير', error);
      notify('تعذر النسخ؛ تحقق من إذن الحافظة');
    } finally { setIsWorking(false); }
  };

  const handleShare = async () => {
    setIsWorking(true);
    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({ title: 'تقرير المتجر', text: reportText, dialogTitle: 'مشاركة التقرير' });
        notify('تم فتح قائمة المشاركة');
      } else if (navigator.share) {
        await navigator.share({ title: 'تقرير المتجر', text: reportText });
        notify('تمت مشاركة التقرير');
      } else {
        await copyFallback(reportText);
        notify('المشاركة غير متاحة؛ تم نسخ التقرير');
      }
    } catch (error) {
      // Dismissal is normal, but still offer a useful copy fallback on share errors.
      try {
        await copyFallback(reportText);
        notify('تعذرت المشاركة؛ تم نسخ التقرير بدلاً منها');
      } catch (copyError) {
        console.error('تعذرت المشاركة والنسخ', error, copyError);
        notify('تعذرت المشاركة والنسخ');
      }
    } finally { setIsWorking(false); }
  };

  const card = 'rounded-2xl border border-[#e8e4d9] bg-white p-3 shadow-sm';
  const dateInput = 'mt-1 w-full rounded-xl border border-[#ddd8ca] bg-white px-3 py-2 text-xs text-gray-800 outline-none focus:border-[#0B3D2E]';

  return (
    <div dir="rtl" className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f7f6f1] text-gray-900">
      <header className="flex items-center justify-between border-b border-[#C9A961]/30 bg-[#0B3D2E] px-3 py-3 text-white shadow-md">
        <div className="flex items-center gap-2">
          <button onClick={() => onNavigate('dashboard')} aria-label="عودة" className="rounded-full p-1 hover:bg-white/10"><ArrowRight className="h-5 w-5" /></button>
          <div><h1 className="text-sm font-bold">تقارير المتجر</h1><p className="text-[10px] text-white/70">ملخص الأداء والمخزون والذمم</p></div>
        </div>
        <button onClick={loadReport} className="rounded-xl bg-white/10 p-2 hover:bg-white/20" aria-label="تحديث"><RefreshCw className="h-4 w-4" /></button>
      </header>

      {toast && <div role="status" className="mx-3 mt-2 rounded-xl bg-gray-900 px-3 py-2 text-center text-xs font-bold text-white shadow-lg">{toast}</div>}
      <main className="flex-1 space-y-3 overflow-y-auto p-3 pb-5">
        <section className={`${card} grid grid-cols-2 gap-3`}>
          <label className="text-[11px] font-bold text-gray-600">من تاريخ<input aria-label="من تاريخ" type="date" value={fromDate} max={toDate} onChange={(event) => setFromDate(event.target.value)} className={dateInput} /></label>
          <label className="text-[11px] font-bold text-gray-600">إلى تاريخ<input aria-label="إلى تاريخ" type="date" value={toDate} min={fromDate} onChange={(event) => setToDate(event.target.value)} className={dateInput} /></label>
        </section>

        <section className="grid grid-cols-2 gap-2">
          <MetricCard title="إجمالي المبيعات" value={formatCurrency(totals.salesAmount)} icon={<BarChart3 className="h-4 w-4" />} tone="green" />
          <MetricCard title="إجمالي المرتجعات" value={formatCurrency(totals.returnsAmount)} icon={<RefreshCw className="h-4 w-4" />} tone="red" />
          <MetricCard title="صافي المبيعات" value={formatCurrency(totals.net)} icon={<Wallet className="h-4 w-4" />} tone="blue" />
          <MetricCard title="الربح التقديري" value={formatCurrency(totals.estimatedProfit)} icon={<TrendingUp className="h-4 w-4" />} tone="gold" />
        </section>
        <div className="grid grid-cols-2 gap-2">
          <div className={`${card} flex items-center justify-between`}><span className="text-[11px] font-semibold text-gray-600">عدد الفواتير</span><span className="text-lg font-extrabold text-[#0B3D2E]">{totals.count}</span></div>
          <div className={`${card} flex items-center justify-between`}><span className="text-[11px] font-semibold text-gray-600">قيمة المديونيات</span><span className="text-sm font-extrabold text-[#8B2E2E]">{formatCurrency(debtTotal)}</span></div>
        </div>

        <section className={card}>
          <SectionTitle icon={<Package className="h-4 w-4" />} title="أكثر المنتجات مبيعاً" subtitle="مرتبة حسب الكمية المباعة" />
          {bestSellers.length ? <div className="mt-2 divide-y divide-gray-100">{bestSellers.map((item, index) => <div key={item.id} className="flex items-center gap-2 py-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#edf4ef] text-[10px] font-extrabold text-[#0B3D2E]">{index + 1}</span><span className="min-w-0 flex-1 truncate text-xs font-semibold">{item.name}</span><span className="text-left text-[10px] text-gray-500">{item.qty} وحدة</span><span className="min-w-[68px] text-left text-[10px] font-bold">{formatCurrency(item.revenue)}</span></div>)}</div> : <EmptyText>لا توجد مبيعات في هذه الفترة</EmptyText>}
        </section>

        <section className={card}>
          <SectionTitle icon={<AlertTriangle className="h-4 w-4" />} title="مخزون منخفض" subtitle={`${lowStock.length} أصناف عند الحد الأدنى أو أقل`} />
          {lowStock.length ? <div className="mt-2 space-y-1.5">{lowStock.slice(0, 8).map((product) => <div key={product.id} className="flex items-center justify-between rounded-xl bg-amber-50 px-2.5 py-2"><span className="truncate text-xs font-semibold">{product.name}</span><span className="mr-2 shrink-0 text-[10px] font-bold text-amber-800">{product.quantity} / {product.min_stock} {product.unit_type}</span></div>)}</div> : <EmptyText>المخزون بحالة جيدة</EmptyText>}
        </section>

        <section className={card}>
          <SectionTitle icon={<Users className="h-4 w-4" />} title="مديونيات العملاء" subtitle={`${debtors.length} عملاء لديهم رصيد مستحق`} />
          {debtors.length ? <div className="mt-2 divide-y divide-gray-100">{debtors.slice(0, 10).map((customer) => <div key={customer.id} className="flex items-center justify-between py-2"><span className="truncate text-xs font-semibold">{customer.name}</span><span className="mr-2 shrink-0 text-xs font-extrabold text-[#8B2E2E]">{formatCurrency(customer.total_debt)}</span></div>)}</div> : <EmptyText>لا توجد مديونيات مستحقة</EmptyText>}
        </section>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button onClick={handleCopy} disabled={isWorking} className="flex items-center justify-center gap-2 rounded-xl border border-[#0B3D2E] bg-white px-3 py-2.5 text-xs font-bold text-[#0B3D2E] disabled:opacity-50"><Clipboard className="h-4 w-4" />نسخ التقرير</button>
          <button onClick={handleShare} disabled={isWorking} className="flex items-center justify-center gap-2 rounded-xl bg-[#0B3D2E] px-3 py-2.5 text-xs font-bold text-white shadow-sm disabled:opacity-50"><Share2 className="h-4 w-4" />مشاركة التقرير</button>
        </div>
        <p className="text-center text-[10px] leading-relaxed text-gray-500"><CalendarDays className="ml-1 inline h-3 w-3" />الربح تقديري وفق تكلفة الأصناف المسجلة حالياً، ولا يشمل المصروفات أو أثر المرتجعات على تكلفة البضاعة.</p>
      </main>
    </div>
  );
};

const MetricCard: React.FC<{ title: string; value: string; icon: React.ReactNode; tone: 'green' | 'red' | 'blue' | 'gold' }> = ({ title, value, icon, tone }) => {
  const styles = { green: 'bg-emerald-50 text-emerald-800', red: 'bg-rose-50 text-rose-800', blue: 'bg-sky-50 text-sky-800', gold: 'bg-amber-50 text-amber-800' };
  return <div className="rounded-2xl border border-[#e8e4d9] bg-white p-3 shadow-sm"><div className="flex items-center justify-between"><span className="text-[10px] font-semibold text-gray-500">{title}</span><span className={`rounded-lg p-1.5 ${styles[tone]}`}>{icon}</span></div><div className="mt-2 text-sm font-extrabold text-gray-900">{value}</div></div>;
};

const SectionTitle: React.FC<{ icon: React.ReactNode; title: string; subtitle: string }> = ({ icon, title, subtitle }) => <div className="flex items-center gap-2"><span className="rounded-lg bg-[#f3f0e7] p-1.5 text-[#0B3D2E]">{icon}</span><div><h2 className="text-xs font-extrabold">{title}</h2><p className="text-[10px] text-gray-500">{subtitle}</p></div></div>;
const EmptyText: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="py-4 text-center text-[11px] text-gray-400">{children}</p>;
