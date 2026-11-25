import test from 'node:test';
import assert from 'node:assert/strict';

const data = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => data.get(key) ?? null,
  setItem: (key: string, value: string) => data.set(key, value),
  removeItem: (key: string) => data.delete(key),
};
const { db, convertSaleUnitsToBaseUnits } = await import('./sqlite-simulation.ts');
const { serializeDatabaseState } = await import('./NativeSqliteStore.ts');
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

test('الفاتورة الحرة تضيف كامل المبلغ إلى رصيد العميل وتسجل الملاحظة دون تكرار', () => {
  db.restoreFromRawState(base() as any);
  const customer = db.insertCustomer(1, 'عميل فاتورة يدوية', '770123458', 0);
  const invoice = { description: 'مشتريات يدوية على الحساب', totalAmount: 450, date: '2026-11-18', idempotencyKey: 'free-invoice-1' };
  const first = db.insertFreeCustomerInvoice(1, customer.id, invoice);
  const repeated = db.insertFreeCustomerInvoice(1, customer.id, invoice);

  assert.equal(first.id, repeated.id);
  assert.equal(first.notes, invoice.description);
  assert.equal(db.getCustomerById(1, customer.id)?.total_debt, 450);
  assert.equal(db.getCustomerSales(1, customer.id).length, 1);
});

test('SQLite يحفظ كل مجموعات البيانات المالية والمخزون كسجلات محلية', () => {
  const rows = serializeDatabaseState({
    users: [{ id: 1 }],
    products: [{ id: 2, store_id: 1 }],
    customers: [{ id: 3, store_id: 1 }],
    sales: [{ id: 4, store_id: 1 }],
    sale_items: [{ id: 5, sale_id: 4 }],
    returns: [{ id: 6, store_id: 1 }],
    expenses: [{ id: 7, store_id: 1 }],
    subscription_packages: [{ id: 8 }],
    parked_sales: [{ id: 'parked-9', store_id: 1 }],
    quick_products: [{ product_id: 2, store_id: 1 }],
    customer_payments: [{ id: 10, store_id: 1 }],
    customer_ledger: [{ id: 11, store_id: 1 }],
    customer_payment_plans: [{ id: 12, store_id: 1 }],
    customer_communications: [{ id: 13, store_id: 1 }],
    customer_merge_records: [{ id: 14, store_id: 1 }],
    drawer_shifts: [{ id: 15, store_id: 1 }],
  });

  assert.deepEqual(
    [...new Set(rows.map((row) => row.entity))].sort(),
    ['customer_communications', 'customer_ledger', 'customer_merge_records', 'customer_payment_plans', 'customer_payments', 'customers', 'drawer_shifts', 'expenses', 'parked_sales', 'products', 'quick_products', 'returns', 'sale_items', 'sales', 'subscription_packages', 'users'].sort(),
  );
  assert.equal(rows.find((row) => row.entity === 'customer_payments')?.record_id, '10');
  assert.equal(rows.find((row) => row.entity === 'sale_items')?.store_id, 1);
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

test('فاتورة آجلة يدوية مكتفية بذاتها تقبل أصنافاً غير موجودة بالمخزون وإجمالياً يدوياً وملاحظة', () => {
  db.restoreFromRawState(base() as any);
  const created = db.insertManualCreditInvoice(1, {
    customerName: 'زبون جديد يدوي',
    items: [
      { product_name: 'خبز صامولي', qty: 2 },
      { product_name: 'جبن مثلثات', qty: 1 },
    ],
    totalAmount: 750,
    notes: 'تسليم صباحي',
    idempotencyKey: 'manual-1',
  });
  assert.equal(created.customer.name, 'زبون جديد يدوي');
  assert.equal(created.customer.total_debt, 750);
  assert.equal(created.sale.notes, 'تسليم صباحي');
  assert.equal(created.items.length, 2);
  assert.equal(db.getSaleItems(created.sale.id).length, 2);
  // Idempotent repeat does not duplicate
  const repeat = db.insertManualCreditInvoice(1, {
    customerName: 'زبون جديد يدوي',
    items: [{ product_name: 'خبز صامولي', qty: 2 }],
    totalAmount: 750,
    idempotencyKey: 'manual-1',
  });
  assert.equal(repeat.sale.id, created.sale.id);
  assert.equal(db.getCustomerById(1, created.customer.id)?.total_debt, 750);
});

test('إخراج العميل من الموقوفين والسماح بمواصلة البيع الآجل عند الحد الائتماني', () => {
  db.restoreFromRawState(base() as any);
  const cust = db.insertCustomer(1, 'عميل موقوف', '771111111', 1000, { credit_limit: 1000, category: 'موقوف' });
  assert.equal(cust.status, 'suspended');
  assert.throws(() => db.insertManualCreditInvoice(1, {
    customerId: cust.id,
    items: [{ product_name: 'شاي', qty: 1, price: 200 }],
  }), /موقوف/);

  db.releaseSuspendedCustomer(1, cust.id);
  assert.equal(db.getCustomerById(1, cust.id)?.status, 'active');

  // Now blocked by credit limit (1000 >= 1000) unless credit override is enabled
  assert.throws(() => db.insertManualCreditInvoice(1, {
    customerId: cust.id,
    items: [{ product_name: 'شاي', qty: 1, price: 200 }],
  }), /الحد الائتماني/);

  db.setCustomerCreditOverride(1, cust.id, true);
  const res = db.insertManualCreditInvoice(1, {
    customerId: cust.id,
    items: [{ product_name: 'شاي', qty: 1, price: 200 }],
  });
  assert.equal(res.customer.total_debt, 1200);
});

test('طابور الإرسال المحلي يحفظ الرسائل غير المرسلة ويحدّث حالتها', () => {
  db.restoreFromRawState(base() as any);
  const entry = db.enqueueShareOutbox(1, {
    customer_id: 1,
    customer_name: 'علي',
    customer_phone: '770123456',
    title: 'فاتورة #101',
    message_text: 'تفاصيل الفاتورة',
    channel: 'whatsapp',
    status: 'pending',
  });
  assert.equal(db.getShareOutbox(1).length, 1);
  assert.equal(db.getShareOutbox(1)[0].status, 'pending');
  db.updateShareOutboxStatus(1, entry.id, 'sent');
  assert.equal(db.getShareOutbox(1)[0].status, 'sent');
});

test('تحديث بيانات المتجر يحفظ ويعمل حتى عند عدم وجود سجل محلي مسبق', () => {
  db.restoreFromRawState(base() as any);
  db.updateUserProfile(1, { store_name: 'بقالة الخير المحدثة', governorate: 'صنعاء', district: 'السبعين', neighborhood: 'حدة', phone: '777123456' });
  const saved = db.findUserById(1);
  assert.equal(saved?.store_name, 'بقالة الخير المحدثة');
  assert.equal(saved?.governorate, 'صنعاء');
  assert.equal(saved?.phone, '777123456');
});

test('تسجيل المتجر يرفض الاسم غير الرباعي أو الخماسي ويقبل الرباعي والخماسي', () => {
  db.restoreFromRawState(base() as any);
  assert.throws(() => db.registerUser({
    store_name: 'بقالة',
    owner_name: 'أحمد محمد',
    phone: '770001112',
    password: '',
    governorate: 'صنعاء',
    district: 'السبعين',
    neighborhood: 'حدة',
    pin_code: '1234',
  }), /الرباعي أو الخماسي/);

  const created = db.registerUser({
    store_name: 'بقالة السلام',
    owner_name: 'أحمد محمد علي صالح',
    phone: '770001113',
    password: '',
    governorate: 'صنعاء',
    district: 'السبعين',
    neighborhood: 'حدة',
    pin_code: '1234',
  });
  assert.equal(created.owner_name, 'أحمد محمد علي صالح');
  assert.ok(typeof created.subscription_start === 'number');
});

test('إيقاف أو انتهاء الاشتراك يقيّد عمليات المتجر دون المساس بشاشة العملاء والديون وتُعاد الصلاحيات فور التفعيل', () => {
  db.restoreFromRawState(base() as any);
  const user = db.registerUser({
    store_name: 'بقالة التقييد',
    owner_name: 'خالد عبد الله يحيى المعمري',
    phone: '771234000',
    password: '',
    governorate: 'صنعاء',
    district: 'التحرير',
    neighborhood: 'المركز',
    pin_code: '1234',
  });
  db.suspendStore(user.id, 'مراجعة إدارية');

  assert.throws(() => db.insertProduct({
    store_id: user.id, name: 'صنف', barcode: '999', unit_type: 'قطعة', cost_price: 10, sale_price: 20, quantity: 5, min_stock: 1, is_active: 1,
  }), /إيقاف/);
  assert.throws(() => db.insertExpense({
    store_id: user.id, category: 'إيجار', amount: 1000, date: '2026-11-24', payment_method: 'نقداً',
  }), /إيقاف/);
  assert.throws(() => db.insertFreePosInvoice(user.id, {
    details: 'فاتورة حرة', amount: 100, paymentType: 'نقداً',
  }), /إيقاف/);

  // Customers & Debt must remain completely unaffected!
  const cust = db.insertCustomer(user.id, 'عميل ديون غير مقيد', '779990001', 500);
  assert.equal(cust.total_debt, 500);
  db.payCustomerDebt(user.id, cust.id, 100);
  assert.equal(db.getCustomerById(user.id, cust.id)?.total_debt, 400);

  // Unsuspend restores full permissions immediately
  db.unsuspendStore(user.id);
  const p = db.insertProduct({
    store_id: user.id, name: 'صنف مفعّل', barcode: '998', unit_type: 'قطعة', cost_price: 10, sale_price: 20, quantity: 5, min_stock: 1, is_active: 1,
  });
  assert.equal(p.name, 'صنف مفعّل');
});

test('تقارير إغلاق الدرج تُحفظ كنسخة ثابتة وإشعارات المالك معزولة لكل متجر', () => {
  db.restoreFromRawState(base() as any);
  const u1 = db.registerUser({ store_name: 'متجر 1', owner_name: 'سعيد علي محمد صالح', phone: '770111222', password: '', governorate: 'صنعاء', district: '1', neighborhood: '1', pin_code: '1111' });
  const u2 = db.registerUser({ store_name: 'متجر 2', owner_name: 'فهد علي محمد صالح', phone: '770111333', password: '', governorate: 'عدن', district: '2', neighborhood: '2', pin_code: '2222' });

  db.sendStoreNotification(u1.id, { title: 'تنبيه خاص', message: 'رسالة خاصة لمتجر 1 فقط', kind: 'message' });
  assert.equal(db.getStoreNotifications(u1.id).length, 1);
  assert.equal(db.getStoreNotifications(u2.id).length, 0);

  db.openDrawerShift(u1.id, 'سعيد', 1000);
  const freeCash = db.insertFreePosInvoice(u1.id, { details: 'بضاعة متنوعة', amount: 250, paymentType: 'نقداً' });
  assert.equal(freeCash.sale.payment_type, 'نقداً');
  const closed = db.closeDrawerShift(u1.id, 1250, 'سعيد');
  assert.equal(closed.snapshot.is_immutable, true);
  assert.equal(closed.snapshot.expected_cash, 1250);
  assert.equal(db.getDrawerCloseReports(u1.id).length, 1);

  db.deleteLocalAccountAndLogout(u1.id);
  assert.equal(db.findUserById(u1.id), null);
  assert.notEqual(db.findUserById(u2.id), null);
});

test('upsertCloudNotifications يدمج رسائل الإدارة دون تكرار ويحافظ على حالة القراءة لكل متجر', () => {
  const u1 = db.registerUser({
    store_name: 'بقالة السحاب 1',
    owner_name: 'محمد صالح علي حسن',
    phone: '777400001',
    password: '123',
    governorate: 'صنعاء',
    district: 'السبعين',
    neighborhood: 'حدة',
    pin_code: '1234',
  });
  const u2 = db.registerUser({
    store_name: 'بقالة السحاب 2',
    owner_name: 'خالد صالح علي حسن',
    phone: '777400002',
    password: '123',
    governorate: 'صنعاء',
    district: 'السبعين',
    neighborhood: 'حدة',
    pin_code: '1234',
  });

  const first = db.upsertCloudNotifications(u1.id, [
    {
      cloud_id: 'cloud-msg-1',
      cloud_store_id: 'store-uuid-1',
      title: 'رسالة من إدارة بقالتي برو',
      message: 'مرحباً بكم في المتجر السحابي',
      kind: 'message',
      sender: 'إدارة بقالتي برو',
      created_at: '2026-11-25T10:00:00.000Z',
      read_at: null,
    },
  ]);
  assert.equal(first.length, 1);
  assert.equal(db.getStoreNotifications(u2.id).length, 0);

  const marked = db.markStoreNotificationRead(u1.id, first[0].id);
  assert.ok(marked?.read_at);

  // Re-syncing the same cloud_id with read_at: null from server must not duplicate or lose local read_at
  const resynced = db.upsertCloudNotifications(u1.id, [
    {
      cloud_id: 'cloud-msg-1',
      cloud_store_id: 'store-uuid-1',
      title: 'رسالة من إدارة بقالتي برو',
      message: 'مرحباً بكم في المتجر السحابي',
      kind: 'message',
      sender: 'إدارة بقالتي برو',
      created_at: '2026-11-25T10:00:00.000Z',
      read_at: null,
    },
  ]);
  assert.equal(resynced.length, 1);
  assert.ok(resynced[0].read_at);
});

test('sendBroadcastNotification يرسل الرسالة لجميع المتاجر المسجلة و markAllStoreNotificationsRead يقرأ متجراً واحداً فقط', () => {
  db.restoreFromRawState(base() as any);
  assert.throws(
    () => db.sendBroadcastNotification({ title: 'إعلان', message: 'نص' }),
    /لا توجد متاجر/,
  );

  const u1 = db.registerUser({
    store_name: 'بقالة البث 1',
    owner_name: 'أحمد صالح علي حسن',
    phone: '777500001',
    password: '123',
    governorate: 'صنعاء',
    district: 'السبعين',
    neighborhood: 'حدة',
    pin_code: '1234',
  });
  const u2 = db.registerUser({
    store_name: 'بقالة البث 2',
    owner_name: 'ناصر صالح علي حسن',
    phone: '777500002',
    password: '123',
    governorate: 'عدن',
    district: 'خور مكسر',
    neighborhood: 'المركز',
    pin_code: '1234',
  });

  assert.throws(
    () => db.sendBroadcastNotification({ title: '  ', message: 'نص' }),
    /مطلوبان/,
  );

  const sentCount = db.sendBroadcastNotification({
    title: 'تحديث جماعي',
    message: 'مرحباً بكل مستخدمي بقالتي برو',
    kind: 'message',
    sender: 'إدارة بقالتي برو',
  });
  assert.equal(sentCount, 2);
  assert.equal(db.getStoreNotifications(u1.id).length, 1);
  assert.equal(db.getStoreNotifications(u2.id).length, 1);
  assert.equal(db.getStoreNotifications(u1.id)[0].title, 'تحديث جماعي');
  assert.equal(db.getStoreNotifications(u2.id)[0].read_at, null);

  // Add a second unread message for u1 then mark all read only for u1
  db.sendStoreNotification(u1.id, { title: 'تنبيه إضافي', message: 'رسالة ثانية' });
  const updatedU1 = db.markAllStoreNotificationsRead(u1.id);
  assert.equal(updatedU1.length, 2);
  assert.equal(updatedU1.every((n) => Boolean(n.read_at)), true);
  assert.equal(db.getStoreNotifications(u2.id)[0].read_at, null);
});


