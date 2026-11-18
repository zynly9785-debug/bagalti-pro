import test from 'node:test';
import assert from 'node:assert/strict';

const data = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => data.get(key) ?? null,
  setItem: (key: string, value: string) => data.set(key, value),
  removeItem: (key: string) => data.delete(key),
};
const { db, convertSaleUnitsToBaseUnits } = await import('./sqlite-simulation.ts');
const base = () => ({ users: [], products: [{ id: 1, store_id: 1, name: 'سكر', barcode: '123', unit_type: 'كيلو', category: 'مواد', cost_price: 100, sale_price: 150, quantity: 10, min_stock: 1, is_active: 1 }], customers: [], sales: [], sale_items: [], returns: [], subscription_packages: [], parked_sales: [] });
const sale = (qty: number) => db.completeSale({ store_id: 1, customer_id: null, total_amount: qty * 150, paid_amount: qty * 150, remaining_amount: 0, payment_type: 'نقداً', items: [{ product_id: 1, product_name: 'سكر', qty, price: 150 }] });

test('فاتورة حرة للعميل تتسجل في الفواتير والدفتر التراكمي', () => {
  db.restoreFromRawState(base() as any);
  const customer = db.insertCustomer(1, 'عميل فاتورة حرة', '770123456', 0, { credit_limit: 50000 });
  const sale = db.insertFreeCustomerInvoice(1, customer.id, { description: 'خدمة توصيل ومواد إضافية', totalAmount: 300, paidAmount: 100, paymentType: 'آجل', date: '2026-11-18' });
  assert.equal(sale.total_amount, 300);
  assert.equal(sale.paid_amount, 100);
  assert.equal(sale.remaining_amount, 200);
  assert.equal(db.getCustomerById(1, customer.id)?.total_debt, 200);
  const ledger = db.getCustomerLedger(1, customer.id);
  assert.equal(ledger.some((entry) => entry.reference === `FREE-${sale.id}` && entry.kind === 'invoice'), true);
  assert.equal(ledger.some((entry) => entry.reference === `FREE-${sale.id}` && entry.kind === 'payment'), true);
});

test('أرشفة الفاتورة تخفيها من النشط دون حذفها من كشف الحساب أو التقارير', () => {
  db.restoreFromRawState(base() as any);
  const customer = db.insertCustomer(1, 'عميل فاتورة مؤرشفة', '770123457');
  const { sale: invoice } = db.completeSale({
    store_id: 1,
    customer_id: customer.id,
    total_amount: 150,
    paid_amount: 0,
    remaining_amount: 150,
    payment_type: 'آجل',
    items: [{ product_id: 1, product_name: 'سكر', qty: 1, price: 150 }],
  });

  db.archiveSale(1, invoice.id);

  assert.equal(db.getActiveSales(1).some((item) => item.id === invoice.id), false);
  assert.equal(db.getArchivedSales(1).some((item) => item.id === invoice.id), true);
  assert.equal(db.getSales(1).some((item) => item.id === invoice.id), true);
  assert.equal(db.getCustomerSales(1, customer.id).some((item) => item.id === invoice.id), true);
});

test('وردية الدرج تربط الفواتير بالمستخدم وتولّد تقرير الإغلاق', () => {
  db.restoreFromRawState(base() as any);
  const shift = db.openDrawerShift(1, 'زين', 500);
  const sale = db.completeSale({ store_id: 1, customer_id: null, total_amount: 300, paid_amount: 300, remaining_amount: 0, payment_type: 'نقداً', items: [{ product_id: 1, product_name: 'سكر', qty: 2, price: 150 }] });
  assert.equal(sale.sale.shift_id, shift.id);
  assert.equal(sale.sale.operator_name, 'زين');
  const report = db.getDrawerShiftReport(1, shift.id);
  assert.equal(report.sales.length, 1);
  assert.equal(report.expectedCash, 800);
  const closed = db.closeDrawerShift(1, 800, 'زين');
  assert.equal(closed.status, 'closed');
  assert.equal(closed.report.shift.operator_name, 'زين');
});

test('يسمح ببيع كمية جزئية ويخصم الرصيد بدقة', () => {
  db.restoreFromRawState(base() as any);
  const result = sale(0.375);
  assert.equal(result.items[0].qty, 0.375);
  assert.equal(db.getProducts(1)[0].quantity, 9.625);
});

test('يسمح باسترجاع جزء من بند فاتورة ثم يمنع تجاوز باقي الكمية', () => {
  db.restoreFromRawState(base() as any);
  const result = sale(3);
  db.returnFromInvoice({ store_id: 1, sale_id: result.sale.id, customer_id: null, product_id: 1, qty: 1, amount: 150 });
  assert.equal(db.getProducts(1)[0].quantity, 8);
  assert.throws(() => db.returnFromInvoice({ store_id: 1, sale_id: result.sale.id, customer_id: null, product_id: 1, qty: 2.01, amount: 301.5 }), /الكمية المتاحة/);
  db.returnFromInvoice({ store_id: 1, sale_id: result.sale.id, customer_id: null, product_id: 1, qty: 2, amount: 300 });
  assert.equal(db.getProducts(1)[0].quantity, 10);
});

test('يرفض البيع فوق رصيد المخزون ولا يغير البيانات', () => {
  db.restoreFromRawState(base() as any);
  assert.throws(() => sale(10.01), /المخزون غير كافٍ/);
  assert.equal(db.getSales(1).length, 0);
  assert.equal(db.getProducts(1)[0].quantity, 10);
});

test('يحوّل 1 كرتون بمعامل 200 إلى 200 حبة ثم يخصم بيع 3 حبات', () => {
  db.restoreFromRawState({ users: [], products: [], customers: [], sales: [], sale_items: [], returns: [], subscription_packages: [], parked_sales: [] } as any);
  const stock = convertSaleUnitsToBaseUnits(1, 10 * 20);
  const product = db.insertProduct({ store_id: 1, name: 'سجائر', barcode: '456', unit_type: 'قطعة', base_unit_name: 'سيجارة', units_per_pack: 20, packs_per_carton: 10, base_units_per_sale_unit: 200, cost_price: 2, sale_price: 3, quantity: stock, min_stock: 1, is_active: 1 });
  assert.equal(product.quantity, 200);
  db.completeSale({ store_id: 1, customer_id: null, total_amount: 9, paid_amount: 9, remaining_amount: 0, payment_type: 'نقداً', items: [{ product_id: product.id, product_name: product.name, qty: 3, price: 3 }] });
  assert.equal(db.getProducts(1)[0].quantity, 197);
});

test('إدارة العميل تحفظ رصيداً افتتاحياً ودفتر حساب وسند قبض بلا تكرار', () => {
  db.restoreFromRawState(base() as any);
  const customer = db.insertCustomer(1, 'عميل اختبار', '770000000', 1000, { credit_limit: 5000, payment_term_days: 30 });
  assert.equal(db.getCustomerById(1, customer.id)?.total_debt, 1000);
  const payment = db.payCustomerDebt(1, customer.id, 400, { method: 'نقداً', idempotencyKey: 'test-payment-1' });
  db.payCustomerDebt(1, customer.id, 400, { method: 'نقداً', idempotencyKey: 'test-payment-1' });
  assert.equal(db.getCustomerPayments(1, customer.id).length, 1);
  assert.equal(db.getCustomerById(1, customer.id)?.total_debt, 600);
  assert.equal(db.getCustomerLedger(1, customer.id).filter((e) => e.kind === 'payment').length, 1);
  assert.equal(payment.receipt_number, 'test-payment-1');
});

test('منع البيع الآجل عند تجاوز الحد الائتماني دون موافقة', () => {
  db.restoreFromRawState(base() as any);
  const customer = db.insertCustomer(1, 'عميل حد ائتماني', '770000001', 900, { credit_limit: 1000 });
  assert.throws(() => db.completeSale({ store_id: 1, customer_id: customer.id, total_amount: 300, paid_amount: 100, remaining_amount: 200, payment_type: 'آجل', items: [{ product_id: 1, product_name: 'سكر', qty: 1, price: 300 }] }), /تجاوز الحد الائتماني/);
});

test('دمج عميلين ينقل الفواتير والسداد ويحتفظ بسجل الدمج', () => {
  db.restoreFromRawState(base() as any);
  const primary = db.insertCustomer(1, 'الحساب الأساسي', '770000002', 100);
  const merged = db.insertCustomer(1, 'الحساب المكرر', '770000003', 200);
  db.payCustomerDebt(1, merged.id, 50, { idempotencyKey: 'merge-payment' });
  const record = db.mergeCustomers(1, primary.id, merged.id, 'تطابق الاسم');
  assert.equal(db.getCustomerById(1, merged.id), null);
  assert.equal(db.getCustomerById(1, primary.id)?.total_debt, 250);
  assert.equal(db.getRawState().customer_merge_records?.length, 1);
  assert.equal(record.primary_customer_id, primary.id);
});

test('المنتج القديم بلا معامل يحتفظ بالكمية ووحدة البيع السابقة', () => {
  db.restoreFromRawState(base() as any);
  const product = db.getProducts(1)[0];
  assert.equal(product.base_units_per_sale_unit, undefined);
  assert.equal(product.quantity, 10);
  assert.equal(convertSaleUnitsToBaseUnits(3, product.base_units_per_sale_unit || 1), 3);
});
