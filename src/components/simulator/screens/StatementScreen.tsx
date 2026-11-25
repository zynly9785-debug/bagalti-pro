/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, CreditCard, Receipt, Share2 } from 'lucide-react';
import { db } from '../../../db/sqlite-simulation.ts';
import type { CustomerPayment, Sale, SaleItem } from '../../../types/index.ts';
import { formatCurrency } from '../../../utils/pureLogic.ts';
import {
  buildCustomerTimeline,
  formatDateTimeDisplay,
  formatStatementShareText,
} from '../../../utils/customerLogic.ts';
import { ShareDispatchModal } from '../ShareDispatchModal.tsx';
import { useTheme } from '../../../context/ThemeContext.tsx';

interface StatementScreenProps {
  storeId: number;
  customerId: number;
  customerName: string;
  customerPhone?: string;
  totalDebt: number;
  onNavigate: (screen: string, params?: Record<string, unknown>) => void;
}

type StatementFilter = 'all' | 'credit' | 'cash' | 'payment';

export const StatementScreen: React.FC<StatementScreenProps> = ({
  storeId,
  customerId,
  customerName,
  customerPhone,
  totalDebt,
  onNavigate,
}) => {
  const { theme, isDarkMode } = useTheme();
  const [salesWithItems, setSalesWithItems] = useState<Array<{ sale: Sale; items: SaleItem[] }>>([]);
  const [payments, setPayments] = useState<CustomerPayment[]>([]);
  const [filter, setFilter] = useState<StatementFilter>('all');
  const [search, setSearch] = useState('');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [archiveSaleId, setArchiveSaleId] = useState<number | null>(null);

  const loadCustomerData = () => {
    const list = db.getCustomerSales(storeId, customerId);
    const detailed = list.map((s) => ({
      sale: s,
      items: db.getSaleItems(s.id),
    }));
    setSalesWithItems(detailed);
    setPayments(db.getCustomerPayments(storeId, customerId));
  };

  useEffect(() => {
    loadCustomerData();
  }, [storeId, customerId]);

  const customer = db.getCustomerById(storeId, customerId);
  const summary = db.getCustomerSummary(storeId, customerId);
  const storeName = db.findUserById(storeId)?.store_name || 'بقالتي برو';
  const liveDebt = customer ? customer.total_debt : totalDebt;
  const openingDebt = customer?.opening_balance || 0;

  const timeline = useMemo(() => {
    if (!customer) return [];
    const itemsMap = new Map<number, SaleItem[]>(salesWithItems.map((entry) => [entry.sale.id, entry.items]));
    return buildCustomerTimeline(
      customer,
      salesWithItems.map((entry) => entry.sale),
      payments,
      itemsMap,
      db.getReturns(storeId).filter((r) => r.customer_id === customerId),
      db.getCustomerLedger(storeId, customerId),
    );
  }, [customer, salesWithItems, payments, storeId, customerId]);

  const timelineBalanceByUid = useMemo(
    () => new Map(timeline.map((row) => [row.uid, row.balanceAfter])),
    [timeline],
  );

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return timeline.filter((row) => {
      if (filter === 'credit') {
        if (row.kind !== 'invoice' || !row.sale) return false;
        if (row.sale.payment_type !== 'آجل' && row.sale.remaining_amount <= 0) return false;
      } else if (filter === 'cash') {
        if (row.kind !== 'invoice' || !row.sale) return false;
        if (row.sale.payment_type === 'آجل') return false;
      } else if (filter === 'payment') {
        if (row.kind !== 'payment') return false;
      }
      if (!q) return true;
      return (
        row.title.toLowerCase().includes(q) ||
        row.reference.toLowerCase().includes(q) ||
        (row.note || '').toLowerCase().includes(q) ||
        String(row.amount).includes(q) ||
        (row.items || []).some((it) => (it.product_name || '').toLowerCase().includes(q))
      );
    });
  }, [timeline, filter, search]);

  const shareText = customer
    ? formatStatementShareText({
        storeName,
        customer,
        salesWithItems,
        payments,
        totalInvoices: summary.totalInvoices,
        totalPayments: summary.totalPayments,
      })
    : '';

  return (
    <div className={`flex-1 flex flex-col ${theme.screenBg} ${theme.textPrimary} overflow-hidden`}>
      {/* Header */}
      <div className="bg-[#0B3D2E] text-white p-3.5 flex items-center justify-between shadow-md border-b border-[#C9A961]/30">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => onNavigate('customers')}
            aria-label="العودة إلى شاشة العملاء"
            className="p-1.5 hover:bg-white/10 rounded-xl"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <h2 className="font-bold text-sm truncate">كشف الحساب الشامل</h2>
        </div>

        <div className="flex gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              const ledger = db.getCustomerLedger(storeId, customerId);
              const csv = [
                'التاريخ,المرجع,الوصف,مدين,دائن,الرصيد',
                ...ledger.map((e) =>
                  [e.date.slice(0, 10), e.reference, e.description, e.debit, e.credit, liveDebt].join(','),
                ),
              ].join('\n');
              const url = URL.createObjectURL(
                new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }),
              );
              const a = document.createElement('a');
              a.href = url;
              a.download = `statement-${customerId}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="bg-white/15 hover:bg-white/25 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg"
          >
            Excel
          </button>
          <button
            type="button"
            onClick={() => setIsShareModalOpen(true)}
            className="bg-[#1F9D55] hover:bg-[#198748] text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1"
          >
            <Share2 className="w-3 h-3" />
            <span>مشاركة</span>
          </button>
        </div>
      </div>

      {/* Customer Info Card */}
      <div className={`p-3.5 ${theme.cardBg} border-b ${theme.borderColor}`}>
        <div className="flex justify-between items-center gap-2">
          <div className="min-w-0">
            <h3 className={`font-extrabold text-sm truncate ${theme.textPrimary}`}>
              {customer?.name || customerName}
            </h3>
            <p className={`text-[11px] ${theme.textSecondary} font-mono mt-0.5`}>
              {customer?.phone || customerPhone || 'بدون هاتف'} • #{customerId}
            </p>
            <p className={`text-[10px] ${theme.textSecondary} mt-0.5`}>
              التصنيف: {customer?.category || 'جديد'} • السداد القادم: {customer?.next_due_at?.slice(0, 10) || '-'}
            </p>
          </div>
          <div
            className={`text-left border px-3 py-2 rounded-xl shrink-0 ${
              isDarkMode ? 'bg-red-950/60 border-red-800' : 'bg-red-50 border-red-200'
            }`}
          >
            <span className={`text-[10px] block ${theme.textSecondary}`}>إجمالي المديونية:</span>
            <span className={`text-sm font-extrabold font-mono ${isDarkMode ? 'text-red-300' : 'text-red-700'}`}>
              {formatCurrency(liveDebt)}
            </span>
          </div>
        </div>
      </div>

      {/* Opening Balance Highlight (المديونية السابقة) */}
      {openingDebt > 0 && (
        <div className={`mx-3 mt-2.5 p-2.5 rounded-xl border flex items-center justify-between text-xs ${
          isDarkMode ? 'bg-amber-950/50 border-amber-700 text-amber-200' : 'bg-amber-50 border-amber-300 text-amber-950'
        }`}>
          <span className="font-bold">المديونية السابقة / الرصيد الافتتاحي:</span>
          <span className="font-extrabold font-mono">{formatCurrency(openingDebt)}</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="px-3 pt-2.5 grid grid-cols-3 gap-2">
        <div className={`${theme.cardBg} border ${theme.borderColor} rounded-xl p-2 text-center`}>
          <p className={`text-[10px] ${theme.textSecondary}`}>إجمالي الفواتير</p>
          <p className="font-bold text-xs font-mono mt-0.5">{formatCurrency(summary.totalInvoices)}</p>
        </div>
        <div className={`${theme.cardBg} border ${theme.borderColor} rounded-xl p-2 text-center`}>
          <p className={`text-[10px] ${theme.textSecondary}`}>سندات القبض</p>
          <p className="font-bold text-xs font-mono text-emerald-500 mt-0.5">{formatCurrency(summary.totalPayments)}</p>
        </div>
        <div className={`${theme.cardBg} border ${theme.borderColor} rounded-xl p-2 text-center`}>
          <p className={`text-[10px] ${theme.textSecondary}`}>المرتجعات</p>
          <p className="font-bold text-xs font-mono text-amber-500 mt-0.5">{formatCurrency(summary.totalReturns)}</p>
        </div>
      </div>

      {/* Search & Filter Tabs */}
      <div className="px-3 pt-2.5 space-y-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث في الفواتير، السندات، الأصناف أو الملاحظات..."
          className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-xl px-3 py-2 text-xs`}
        />
        <div className="flex gap-1.5 overflow-x-auto text-[10px] pb-1" role="tablist" aria-label="فلاتر كشف الحساب">
          {([
            ['all', 'الكل'],
            ['credit', 'فواتير آجلة'],
            ['cash', 'فواتير نقدية'],
            ['payment', 'سندات قبض'],
          ] as Array<[StatementFilter, string]>).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
              className={`whitespace-nowrap px-2.5 py-1.5 rounded-lg border font-bold ${
                filter === key
                  ? 'bg-[#0B3D2E] text-white border-[#C9A961]'
                  : isDarkMode
                    ? 'bg-[#121B17] text-gray-200 border-emerald-900'
                    : 'bg-white text-gray-800 border-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards Timeline */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 pb-20">
        {filteredEntries.length === 0 ? (
          <div className={`text-center py-12 text-xs ${theme.textSecondary}`}>
            لا توجد حركات مطابقة في كشف الحساب
          </div>
        ) : (
          filteredEntries.map((row) => {
            if (row.kind === 'payment' && row.payment) {
              const p = row.payment;
              const afterBalance = timelineBalanceByUid.get(row.uid) ?? liveDebt;
              return (
                <div
                  key={row.uid}
                  className={`${theme.cardBg} rounded-2xl p-3 border ${theme.borderColor} space-y-2`}
                >
                  <div className={`flex items-center justify-between pb-1.5 border-b ${theme.borderColor}`}>
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-emerald-500" />
                      <span className="font-bold text-xs">سند قبض #{p.id}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                        isDarkMode ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {p.method}
                      </span>
                    </div>
                    <span className={`text-[10px] font-mono ${theme.textSecondary}`}>
                      {formatDateTimeDisplay(p.created_at)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className={theme.textSecondary}>المبلغ المستلم من العميل:</span>
                    <span className="font-extrabold font-mono text-emerald-500">{formatCurrency(p.amount)}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className={theme.textSecondary}>إجمالي المتبقي بعد السداد:</span>
                    <span className="font-bold font-mono">{formatCurrency(afterBalance)}</span>
                  </div>

                  {p.notes && (
                    <p className={`text-[11px] pt-1 border-t ${theme.borderColor} ${theme.textSecondary}`}>
                      ملاحظة: {p.notes}
                    </p>
                  )}
                </div>
              );
            }

            if (row.kind === 'invoice' && row.sale) {
              const s = row.sale;
              const items = row.items || [];
              const itemsSum = items.reduce((sum, it) => sum + (it.price > 0 ? it.qty * it.price : 0), 0);
              const isCreditSale = s.payment_type === 'آجل' || s.remaining_amount > 0;
              const afterBalance = timelineBalanceByUid.get(row.uid) ?? liveDebt;

              return (
                <div
                  key={row.uid}
                  className={`${theme.cardBg} rounded-2xl p-3 border ${theme.borderColor} space-y-2`}
                >
                  <div className={`flex justify-between items-center text-xs pb-1.5 border-b ${theme.borderColor}`}>
                    <div className="flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-[#C9A961]" />
                      <span className="font-bold">فاتورة #{s.id}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                          s.payment_type === 'نقداً'
                            ? isDarkMode
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-emerald-100 text-emerald-800'
                            : isDarkMode
                              ? 'bg-red-950 text-red-300 border border-red-800'
                              : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {isCreditSale ? 'فاتورة آجلة' : `فاتورة ${s.payment_type}`}
                      </span>
                    </div>
                    <span className={`text-[10px] ${theme.textSecondary} font-mono`}>
                      {formatDateTimeDisplay(s.created_at)}
                    </span>
                  </div>

                  {/* Items Breakdown */}
                  <div className="space-y-1 text-xs">
                    {items.length === 0 ? (
                      <div className={`text-[11px] ${theme.textSecondary}`}>
                        فاتورة مبلغ مباشر مسجلة على الحساب
                      </div>
                    ) : (
                      items.map((it) => (
                        <div key={it.id} className="flex justify-between text-[11px]">
                          <span className="truncate">{it.product_name || `صنف #${it.product_id}`}</span>
                          <span className={`font-mono ${theme.textSecondary}`}>
                            {it.price > 0
                              ? `${it.qty} × ${formatCurrency(it.price)} = ${formatCurrency(it.qty * it.price)}`
                              : `الكمية: ${it.qty}`}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className={`pt-2 border-t ${theme.borderColor} space-y-1 text-xs font-mono`}>
                    {itemsSum > 0 && (
                      <div className="flex justify-between text-[11px]">
                        <span className={theme.textSecondary}>مجموع قيم الأصناف:</span>
                        <span>{formatCurrency(itemsSum)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className={theme.textSecondary}>إجمالي الفاتورة:</span>
                      <span className="font-bold">{formatCurrency(s.total_amount)}</span>
                    </div>
                    {isCreditSale && (
                      <div className="flex justify-between">
                        <span className={theme.textSecondary}>الرصيد بعد الفاتورة:</span>
                        <span className="font-extrabold text-red-500">{formatCurrency(afterBalance)}</span>
                      </div>
                    )}
                  </div>

                  {s.notes && (
                    <p className={`text-[11px] pt-1 border-t ${theme.borderColor} ${theme.textSecondary}`}>
                      ملاحظة الفاتورة: {s.notes}
                    </p>
                  )}

                  {!s.is_archived && (
                    <button
                      type="button"
                      onClick={() => setArchiveSaleId(s.id)}
                      className={`mt-1 w-full rounded-xl border py-1.5 text-[10px] font-bold ${
                        isDarkMode
                          ? 'border-amber-700 bg-amber-950/50 text-amber-200 hover:bg-amber-950'
                          : 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                      }`}
                    >
                      أرشفة الفاتورة
                    </button>
                  )}
                </div>
              );
            }

            return (
              <div
                key={row.uid}
                className={`${theme.cardBg} rounded-2xl p-3 border ${theme.borderColor} flex items-center justify-between text-xs`}
              >
                <div>
                  <p className="font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />
                    <span>{row.title}</span>
                  </p>
                  <p className={`text-[10px] font-mono ${theme.textSecondary}`}>
                    {formatDateTimeDisplay(row.date)}
                  </p>
                </div>
                <span className="font-bold font-mono">{formatCurrency(row.amount)}</span>
              </div>
            );
          })
        )}
      </div>

      {/* Archive Sale Confirmation Modal (replaces window.confirm) */}
      {archiveSaleId !== null && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className={`${theme.cardBg} w-full max-w-xs rounded-3xl border ${theme.borderColor} p-4 space-y-3`}>
            <h3 className="font-bold text-sm">أرشفة الفاتورة #{archiveSaleId}</h3>
            <p className={`text-xs ${theme.textSecondary}`}>
              هل تريد أرشفة هذه الفاتورة دون حذفها من كشف الحساب؟
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  db.archiveSale(storeId, archiveSaleId);
                  setArchiveSaleId(null);
                  loadCustomerData();
                }}
                className="flex-1 bg-amber-600 text-white py-2 rounded-xl text-xs font-bold"
              >
                تأكيد الأرشفة
              </button>
              <button
                type="button"
                onClick={() => setArchiveSaleId(null)}
                className={`flex-1 border py-2 rounded-xl text-xs font-bold ${theme.borderColor}`}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Share Modal */}
      <ShareDispatchModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        storeId={storeId}
        customerId={customerId}
        customerName={customer?.name || customerName}
        targetPhone={customer?.phone || customerPhone}
        title={`مشاركة كشف حساب ${customer?.name || customerName}`}
        messageText={shareText}
        reference={`STMT-${customerId}`}
      />
    </div>
  );
};
