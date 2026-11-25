import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCustomerTimeline,
  buildWhatsAppDirectUrl,
  computeCustomerDashboardCards,
  filterAndSortCustomers,
  formatCreditInvoiceShareText,
  formatPaymentReceiptShareText,
  getCustomerAccountStatus,
  hasReachedOrExceededCreditLimit,
  normalizePhoneForWhatsApp,
} from './customerLogic.ts';
import type { Customer, CustomerPayment, Sale, SaleItem } from '../types/index.ts';

const mkCustomer = (overrides: Partial<Customer> = {}): Customer => ({
  id: 1,
  store_id: 1,
  name: 'أحمد صالح',
  phone: '770123456',
  total_debt: 0,
  credit_limit: 5000,
  category: 'جديد',
  status: 'active',
  ...overrides,
});

test('getCustomerAccountStatus classifies overdue, credit-limit, soon, suspended, and regular accurately', () => {
  const now = new Date('2026-11-24T10:00:00Z');
  assert.equal(getCustomerAccountStatus(mkCustomer({ total_debt: 1000, next_due_at: '2026-11-20' }), now).label, 'متأخر');
  assert.equal(getCustomerAccountStatus(mkCustomer({ total_debt: 5000, next_due_at: '2026-12-10' }), now).label, 'تجاوز الحد');
  assert.equal(getCustomerAccountStatus(mkCustomer({ total_debt: 1000, next_due_at: '2026-11-28' }), now).label, 'قريب السداد');
  assert.equal(getCustomerAccountStatus(mkCustomer({ total_debt: 1000, category: 'موقوف', status: 'suspended' }), now).label, 'موقوف');
  assert.equal(getCustomerAccountStatus(mkCustomer({ total_debt: 1000, next_due_at: '2026-12-20' }), now).label, 'منتظم');
  assert.equal(hasReachedOrExceededCreditLimit(mkCustomer({ total_debt: 5000, credit_limit: 5000 })), true);
});

test('computeCustomerDashboardCards computes all 6 top stat cards including opening debts and troubled count', () => {
  const now = new Date('2026-11-24T10:00:00Z');
  const customers: Customer[] = [
    mkCustomer({ id: 1, total_debt: 2000, next_due_at: '2026-11-20' }), // overdue
    mkCustomer({ id: 2, total_debt: 1500, next_due_at: '2026-11-27' }), // soon
    mkCustomer({ id: 3, total_debt: 6000, credit_limit: 5000, next_due_at: '2026-12-25' }), // over limit
    mkCustomer({ id: 4, total_debt: 500, status: 'archived' }), // archived excluded
  ];
  const payments: CustomerPayment[] = [
    { id: 1, store_id: 1, customer_id: 1, amount: 400, method: 'نقداً', created_at: '2026-11-22', receipt_number: 'R1' },
  ];
  const stats = computeCustomerDashboardCards(customers, payments, now);
  assert.equal(stats.totalCustomers, 3);
  assert.equal(stats.totalDebt, 9500);
  assert.equal(stats.overdueDebt, 2000);
  assert.equal(stats.soonDebt, 1500);
  assert.equal(stats.collected, 400);
  assert.equal(stats.troubledCount, 2);
});

test('filterAndSortCustomers supports suspended filter, invoice-number search, and all sort orders', () => {
  const now = new Date('2026-11-24T10:00:00Z');
  const customers: Customer[] = [
    mkCustomer({ id: 1, name: 'بدر', total_debt: 1000, next_due_at: '2026-12-05' }),
    mkCustomer({ id: 2, name: 'أحمد', total_debt: 3000, category: 'موقوف', status: 'suspended' }),
    mkCustomer({ id: 3, name: 'سعيد', total_debt: 0 }),
  ];
  const salesByCustomer = new Map<number, Sale[]>([
    [1, [{ id: 555, store_id: 1, customer_id: 1, total_amount: 1000, paid_amount: 0, remaining_amount: 1000, payment_type: 'آجل', created_at: '2026-11-24 10:00:00' }]],
  ]);
  const paymentsByCustomer = new Map<number, CustomerPayment[]>();

  assert.deepEqual(
    filterAndSortCustomers(customers, { query: '', filter: 'suspended', sort: 'debt_desc', salesByCustomer, paymentsByCustomer, now }).map((c) => c.id),
    [2],
  );
  assert.deepEqual(
    filterAndSortCustomers(customers, { query: '555', filter: 'all', sort: 'debt_desc', salesByCustomer, paymentsByCustomer, now }).map((c) => c.id),
    [1],
  );
  assert.deepEqual(
    filterAndSortCustomers(customers, { query: '', filter: 'all', sort: 'debt_asc', salesByCustomer, paymentsByCustomer, now }).map((c) => c.id),
    [3, 1, 2],
  );
  assert.deepEqual(
    filterAndSortCustomers(customers, { query: '', filter: 'all', sort: 'name', salesByCustomer, paymentsByCustomer, now }).map((c) => c.id),
    [2, 1, 3],
  );
});

test('buildCustomerTimeline tracks opening debt and accurate balanceAfter across credit invoice and payment', () => {
  const customer = mkCustomer({ opening_balance: 500, total_debt: 700 });
  const sales: Sale[] = [
    {
      id: 101,
      store_id: 1,
      customer_id: 1,
      total_amount: 400,
      paid_amount: 200, // mutated later by payCustomerDebt
      initial_paid_amount: 0,
      remaining_amount: 200,
      payment_type: 'آجل',
      created_at: '2026-11-24 09:00:00',
    },
  ];
  const payments: CustomerPayment[] = [
    { id: 1, store_id: 1, customer_id: 1, amount: 200, method: 'نقداً', created_at: '2026-11-24 11:00:00', receipt_number: 'RCPT-1' },
  ];
  const itemsMap = new Map<number, SaleItem[]>([
    [101, [{ id: 1, sale_id: 101, product_id: 0, product_name: 'أرز بسمتي', qty: 1, price: 400 }]],
  ]);
  const timeline = buildCustomerTimeline(customer, sales, payments, itemsMap);
  assert.equal(timeline.length, 2);
  // Newest first: payment first, then invoice
  assert.equal(timeline[0].kind, 'payment');
  assert.equal(timeline[0].balanceAfter, 700);
  assert.equal(timeline[1].kind, 'invoice');
  assert.equal(timeline[1].balanceAfter, 900);
});

test('normalizePhoneForWhatsApp & share formatters target customer phone directly and include notes & debt', () => {
  assert.equal(normalizePhoneForWhatsApp('770123456'), '967770123456');
  const url = buildWhatsAppDirectUrl('770123456', 'مرحبا');
  assert.equal(url.startsWith('https://wa.me/967770123456?text='), true);

  const invoiceText = formatCreditInvoiceShareText({
    storeName: 'بقالة النور',
    customerName: 'علي',
    customerTotalDebt: 1500,
    sale: { id: 12, store_id: 1, customer_id: 1, total_amount: 500, paid_amount: 0, remaining_amount: 500, payment_type: 'آجل', notes: 'تسليم المساء', created_at: '2026-11-24 12:00:00' },
    items: [{ id: 1, sale_id: 12, product_id: 0, product_name: 'سكر', qty: 2, price: 250 }],
  });
  assert.match(invoiceText, /تسليم المساء/);
  assert.match(invoiceText, /سكر/);

  const receiptText = formatPaymentReceiptShareText({
    storeName: 'بقالة النور',
    customerName: 'علي',
    payment: { id: 4, store_id: 1, customer_id: 1, amount: 300, method: 'نقداً', created_at: '2026-11-24 13:00:00', receipt_number: 'R-4', notes: 'دفعة أولى' },
    remainingBalance: 1200,
  });
  assert.match(receiptText, /دفعة أولى/);
  assert.match(receiptText, /سند قبض/);
});
