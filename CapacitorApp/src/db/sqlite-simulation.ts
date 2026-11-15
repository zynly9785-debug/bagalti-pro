/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capacitor } from '@capacitor/core';
import { User, Product, Customer, Sale, SaleItem, ReturnItem, SubscriptionPackage, SharedPreferences, ParkedSale, Expense } from '../types/index.ts';
import { calculateZReportBreakdown } from '../utils/pureLogic.ts';
import { NativeSqliteStore } from './NativeSqliteStore.ts';

const STORAGE_KEY = 'grocery_pos_sqlite_db_clean_prod_v1';
const PREFS_KEY = 'grocery_pos_shared_prefs_clean_prod_v1';

/** Convert a entered package count to the canonical quantity stored in base units. */
export const convertSaleUnitsToBaseUnits = (quantity: number, factor: number): number => {
  if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(factor) || factor <= 0) {
    throw new Error('كمية أو معامل تحويل غير صالح');
  }
  return quantity * factor;
};

export interface DatabaseState {
  users: User[];
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  sale_items: SaleItem[];
  returns: ReturnItem[];
  subscription_packages: SubscriptionPackage[];
  parked_sales?: ParkedSale[];
  expenses?: Expense[];
  quick_products?: { store_id: number; product_id: number; sync_id?: string }[];
}

// الباقات والأسعار ينشئها مالك التطبيق؛ لا توجد بيانات افتراضية تجريبية.
const INITIAL_PACKAGES: SubscriptionPackage[] = [];

// قاعدة بيانات إنتاجية نظيفة تماماً بدون أي بيانات تجريبية وهمية
const INITIAL_USERS: User[] = [];
const INITIAL_PRODUCTS: Product[] = [];
const INITIAL_CUSTOMERS: Customer[] = [];
const INITIAL_SALES: Sale[] = [];
const INITIAL_SALE_ITEMS: SaleItem[] = [];
const INITIAL_RETURNS: ReturnItem[] = [];

class SQLiteDatabaseHelper {
  private state: DatabaseState;
  private readonly nativeStore = new NativeSqliteStore();
  private sharedPreferences: SharedPreferences;

  constructor() {
    this.state = this.loadState();
    this.sharedPreferences = this.loadSharedPreferencesFromLegacyStorage();
  }

  /** Initialize encrypted native SQLite, migrating the previous local snapshot once. */
  public async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    await this.nativeStore.open();
    const persistedState = await this.nativeStore.loadState<DatabaseState>();
    if (persistedState) {
      this.state = this.normalizeState(persistedState);
      if (persistedState.users?.some((user) => Boolean(user.password))) {
        await this.nativeStore.replaceState(this.state);
      }
    } else {
      const legacy = localStorage.getItem(STORAGE_KEY);
      if (legacy) {
        try { this.state = this.normalizeState(JSON.parse(legacy)); } catch { /* Keep safe empty state. */ }
      }
      await this.nativeStore.replaceState(this.state);
    }
    const persistedPreferences = await this.nativeStore.loadPreferences<SharedPreferences>();
    if (persistedPreferences) {
      this.sharedPreferences = { ...this.defaultPreferences(), ...persistedPreferences };
    } else {
      this.nativeStore.savePreferences(this.sharedPreferences);
    }
    await this.nativeStore.flush();
    if (this.nativeStore.error) throw new Error(this.nativeStore.error);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PREFS_KEY);
  }

  private defaultPreferences(): SharedPreferences {
    return { user_id: null, store_id: null, status: 'active', is_suspended_flag: false, biometric_enabled: false };
  }

  private normalizeState(value: Partial<DatabaseState>): DatabaseState {
    const parsed = value || {};
    return {
      // Supabase is the credential authority; never retain merchant passwords in app state.
      users: (parsed.users || []).map((user) => ({ ...user, password: '' })),
      products: (parsed.products || []).map((product) => ({
        ...product,
        base_units_per_sale_unit: Number.isFinite(product.base_units_per_sale_unit) && (product.base_units_per_sale_unit || 0) > 0
          ? product.base_units_per_sale_unit : 1,
      })),
      customers: parsed.customers || [],
      sales: parsed.sales || [],
      sale_items: parsed.sale_items || [],
      returns: parsed.returns || [],
      subscription_packages: parsed.subscription_packages || [],
      parked_sales: parsed.parked_sales || [],
      expenses: parsed.expenses || [],
      quick_products: parsed.quick_products || [],
    };
  }

  private loadState(): DatabaseState {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.subscription_packages) {
          parsed.subscription_packages = INITIAL_PACKAGES;
        }
        // Old records have no package factor; keep their historical quantities unchanged.
        parsed.products = (parsed.products || []).map((product: Product) => ({
          ...product,
          base_units_per_sale_unit: Number.isFinite(product.base_units_per_sale_unit) && product.base_units_per_sale_unit! > 0
            ? product.base_units_per_sale_unit : 1,
        }));
        const normalized = this.normalizeState(parsed);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        return normalized;
      }
    } catch {
      // fallback
    }
    const defaultState: DatabaseState = {
      users: INITIAL_USERS,
      products: INITIAL_PRODUCTS,
      customers: INITIAL_CUSTOMERS,
      sales: INITIAL_SALES,
      sale_items: INITIAL_SALE_ITEMS,
      returns: INITIAL_RETURNS,
      subscription_packages: INITIAL_PACKAGES,
      parked_sales: [],
      expenses: [],
      quick_products: [],
    };
    this.persist(defaultState);
    return defaultState;
  }

  private persist(state: DatabaseState) {
    const previous = this.state as DatabaseState | undefined;
    const syncCollections = ['products', 'customers', 'sales', 'sale_items', 'returns', 'expenses', 'quick_products'] as const;
    const timestamp = new Date().toISOString();
    for (const collection of syncCollections) {
      const nextRows = (state[collection] || []) as Array<Record<string, unknown>>;
      const oldRows = ((previous?.[collection] as unknown[]) || []) as Array<Record<string, unknown>>;
      const oldById = new Map(oldRows.map((row) => [String(row.sync_id || row.id || ''), row]));
      for (const row of nextRows) {
        const key = String(row.sync_id || row.id || '');
        const oldRow = oldById.get(key);
        if (!oldRow) {
          row._sync_updated_at = row._sync_updated_at || timestamp;
          continue;
        }
        const withoutTimestamp = (value: Record<string, unknown>) => {
          const copy = { ...value };
          delete copy._sync_updated_at;
          return JSON.stringify(copy);
        };
        if (withoutTimestamp(row) !== withoutTimestamp(oldRow)) {
          const oldTime = Date.parse(String(oldRow._sync_updated_at || '')) || 0;
          row._sync_updated_at = new Date(Math.max(Date.now(), oldTime + 1)).toISOString();
        } else {
          row._sync_updated_at = oldRow._sync_updated_at || row._sync_updated_at;
        }
      }
    }
    this.state = state;
    try {
      if (Capacitor.isNativePlatform() && this.nativeStore.isOpen) {
        this.nativeStore.saveStateDelta(previous, state);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
    } catch {
      // ignore
    }
  }

  public resetToDefaults() {
    const defaultState: DatabaseState = {
      users: JSON.parse(JSON.stringify(INITIAL_USERS)),
      products: JSON.parse(JSON.stringify(INITIAL_PRODUCTS)),
      customers: JSON.parse(JSON.stringify(INITIAL_CUSTOMERS)),
      sales: JSON.parse(JSON.stringify(INITIAL_SALES)),
      sale_items: JSON.parse(JSON.stringify(INITIAL_SALE_ITEMS)),
      returns: [],
      subscription_packages: [],
      parked_sales: [],
      expenses: [],
      quick_products: [],
    };
    this.persist(defaultState);
    return defaultState;
  }

  public getRawState(): DatabaseState {
    return this.state;
  }

  public restoreFromRawState(newState: DatabaseState) {
    this.persist(newState);
  }

  // --- SharedPreferences helper ---
  public getSharedPreferences(): SharedPreferences {
    return this.sharedPreferences;
  }

  private loadSharedPreferencesFromLegacyStorage(): SharedPreferences {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) return { ...this.defaultPreferences(), ...JSON.parse(raw) };
    } catch {
      // ignore
    }
    return this.defaultPreferences();
  }

  public saveSharedPreferences(prefs: Partial<SharedPreferences>) {
    const before = this.sharedPreferences;
    const updated = { ...before, ...prefs };
    const preferenceKeys: (keyof SharedPreferences)[] = ['currency_symbol', 'receipt_footer', 'receipt_width_mm', 'low_stock_alerts_enabled'];
    const preferencesChanged = preferenceKeys.some((key) => Object.prototype.hasOwnProperty.call(prefs, key) && before[key] !== updated[key]);
    if (preferencesChanged) updated.store_preferences_updated_at = new Date().toISOString();
    this.sharedPreferences = updated;
    try {
      if (Capacitor.isNativePlatform() && this.nativeStore.isOpen) {
        this.nativeStore.savePreferences(updated);
      } else {
        localStorage.setItem(PREFS_KEY, JSON.stringify(updated));
      }
    } catch {
      // ignore
    }
    return updated;
  }

  // --- Users Table operations ---
  public findUserById(id: number): User | null {
    return this.state.users.find((u) => u.id === id) || null;
  }

  public findUserByPhone(phone: string): User | null {
    const trimmedPhone = phone.trim();
    return this.state.users.find((u) => u.phone === trimmedPhone) || null;
  }

  public isPhoneRegistered(phone: string): boolean {
    const trimmed = phone.trim();
    return this.state.users.some((u) => u.phone === trimmed);
  }

  public registerUser(userData: Omit<User, 'id' | 'subscription_end' | 'role' | 'status' | 'suspension_reason'>): User {
    const newId = this.state.users.length ? Math.max(...this.state.users.map((u) => u.id)) + 1 : 1;
    const subscription_end = Date.now() + 60 * 24 * 60 * 60 * 1000; // 60 days
    const newUser: User = {
      ...userData,
      id: newId,
      subscription_end,
      role: 'merchant',
      status: 'active',
      suspension_reason: null,
    };
    const updatedUsers = [...this.state.users, newUser];
    this.persist({ ...this.state, users: updatedUsers });
    return newUser;
  }

  public updateUserProfile(userId: number, updates: Partial<User>) {
    const updatedUsers = this.state.users.map((u) => (u.id === userId ? { ...u, ...updates } : u));
    this.persist({ ...this.state, users: updatedUsers });
  }

  // --- Products Table operations (Enforcing WHERE store_id = ?) ---
  public getProducts(store_id: number, includeInactive = false): Product[] {
    return this.state.products.filter(
      (p) => p.store_id === store_id && (includeInactive ? true : p.is_active === 1)
    );
  }

  public getProductByBarcode(store_id: number, barcode: string): Product | null {
    const trimmed = barcode.trim();
    return (
      this.state.products.find(
        (p) => p.store_id === store_id && p.barcode === trimmed && p.is_active === 1
      ) || null
    );
  }

  public searchProducts(store_id: number, query: string): Product[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.getProducts(store_id);
    return this.state.products.filter(
      (p) =>
        p.store_id === store_id &&
        p.is_active === 1 &&
        (p.name.toLowerCase().includes(q) || p.barcode.includes(q))
    );
  }

  public insertProduct(data: Omit<Product, 'id'>): Product {
    const newId = this.state.products.length ? Math.max(...this.state.products.map((p) => p.id)) + 1 : 1;
    const factor = Number.isFinite(data.base_units_per_sale_unit) && (data.base_units_per_sale_unit || 0) > 0
      ? data.base_units_per_sale_unit! : 1;
    const newProd: Product = { ...data, base_units_per_sale_unit: factor, id: newId };
    const updated = [...this.state.products, newProd];
    this.persist({ ...this.state, products: updated });
    return newProd;
  }

  public updateProduct(store_id: number, productId: number, updates: Partial<Product>) {
    const updated = this.state.products.map((p) => {
      if (p.id === productId && p.store_id === store_id) {
        return { ...p, ...updates };
      }
      return p;
    });
    this.persist({ ...this.state, products: updated });
  }

  public softDeleteProduct(store_id: number, productId: number) {
    this.updateProduct(store_id, productId, { is_active: 0 });
  }

  public getQuickProducts(store_id: number): Product[] {
    let ids: number[];
    if (Capacitor.isNativePlatform() && this.nativeStore.isOpen) {
      ids = (this.state.quick_products || []).filter((entry) => entry.store_id === store_id).map((entry) => entry.product_id);
    } else {
      try { ids = JSON.parse(localStorage.getItem(`bagalti_quick_${store_id}`) || '[]'); } catch { ids = []; }
    }
    return ids.map((id) => this.state.products.find((product) => product.id === id && product.store_id === store_id && product.is_active === 1)).filter((product): product is Product => !!product);
  }
  public toggleQuickProduct(store_id: number, productId: number) {
    const ids = (Capacitor.isNativePlatform() && this.nativeStore.isOpen)
      ? (this.state.quick_products || []).filter((entry) => entry.store_id === store_id).map((entry) => entry.product_id)
      : JSON.parse(localStorage.getItem(`bagalti_quick_${store_id}`) || '[]') as number[];
    const next = ids.includes(productId) ? ids.filter(id => id !== productId) : [...ids, productId];
    if (Capacitor.isNativePlatform() && this.nativeStore.isOpen) {
      const otherStores = (this.state.quick_products || []).filter((entry) => entry.store_id !== store_id);
      this.persist({ ...this.state, quick_products: [...otherStores, ...next.map((id) => ({ store_id, product_id: id }))] });
    } else {
      localStorage.setItem(`bagalti_quick_${store_id}`, JSON.stringify(next));
    }
    return this.getQuickProducts(store_id);
  }

  // --- Customers Table operations (Enforcing WHERE store_id = ?) ---
  public getCustomers(store_id: number): Customer[] {
    return this.state.customers.filter((c) => c.store_id === store_id);
  }

  public getCustomerById(store_id: number, customerId: number): Customer | null {
    return this.state.customers.find((c) => c.store_id === store_id && c.id === customerId) || null;
  }

  public searchCustomers(store_id: number, query: string): Customer[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.getCustomers(store_id);
    return this.state.customers.filter(
      (c) =>
        c.store_id === store_id &&
        (c.name.toLowerCase().includes(q) || c.phone.includes(q))
    );
  }

  public insertCustomer(store_id: number, name: string, phone: string, initialDebt = 0): Customer {
    const newId = this.state.customers.length ? Math.max(...this.state.customers.map((c) => c.id)) + 1 : 1;
    const newCust: Customer = {
      id: newId,
      store_id,
      name,
      phone,
      total_debt: initialDebt,
    };
    const updated = [...this.state.customers, newCust];
    this.persist({ ...this.state, customers: updated });
    return newCust;
  }

  public updateCustomerDebt(store_id: number, customerId: number, deltaDebt: number) {
    const updated = this.state.customers.map((c) => {
      if (c.id === customerId && c.store_id === store_id) {
        const nextDebt = Math.max(0, c.total_debt + deltaDebt);
        return { ...c, total_debt: nextDebt };
      }
      return c;
    });
    this.persist({ ...this.state, customers: updated });
  }

  public payCustomerDebt(store_id: number, customerId: number, amount: number) {
    this.updateCustomerDebt(store_id, customerId, -amount);
  }

  // --- Store expense records ---
  public getExpenses(store_id: number): Expense[] {
    return (this.state.expenses || []).filter((expense) => expense.store_id === store_id).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  }

  public insertExpense(data: Omit<Expense, 'id' | 'created_at'>): Expense {
    if (!Number.isFinite(data.amount) || data.amount <= 0 || !data.category.trim() || !data.date) throw new Error('أدخل تصنيفاً ومبلغاً وتاريخاً صحيحاً للمصروف');
    const records = this.state.expenses || [];
    const id = records.length ? Math.max(...records.map((expense) => expense.id)) + 1 : 1;
    const record: Expense = { ...data, id, created_at: new Date().toISOString() };
    this.persist({ ...this.state, expenses: [...records, record] });
    return record;
  }

  public updateExpense(store_id: number, expenseId: number, updates: Partial<Expense>): void {
    const records = this.state.expenses || [];
    const updated = records.map((expense) => expense.store_id === store_id && expense.id === expenseId ? { ...expense, ...updates, id: expense.id, store_id: expense.store_id } : expense);
    this.persist({ ...this.state, expenses: updated });
  }

  public deleteExpense(store_id: number, expenseId: number): void {
    this.persist({ ...this.state, expenses: (this.state.expenses || []).filter((expense) => expense.store_id !== store_id || expense.id !== expenseId) });
  }

  // --- Sales & Sale Items operations ---
  public completeSale(params: {
    store_id: number;
    customer_id: number | null;
    new_customer_name?: string;
    total_amount: number;
    discount_amount?: number;
    paid_amount: number;
    remaining_amount: number;
    payment_type: 'نقداً' | 'آجل' | 'شبكة';
    items: { product_id: number; product_name?: string; qty: number; price: number }[];
  }): { sale: Sale; items: SaleItem[]; customerCreated?: Customer } {
    if (!params.items.length || params.items.some(i => !Number.isFinite(i.qty) || i.qty <= 0 || !Number.isFinite(i.price) || i.price < 0)) throw new Error('يوجد صنف بكمية أو سعر غير صحيح');
    for (const item of params.items) { const product = this.state.products.find(p => p.id === item.product_id && p.store_id === params.store_id && p.is_active === 1); if (!product) throw new Error('أحد الأصناف لم يعد متاحاً'); if (item.qty > product.quantity + 1e-9) throw new Error(`المخزون غير كافٍ للصنف ${product.name} (المتاح ${product.quantity})`); }
    const now = new Date();
    const formattedDate = `${now.toISOString().split('T')[0]} ${now.toTimeString().split(' ')[0]}`;

    let activeCustomerId = params.customer_id;
    let customerName = '';
    let updatedCustomers = [...this.state.customers];
    let customerCreated: Customer | undefined;

    // Check if new customer name is provided and needs auto-creation (especially for credit sale)
    if (!activeCustomerId && params.new_customer_name && params.new_customer_name.trim()) {
      const trimmedName = params.new_customer_name.trim();
      const existing = updatedCustomers.find(
        (c) => c.store_id === params.store_id && c.name.toLowerCase() === trimmedName.toLowerCase()
      );
      if (existing) {
        activeCustomerId = existing.id;
        customerName = existing.name;
      } else {
        const newCustId = updatedCustomers.length ? Math.max(...updatedCustomers.map((c) => c.id)) + 1 : 1;
        const newCust: Customer = {
          id: newCustId,
          store_id: params.store_id,
          name: trimmedName,
          phone: '',
          total_debt: 0,
        };
        updatedCustomers.push(newCust);
        activeCustomerId = newCust.id;
        customerName = newCust.name;
        customerCreated = newCust;
      }
    } else if (activeCustomerId) {
      const c = updatedCustomers.find((cust) => cust.id === activeCustomerId && cust.store_id === params.store_id);
      if (c) customerName = c.name;
    }

    const newSaleId = this.state.sales.length ? Math.max(...this.state.sales.map((s) => s.id)) + 1 : 101;
    const sale: Sale = {
      id: newSaleId,
      store_id: params.store_id,
      customer_id: activeCustomerId,
      customer_name: customerName || undefined,
      total_amount: params.total_amount,
      discount_amount: params.discount_amount || 0,
      paid_amount: params.paid_amount,
      remaining_amount: params.remaining_amount,
      payment_type: params.payment_type,
      created_at: formattedDate,
    };

    let itemSeq = this.state.sale_items.length ? Math.max(...this.state.sale_items.map((i) => i.id)) + 1 : 1;
    const newSaleItems: SaleItem[] = params.items.map((it) => ({
      id: itemSeq++,
      sale_id: newSaleId,
      product_id: it.product_id,
      product_name: it.product_name,
      qty: it.qty,
      price: it.price,
    }));

    // Deduct quantity from products
    const updatedProducts = this.state.products.map((p) => {
      const sold = params.items.find((it) => it.product_id === p.id && p.store_id === params.store_id);
      if (sold) {
        return { ...p, quantity: Math.max(0, p.quantity - sold.qty) };
      }
      return p;
    });

    // Update customer debt if remaining > 0 and customer is chosen or created
    if (activeCustomerId && params.remaining_amount > 0) {
      updatedCustomers = updatedCustomers.map((c) => {
        if (c.id === activeCustomerId && c.store_id === params.store_id) {
          return { ...c, total_debt: c.total_debt + params.remaining_amount };
        }
        return c;
      });
    }

    const nextState: DatabaseState = {
      ...this.state,
      sales: [sale, ...this.state.sales],
      sale_items: [...this.state.sale_items, ...newSaleItems],
      products: updatedProducts,
      customers: updatedCustomers,
    };
    this.persist(nextState);
    return { sale, items: newSaleItems, customerCreated };
  }

  public getSales(store_id: number): Sale[] {
    return this.state.sales.filter((s) => s.store_id === store_id);
  }

  public getSaleById(store_id: number, saleId: number): Sale | null {
    return this.state.sales.find((s) => s.store_id === store_id && s.id === saleId) || null;
  }

  public getSaleItems(sale_id: number): SaleItem[] {
    return this.state.sale_items.filter((si) => si.sale_id === sale_id);
  }

  public getCustomerSales(store_id: number, customer_id: number): Sale[] {
    return this.state.sales.filter((s) => s.store_id === store_id && s.customer_id === customer_id);
  }

  // --- Returns operations ---
  public returnFromInvoice(params: {
    store_id: number;
    sale_id: number;
    customer_id: number | null;
    product_id: number;
    qty: number;
    amount: number;
  }) {
    if (!Number.isFinite(params.qty) || params.qty <= 0 || !Number.isFinite(params.amount) || params.amount < 0) throw new Error('كمية أو قيمة المرتجع غير صالحة');
    const soldItem = this.state.sale_items.find(i => i.sale_id === params.sale_id && i.product_id === params.product_id);
    if (!soldItem) throw new Error('الصنف غير موجود في الفاتورة المحددة');
    const alreadyReturned = this.state.returns.filter(r => r.type === 'invoice' && r.sale_id === params.sale_id && r.product_id === params.product_id).reduce((n,r) => n + r.qty, 0);
    if (params.qty > soldItem.qty - alreadyReturned + 1e-9) throw new Error(`الكمية المتاحة للإرجاع هي ${Math.max(0, soldItem.qty - alreadyReturned)}`);
    const newId = this.state.returns.length ? Math.max(...this.state.returns.map((r) => r.id)) + 1 : 1;
    const now = new Date();
    const dateStr = `${now.toISOString().split('T')[0]} ${now.toTimeString().split(' ')[0]}`;

    const returnRecord: ReturnItem = {
      id: newId,
      store_id: params.store_id,
      sale_id: params.sale_id,
      customer_id: params.customer_id,
      product_id: params.product_id,
      qty: params.qty,
      amount: params.amount,
      type: 'invoice',
      created_at: dateStr,
    };

    // Restore product stock
    const updatedProducts = this.state.products.map((p) => {
      if (p.id === params.product_id && p.store_id === params.store_id) {
        return { ...p, quantity: p.quantity + params.qty };
      }
      return p;
    });

    // If sale was credit (آجل) or has customer debt, reduce debt
    let updatedCustomers = [...this.state.customers];
    if (params.customer_id) {
      updatedCustomers = updatedCustomers.map((c) => {
        if (c.id === params.customer_id && c.store_id === params.store_id) {
          return { ...c, total_debt: Math.max(0, c.total_debt - params.amount) };
        }
        return c;
      });
    }

    this.persist({
      ...this.state,
      returns: [returnRecord, ...this.state.returns],
      products: updatedProducts,
      customers: updatedCustomers,
    });
    return returnRecord;
  }

  public creditReturn(params: {
    store_id: number;
    customer_id: number;
    product_id: number;
    amount: number;
    qty?: number;
  }) {
    const newId = this.state.returns.length ? Math.max(...this.state.returns.map((r) => r.id)) + 1 : 1;
    const now = new Date();
    const dateStr = `${now.toISOString().split('T')[0]} ${now.toTimeString().split(' ')[0]}`;

    const returnRecord: ReturnItem = {
      id: newId,
      store_id: params.store_id,
      sale_id: null,
      customer_id: params.customer_id,
      product_id: params.product_id,
      qty: params.qty || 1,
      amount: params.amount,
      type: 'credit',
      created_at: dateStr,
    };

    // Deduct from customer's debt
    const updatedCustomers = this.state.customers.map((c) => {
      if (c.id === params.customer_id && c.store_id === params.store_id) {
        return { ...c, total_debt: Math.max(0, c.total_debt - params.amount) };
      }
      return c;
    });

    this.persist({
      ...this.state,
      returns: [returnRecord, ...this.state.returns],
      customers: updatedCustomers,
    });
    return returnRecord;
  }

  public getReturns(store_id: number): ReturnItem[] {
    return this.state.returns.filter((r) => r.store_id === store_id);
  }

  // --- Dashboard Statistics (Enforcing WHERE store_id = ?) ---
  public getDashboardStats(store_id: number) {
    const today = new Date().toISOString().split('T')[0];
    const storeSales = this.getSales(store_id);
    const todaySales = storeSales.filter((s) => s.created_at.startsWith(today));

    const todaySalesTotal = todaySales.reduce((acc, s) => acc + s.total_amount, 0);
    const invoiceCount = todaySales.length;

    const customers = this.getCustomers(store_id);
    const totalDebt = customers.reduce((acc, c) => acc + c.total_debt, 0);

    // Calculate profit for today's sales
    let netProfit = 0;
    const storeProducts = this.state.products.filter((p) => p.store_id === store_id);
    const productCostMap = new Map(storeProducts.map((p) => [p.id, p.cost_price]));

    todaySales.forEach((sale) => {
      const items = this.getSaleItems(sale.id);
      items.forEach((item) => {
        const cost = productCostMap.get(item.product_id) || 0;
        const profitPerUnit = item.price - cost;
        netProfit += profitPerUnit * item.qty;
      });
    });

    return {
      todaySalesTotal,
      totalDebt,
      invoiceCount,
      netProfit,
    };
  }

  // --- Owner panel operations ---
  public getAllStores(): User[] {
    return this.state.users;
  }

  public getOwnerStats() {
    const now = Date.now();
    let trialCount = 0;
    let paidCount = 0;

    this.state.users.forEach((u) => {
      const diffDays = Math.ceil((u.subscription_end - now) / (1000 * 60 * 60 * 24));
      if (diffDays <= 60 && diffDays > 0) {
        trialCount++;
      } else if (diffDays > 60) {
        paidCount++;
      }
    });

    return { trialCount, paidCount, totalStores: this.state.users.length };
  }

  public activateStore(storeId: number, durationDays: number, price?: number) {
    const now = Date.now();
    const updatedUsers = this.state.users.map((u) => {
      if (u.id === storeId) {
        const baseTime = u.subscription_end > now ? u.subscription_end : now;
        return {
          ...u,
          status: 'active' as const,
          subscription_end: baseTime + durationDays * 24 * 60 * 60 * 1000,
          suspension_reason: null,
          subscription_price: price !== undefined ? price : u.subscription_price,
        };
      }
      return u;
    });
    this.persist({ ...this.state, users: updatedUsers });
  }

  /**
   * Manual edit of store subscription duration (days or timestamp) and price
   */
  public updateStoreSubscriptionManual(
    storeId: number,
    options: {
      daysToAdd?: number;
      exactDaysRemaining?: number;
      exactTimestamp?: number;
      price?: number;
      status?: 'active' | 'suspended';
    }
  ) {
    const now = Date.now();
    const updatedUsers = this.state.users.map((u) => {
      if (u.id === storeId) {
        let newEnd = u.subscription_end;

        if (options.exactTimestamp !== undefined) {
          newEnd = options.exactTimestamp;
        } else if (options.exactDaysRemaining !== undefined) {
          newEnd = now + options.exactDaysRemaining * 24 * 60 * 60 * 1000;
        } else if (options.daysToAdd !== undefined) {
          const baseTime = u.subscription_end > now ? u.subscription_end : now;
          newEnd = baseTime + options.daysToAdd * 24 * 60 * 60 * 1000;
        }

        const newStatus = options.status || (newEnd > now ? 'active' : u.status);

        return {
          ...u,
          subscription_end: newEnd,
          subscription_price: options.price !== undefined ? options.price : u.subscription_price,
          status: newStatus,
          suspension_reason: newStatus === 'active' ? null : u.suspension_reason,
        };
      }
      return u;
    });
    this.persist({ ...this.state, users: updatedUsers });
  }

  public suspendStore(storeId: number, reason: string) {
    const updatedUsers = this.state.users.map((u) => {
      if (u.id === storeId) {
        return {
          ...u,
          status: 'suspended' as const,
          suspension_reason: reason,
        };
      }
      return u;
    });
    this.persist({ ...this.state, users: updatedUsers });
  }

  // ==========================================
  // دوال باقات الاشتراكات (إنشاء وإدارة وتعديل من قبل المالك)
  // ==========================================
  public getSubscriptionPackages(includeInactive = false): SubscriptionPackage[] {
    const packages = this.state.subscription_packages || INITIAL_PACKAGES;
    return includeInactive ? packages : packages.filter((p) => p.is_active === 1);
  }

  public insertSubscriptionPackage(data: Omit<SubscriptionPackage, 'id'>): SubscriptionPackage {
    const packages = this.state.subscription_packages || INITIAL_PACKAGES;
    const newId = packages.length ? Math.max(...packages.map((p) => p.id)) + 1 : 1;
    const newPkg: SubscriptionPackage = { ...data, id: newId };
    const updated = [...packages, newPkg];
    this.persist({ ...this.state, subscription_packages: updated });
    return newPkg;
  }

  public updateSubscriptionPackage(id: number, updates: Partial<SubscriptionPackage>) {
    const packages = this.state.subscription_packages || INITIAL_PACKAGES;
    const updated = packages.map((p) => (p.id === id ? { ...p, ...updates } : p));
    this.persist({ ...this.state, subscription_packages: updated });
  }

  public deleteSubscriptionPackage(id: number) {
    // Soft delete package
    this.updateSubscriptionPackage(id, { is_active: 0 });
  }

  // ==========================================
  // تعليق واسترجاع الفواتير (Parked Sales)
  // ==========================================
  public getParkedSales(store_id: number): ParkedSale[] {
    const list = this.state.parked_sales || [];
    return list.filter((p) => p.store_id === store_id);
  }

  public parkSale(sale: ParkedSale) {
    const current = this.state.parked_sales || [];
    const updated = [sale, ...current];
    this.persist({ ...this.state, parked_sales: updated });
  }

  public removeParkedSale(id: string) {
    const current = this.state.parked_sales || [];
    const updated = current.filter((p) => p.id !== id);
    this.persist({ ...this.state, parked_sales: updated });
  }

  // ==========================================
  // إدارة العملاء وسقف الائتمان
  // ==========================================
  public updateCustomer(store_id: number, customerId: number, updates: Partial<Customer>) {
    const updated = this.state.customers.map((c) => {
      if (c.id === customerId && c.store_id === store_id) {
        return { ...c, ...updates };
      }
      return c;
    });
    this.persist({ ...this.state, customers: updated });
  }

  // ==========================================
  // تقرير إغلاق الدرج والوردية (Z-Report)
  // ==========================================
  public getDailyZReport(store_id: number, targetDate?: string) {
    const datePrefix = targetDate || new Date().toISOString().split('T')[0];
    const storeSales = this.getSales(store_id).filter((s) => s.created_at.startsWith(datePrefix));
    const storeReturns = this.getReturns(store_id).filter((r) => r.created_at.startsWith(datePrefix));

    const totalReturnsAmount = storeReturns.reduce((acc, r) => acc + (r.amount || 0), 0);
    const breakdown = calculateZReportBreakdown(storeSales, totalReturnsAmount);

    return {
      date: datePrefix,
      totalSalesCount: storeSales.length,
      totalReturnsCount: storeReturns.length,
      totalSalesVolume: breakdown.totalSalesVolume,
      totalCashSales: breakdown.totalCashSales,
      totalCreditSales: breakdown.totalCreditSales,
      totalNetworkSales: breakdown.totalNetworkSales,
      totalReturnsAmount,
      netCashInDrawer: breakdown.netCashInDrawer,
    };
  }
}


export const db = new SQLiteDatabaseHelper();
