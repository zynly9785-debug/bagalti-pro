/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ArrowRight, Share2, Receipt, Phone, Calendar, Clock, CheckCircle2 } from 'lucide-react';
import { db } from '../../../db/sqlite-simulation.ts';
import { Sale, SaleItem, CustomerLedgerEntry } from '../../../types/index.ts';
import { formatCurrency } from '../../../utils/pureLogic.ts';
import { WhatsAppShareModal } from '../WhatsAppShareModal.tsx';
import { useTheme } from '../../../context/ThemeContext.tsx';

interface StatementScreenProps {
  storeId: number;
  customerId: number;
  customerName: string;
  customerPhone?: string;
  totalDebt: number;
  onNavigate: (screen: string, params?: Record<string, unknown>) => void;
}

export const StatementScreen: React.FC<StatementScreenProps> = ({
  storeId,
  customerId,
  customerName,
  customerPhone,
  totalDebt,
  onNavigate,
}) => {
  const { theme, isDarkMode } = useTheme();
  const [sales, setSales] = useState<{ sale: Sale; items: SaleItem[] }[]>([]);
  const [ledger, setLedger] = useState<CustomerLedgerEntry[]>([]);
  const [tab, setTab] = useState<'all' | 'invoice' | 'payment' | 'return' | 'other'>('all');
  const [search, setSearch] = useState('');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  useEffect(() => {
    loadCustomerData();
  }, [storeId, customerId]);

  const loadCustomerData = () => {
    const list = db.getCustomerSales(storeId, customerId);
    const detailed = list.map((s) => ({
      sale: s,
      items: db.getSaleItems(s.id),
    }));
    setSales(detailed);
    setLedger(db.getCustomerLedger(storeId, customerId));
  };

  const summary = db.getCustomerSummary(storeId, customerId);
  const filteredLedger = ledger.filter((entry) => {
    if (tab === 'invoice' && entry.kind !== 'invoice') return false;
    if (tab === 'payment' && entry.kind !== 'payment') return false;
    if (tab === 'return' && entry.kind !== 'return') return false;
    if (tab === 'other' && !['opening_balance','adjustment','merge'].includes(entry.kind)) return false;
    const q = search.trim().toLowerCase();
    return !q || entry.description.toLowerCase().includes(q) || entry.reference.toLowerCase().includes(q);
  });

  let runningBalance = summary.customer?.opening_balance || 0;
  const ledgerWithBalance = filteredLedger.map((entry) => {
    runningBalance += entry.debit - entry.credit;
    return { ...entry, balance: runningBalance };
  });

  const generateStatementText = () => {
    const store = db.findUserById(storeId);
    let text = `📋 *كشف حساب تفصيلي للعميل: ${customerName}*\n`;
    text += `متجر: ${store ? store.store_name : 'البقالة'}\n`;
    text += `رقم الهاتف: ${customerPhone || '-'}\n`;
    text += `💰 *الرصيد المستحق (الدين الحالي):* *${totalDebt} ر.ي*\n`;
    text += `================================\n`;
    text += `سجل العمليات والفواتير السابقة:\n\n`;

    sales.forEach((item) => {
      text += `🧾 فاتورة #${item.sale.id} (${item.sale.created_at})\n`;
      item.items.forEach((it) => {
        text += `  • ${it.product_name || 'صنف'} (${it.qty} × ${it.price})\n`;
      });
      text += `  المجموع: ${item.sale.total_amount} ر.ي | المدفوع: ${item.sale.paid_amount} ر.ي`;
      if (item.sale.remaining_amount > 0) {
        text += ` | المتبقي (آجل): ${item.sale.remaining_amount} ر.ي`;
      }
      text += `\n--------------------------------\n`;
    });

    const payments = db.getCustomerPayments(storeId, customerId);
    if (payments.length) {
      text += `سندات القبض والسدادات:\n`;
      payments.forEach((payment) => {
        text += `• سند ${payment.receipt_number} (${payment.created_at.slice(0,10)}): ${formatCurrency(payment.amount)} - ${payment.method}\n`;
      });
      text += `--------------------------------\n`;
    }

    text += `الإجمالي الافتتاحي/الفواتير: ${formatCurrency(summary.totalInvoices)}\n`;
    text += `إجمالي سندات القبض: ${formatCurrency(summary.totalPayments)}\n`;
    text += `إجمالي المرتجعات: ${formatCurrency(summary.totalReturns)}\n`;
    text += `*الرصيد التراكمي المستحق:* ${formatCurrency(summary.currentBalance)}\n`;
    text += `\nشاكرين لكم حسن التعامل والمبادرة بالسداد.`;
    return text;
  };

  return (
    <div className={`flex-1 flex flex-col ${theme.screenBg} ${theme.textPrimary} overflow-hidden`}>
      {/* Header */}
      <div className="bg-[#0B3D2E] text-white p-3.5 flex items-center justify-between shadow-md border-b border-[#C9A961]/30">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('customers')}
            className="p-1 hover:bg-white/10 rounded-full"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <h2 className="font-bold text-sm">كشف الحساب التراكمي للعميل</h2>
        </div>

        <div className="flex gap-1">
          <button onClick={() => window.print()} className="bg-white/15 text-white text-[10px] px-2 py-1.5 rounded-lg">طباعة/PDF</button>
          <button onClick={() => {
            const csv = ['التاريخ,المرجع,الوصف,مدين,دائن,الرصيد', ...ledger.map(e => [e.date.slice(0,10),e.reference,e.description,e.debit,e.credit,summary.currentBalance].join(','))].join('\n');
            const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'})); const a=document.createElement('a'); a.href=url; a.download=`statement-${customerId}.csv`; a.click(); URL.revokeObjectURL(url);
          }} className="bg-white/15 text-white text-[10px] px-2 py-1.5 rounded-lg">Excel</button>
          <button
            onClick={() => setIsShareModalOpen(true)}
            className="bg-[#25D366] text-white text-[10px] font-bold px-2 py-1.5 rounded-lg flex items-center gap-1"
          ><Share2 className="w-3 h-3" /><span>مشاركة</span></button>
        </div>
      </div>

      {/* Customer Info Card */}
      <div className={`p-4 ${theme.cardBg} border-b ${theme.borderColor} shadow-xs`}>
        <div className="flex justify-between items-center">
          <div>
            <h3 className={`font-bold text-sm ${theme.textPrimary}`}>{customerName}</h3>
            <p className={`text-xs ${theme.textSecondary} font-mono mt-0.5`}>{customerPhone || 'بدون هاتف'} • رقم عميل #{customerId}</p>
            {summary.customer?.address && <p className={`text-[10px] ${theme.textSecondary} mt-0.5`}>{summary.customer.address}</p>}
            <p className={`text-[9px] ${theme.textSecondary} mt-0.5`}>
              تاريخ التسجيل: {summary.customer?.registered_at?.slice(0,10) || '-'} • التصنيف: {summary.customer?.category || 'جديد'}
            </p>
          </div>
          <div className={`text-left ${
            isDarkMode ? 'bg-red-950/60 border-red-900/60' : 'bg-red-50 border-red-200'
          } border px-3 py-1.5 rounded-xl`}>
            <span className={`text-[10px] ${theme.textSecondary} block`}>إجمالي الدين الحالي:</span>
            <span className="text-sm font-extrabold text-[#8B2E2E] font-mono">
              {formatCurrency(totalDebt)}
            </span>
          </div>
        </div>
      </div>

      {/* Comprehensive ledger summary */}
      <div className="p-3 grid grid-cols-3 gap-2 border-b border-gray-200/30">
        <div className={`${theme.cardBg} border ${theme.borderColor} rounded-xl p-2 text-center`}><p className="text-[9px]">إجمالي الفواتير</p><p className="font-bold text-xs">{formatCurrency(summary.totalInvoices)}</p></div>
        <div className={`${theme.cardBg} border ${theme.borderColor} rounded-xl p-2 text-center`}><p className="text-[9px]">سندات القبض</p><p className="font-bold text-xs text-emerald-600">{formatCurrency(summary.totalPayments)}</p></div>
        <div className={`${theme.cardBg} border ${theme.borderColor} rounded-xl p-2 text-center`}><p className="text-[9px]">المرتجعات</p><p className="font-bold text-xs text-amber-600">{formatCurrency(summary.totalReturns)}</p></div>
      </div>

      {/* Ledger tabs */}
      <div className="px-3 pt-2 space-y-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث في حركات الحساب" className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-lg px-2 py-1.5 text-xs`} />
        <div className="flex gap-1 overflow-x-auto text-[10px]">
          {([['all','الكل'],['invoice','الفواتير'],['payment','السداد'],['return','المرتجعات'],['other','الحركات']] as const).map(([value,label]) => (
            <button key={value} onClick={() => setTab(value)} className={`whitespace-nowrap px-2 py-1.5 rounded-lg border ${tab===value?'bg-[#0B3D2E] text-white':'border-gray-300'}`}>{label}</button>
          ))}
        </div>
      </div>

      {/* Invoices and ledger */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {ledgerWithBalance.length > 0 && <div className={`rounded-xl border ${theme.borderColor} overflow-hidden`}>
          {ledgerWithBalance.map((entry) => (
            <div key={`${entry.id}-${entry.reference}`} className={`grid grid-cols-[70px_1fr_62px_62px_72px] gap-1 items-center px-2 py-2 border-b ${theme.borderColor} text-[9px]`}>
              <span>{entry.date.slice(0,10)}</span><span className="truncate">{entry.description}<br/><b>{entry.reference}</b></span>
              <span className="text-[#8B2E2E] text-left">{entry.debit?formatCurrency(entry.debit):'-'}</span>
              <span className="text-emerald-600 text-left">{entry.credit?formatCurrency(entry.credit):'-'}</span>
              <span className="font-bold text-left">{formatCurrency(entry.balance)}</span>
            </div>
          ))}
        </div>}
        <h4 className="text-xs font-bold text-[#C9A961] flex items-center gap-1">
          <Receipt className="w-4 h-4 text-[#C9A961]" />
          <span>سجل الفواتير والمشتريات:</span>
        </h4>

        {sales.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-xs">
            لا توجد فواتير مسجلة لهذا العميل
          </div>
        ) : (
          sales.map(({ sale, items }) => (
            <div
              key={sale.id}
              className={`${theme.cardBg} rounded-2xl p-3 shadow-xs border ${theme.borderColor} space-y-2`}
            >
              <div className={`flex justify-between items-center text-xs pb-1.5 border-b ${theme.borderColor}`}>
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${theme.textPrimary}`}>فاتورة #{sale.id}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                    sale.payment_type === 'نقداً'
                      ? isDarkMode ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-emerald-100 text-emerald-800'
                      : isDarkMode ? 'bg-red-950 text-red-300 border border-red-800' : 'bg-red-100 text-[#8B2E2E]'
                  }`}>
                    {sale.payment_type}
                  </span>
                </div>
                <span className={`text-[10px] ${theme.textSecondary} font-mono`}>{sale.created_at}</span>
              </div>

              {/* Items Breakdown */}
              <div className="space-y-1 text-xs">
                {items.length === 0 && <div className={`text-[11px] ${theme.textSecondary}`}>فاتورة حرة أو حركة مبلغ يدوي مسجلة للحساب</div>}
                {items.map((it) => (
                  <div key={it.id} className={`flex justify-between ${theme.textPrimary} text-[11px]`}>
                    <span className="truncate">{it.product_name || `صنف #${it.product_id}`}</span>
                    <span className={`font-mono ${theme.textSecondary}`}>{it.qty} × {it.price} = {it.qty * it.price} ر.ي</span>
                  </div>
                ))}
              </div>

              {/* Total & Remaining */}
              <div className={`pt-2 border-t ${theme.borderColor} flex justify-between text-xs font-mono`}>
                <div>
                  <span className={theme.textSecondary}>الإجمالي: </span>
                  <span className={`font-bold ${theme.textPrimary}`}>{sale.total_amount} ر.ي</span>
                </div>
                {sale.remaining_amount > 0 && (
                  <div>
                    <span className="text-[#8B2E2E] font-bold">باقي دين: </span>
                    <span className="font-bold text-[#8B2E2E]">{sale.remaining_amount} ر.ي</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  if (!window.confirm(`هل تريد أرشفة الفاتورة رقم ${sale.id} دون حذفها؟`)) return;
                  db.archiveSale(storeId, sale.id);
                  loadCustomerData();
                }}
                className="mt-2 w-full rounded-lg border border-amber-300 bg-amber-50 py-1.5 text-[10px] font-bold text-amber-800"
              >
                أرشفة الفاتورة
              </button>
            </div>
          ))
        )}
      </div>

      {/* WhatsApp Share Modal */}
      <WhatsAppShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title="مشاركة كشف الحساب عبر واتساب"
        messageText={generateStatementText()}
        targetPhone={customerPhone}
      />
    </div>
  );
};
