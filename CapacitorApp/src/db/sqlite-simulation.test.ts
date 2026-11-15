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

test('المنتج القديم بلا معامل يحتفظ بالكمية ووحدة البيع السابقة', () => {
  db.restoreFromRawState(base() as any);
  const product = db.getProducts(1)[0];
  assert.equal(product.base_units_per_sale_unit, undefined);
  assert.equal(product.quantity, 10);
  assert.equal(convertSaleUnitsToBaseUnits(3, product.base_units_per_sale_unit || 1), 3);
});
