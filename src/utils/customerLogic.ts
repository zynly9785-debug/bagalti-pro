/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Customer,
  CustomerLedgerEntry,
  CustomerPayment,
  ReturnItem,
  Sale,
  SaleItem,
} from '../types/index.ts';
import { formatCurrency } from './pureLogic.ts';

export type CustomerFilter =
  | 'all'
  | 'debtor'
  | 'clear'
  | 'overdue'
  | 'soon'
  | 'limit'
  | 'suspended';

export type CustomerSort =
  | 'debt_desc'
  | 'debt_asc'
  | 'recent_activity'
  | 'name'
  | 'due_soon';

export interface CustomerTimelineRow {
  uid: string;
  kind: 'invoice' | 'payment' | 'return';
  id: number;
  reference: string;
  date: string;
  title: string;
  sign: '+' | '-' | '';
  amount: number;
  balanceAfter: number;
  note?: string;
  sale?: Sale;
  payment?: CustomerPayment;
  items?: SaleItem[];
}

export interface CustomerCardStats {
  totalCustomers: number;
  totalDebt: number;
  soonDebt: number;
  overdueDebt: number;
  collected: number;
  troubledCount: number;
}

export const toLocalDateKey = (date: Date = new Date()): string => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

export const addDaysToDateKey = (date: Date, days: number): string => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return toLocalDateKey(copy);
};

export const formatDateTimeDisplay = (value?: string): string => {
  if (!value) return '-';
  if (value.includes('T')) {
    return value.slice(0, 19).replace('T', ' ');
  }
  return value.slice(0, 19);
};

export const isCustomerSuspended = (c: Pick<Customer, 'status' | 'category'>): boolean =>
  c.status === 'suspended' || c.category === 'موقوف';

export const isCustomerArchived = (c: Pick<Customer, 'status'>): boolean =>
  c.status === 'archived';

export const isCustomerOverdue = (
  c: Pick<Customer, 'total_debt' | 'next_due_at'>,
  now: Date = new Date(),
): boolean => {
  if (c.total_debt <= 0 || !c.next_due_at) return false;
  return c.next_due_at.slice(0, 10) < toLocalDateKey(now);
};

export const isCustomerSoon = (
  c: Pick<Customer, 'total_debt' | 'next_due_at'>,
  now: Date = new Date(),
  windowDays = 7,
): boolean => {
  if (c.total_debt <= 0 || !c.next_due_at) return false;
  const dueKey = c.next_due_at.slice(0, 10);
  const todayKey = toLocalDateKey(now);
  const soonKey = addDaysToDateKey(now, windowDays);
  return dueKey >= todayKey && dueKey <= soonKey;
};

export const hasReachedOrExceededCreditLimit = (
  c: Pick<Customer, 'total_debt' | 'credit_limit'>,
): boolean => {
  const limit = c.credit_limit ?? 50000;
  if (c.total_debt <= 0) return false;
  return c.total_debt >= limit;
};

export const getCustomerAccountStatus = (
  c: Customer,
  now: Date = new Date(),
): {
  label: 'منتظم' | 'قريب السداد' | 'متأخر' | 'تجاوز الحد' | 'موقوف' | 'مؤرشف';
  tone: 'emerald' | 'amber' | 'red' | 'purple' | 'slate';
} => {
  if (isCustomerArchived(c)) return { label: 'مؤرشف', tone: 'slate' };
  if (isCustomerSuspended(c)) return { label: 'موقوف', tone: 'purple' };
  if (isCustomerOverdue(c, now)) return { label: 'متأخر', tone: 'red' };
  if (hasReachedOrExceededCreditLimit(c)) return { label: 'تجاوز الحد', tone: 'red' };
  if (isCustomerSoon(c, now)) return { label: 'قريب السداد', tone: 'amber' };
  return { label: 'منتظم', tone: 'emerald' };
};

export const computeCustomerDashboardCards = (
  customers: Customer[],
  allPayments: CustomerPayment[],
  now: Date = new Date(),
): CustomerCardStats => {
  const activeCustomers = customers.filter((c) => !isCustomerArchived(c));
  const totalCustomers = activeCustomers.length;
  const totalDebt = activeCustomers.reduce((sum, c) => sum + (c.total_debt || 0), 0);
  const soonDebt = activeCustomers
    .filter((c) => isCustomerSoon(c, now))
    .reduce((sum, c) => sum + (c.total_debt || 0), 0);
  const overdueDebt = activeCustomers
    .filter((c) => isCustomerOverdue(c, now))
    .reduce((sum, c) => sum + (c.total_debt || 0), 0);
  const collected = allPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const troubledCount = activeCustomers.filter(
    (c) =>
      isCustomerOverdue(c, now) ||
      hasReachedOrExceededCreditLimit(c) ||
      isCustomerSuspended(c),
  ).length;

  return {
    totalCustomers,
    totalDebt,
    soonDebt,
    overdueDebt,
    collected,
    troubledCount,
  };
};

export const filterAndSortCustomers = (
  customers: Customer[],
  options: {
    query: string;
    filter: CustomerFilter;
    sort: CustomerSort;
    salesByCustomer: Map<number, Sale[]>;
    paymentsByCustomer: Map<number, CustomerPayment[]>;
    now?: Date;
  },
): Customer[] => {
  const now = options.now ?? new Date();
  const q = options.query.trim().toLowerCase();

  let list = customers.filter((c) => {
    if (options.filter === 'suspended') return isCustomerSuspended(c);
    if (isCustomerArchived(c)) return false;
    if (options.filter === 'debtor') return c.total_debt > 0;
    if (options.filter === 'clear') return c.total_debt <= 0;
    if (options.filter === 'overdue') return isCustomerOverdue(c, now);
    if (options.filter === 'soon') return isCustomerSoon(c, now);
    if (options.filter === 'limit') return hasReachedOrExceededCreditLimit(c);
    return true;
  });

  if (q) {
    list = list.filter((c) => {
      if (
        c.name.toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.phone_secondary || '').toLowerCase().includes(q) ||
        String(c.id).includes(q) ||
        String(c.total_debt).includes(q)
      ) {
        return true;
      }
      const custSales = options.salesByCustomer.get(c.id) || [];
      if (
        custSales.some(
          (s) =>
            String(s.id).includes(q) ||
            String(s.total_amount).includes(q) ||
            String(s.remaining_amount).includes(q) ||
            (s.notes || '').toLowerCase().includes(q),
        )
      ) {
        return true;
      }
      const custPayments = options.paymentsByCustomer.get(c.id) || [];
      return custPayments.some(
        (p) =>
          String(p.id).includes(q) ||
          (p.receipt_number || '').toLowerCase().includes(q) ||
          String(p.amount).includes(q) ||
          (p.notes || '').toLowerCase().includes(q),
      );
    });
  }

  const latestActivity = (c: Customer) => {
    const candidates = [c.last_purchase_at || '', c.last_payment_at || '', c.registered_at || ''].sort();
    return candidates[candidates.length - 1] || '';
  };

  return [...list].sort((a, b) => {
    if (options.sort === 'debt_desc') return b.total_debt - a.total_debt;
    if (options.sort === 'debt_asc') return a.total_debt - b.total_debt;
    if (options.sort === 'recent_activity') return latestActivity(b).localeCompare(latestActivity(a));
    if (options.sort === 'due_soon') {
      const dueA = a.next_due_at || '9999-12-31';
      const dueB = b.next_due_at || '9999-12-31';
      return dueA.localeCompare(dueB) || b.total_debt - a.total_debt;
    }
    return a.name.localeCompare(b.name, 'ar');
  });
};

const normalizeTimestampKey = (value: string) =>
  value.includes('T') ? value : value.replace(' ', 'T');

/**
 * Builds chronological customer transactions (credit/cash invoices, receipts, returns)
 * with accurate running balance after each event, returned newest-first.
 */
export const buildCustomerTimeline = (
  customer: Customer,
  sales: Sale[],
  payments: CustomerPayment[],
  saleItemsBySaleId: Map<number, SaleItem[]>,
  returns: ReturnItem[] = [],
  ledger: CustomerLedgerEntry[] = [],
): CustomerTimelineRow[] => {
  type RawEvent = {
    uid: string;
    kind: 'invoice' | 'payment' | 'return';
    id: number;
    reference: string;
    date: string;
    sortKey: string;
    orderWeight: number;
    title: string;
    sign: '+' | '-' | '';
    amount: number;
    debtDelta: number;
    note?: string;
    sale?: Sale;
    payment?: CustomerPayment;
    items?: SaleItem[];
  };

  const events: RawEvent[] = [];

  for (const s of sales) {
    const initialPaidLedger = ledger
      .filter(
        (entry) =>
          entry.kind === 'payment' &&
          entry.source_id === s.id &&
          (entry.reference === `INV-${s.id}` || entry.reference === `FREE-${s.id}`),
      )
      .reduce((sum, entry) => sum + (entry.credit || 0), 0);

    const paidAtSale =
      s.initial_paid_amount !== undefined
        ? s.initial_paid_amount
        : initialPaidLedger > 0
          ? initialPaidLedger
          : s.payment_type === 'آجل'
            ? 0
            : s.total_amount;

    const isCredit = s.payment_type === 'آجل' || s.total_amount - paidAtSale > 0;
    const debtAddedAtSale = isCredit ? Math.max(0, s.total_amount - paidAtSale) : 0;

    events.push({
      uid: `sale-${s.id}`,
      kind: 'invoice',
      id: s.id,
      reference: `#${s.id}`,
      date: s.created_at,
      sortKey: normalizeTimestampKey(s.created_at),
      orderWeight: 1,
      title: isCredit ? `فاتورة آجلة #${s.id}` : `فاتورة نقدية #${s.id}`,
      sign: debtAddedAtSale > 0 ? '+' : '',
      amount: s.total_amount,
      debtDelta: debtAddedAtSale,
      note: s.notes,
      sale: s,
      items: saleItemsBySaleId.get(s.id) || [],
    });
  }

  for (const p of payments) {
    events.push({
      uid: `payment-${p.id}`,
      kind: 'payment',
      id: p.id,
      reference: p.receipt_number || `#${p.id}`,
      date: p.created_at,
      sortKey: normalizeTimestampKey(p.created_at),
      orderWeight: 2,
      title: `سند قبض #${p.id}`,
      sign: '-',
      amount: p.amount,
      debtDelta: -p.amount,
      note: p.notes,
      payment: p,
    });
  }

  for (const r of returns) {
    events.push({
      uid: `return-${r.id}`,
      kind: 'return',
      id: r.id,
      reference: `RET-${r.id}`,
      date: r.created_at,
      sortKey: normalizeTimestampKey(r.created_at),
      orderWeight: 3,
      title: `مرتجع #${r.id}`,
      sign: '-',
      amount: r.amount,
      debtDelta: -r.amount,
    });
  }

  events.sort(
    (a, b) =>
      a.sortKey.localeCompare(b.sortKey) ||
      a.orderWeight - b.orderWeight ||
      a.id - b.id,
  );

  let running = customer.opening_balance || 0;
  // Account for any manual adjustments recorded in ledger
  const adjustments = ledger.filter((e) => e.kind === 'adjustment');
  if (adjustments.length > 0 && events.length === 0) {
    running = customer.total_debt;
  }

  const withBalance: CustomerTimelineRow[] = events.map((ev) => {
    running = Math.max(0, running + ev.debtDelta);
    return {
      uid: ev.uid,
      kind: ev.kind,
      id: ev.id,
      reference: ev.reference,
      date: ev.date,
      title: ev.title,
      sign: ev.sign,
      amount: ev.amount,
      balanceAfter: running,
      note: ev.note,
      sale: ev.sale,
      payment: ev.payment,
      items: ev.items,
    };
  });

  return withBalance.reverse();
};

export const normalizePhoneForWhatsApp = (phone?: string): string => {
  if (!phone) return '';
  let digits = phone.replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  // Yemeni local 9-digit mobile numbers (e.g. 77xxxxxxx -> 96777xxxxxxx)
  if (digits.length === 9 && digits.startsWith('7')) {
    digits = `967${digits}`;
  }
  return digits;
};

export const buildWhatsAppDirectUrl = (phone: string | undefined, text: string): string => {
  const digits = normalizePhoneForWhatsApp(phone);
  const encoded = encodeURIComponent(text);
  return digits ? `https://wa.me/${digits}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
};

export const formatCreditInvoiceShareText = (params: {
  storeName: string;
  customerName: string;
  customerTotalDebt: number;
  sale: Sale;
  items: SaleItem[];
}): string => {
  const { storeName, customerName, customerTotalDebt, sale, items } = params;
  const lines = [
    `🧾 *فاتورة ${sale.payment_type === 'آجل' ? 'آجلة' : sale.payment_type} - ${storeName}*`,
    `رقم الفاتورة: #${sale.id}`,
    `التاريخ والوقت: ${sale.created_at}`,
    `العميل: ${customerName}`,
    '--------------------------------',
  ];

  if (items.length > 0) {
    for (const item of items) {
      const name = item.product_name || `صنف #${item.product_id}`;
      if (item.price > 0) {
        lines.push(`• ${name} (${item.qty} × ${formatCurrency(item.price)}) = ${formatCurrency(item.qty * item.price)}`);
      } else {
        lines.push(`• ${name} (الكمية: ${item.qty})`);
      }
    }
    lines.push('--------------------------------');
  }

  lines.push(`💰 *إجمالي الفاتورة:* ${formatCurrency(sale.total_amount)}`);
  if (sale.initial_paid_amount && sale.initial_paid_amount > 0) {
    lines.push(`💵 *المدفوع عند الفاتورة:* ${formatCurrency(sale.initial_paid_amount)}`);
  }
  if (sale.notes && sale.notes.trim()) {
    lines.push(`📝 *ملاحظات:* ${sale.notes.trim()}`);
  }
  lines.push(`📌 *إجمالي المديونية الحالية:* ${formatCurrency(customerTotalDebt)}`);
  lines.push('شكراً لتعاملكم معنا.');
  return lines.join('\n');
};

export const formatPaymentReceiptShareText = (params: {
  storeName: string;
  customerName: string;
  payment: CustomerPayment;
  remainingBalance: number;
}): string => {
  const { storeName, customerName, payment, remainingBalance } = params;
  const lines = [
    `✅ *سند قبض - ${storeName}*`,
    `رقم السند: #${payment.id} (${payment.receipt_number})`,
    `التاريخ والوقت: ${payment.created_at}`,
    `العميل: ${customerName}`,
    '--------------------------------',
    `💵 *المبلغ المستلم:* ${formatCurrency(payment.amount)}`,
    `💳 طريقة الدفع: ${payment.method}`,
  ];
  if (payment.notes && payment.notes.trim()) {
    lines.push(`📝 *ملاحظات:* ${payment.notes.trim()}`);
  }
  lines.push(`📌 *الرصيد المتبقي بعد السداد:* ${formatCurrency(remainingBalance)}`);
  lines.push('نشكر لكم التزامكم وحسن تعاملكم.');
  return lines.join('\n');
};

export const formatStatementShareText = (params: {
  storeName: string;
  customer: Customer;
  salesWithItems: Array<{ sale: Sale; items: SaleItem[] }>;
  payments: CustomerPayment[];
  totalInvoices: number;
  totalPayments: number;
}): string => {
  const { storeName, customer, salesWithItems, payments, totalInvoices, totalPayments } = params;
  const lines = [
    `📋 *كشف حساب العميل: ${customer.name}*`,
    `المتجر: ${storeName}`,
    `رقم الهاتف: ${customer.phone || 'بدون هاتف'}`,
    `💰 *إجمالي المديونية المستحقة:* ${formatCurrency(customer.total_debt)}`,
    '================================',
  ];

  if ((customer.opening_balance || 0) > 0) {
    lines.push(`📌 رصيد افتتاحي (مديونية سابقة): ${formatCurrency(customer.opening_balance || 0)}`);
    lines.push('--------------------------------');
  }

  if (salesWithItems.length > 0) {
    lines.push('الفواتير:');
    for (const { sale, items } of salesWithItems.slice(0, 15)) {
      lines.push(`🧾 فاتورة ${sale.payment_type} #${sale.id} (${sale.created_at})`);
      for (const it of items) {
        const label = it.product_name || 'صنف';
        lines.push(
          it.price > 0
            ? `  • ${label} (${it.qty} × ${formatCurrency(it.price)}) = ${formatCurrency(it.qty * it.price)}`
            : `  • ${label} (الكمية: ${it.qty})`,
        );
      }
      lines.push(`  الإجمالي: ${formatCurrency(sale.total_amount)}${sale.notes ? ` | ملاحظة: ${sale.notes}` : ''}`);
    }
    lines.push('--------------------------------');
  }

  if (payments.length > 0) {
    lines.push('سندات القبض:');
    for (const p of payments.slice(0, 15)) {
      lines.push(`✅ سند #${p.id} (${p.created_at}): ${formatCurrency(p.amount)} (${p.method})${p.notes ? ` - ${p.notes}` : ''}`);
    }
    lines.push('--------------------------------');
  }

  lines.push(`إجمالي الفواتير: ${formatCurrency(totalInvoices)}`);
  lines.push(`إجمالي السدادات: ${formatCurrency(totalPayments)}`);
  lines.push(`*إجمالي الرصيد المتبقي:* ${formatCurrency(customer.total_debt)}`);
  return lines.join('\n');
};
