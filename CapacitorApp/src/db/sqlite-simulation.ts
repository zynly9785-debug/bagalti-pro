/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capacitor } from '@capacitor/core';
import { User, Product, Customer, CustomerPayment, CustomerLedgerEntry, CustomerPaymentPlan, CustomerCommunication, CustomerMergeRecord, DrawerShift, Sale, SaleItem, ReturnItem, SubscriptionPackage, SharedPreferences, ParkedSale, Expense } from '../types/index.ts';
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
  customer_payments?: CustomerPayment[];
  customer_ledger?: CustomerLedgerEntry[];
  customer_payment_plans?: CustomerPaymentPlan[];
  customer_communications?: CustomerCommunication[];
  customer_merge_records?: CustomerMergeRecord[];
  drawer_shifts?: DrawerShift[];
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
      customer_payments: parsed.customer_payments || [],
      customer_ledger: parsed.customer_ledger || [],
      customer_payment_plans: parsed.customer_payment_plans || [],
      customer_communications: parsed.customer_communications || [],
      customer_merge_records: parsed.customer_merge_records || [],
      drawer_shifts: parsed.drawer_shifts || [],
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
      customer_payments: [],
      customer_ledger: [],
      customer_payment_plans: [],
      customer_communications: [],
      customer_merge_records: [],
      drawer_shifts: [],
      quick_products: [],
    };
    this.persist(defaultState);
    return defaultState;
  }

  private persist(state: DatabaseState) {
    const previous = this.state as DatabaseState | undefined;
    const syncCollections = ['products', 'customers', 'sales', 'sale_items', 'returns', 'expenses', 'customer_payments', 'customer_ledger', 'customer_payment_plans', 'customer_communications', 'customer_merge_records', 'drawer_shifts', 'quick_products'] as const;
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
      customer_payments: [],
      customer_ledger: [],
      customer_payment_plans: [],
      customer_communications: [],
      customer_merge_records: [],
      drawer_shifts: [],
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

  public insertCustomer(store_id: number, name: string, phone: string, initialDebt = 0, details: Partial<Customer> = {}): Customer {
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    if (!cleanName) throw new Error('اسم العميل مطلوب');
    if (cleanPhone && this.state.customers.some((c) => c.store_id === store_id && c.phone.trim() === cleanPhone)) {
      throw new Error('يوجد عميل مسجل بنفس رقم الهاتف');
    }
    if (cleanName && this.state.customers.some((c) => c.store_id === store_id && c.name.trim().toLowerCase() === cleanName.toLowerCase())) {
      throw new Error('يوجد عميل مسجل بهذا الاسم');
    }
    const opening = Number.isFinite(initialDebt) ? Math.max(0, initialDebt) : 0;
    const limit = Number.isFinite(details.credit_limit) ? Math.max(0, Number(details.credit_limit)) : 50000;
    const newId = this.state.customers.length ? Math.max(...this.state.customers.map((c) => c.id)) + 1 : 1;
    const now = new Date().toISOString();
    const newCust: Customer = {
      id: newId, store_id, name: cleanName, phone: cleanPhone, total_debt: opening,
      credit_limit: limit,
      phone_secondary: details.phone_secondary?.trim() || '',
      address: details.address?.trim() || '',
      image_url: details.image_url || '',
      notes: details.notes?.trim() || '',
      category: details.category || 'جديد',
      status: 'active',
      credit_warning_percent: details.credit_warning_percent || 80,
      allow_credit_override: details.allow_credit_override || false,
      payment_term_days: details.payment_term_days || 30,
      opening_balance: opening,
      opening_balance_date: details.opening_balance_date || now.slice(0, 10),
      registered_at: now,
    };
    const ledger = [...(this.state.customer_ledger || [])];
    if (opening > 0) {
      ledger.unshift({
        id: ledger.length ? Math.max(...ledger.map((e) => e.id)) + 1 : 1,
        store_id, customer_id: newId, date: newCust.opening_balance_date || now,
        reference: `OPEN-${newId}`, description: 'رصيد افتتاحي', debit: opening, credit: 0,
        kind: 'opening_balance', source_id: newId,
      });
    }
    this.persist({ ...this.state, customers: [...this.state.customers, newCust], customer_ledger: ledger });
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

  public payCustomerDebt(store_id: number, customerId: number, amount: number, options: {method?: CustomerPayment['method']; reference?: string; saleIds?: number[]; notes?: string; date?: string; idempotencyKey?: string} = {}): CustomerPayment {
    const customer = this.getCustomerById(store_id, customerId);
    if (!customer) throw new Error('العميل غير موجود');
    const paid = Number(amount);
    if (!Number.isFinite(paid) || paid <= 0) throw new Error('مبلغ السداد غير صالح');
    if (paid > customer.total_debt + 1e-9) throw new Error('مبلغ السداد أكبر من الرصيد المستحق');
    const payments = this.state.customer_payments || [];
    const receiptNumber = options.idempotencyKey || `RCPT-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${store_id}-${customerId}`;
    if (payments.some((p) => p.store_id === store_id && p.receipt_number === receiptNumber)) {
      return payments.find((p) => p.store_id === store_id && p.receipt_number === receiptNumber)!;
    }
    const id = payments.length ? Math.max(...payments.map((p) => p.id)) + 1 : 1;
    const date = options.date || new Date().toISOString();
    const activeShift = this.getActiveDrawerShift(store_id);
    const payment: CustomerPayment = {
      id, store_id, customer_id: customerId, amount: paid,
      method: options.method || 'نقداً', reference: options.reference?.trim() || '',
      sale_ids: options.saleIds || [], notes: options.notes?.trim() || '', created_at: date, receipt_number: receiptNumber,
      operator_name: activeShift?.operator_name,
      shift_id: activeShift?.id,
    };
    let remainingToAllocate = paid;
    const saleIds = new Set(options.saleIds || []);
    const updatedSales = this.state.sales.map((sale) => {
      if (sale.store_id !== store_id || sale.customer_id !== customerId || sale.remaining_amount <= 0) return sale;
      if (saleIds.size && !saleIds.has(sale.id)) return sale;
      const allocation = Math.min(remainingToAllocate, sale.remaining_amount);
      remainingToAllocate -= allocation;
      return allocation > 0 ? { ...sale, remaining_amount: Math.max(0, sale.remaining_amount - allocation), paid_amount: sale.paid_amount + allocation } : sale;
    });
    const nextDebt = Math.max(0, customer.total_debt - paid);
    const updatedCustomers = this.state.customers.map((c) => c.id === customerId && c.store_id === store_id
      ? { ...c, total_debt: nextDebt, last_payment_at: date, next_due_at: c.next_due_at }
      : c);
    const ledger = this.state.customer_ledger || [];
    ledger.unshift({
      id: ledger.length ? Math.max(...ledger.map((e) => e.id)) + 1 : 1,
      store_id, customer_id: customerId, date, reference: receiptNumber,
      description: `سند قبض - ${options.method || 'نقداً'}`, debit: 0, credit: paid,
      kind: 'payment', source_id: payment.id,
    });
    this.persist({ ...this.state, customer_payments: [payment, ...payments], sales: updatedSales,
      customers: updatedCustomers, customer_ledger: ledger });
    return payment;
  }

  public getCustomerPayments(store_id: number, customerId?: number): CustomerPayment[] {
    return (this.state.customer_payments || []).filter((p) => p.store_id === store_id && (!customerId || p.customer_id === customerId));
  }

  public getCustomerLedger(store_id: number, customerId: number): CustomerLedgerEntry[] {
    const existing = (this.state.customer_ledger || []).filter((e) => e.store_id === store_id && e.customer_id === customerId);
    const customer = this.getCustomerById(store_id, customerId);
    if (existing.length || !customer) return [...existing].sort((a, b) => a.date.localeCompare(b.date));
    const entries: CustomerLedgerEntry[] = [];
    if (customer.opening_balance) entries.push({ id: 1, store_id, customer_id: customerId, date: customer.opening_balance_date || customer.registered_at || '', reference: `OPEN-${customerId}`, description: 'رصيد افتتاحي', debit: customer.opening_balance, credit: 0, kind: 'opening_balance' });
    this.getCustomerSales(store_id, customerId).forEach((sale) => {
      if (sale.remaining_amount > 0) entries.push({ id: entries.length + 1, store_id, customer_id: customerId, date: sale.created_at, reference: `INV-${sale.id}`, description: 'فاتورة بيع آجلة', debit: sale.remaining_amount, credit: 0, kind: 'invoice', source_id: sale.id });
    });
    this.getReturns(store_id).filter((r) => r.customer_id === customerId).forEach((r) => entries.push({ id: entries.length + 1, store_id, customer_id: customerId, date: r.created_at, reference: `RET-${r.id}`, description: 'مرتجع معتمد', debit: 0, credit: r.amount, kind: 'return', source_id: r.id }));
    this.getCustomerPayments(store_id, customerId).forEach((p) => entries.push({ id: entries.length + 1, store_id, customer_id: customerId, date: p.created_at, reference: p.receipt_number, description: 'سند قبض', debit: 0, credit: p.amount, kind: 'payment', source_id: p.id }));
    return entries.sort((a, b) => a.date.localeCompare(b.date));
  }

  public getCustomerSummary(store_id: number, customerId: number) {
    const customer = this.getCustomerById(store_id, customerId);
    const sales = this.getCustomerSales(store_id, customerId);
    const returns = this.getReturns(store_id).filter((r) => r.customer_id === customerId);
    const payments = this.getCustomerPayments(store_id, customerId);
    const ledger = this.getCustomerLedger(store_id, customerId);
    let balance = 0;
    ledger.forEach((entry) => { balance += entry.debit - entry.credit; });
    const unpaid = sales.filter((s) => s.remaining_amount > 0);
    return {
      customer, totalInvoices: sales.reduce((n, s) => n + s.total_amount, 0), paidAtSale: sales.reduce((n, s) => n + s.paid_amount, 0),
      totalPayments: payments.reduce((n, p) => n + p.amount, 0), totalReturns: returns.reduce((n, r) => n + r.amount, 0),
      currentBalance: balance > 0 ? balance : Math.max(0, customer?.total_debt || 0), unpaidInvoiceCount: unpaid.length,
      availableCredit: Math.max(0, (customer?.credit_limit || 0) - (customer?.total_debt || 0)),
      firstPurchase: sales.length ? sales.map((s) => s.created_at).sort()[0] : undefined,
      lastPurchase: customer?.last_purchase_at || (sales.length ? sales.map((s) => s.created_at).sort().at(-1) : undefined),
      lastPayment: customer?.last_payment_at || (payments.length ? payments.map((p) => p.created_at).sort().at(-1) : undefined),
      nextDue: customer?.next_due_at,
    };
  }

  public createCustomerPaymentPlan(store_id: number, params: {customerId: number; saleId?: number; title: string; notes?: string; installments: {amount: number; dueDate: string}[]}) {
    const customer = this.getCustomerById(store_id, params.customerId);
    if (!customer) throw new Error('العميل غير موجود');
    if (!params.installments.length || params.installments.some((i) => i.amount <= 0 || !i.dueDate)) throw new Error('بيانات الدفعات غير صالحة');
    const today = new Date();
    const plans = this.state.customer_payment_plans || [];
    const id = plans.length ? Math.max(...plans.map((p) => p.id)) + 1 : 1;
    let installmentId = 1;
    const plan: CustomerPaymentPlan = { id, store_id, customer_id: params.customerId, sale_id: params.saleId,
      title: params.title.trim() || 'جدول سداد', notes: params.notes?.trim() || '', created_at: today.toISOString(),
      installments: params.installments.map((i) => ({ id: installmentId++, amount: i.amount, due_date: i.dueDate, paid_amount: 0,
        status: new Date(i.dueDate).getTime() <= today.getTime() ? 'مستحقة اليوم' : 'لم يحن موعدها' })) };
    this.persist({ ...this.state, customer_payment_plans: [plan, ...plans], customers: this.state.customers.map((c) => c.id === params.customerId ? { ...c, next_due_at: params.installments.map((i) => i.dueDate).sort()[0] } : c) });
    return plan;
  }

  public payCustomerInstallment(store_id: number, planId: number, installmentId: number, amount: number, method: CustomerPayment['method'] = 'نقداً') {
    const plans = this.state.customer_payment_plans || [];
    const plan = plans.find((p) => p.store_id === store_id && p.id === planId);
    if (!plan) throw new Error('جدول السداد غير موجود');
    const installment = plan.installments.find((i) => i.id === installmentId);
    if (!installment) throw new Error('الدفعة غير موجودة');
    const remaining = installment.amount - installment.paid_amount;
    if (amount <= 0 || amount > remaining + 1e-9) throw new Error('مبلغ الدفعة غير صالح');
    const payment = this.payCustomerDebt(store_id, plan.customer_id, amount, { method, saleIds: plan.sale_id ? [plan.sale_id] : [] });
    const updatedPlans = plans.map((p) => p.id === planId ? { ...p, installments: p.installments.map((i) => {
      if (i.id !== installmentId) return i;
      const paidAmount = i.paid_amount + amount;
      return { ...i, paid_amount: paidAmount, paid_at: new Date().toISOString(), status: paidAmount >= i.amount ? 'مسددة بالكامل' as const : 'مسددة جزئياً' as const };
    }) } : p);
    this.persist({ ...this.state, customer_payment_plans: updatedPlans });
    return payment;
  }

  public getCustomerPaymentPlans(store_id: number, customerId?: number) { return (this.state.customer_payment_plans || []).filter((p) => p.store_id === store_id && (!customerId || p.customer_id === customerId)); }

  public addCustomerCommunication(store_id: number, data: Omit<CustomerCommunication, 'id' | 'sync_id'>) {
    const records = this.state.customer_communications || [];
    const record: CustomerCommunication = { ...data, id: records.length ? Math.max(...records.map((r) => r.id)) + 1 : 1 };
    this.persist({ ...this.state, customer_communications: [record, ...records], customers: this.state.customers.map((c) => c.id === data.customer_id && c.store_id === store_id
      ? { ...c, next_due_at: data.follow_up_at || data.expected_payment_date || c.next_due_at } : c) });
    return record;
  }

  public getCustomerCommunications(store_id: number, customerId?: number) { return (this.state.customer_communications || []).filter((r) => r.store_id === store_id && (!customerId || r.customer_id === customerId)); }

  public archiveCustomer(store_id: number, customerId: number) { this.updateCustomer(store_id, customerId, { status: 'archived' }); }

  public deleteCustomerSafely(store_id: number, customerId: number) {
    const hasHistory = this.getCustomerSales(store_id, customerId).length > 0 || this.getCustomerPayments(store_id, customerId).length > 0 || this.getReturns(store_id).some((r) => r.customer_id === customerId);
    if (hasHistory) throw new Error('لا يمكن حذف عميل له سجلات مالية؛ استخدم الأرشفة أو دمج الحسابات');
    this.persist({ ...this.state, customers: this.state.customers.filter((c) => !(c.store_id === store_id && c.id === customerId)) });
  }

  public mergeCustomers(store_id: number, primaryId: number, mergedId: number, reason = '') {
    if (primaryId === mergedId) throw new Error('اختر حسابين مختلفين');
    const primary = this.getCustomerById(store_id, primaryId);
    const merged = this.getCustomerById(store_id, mergedId);
    if (!primary || !merged) throw new Error('أحد الحسابين غير موجود');
    const records = this.state.customer_merge_records || [];
    const mergeId = records.length ? Math.max(...records.map((r) => r.id)) + 1 : 1;
    const record: CustomerMergeRecord = { id: mergeId, store_id, primary_customer_id: primaryId, merged_customer_id: mergedId, merged_customer_snapshot: merged, created_at: new Date().toISOString(), reason };
    const combinedDebt = primary.total_debt + merged.total_debt;
    const updatedCustomers = this.state.customers
      .filter((c) => !(c.store_id === store_id && c.id === mergedId))
      .map((c) => c.id === primaryId && c.store_id === store_id ? { ...c, total_debt: combinedDebt } : c);
    const sales = this.state.sales.map((s) => s.store_id === store_id && s.customer_id === mergedId ? { ...s, customer_id: primaryId, customer_name: primary.name } : s);
    const returns = this.state.returns.map((r) => r.store_id === store_id && r.customer_id === mergedId ? { ...r, customer_id: primaryId } : r);
    const payments = (this.state.customer_payments || []).map((p) => p.store_id === store_id && p.customer_id === mergedId ? { ...p, customer_id: primaryId } : p);
    const ledger = (this.state.customer_ledger || []).map((e) => e.store_id === store_id && e.customer_id === mergedId ? { ...e, customer_id: primaryId } : e);
    ledger.unshift({ id: ledger.length ? Math.max(...ledger.map((e) => e.id)) + 1 : 1, store_id, customer_id: primaryId, date: record.created_at, reference: `MERGE-${mergeId}`, description: `دمج العميل رقم ${mergedId}`, debit: 0, credit: 0, kind: 'merge', source_id: mergeId });
    this.persist({ ...this.state, customers: updatedCustomers, sales, returns,
      customer_payments: payments, customer_ledger: ledger,
      customer_payment_plans: (this.state.customer_payment_plans || []).map((p) => p.store_id === store_id && p.customer_id === mergedId ? { ...p, customer_id: primaryId } : p),
      customer_communications: (this.state.customer_communications || []).map((c) => c.store_id === store_id && c.customer_id === mergedId ? { ...c, customer_id: primaryId } : c),
      customer_merge_records: [...records, record] });
    return record;
  }

  // --- Store expense records ---
  public getExpenses(store_id: number): Expense[] {
    return (this.state.expenses || []).filter((expense) => expense.store_id === store_id).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  }

  public insertExpense(data: Omit<Expense, 'id' | 'created_at'>): Expense {
    if (!Number.isFinite(data.amount) || data.amount <= 0 || !data.category.trim() || !data.date) throw new Error('أدخل تصنيفاً ومبلغاً وتاريخاً صحيحاً للمصروف');
    const records = this.state.expenses || [];
    const id = records.length ? Math.max(...records.map((expense) => expense.id)) + 1 : 1;
    const activeShift = this.getActiveDrawerShift(data.store_id);
    const record: Expense = { ...data, id, created_at: new Date().toISOString(), operator_name: activeShift?.operator_name, shift_id: activeShift?.id };
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
  public insertFreeCustomerInvoice(storeId: number, customerId: number, params: { description: string; totalAmount: number; paidAmount?: number; paymentType?: 'نقداً' | 'آجل' | 'شبكة'; date?: string; idempotencyKey?: string }): Sale {
    const customer = this.getCustomerById(storeId, customerId);
    if (!customer) throw new Error('العميل غير موجود');
    const idempotentSale = params.idempotencyKey && this.state.sales.find((sale) =>
      sale.store_id === storeId && sale.customer_id === customerId && sale.idempotency_key === params.idempotencyKey,
    );
    if (idempotentSale) return idempotentSale;
    const description = params.description.trim();
    const total = Number(params.totalAmount);
    const paid = Math.max(0, Number(params.paidAmount) || 0);
    if (!description) throw new Error('يرجى إدخال وصف الفاتورة الحرة');
    if (!Number.isFinite(total) || total <= 0) throw new Error('قيمة الفاتورة غير صالحة');
    if (paid > total + 1e-9) throw new Error('المبلغ المدفوع لا يمكن أن يتجاوز قيمة الفاتورة');
    const remaining = Math.max(0, total - paid);
    if (customer.status === 'suspended' || customer.status === 'archived') throw new Error('العميل موقوف ولا يسمح بإضافة فاتورة آجلة له');
    if (remaining > 0 && customer.total_debt + remaining > (customer.credit_limit || 50000) && !customer.allow_credit_override) {
      throw new Error('تم تجاوز الحد الائتماني للعميل ولا يسمح بإضافة فاتورة آجلة');
    }
    const now = params.date ? new Date(`${params.date}T12:00:00`) : new Date();
    const formattedDate = `${now.toISOString().split('T')[0]} ${now.toTimeString().split(' ')[0]}`;
    const id = this.state.sales.length ? Math.max(...this.state.sales.map((s) => s.id)) + 1 : 101;
    const activeShift = this.getActiveDrawerShift(storeId);
    const sale: Sale = {
      id,
      store_id: storeId,
      customer_id: customerId,
      customer_name: customer.name,
      total_amount: total,
      discount_amount: 0,
      paid_amount: paid,
      remaining_amount: remaining,
      payment_type: params.paymentType || 'آجل',
      notes: description,
      idempotency_key: params.idempotencyKey,
      created_at: formattedDate,
      operator_name: activeShift?.operator_name,
      shift_id: activeShift?.id,
    };
    const ledger = [...(this.state.customer_ledger || [])];
    const nextLedgerId = () => ledger.length ? Math.max(...ledger.map((e) => e.id)) + 1 : 1;
    ledger.unshift({ id: nextLedgerId(), store_id: storeId, customer_id: customerId, date: formattedDate, reference: `FREE-${id}`, description: `فاتورة حرة: ${description}`, debit: total, credit: 0, kind: 'invoice', source_id: id });
    if (paid > 0) ledger.unshift({ id: nextLedgerId(), store_id: storeId, customer_id: customerId, date: formattedDate, reference: `FREE-${id}`, description: `مدفوع عند فاتورة حرة: ${description}`, debit: 0, credit: paid, kind: 'payment', source_id: id });
    const customers = this.state.customers.map((c) => c.id === customerId && c.store_id === storeId
      ? { ...c, total_debt: Math.max(0, c.total_debt + remaining), last_purchase_at: formattedDate, next_due_at: remaining > 0 ? (() => { const due = new Date(now); due.setDate(due.getDate() + (c.payment_term_days || 30)); return due.toISOString().slice(0, 10); })() : c.next_due_at }
      : c);
    this.persist({ ...this.state, sales: [sale, ...this.state.sales], customers, customer_ledger: ledger });
    return sale;
  }

  public completeSale(params: {
    store_id: number;
    customer_id: number | null;
    new_customer_name?: string;
    total_amount: number;
    discount_amount?: number;
    paid_amount: number;
    remaining_amount: number;
    payment_type: 'نقداً' | 'آجل' | 'شبكة';
    credit_override?: { approved: boolean; approver: string; reason: string };
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

    if (activeCustomerId && params.remaining_amount > 0) {
      const creditCustomer = updatedCustomers.find((c) => c.id === activeCustomerId && c.store_id === params.store_id);
      if (creditCustomer) {
        const limit = creditCustomer.credit_limit ?? 50000;
        const nextDebt = creditCustomer.total_debt + params.remaining_amount;
        if (nextDebt > limit && !params.credit_override?.approved) {
          throw new Error(`تم تجاوز الحد الائتماني (${limit}). يلزم موافقة مخولة لتأكيد البيع الآجل`);
        }
        if (nextDebt > limit && params.credit_override?.approved && (!params.credit_override.approver || !params.credit_override.reason)) {
          throw new Error('يجب تسجيل اسم المستخدم وسبب موافقة تجاوز الحد الائتماني');
        }
        if (creditCustomer.status === 'suspended' || creditCustomer.status === 'archived') {
          throw new Error('العميل موقوف ولا يسمح له بالبيع الآجل');
        }
      }
    }

    const newSaleId = this.state.sales.length ? Math.max(...this.state.sales.map((s) => s.id)) + 1 : 101;
    const activeShift = this.getActiveDrawerShift(params.store_id);
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
      operator_name: activeShift?.operator_name,
      shift_id: activeShift?.id,
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
    let ledger = [...(this.state.customer_ledger || [])];
    if (activeCustomerId) {
      const dueDate = new Date(now);
      const currentCustomer = updatedCustomers.find((c) => c.id === activeCustomerId && c.store_id === params.store_id);
      dueDate.setDate(dueDate.getDate() + (currentCustomer?.payment_term_days || 30));
      updatedCustomers = updatedCustomers.map((c) => {
        if (c.id === activeCustomerId && c.store_id === params.store_id) {
          return {
            ...c,
            total_debt: c.total_debt + (params.remaining_amount > 0 ? params.remaining_amount : 0),
            last_purchase_at: formattedDate,
            next_due_at: params.remaining_amount > 0 ? dueDate.toISOString().slice(0, 10) : c.next_due_at,
          };
        }
        return c;
      });
      const nextLedgerId = () => ledger.length ? Math.max(...ledger.map((e) => e.id)) + 1 : 1;
      ledger.unshift({
        id: nextLedgerId(),
        store_id: params.store_id, customer_id: activeCustomerId, date: formattedDate,
        reference: `INV-${newSaleId}`,
        description: params.remaining_amount > 0 ? 'فاتورة بيع آجلة' : 'فاتورة بيع نقدية',
        debit: params.total_amount, credit: 0, kind: 'invoice', source_id: newSaleId,
      });
      if (params.paid_amount > 0) {
        ledger.unshift({
          id: nextLedgerId(),
          store_id: params.store_id, customer_id: activeCustomerId, date: formattedDate,
          reference: `INV-${newSaleId}`, description: 'مدفوع عند البيع', debit: 0,
          credit: params.paid_amount, kind: 'payment', source_id: newSaleId,
        });
      }
    }

    const nextState: DatabaseState = {
      ...this.state,
      sales: [sale, ...this.state.sales],
      sale_items: [...this.state.sale_items, ...newSaleItems],
      products: updatedProducts,
      customers: updatedCustomers,
      customer_ledger: ledger,
    };
    this.persist(nextState);
    return { sale, items: newSaleItems, customerCreated };
  }

  public getSales(store_id: number): Sale[] {
    return this.state.sales.filter((s) => s.store_id === store_id);
  }

  public getActiveSales(store_id: number): Sale[] {
    return this.state.sales.filter((s) => s.store_id === store_id && !s.is_archived);
  }

  public getArchivedSales(store_id: number): Sale[] {
    return this.state.sales.filter((s) => s.store_id === store_id && s.is_archived);
  }

  public archiveSale(store_id: number, saleId: number): void {
    const archivedAt = new Date().toISOString();
    this.persist({ ...this.state, sales: this.state.sales.map((sale) => sale.store_id === store_id && sale.id === saleId
      ? { ...sale, is_archived: true, archived_at: archivedAt }
      : sale) });
  }

  public restoreSale(store_id: number, saleId: number): void {
    this.persist({ ...this.state, sales: this.state.sales.map((sale) => sale.store_id === store_id && sale.id === saleId
      ? { ...sale, is_archived: false, archived_at: undefined }
      : sale) });
  }

  public getArchivedProducts(store_id: number): Product[] {
    return this.state.products.filter((product) => product.store_id === store_id && product.is_active === 0);
  }

  public restoreProduct(store_id: number, productId: number): void {
    this.updateProduct(store_id, productId, { is_active: 1 });
  }

  public getArchivedCustomers(store_id: number): Customer[] {
    return this.state.customers.filter((customer) => customer.store_id === store_id && (customer.status === 'archived' || customer.status === 'suspended'));
  }

  public restoreCustomer(store_id: number, customerId: number): void {
    this.updateCustomer(store_id, customerId, { status: 'active' });
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
    const activeShift = this.getActiveDrawerShift(params.store_id);
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
      operator_name: activeShift?.operator_name,
      shift_id: activeShift?.id,
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

    const ledger = [...(this.state.customer_ledger || [])];
    if (params.customer_id) ledger.unshift({ id: ledger.length ? Math.max(...ledger.map((e) => e.id)) + 1 : 1,
      store_id: params.store_id, customer_id: params.customer_id, date: dateStr, reference: `RET-${returnRecord.id}`,
      description: 'مرتجع من فاتورة', debit: 0, credit: params.amount, kind: 'return', source_id: returnRecord.id });
    this.persist({
      ...this.state,
      returns: [returnRecord, ...this.state.returns],
      products: updatedProducts,
      customers: updatedCustomers,
      customer_ledger: ledger,
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
    const activeShift = this.getActiveDrawerShift(params.store_id);
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
      operator_name: activeShift?.operator_name,
      shift_id: activeShift?.id,
    };

    // Deduct from customer's debt
    const updatedCustomers = this.state.customers.map((c) => {
      if (c.id === params.customer_id && c.store_id === params.store_id) {
        return { ...c, total_debt: Math.max(0, c.total_debt - params.amount) };
      }
      return c;
    });

    const ledger = [...(this.state.customer_ledger || [])];
    ledger.unshift({ id: ledger.length ? Math.max(...ledger.map((e) => e.id)) + 1 : 1,
      store_id: params.store_id, customer_id: params.customer_id, date: dateStr, reference: `RET-${returnRecord.id}`,
      description: 'مرتجع معتمد', debit: 0, credit: params.amount, kind: 'return', source_id: returnRecord.id });
    this.persist({
      ...this.state,
      returns: [returnRecord, ...this.state.returns],
      customers: updatedCustomers,
      customer_ledger: ledger,
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
  // وردية الدرج والتقارير حسب المستخدم
  // ==========================================
  public openDrawerShift(storeId: number, operatorName: string, openingAmount: number): DrawerShift {
    const name = operatorName.trim();
    if (!name) throw new Error('اسم المستخدم مطلوب لفتح الدرج');
    if (!Number.isFinite(openingAmount) || openingAmount < 0) throw new Error('قيمة فتح الوردية غير صالحة');
    const openShift = (this.state.drawer_shifts || []).find((s) => s.store_id === storeId && s.status === 'open');
    if (openShift) throw new Error(`الدرج مفتوح بالفعل للمستخدم ${openShift.operator_name}`);
    const shifts = this.state.drawer_shifts || [];
    const shift: DrawerShift = {
      id: shifts.length ? Math.max(...shifts.map((s) => s.id)) + 1 : 1,
      store_id: storeId,
      operator_name: name,
      opening_amount: openingAmount,
      opening_at: new Date().toISOString(),
      status: 'open',
    };
    this.persist({ ...this.state, drawer_shifts: [shift, ...shifts] });
    this.saveSharedPreferences({ active_shift_id: shift.id });
    return shift;
  }

  public getActiveDrawerShift(storeId: number): DrawerShift | null {
    const prefsShiftId = this.sharedPreferences.active_shift_id;
    const shifts = this.state.drawer_shifts || [];
    return shifts.find((s) => s.store_id === storeId && s.status === 'open' && (!prefsShiftId || s.id === prefsShiftId))
      || shifts.find((s) => s.store_id === storeId && s.status === 'open')
      || null;
  }

  public getDrawerShiftReport(storeId: number, shiftId?: number) {
    const shift = shiftId
      ? (this.state.drawer_shifts || []).find((s) => s.store_id === storeId && s.id === shiftId) || null
      : this.getActiveDrawerShift(storeId);
    if (!shift) throw new Error('لا توجد وردية مفتوحة');
    const start = shift.opening_at;
    const end = shift.closing_at || new Date().toISOString();
    const sales = this.getSales(storeId).filter((s) => s.shift_id === shift.id || (!s.shift_id && s.created_at >= start));
    const payments = (this.state.customer_payments || []).filter((p) => p.store_id === storeId && (p.shift_id === shift.id || (!p.shift_id && p.created_at >= start)));
    const returns = this.getReturns(storeId).filter((r) => r.shift_id === shift.id || (!r.shift_id && r.created_at >= start));
    const expenses = (this.state.expenses || []).filter((e) => e.store_id === storeId && (!e.shift_id && e.created_at >= start));
    const inPeriod = (date: string) => {
      const at = Date.parse(date.includes('T') ? date : date.replace(' ', 'T'));
      const from = Date.parse(start);
      const to = Date.parse(end);
      return Number.isFinite(at) && at >= from && at <= to;
    };
    const shiftSales = sales.filter((s) => s.shift_id === shift.id || (!s.shift_id && inPeriod(s.created_at)));
    const shiftPayments = payments.filter((p) => p.shift_id === shift.id || (!p.shift_id && inPeriod(p.created_at)));
    const shiftReturns = returns.filter((r) => r.shift_id === shift.id || (!r.shift_id && inPeriod(r.created_at)));
    const shiftExpenses = expenses.filter((e) => e.shift_id === shift.id || (!e.shift_id && inPeriod(e.created_at)));
    const totals = calculateZReportBreakdown(shiftSales, shiftReturns.reduce((n, r) => n + r.amount, 0));
    const cashPayments = shiftPayments.filter((p) => p.method === 'نقداً').reduce((n, p) => n + p.amount, 0);
    const expectedCash = shift.opening_amount + totals.totalCashSales + cashPayments - shiftReturns.reduce((n, r) => n + r.amount, 0) - shiftExpenses.reduce((n, e) => n + e.amount, 0);
    return {
      shift,
      sales: shiftSales,
      payments: shiftPayments,
      returns: shiftReturns,
      expenses: shiftExpenses,
      openingAmount: shift.opening_amount,
      ...totals,
      cashPayments,
      expectedCash,
    };
  }

  public closeDrawerShift(storeId: number, closingAmount: number, closedBy?: string): DrawerShift & { report: ReturnType<SQLiteDatabaseHelper['getDrawerShiftReport']> } {
    const shift = this.getActiveDrawerShift(storeId);
    if (!shift) throw new Error('لا توجد وردية مفتوحة');
    if (!Number.isFinite(closingAmount) || closingAmount < 0) throw new Error('قيمة الدرج عند الإغلاق غير صالحة');
    const closedAt = new Date().toISOString();
    const shifts = (this.state.drawer_shifts || []).map((s) => s.id === shift.id && s.store_id === storeId
      ? { ...s, status: 'closed' as const, closing_amount: closingAmount, closing_at: closedAt, closed_by: closedBy?.trim() || shift.operator_name }
      : s);
    this.persist({ ...this.state, drawer_shifts: shifts });
    this.saveSharedPreferences({ active_shift_id: undefined });
    const closedShift = shifts.find((s) => s.id === shift.id)!;
    const report = this.getDrawerShiftReport(storeId, shift.id);
    return { ...closedShift, report };
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
