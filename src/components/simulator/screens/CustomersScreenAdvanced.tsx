/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  CalendarClock,
  Clock,
  FilePlus2,
  Merge,
  Search,
  Share2,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { db } from '../../../db/sqlite-simulation.ts';
import type {
  Customer,
  CustomerPayment,
  Sale,
  SaleItem,
  ShareOutboxItem,
} from '../../../types/index.ts';
import { formatCurrency } from '../../../utils/pureLogic.ts';
import {
  buildCustomerTimeline,
  computeCustomerDashboardCards,
  type CustomerFilter,
  type CustomerSort,
  type CustomerTimelineRow,
  filterAndSortCustomers,
  formatCreditInvoiceShareText,
  formatDateTimeDisplay,
  formatPaymentReceiptShareText,
  formatStatementShareText,
} from '../../../utils/customerLogic.ts';
import { synchronizeStore } from '../../../services/syncService.ts';
import { useTheme } from '../../../context/ThemeContext.tsx';
import { ShareDispatchModal } from '../ShareDispatchModal.tsx';
import { CustomerFormModal } from '../customers/CustomerFormModal.tsx';
import { CreditInvoiceModal } from '../customers/CreditInvoiceModal.tsx';
import { PaymentReceiptModal } from '../customers/PaymentReceiptModal.tsx';
import { CustomerCard } from '../customers/CustomerCard.tsx';
import { ShareMenuModal } from '../customers/ShareMenuModal.tsx';
import { OutboxQueueModal } from '../customers/OutboxQueueModal.tsx';

interface Props {
  storeId: number;
  onNavigate: (screen: string, params?: Record<string, unknown>) => void;
  onBack?: () => void;
}

export const CustomersScreenAdvanced: React.FC<Props> = ({
  storeId,
  onNavigate,
  onBack,
}) => {
  const { isDarkMode, theme } = useTheme();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allPayments, setAllPayments] = useState<CustomerPayment[]>([]);
  const [outbox, setOutbox] = useState<ShareOutboxItem[]>([]);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CustomerFilter>('all');
  const [sort, setSort] = useState<CustomerSort>('debt_desc');
  const [toast, setToast] = useState('');

  // Modal controls
  const [customerFormState, setCustomerFormState] = useState<{
    open: boolean;
    mode: 'add' | 'edit';
    customer?: Customer | null;
    focusField?: 'phone' | 'due' | 'name';
  }>({ open: false, mode: 'add' });

  const [creditInvoiceState, setCreditInvoiceState] = useState<{
    open: boolean;
    fixedCustomer: Customer | null;
  }>({ open: false, fixedCustomer: null });

  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);
  const [shareMenuCustomer, setShareMenuCustomer] = useState<Customer | null>(null);

  const [shareDispatch, setShareDispatch] = useState<{
    open: boolean;
    customerId?: number | null;
    customerName?: string;
    targetPhone?: string;
    title: string;
    messageText: string;
    reference?: string;
  } | null>(null);

  const [itemsDetailState, setItemsDetailState] = useState<{
    customer: Customer;
    row: CustomerTimelineRow;
  } | null>(null);

  const [scheduleState, setScheduleState] = useState<{
    customer: Customer;
    dueDate: string;
  } | null>(null);

  const [mergeState, setMergeState] = useState<{
    primary: Customer;
    targetId: string;
  } | null>(null);

  const [archiveConfirmCustomer, setArchiveConfirmCustomer] = useState<Customer | null>(null);
  const [deleteConfirmCustomer, setDeleteConfirmCustomer] = useState<Customer | null>(null);
  const [isOutboxOpen, setIsOutboxOpen] = useState(false);

  const notify = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(''), 3800);
  }, []);

  const load = useCallback(() => {
    setCustomers(db.getCustomers(storeId));
    setAllPayments(db.getCustomerPayments(storeId));
    setOutbox(db.getShareOutbox(storeId));
  }, [storeId]);

  useEffect(() => {
    load();
  }, [load]);

  // Automatic background cloud sync when online (sharing and all local actions stay 100% offline-first)
  useEffect(() => {
    const handleOnline = () => {
      if (db.getSharedPreferences().cloud_store_id) {
        void synchronizeStore()
          .then(() => load())
          .catch(() => undefined);
      }
    };
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [storeId, load]);

  const storeName = db.findUserById(storeId)?.store_name || 'بقالتي برو';
  const products = useMemo(() => db.getProducts(storeId), [storeId, customers]);

  const { salesByCustomer, paymentsByCustomer, saleItemsBySaleId, timelinesByCustomer } = useMemo(() => {
    const sMap = new Map<number, Sale[]>();
    const pMap = new Map<number, CustomerPayment[]>();
    const iMap = new Map<number, SaleItem[]>();
    const tMap = new Map<number, CustomerTimelineRow[]>();
    const allReturns = db.getReturns(storeId);

    for (const c of customers) {
      const custSales = db.getCustomerSales(storeId, c.id);
      const custPayments = db.getCustomerPayments(storeId, c.id);
      const custReturns = allReturns.filter((r) => r.customer_id === c.id);
      const custLedger = db.getCustomerLedger(storeId, c.id);
      for (const s of custSales) {
        iMap.set(s.id, db.getSaleItems(s.id));
      }
      sMap.set(c.id, custSales);
      pMap.set(c.id, custPayments);
      tMap.set(c.id, buildCustomerTimeline(c, custSales, custPayments, iMap, custReturns, custLedger));
    }

    return {
      salesByCustomer: sMap,
      paymentsByCustomer: pMap,
      saleItemsBySaleId: iMap,
      timelinesByCustomer: tMap,
    };
  }, [customers, storeId]);

  const cardStats = useMemo(
    () => computeCustomerDashboardCards(customers, allPayments),
    [customers, allPayments],
  );

  const filtered = useMemo(
    () =>
      filterAndSortCustomers(customers, {
        query,
        filter,
        sort,
        salesByCustomer,
        paymentsByCustomer,
      }),
    [customers, query, filter, sort, salesByCustomer, paymentsByCustomer],
  );

  const pendingOutboxCount = outbox.filter((i) => i.status !== 'sent').length;

  const openShareDispatchForText = (params: {
    customer: Customer;
    title: string;
    messageText: string;
    reference?: string;
  }) => {
    setShareDispatch({
      open: true,
      customerId: params.customer.id,
      customerName: params.customer.name,
      targetPhone: params.customer.phone,
      title: params.title,
      messageText: params.messageText,
      reference: params.reference,
    });
  };

  const handleSaveCustomerForm = (payload: {
    name: string;
    phone: string;
    openingBalance: number;
    totalDebt?: number;
    creditLimit: number;
    category: 'جديد' | 'منتظم' | 'VIP' | 'موقوف';
    nextDueAt?: string;
    notes?: string;
  }) => {
    if (customerFormState.mode === 'add') {
      db.insertCustomer(storeId, payload.name, payload.phone, payload.openingBalance, {
        credit_limit: payload.creditLimit,
        category: payload.category,
        next_due_at: payload.nextDueAt,
        notes: payload.notes,
      });
      setCustomerFormState({ open: false, mode: 'add' });
      load();
      notify('تم حفظ العميل وإضافته إلى القائمة والإحصائيات');
    } else if (customerFormState.customer) {
      db.updateCustomer(storeId, customerFormState.customer.id, {
        name: payload.name,
        phone: payload.phone,
        opening_balance: payload.openingBalance,
        total_debt: payload.totalDebt,
        credit_limit: payload.creditLimit,
        category: payload.category,
        next_due_at: payload.nextDueAt,
        notes: payload.notes,
      });
      setCustomerFormState({ open: false, mode: 'add' });
      load();
      notify('تم تحديث بيانات العميل وإعادة احتساب الأرصدة');
    }
  };

  const handleSaveCreditInvoice = (
    payload: {
      customerId?: number | null;
      customerName?: string;
      items: Array<{ product_id?: number; product_name: string; qty: number; price: number; price_entered: boolean }>;
      totalAmount: number;
      notes?: string;
      idempotencyKey: string;
    },
    shareAfterSave: boolean,
  ) => {
    const result = db.insertManualCreditInvoice(storeId, payload);
    setCreditInvoiceState({ open: false, fixedCustomer: null });
    load();
    notify(
      result.customerCreated
        ? `تم فتح حساب للعميل ${result.customer.name} وحفظ الفاتورة الآجلة #${result.sale.id}`
        : `تم حفظ الفاتورة الآجلة #${result.sale.id} وتحديث مديونية ${result.customer.name}`,
    );

    if (shareAfterSave) {
      const text = formatCreditInvoiceShareText({
        storeName,
        customerName: result.customer.name,
        customerTotalDebt: result.customer.total_debt,
        sale: result.sale,
        items: result.items,
      });
      openShareDispatchForText({
        customer: result.customer,
        title: `مشاركة فاتورة آجلة #${result.sale.id}`,
        messageText: text,
        reference: `INV-${result.sale.id}`,
      });
    }
  };

  const handleSavePaymentReceipt = (
    payload: {
      amount: number;
      method: CustomerPayment['method'];
      notes?: string;
      idempotencyKey: string;
    },
    shareAfterSave: boolean,
  ) => {
    if (!paymentCustomer) return;
    const payment = db.payCustomerDebt(storeId, paymentCustomer.id, payload.amount, {
      method: payload.method,
      notes: payload.notes,
      idempotencyKey: payload.idempotencyKey,
    });
    const updatedCustomer = db.getCustomerById(storeId, paymentCustomer.id) || paymentCustomer;
    setPaymentCustomer(null);
    load();
    notify(`تم حفظ سند القبض #${payment.id} وتحديث رصيد العميل`);

    if (shareAfterSave) {
      const text = formatPaymentReceiptShareText({
        storeName,
        customerName: updatedCustomer.name,
        payment,
        remainingBalance: updatedCustomer.total_debt,
      });
      openShareDispatchForText({
        customer: updatedCustomer,
        title: `مشاركة سند قبض #${payment.id}`,
        messageText: text,
        reference: payment.receipt_number,
      });
    }
  };

  const shareTimelineRow = (customer: Customer, row: CustomerTimelineRow) => {
    if (row.kind === 'invoice' && row.sale) {
      const text = formatCreditInvoiceShareText({
        storeName,
        customerName: customer.name,
        customerTotalDebt: customer.total_debt,
        sale: row.sale,
        items: row.items || [],
      });
      openShareDispatchForText({
        customer,
        title: `مشاركة فاتورة #${row.sale.id}`,
        messageText: text,
        reference: `INV-${row.sale.id}`,
      });
    } else if (row.kind === 'payment' && row.payment) {
      const text = formatPaymentReceiptShareText({
        storeName,
        customerName: customer.name,
        payment: row.payment,
        remainingBalance: row.balanceAfter,
      });
      openShareDispatchForText({
        customer,
        title: `مشاركة سند قبض #${row.payment.id}`,
        messageText: text,
        reference: row.payment.receipt_number,
      });
    } else {
      const summary = db.getCustomerSummary(storeId, customer.id);
      const salesWithItems = (salesByCustomer.get(customer.id) || []).map((sale) => ({
        sale,
        items: saleItemsBySaleId.get(sale.id) || [],
      }));
      const text = formatStatementShareText({
        storeName,
        customer,
        salesWithItems,
        payments: paymentsByCustomer.get(customer.id) || [],
        totalInvoices: summary.totalInvoices,
        totalPayments: summary.totalPayments,
      });
      openShareDispatchForText({
        customer,
        title: `مشاركة كشف حساب ${customer.name}`,
        messageText: text,
        reference: `STMT-${customer.id}`,
      });
    }
  };

  const shareCustomerStatement = (customer: Customer) => {
    const summary = db.getCustomerSummary(storeId, customer.id);
    const salesWithItems = (salesByCustomer.get(customer.id) || []).map((sale) => ({
      sale,
      items: saleItemsBySaleId.get(sale.id) || [],
    }));
    const text = formatStatementShareText({
      storeName,
      customer,
      salesWithItems,
      payments: paymentsByCustomer.get(customer.id) || [],
      totalInvoices: summary.totalInvoices,
      totalPayments: summary.totalPayments,
    });
    openShareDispatchForText({
      customer,
      title: `كشف حساب / إجمالي المديونية — ${customer.name}`,
      messageText: text,
      reference: `STMT-${customer.id}`,
    });
  };

  const statCards: Array<{ label: string; value: string | number; accent?: string }> = [
    { label: 'إجمالي العملاء', value: cardStats.totalCustomers },
    { label: 'إجمالي الديون', value: formatCurrency(cardStats.totalDebt), accent: 'text-red-500' },
    { label: 'ديون قريبة', value: formatCurrency(cardStats.soonDebt), accent: 'text-amber-500' },
    { label: 'ديون متأخرة', value: formatCurrency(cardStats.overdueDebt), accent: 'text-red-500' },
    { label: 'المحصل', value: formatCurrency(cardStats.collected), accent: 'text-emerald-500' },
    { label: 'المتعثرون', value: cardStats.troubledCount, accent: 'text-purple-500' },
  ];

  const filterButtons: Array<[CustomerFilter, string]> = [
    ['all', 'الكل'],
    ['debtor', 'مدينون'],
    ['clear', 'لهم رصيد صفر'],
    ['overdue', 'متأخرون'],
    ['soon', 'قريبون'],
    ['limit', 'تجاوزوا الحد'],
    ['suspended', 'الموقوفين'],
  ];

  const shareMenuCustomerSales = shareMenuCustomer
    ? [...(salesByCustomer.get(shareMenuCustomer.id) || [])]
        .filter((s) => s.payment_type === 'آجل' || s.remaining_amount > 0)
        .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)
    : [];
  const shareMenuLastSale = shareMenuCustomerSales[0];
  const shareMenuLastPayment = shareMenuCustomer
    ? [...(paymentsByCustomer.get(shareMenuCustomer.id) || [])]
        .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)[0]
    : undefined;

  return (
    <div className={`relative flex-1 flex flex-col ${theme.screenBg} ${theme.textPrimary} overflow-hidden`}>
      {/* Header */}
      <header className="bg-[#0B3D2E] text-white p-3 space-y-2 border-b border-[#C9A961]/30 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => (onBack ? onBack() : onNavigate('dashboard'))}
              aria-label="رجوع إلى الشاشة السابقة"
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition shrink-0"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
            <h2 className="font-extrabold text-sm truncate">إدارة العملاء والديون</h2>
          </div>

          <button
            type="button"
            onClick={() => setIsOutboxOpen(true)}
            aria-label="طابور الإرسال المحلي"
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 border shrink-0 transition ${
              pendingOutboxCount > 0
                ? 'bg-amber-500 text-[#0B3D2E] border-amber-300'
                : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>الطابور</span>
            {pendingOutboxCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#0B3D2E] text-white text-[10px] font-mono">
                {pendingOutboxCount}
              </span>
            )}
          </button>
        </div>

        {/* Two Primary Header Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setCustomerFormState({ open: true, mode: 'add' })}
            className="flex items-center justify-center gap-1.5 bg-[#C9A961] hover:bg-[#d6b76f] text-[#0B3D2E] px-3 py-2 rounded-xl font-extrabold text-xs transition shadow-xs"
          >
            <UserPlus className="w-4 h-4 shrink-0" />
            <span>+ إضافة عميل</span>
          </button>
          <button
            type="button"
            onClick={() => setCreditInvoiceState({ open: true, fixedCustomer: null })}
            className="flex items-center justify-center gap-1.5 bg-white text-[#0B3D2E] hover:bg-emerald-50 px-3 py-2 rounded-xl font-extrabold text-xs transition shadow-xs"
          >
            <FilePlus2 className="w-4 h-4 shrink-0" />
            <span>+ فاتورة آجلة</span>
          </button>
        </div>
      </header>

      {/* Pending Saved Shares Strip (only shown when saved items exist) */}
      {pendingOutboxCount > 0 && (
        <div
          className={`px-3 py-2 text-[11px] font-bold flex items-center justify-between gap-2 border-b ${
            isDarkMode
              ? 'bg-amber-950/70 border-amber-800 text-amber-200'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {`يوجد ${pendingOutboxCount} مستند محفوظ في سجل المشاركات جاهز للمشاركة دون إنترنت`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsOutboxOpen(true)}
            className="px-2 py-1 rounded-lg bg-[#0B3D2E] text-white text-[10px] font-bold shrink-0"
          >
            مشاركة الآن
          </button>
        </div>
      )}

      {/* Top 6 Live Stat Cards */}
      <section aria-label="إحصائيات العملاء والديون" className="grid grid-cols-3 gap-2 p-3 pb-2">
        {statCards.map((card) => (
          <div
            key={card.label}
            className={`${theme.cardBg} border ${theme.borderColor} rounded-xl p-2 text-center`}
          >
            <p className={`text-[10px] font-semibold ${theme.textSecondary}`}>{card.label}</p>
            <p className={`font-extrabold text-xs mt-1 font-mono ${card.accent || theme.textPrimary}`}>
              {card.value}
            </p>
          </div>
        ))}
      </section>

      {/* Search, Filters & Sort */}
      <section aria-label="البحث والفلترة والترتيب" className={`px-3 py-2 space-y-2 border-b ${theme.borderColor}`}>
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="بحث بالاسم، الهاتف، رقم الفاتورة أو المبلغ"
            aria-label="بحث بالاسم، الهاتف، رقم الفاتورة أو المبلغ"
            className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-xl px-3 py-2 pr-9 text-xs focus:outline-none focus:border-[#C9A961]`}
          />
          <Search className={`w-4 h-4 absolute right-3 top-2.5 ${theme.textMuted}`} />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 text-[10px]" role="tablist" aria-label="فلاتر العملاء">
          {filterButtons.map(([key, label]) => {
            const active = filter === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(key)}
                className={`whitespace-nowrap px-2.5 py-1.5 rounded-lg border font-bold transition ${
                  active
                    ? 'bg-[#0B3D2E] text-white border-[#C9A961]'
                    : isDarkMode
                      ? 'bg-[#121B17] text-gray-200 border-emerald-900/70 hover:bg-emerald-950/60'
                      : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-100'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as CustomerSort)}
          aria-label="ترتيب العملاء"
          className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-xl px-2.5 py-2 text-xs font-semibold`}
        >
          <option value="debt_desc">أعلى مديونية</option>
          <option value="debt_asc">أقل مديونية</option>
          <option value="recent_activity">الأحدث حركة</option>
          <option value="name">الأبجدي (أ - ي)</option>
          <option value="due_soon">الأقرب موعد سداد</option>
        </select>
      </section>

      {/* Customer Cards List */}
      <main className="flex-1 overflow-y-auto p-3 space-y-3 pb-24">
        {filtered.length === 0 ? (
          <div className={`text-center py-14 text-xs ${theme.textSecondary} space-y-2`}>
            <p className="font-bold">لا توجد نتائج مطابقة</p>
            <p>أضف عميلاً جديداً أو أنشئ فاتورة آجلة مباشرة من الأعلى.</p>
          </div>
        ) : (
          filtered.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              sales={salesByCustomer.get(customer.id) || []}
              payments={paymentsByCustomer.get(customer.id) || []}
              timeline={timelinesByCustomer.get(customer.id) || []}
              onOpenStatement={(c) =>
                onNavigate('statement', {
                  customerId: c.id,
                  customerName: c.name,
                  customerPhone: c.phone,
                  totalDebt: c.total_debt,
                })
              }
              onOpenNewCreditInvoice={(c) => setCreditInvoiceState({ open: true, fixedCustomer: c })}
              onOpenPayment={(c) => setPaymentCustomer(c)}
              onOpenShareMenu={(c) => setShareMenuCustomer(c)}
              onOpenQuickPhone={(c) =>
                setCustomerFormState({ open: true, mode: 'edit', customer: c, focusField: 'phone' })
              }
              onEditCustomer={(c) =>
                setCustomerFormState({ open: true, mode: 'edit', customer: c, focusField: 'name' })
              }
              onScheduleDueDate={(c) =>
                setScheduleState({
                  customer: c,
                  dueDate: c.next_due_at ? c.next_due_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
                })
              }
              onMergeCustomer={(c) => setMergeState({ primary: c, targetId: '' })}
              onArchiveCustomer={(c) => setArchiveConfirmCustomer(c)}
              onRestoreCustomer={(c) => {
                db.restoreCustomer(storeId, c.id);
                load();
                notify(`تمت استعادة العميل ${c.name} إلى القائمة النشطة`);
              }}
              onSafeDeleteCustomer={(c) => setDeleteConfirmCustomer(c)}
              onReleaseSuspended={(c) => {
                db.releaseSuspendedCustomer(storeId, c.id);
                load();
                notify(`تم إخراج العميل ${c.name} من الموقوفين وتفعيل البيع الآجل له`);
              }}
              onAllowCreditOverride={(c, allow) => {
                db.setCustomerCreditOverride(storeId, c.id, allow);
                load();
                notify(
                  allow
                    ? `تم السماح بمواصلة البيع الآجل للعميل ${c.name} رغم بلوغ الحد الائتماني`
                    : `تم إيقاف التجاوز الاستثنائي للحد الائتماني للعميل ${c.name}`,
                );
              }}
              onViewInvoiceItems={(c, row) => setItemsDetailState({ customer: c, row })}
              onShareTimelineRow={shareTimelineRow}
            />
          ))
        )}
      </main>

      {/* Modals */}
      <CustomerFormModal
        isOpen={customerFormState.open}
        mode={customerFormState.mode}
        customer={customerFormState.customer}
        focusField={customerFormState.focusField}
        onClose={() => setCustomerFormState({ open: false, mode: 'add' })}
        onSave={handleSaveCustomerForm}
      />

      <CreditInvoiceModal
        isOpen={creditInvoiceState.open}
        storeId={storeId}
        customers={customers}
        products={products}
        fixedCustomer={creditInvoiceState.fixedCustomer}
        onClose={() => setCreditInvoiceState({ open: false, fixedCustomer: null })}
        onSave={handleSaveCreditInvoice}
      />

      <PaymentReceiptModal
        isOpen={Boolean(paymentCustomer)}
        customer={paymentCustomer}
        onClose={() => setPaymentCustomer(null)}
        onSave={handleSavePaymentReceipt}
      />

      <ShareMenuModal
        isOpen={Boolean(shareMenuCustomer)}
        customer={shareMenuCustomer}
        lastCreditSale={shareMenuLastSale}
        lastPayment={shareMenuLastPayment}
        timeline={shareMenuCustomer ? timelinesByCustomer.get(shareMenuCustomer.id) || [] : []}
        onClose={() => setShareMenuCustomer(null)}
        onSelectLastCreditInvoice={() => {
          if (!shareMenuCustomer || !shareMenuLastSale) return;
          const items = saleItemsBySaleId.get(shareMenuLastSale.id) || [];
          openShareDispatchForText({
            customer: shareMenuCustomer,
            title: `مشاركة آخر فاتورة آجلة #${shareMenuLastSale.id}`,
            messageText: formatCreditInvoiceShareText({
              storeName,
              customerName: shareMenuCustomer.name,
              customerTotalDebt: shareMenuCustomer.total_debt,
              sale: shareMenuLastSale,
              items,
            }),
            reference: `INV-${shareMenuLastSale.id}`,
          });
        }}
        onSelectLastReceipt={() => {
          if (!shareMenuCustomer || !shareMenuLastPayment) return;
          openShareDispatchForText({
            customer: shareMenuCustomer,
            title: `مشاركة آخر سند قبض #${shareMenuLastPayment.id}`,
            messageText: formatPaymentReceiptShareText({
              storeName,
              customerName: shareMenuCustomer.name,
              payment: shareMenuLastPayment,
              remainingBalance: shareMenuCustomer.total_debt,
            }),
            reference: shareMenuLastPayment.receipt_number,
          });
        }}
        onSelectSpecificRow={(row) => {
          if (!shareMenuCustomer) return;
          shareTimelineRow(shareMenuCustomer, row);
        }}
        onSelectStatement={() => {
          if (!shareMenuCustomer) return;
          shareCustomerStatement(shareMenuCustomer);
        }}
      />

      {shareDispatch && (
        <ShareDispatchModal
          isOpen={shareDispatch.open}
          onClose={() => {
            setShareDispatch(null);
            load();
          }}
          storeId={storeId}
          customerId={shareDispatch.customerId}
          customerName={shareDispatch.customerName}
          targetPhone={shareDispatch.targetPhone}
          title={shareDispatch.title}
          messageText={shareDispatch.messageText}
          reference={shareDispatch.reference}
          onOutboxChanged={(msg) => {
            load();
            if (msg) notify(msg);
          }}
        />
      )}

      <OutboxQueueModal
        isOpen={isOutboxOpen}
        items={outbox}
        onClose={() => setIsOutboxOpen(false)}
        onRetryItem={(item) => {
          setIsOutboxOpen(false);
          setShareDispatch({
            open: true,
            customerId: item.customer_id,
            customerName: item.customer_name,
            targetPhone: item.customer_phone,
            title: item.title,
            messageText: item.message_text,
            reference: item.reference,
          });
        }}
        onDeleteItem={(id) => {
          db.removeShareOutboxItem(storeId, id);
          load();
        }}
      />

      {/* Invoice Items Details Modal */}
      {itemsDetailState && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="تفاصيل أصناف الفاتورة"
        >
          <div className={`${theme.cardBg} w-full max-w-sm rounded-3xl border ${theme.borderColor} shadow-2xl overflow-hidden`}>
            <div className="bg-[#0B3D2E] text-white p-3.5 flex items-center justify-between border-b border-[#C9A961]/30">
              <h3 className="font-bold text-sm">{itemsDetailState.row.title}</h3>
              <button
                type="button"
                onClick={() => setItemsDetailState(null)}
                aria-label="إغلاق تفاصيل الأصناف"
                className="p-1 hover:bg-white/10 rounded-full text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-[75vh] overflow-y-auto">
              <div className={`text-xs ${theme.textSecondary} flex justify-between`}>
                <span>العميل: <strong className={theme.textPrimary}>{itemsDetailState.customer.name}</strong></span>
                <span className="font-mono">{formatDateTimeDisplay(itemsDetailState.row.date)}</span>
              </div>

              <div className={`rounded-2xl border ${theme.borderColor} divide-y divide-gray-200/20`}>
                {(itemsDetailState.row.items || []).length === 0 ? (
                  <div className={`p-3 text-xs ${theme.textSecondary}`}>
                    فاتورة آجلة مسجلة بإجمالي مباشر دون تفصيل أصناف
                  </div>
                ) : (
                  (itemsDetailState.row.items || []).map((item) => (
                    <div key={item.id} className="p-2.5 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold">{item.product_name || `صنف #${item.product_id}`}</p>
                        <p className={`text-[10px] ${theme.textSecondary}`}>
                          الكمية: {item.qty} {item.price > 0 ? `× ${formatCurrency(item.price)}` : '(سعر غير محدد فردياً)'}
                        </p>
                      </div>
                      <span className="font-bold font-mono">
                        {item.price > 0 ? formatCurrency(item.qty * item.price) : '—'}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className={`p-3 rounded-2xl border ${theme.borderColor} flex items-center justify-between text-xs`}>
                <span className="font-bold">إجمالي الفاتورة:</span>
                <span className="font-extrabold text-sm font-mono">{formatCurrency(itemsDetailState.row.amount)}</span>
              </div>

              {itemsDetailState.row.note && (
                <div className={`p-2.5 rounded-xl border ${theme.borderColor} text-xs`}>
                  <span className={`font-bold ${theme.textSecondary}`}>الملاحظة: </span>
                  <span>{itemsDetailState.row.note}</span>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = itemsDetailState;
                    setItemsDetailState(null);
                    shareTimelineRow(target.customer, target.row);
                  }}
                  className="flex-1 bg-[#1F9D55] hover:bg-[#198748] text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>مشاركة الفاتورة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setItemsDetailState(null)}
                  className={`px-4 py-2.5 rounded-xl border text-xs font-bold ${theme.borderColor}`}
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Due Date Modal */}
      {scheduleState && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="جدولة موعد السداد"
        >
          <div className={`${theme.cardBg} w-full max-w-sm rounded-3xl border ${theme.borderColor} p-4 space-y-3 shadow-2xl`}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-1.5">
                <CalendarClock className="w-4 h-4 text-[#C9A961]" />
                <span>جدولة السداد — {scheduleState.customer.name}</span>
              </h3>
              <button type="button" onClick={() => setScheduleState(null)} className="p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="date"
              value={scheduleState.dueDate}
              onChange={(e) => setScheduleState({ ...scheduleState, dueDate: e.target.value })}
              className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-xl px-3 py-2.5 text-xs`}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  db.updateCustomer(storeId, scheduleState.customer.id, {
                    next_due_at: scheduleState.dueDate || undefined,
                  });
                  setScheduleState(null);
                  load();
                  notify('تم تحديث موعد السداد المجدول والمؤشرات');
                }}
                className="flex-1 bg-[#0B3D2E] text-white py-2.5 rounded-xl text-xs font-bold border border-[#C9A961]/50"
              >
                حفظ الموعد
              </button>
              <button
                type="button"
                onClick={() => setScheduleState(null)}
                className={`flex-1 border py-2.5 rounded-xl text-xs font-bold ${theme.borderColor}`}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Customer Modal */}
      {mergeState && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="دمج عميل"
        >
          <div className={`${theme.cardBg} w-full max-w-sm rounded-3xl border ${theme.borderColor} p-4 space-y-3 shadow-2xl`}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-1.5">
                <Merge className="w-4 h-4 text-[#C9A961]" />
                <span>دمج عميل مع: {mergeState.primary.name}</span>
              </h3>
              <button type="button" onClick={() => setMergeState(null)} className="p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className={`text-xs ${theme.textSecondary}`}>
              سيتم نقل جميع فواتير وسندات وأرصدة الحساب المكرر إلى حساب ({mergeState.primary.name}).
            </p>
            <select
              value={mergeState.targetId}
              onChange={(e) => setMergeState({ ...mergeState, targetId: e.target.value })}
              className={`w-full ${theme.inputBg} border ${theme.borderColor} rounded-xl px-3 py-2.5 text-xs`}
            >
              <option value="">اختر الحساب المكرر المراد دمجه...</option>
              {customers
                .filter((c) => c.id !== mergeState.primary.id && c.status !== 'archived')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {formatCurrency(c.total_debt)}
                  </option>
                ))}
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!mergeState.targetId}
                onClick={() => {
                  try {
                    db.mergeCustomers(
                      storeId,
                      mergeState.primary.id,
                      Number(mergeState.targetId),
                      'دمج حساب مكرر من شاشة العملاء',
                    );
                    setMergeState(null);
                    load();
                    notify('تم دمج الحسابين ونقل جميع الفواتير والسندات والأرصدة');
                  } catch (err) {
                    notify(err instanceof Error ? err.message : 'تعذر دمج الحسابات');
                  }
                }}
                className="flex-1 bg-[#0B3D2E] text-white py-2.5 rounded-xl text-xs font-bold disabled:opacity-50"
              >
                تأكيد الدمج
              </button>
              <button
                type="button"
                onClick={() => setMergeState(null)}
                className={`flex-1 border py-2.5 rounded-xl text-xs font-bold ${theme.borderColor}`}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {archiveConfirmCustomer && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="تأكيد أرشفة العميل"
        >
          <div className={`${theme.cardBg} w-full max-w-sm rounded-3xl border ${theme.borderColor} p-4 space-y-3 shadow-2xl`}>
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Archive className="w-4 h-4 text-amber-500" />
              <span>أرشفة العميل: {archiveConfirmCustomer.name}</span>
            </h3>
            {archiveConfirmCustomer.total_debt > 0 && (
              <div className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                isDarkMode ? 'bg-amber-950/60 border-amber-800 text-amber-200' : 'bg-amber-50 border-amber-300 text-amber-900'
              }`}>
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  تنبيه: لا يزال على العميل رصيد مستحق قدره {formatCurrency(archiveConfirmCustomer.total_debt)}.
                </span>
              </div>
            )}
            <p className={`text-xs ${theme.textSecondary}`}>
              سيتم إخفاء العميل من القائمة النشطة مع الاحتفاظ الكامل بجميع فواتيره وسنداته وإمكانية استعادته لاحقاً.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  db.archiveCustomer(storeId, archiveConfirmCustomer.id);
                  setArchiveConfirmCustomer(null);
                  load();
                  notify('تم نقل العميل إلى الأرشيف مع حفظ كافة سجلاته');
                }}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-xl text-xs font-bold"
              >
                تأكيد الأرشفة
              </button>
              <button
                type="button"
                onClick={() => setArchiveConfirmCustomer(null)}
                className={`flex-1 border py-2.5 rounded-xl text-xs font-bold ${theme.borderColor}`}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safe Delete Confirmation Modal */}
      {deleteConfirmCustomer && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="تأكيد الحذف الآمن"
        >
          <div className={`${theme.cardBg} w-full max-w-sm rounded-3xl border ${theme.borderColor} p-4 space-y-3 shadow-2xl`}>
            <h3 className="font-bold text-sm flex items-center gap-2 text-red-500">
              <Trash2 className="w-4 h-4" />
              <span>حذف آمن — {deleteConfirmCustomer.name}</span>
            </h3>
            <p className={`text-xs ${theme.textSecondary}`}>
              هل أنت متأكد من حذف هذا العميل؟ يمنع النظام تلقائياً حذف أي عميل لديه فواتير أو سندات أو سجلات مالية لحماية البيانات.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  try {
                    db.deleteCustomerSafely(storeId, deleteConfirmCustomer.id);
                    setDeleteConfirmCustomer(null);
                    load();
                    notify('تم حذف العميل بأمان');
                  } catch (err) {
                    setDeleteConfirmCustomer(null);
                    notify(err instanceof Error ? err.message : 'تعذر الحذف');
                  }
                }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-xs font-bold"
              >
                تأكيد الحذف الآمن
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmCustomer(null)}
                className={`flex-1 border py-2.5 rounded-xl text-xs font-bold ${theme.borderColor}`}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[60] bg-gray-950 text-white border border-[#C9A961]/60 text-xs font-bold px-4 py-2.5 rounded-2xl shadow-xl w-[92%] max-w-sm text-center"
        >
          {toast}
        </div>
      )}
    </div>
  );
};
