/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  id: number;
  store_name: string;
  owner_name: string;
  phone: string;
  password: string;
  governorate: string;
  district: string;
  neighborhood: string;
  pin_code: string;
  subscription_end: number;
  role: 'owner' | 'merchant' | 'cashier';
  status: 'active' | 'suspended';
  suspension_reason?: string | null;
  subscription_price?: number;
}

export interface SubscriptionPackage {
  id: number;
  name: string;
  duration_days: number;
  price: number;
  description?: string;
  is_active: number; // 1 = active, 0 = inactive
}

export interface Product {
  id: number;
  sync_id?: string;
  store_id: number;
  name: string;
  barcode: string;
  unit_type: 'قطعة' | 'كرتون' | 'كيلو';
  /** Optional sale-package description; stock quantity remains in base units. */
  base_unit_name?: string;
  units_per_pack?: number;
  packs_per_carton?: number;
  /** Total base units represented by one entered pack/carton. */
  base_units_per_sale_unit?: number;
  category?: string;
  cost_price: number;
  sale_price: number;
  quantity: number;
  min_stock: number;
  expiry_date?: string;
  sku?: string;
  storage_location?: string;
  additional_sale_units?: Array<{ name: string; factor: number; price: number }>;
  is_active: number; // 1 = active, 0 = inactive
}

export interface Customer {
  id: number;
  sync_id?: string;
  store_id: number;
  name: string;
  phone: string;
  phone_secondary?: string;
  address?: string;
  image_url?: string;
  notes?: string;
  category?: 'منتظم' | 'مميز' | 'جديد' | 'متأخر' | 'متعثر' | 'موقوف';
  status?: 'active' | 'suspended' | 'archived';
  total_debt: number;
  credit_limit?: number;
  credit_warning_percent?: number;
  allow_credit_override?: boolean;
  payment_term_days?: number;
  opening_balance?: number;
  opening_balance_date?: string;
  registered_at?: string;
  last_purchase_at?: string;
  last_payment_at?: string;
  next_due_at?: string;
}

export interface CustomerPayment {
  id: number;
  sync_id?: string;
  store_id: number;
  customer_id: number;
  amount: number;
  method: 'نقداً' | 'تحويل بنكي' | 'محفظة إلكترونية' | 'أخرى';
  reference?: string;
  sale_ids?: number[];
  notes?: string;
  created_at: string;
  receipt_number: string;
  operator_name?: string;
  shift_id?: number;
}

export interface CustomerLedgerEntry {
  id: number;
  sync_id?: string;
  store_id: number;
  customer_id: number;
  date: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  kind: 'opening_balance' | 'invoice' | 'payment' | 'return' | 'adjustment' | 'merge';
  source_id?: number | string;
}

export interface CustomerPaymentPlan {
  id: number;
  sync_id?: string;
  store_id: number;
  customer_id: number;
  sale_id?: number;
  title: string;
  notes?: string;
  created_at: string;
  installments: CustomerInstallment[];
}

export interface CustomerInstallment {
  id: number;
  amount: number;
  due_date: string;
  paid_amount: number;
  paid_at?: string;
  status: 'لم يحن موعدها' | 'مستحقة قريباً' | 'مستحقة اليوم' | 'متأخرة' | 'مسددة جزئياً' | 'مسددة بالكامل';
}

export interface CustomerCommunication {
  id: number;
  sync_id?: string;
  store_id: number;
  customer_id: number;
  date: string;
  method: 'واتساب' | 'اتصال' | 'رسالة' | 'زيارة';
  subject: string;
  amount_discussed?: number;
  promise_to_pay?: boolean;
  expected_payment_date?: string;
  follow_up_at?: string;
  notes?: string;
}

export interface CustomerMergeRecord {
  id: number;
  sync_id?: string;
  store_id: number;
  primary_customer_id: number;
  merged_customer_id: number;
  merged_customer_snapshot: Customer;
  created_at: string;
  reason?: string;
}

export interface Sale {
  id: number;
  sync_id?: string;
  store_id: number;
  customer_id: number | null;
  customer_name?: string;
  total_amount: number;
  discount_amount?: number;
  paid_amount: number;
  remaining_amount: number;
  payment_type: 'نقداً' | 'آجل' | 'شبكة';
  created_at: string;
  operator_name?: string;
  shift_id?: number;
  is_archived?: boolean;
  archived_at?: string;
}

export interface ParkedSale {
  id: string;
  sync_id?: string;
  store_id: number;
  cart: CartItem[];
  customer_name?: string;
  customer_id?: number | null;
  discount: number;
  created_at: string;
}

export interface SaleItem {
  id: number;
  sync_id?: string;
  sale_id: number;
  product_id: number;
  product_name?: string;
  qty: number;
  price: number;
}

export interface ReturnItem {
  id: number;
  sync_id?: string;
  store_id: number;
  sale_id: number | null;
  customer_id: number | null;
  product_id: number;
  qty: number;
  amount: number;
  type: 'invoice' | 'credit';
  created_at: string;
  operator_name?: string;
  shift_id?: number;
}

export interface Expense {
  id: number;
  sync_id?: string;
  store_id: number;
  category: string;
  amount: number;
  date: string;
  payment_method: string;
  payee?: string;
  reference?: string;
  notes?: string;
  created_at: string;
  operator_name?: string;
  shift_id?: number;
}

export interface CartItem {
  product: Product;
  qty: number;
  price: number;
  subtotal: number;
}

export interface DrawerShift {
  id: number;
  sync_id?: string;
  store_id: number;
  operator_name: string;
  opening_amount: number;
  opening_at: string;
  status: 'open' | 'closed';
  closing_amount?: number;
  closing_at?: string;
  closed_by?: string;
}

export interface SharedPreferences {
  user_id: number | null;
  store_id: number | null;
  cloud_user_id?: string;
  cloud_store_id?: string;
  sync_device_id?: string;
  store_preferences_sync_id?: string;
  store_preferences_updated_at?: string;
  status: 'active' | 'suspended';
  is_suspended_flag?: boolean;
  biometric_enabled?: boolean;
  current_pin?: string;
  dark_mode?: boolean;
  last_phone?: string;
  username?: string;
  currency_symbol?: string;
  receipt_footer?: string;
  receipt_width_mm?: '58' | '80';
  low_stock_alerts_enabled?: boolean;
  offline_password_hash?: string;
  active_shift_id?: number;
  pos_allow_negative_stock?: boolean;
  pos_require_customer_for_credit?: boolean;
  pos_show_arabic_numbers?: boolean;
  pos_sound_enabled?: boolean;
  pos_quick_scan_enabled?: boolean;
  pos_default_payment?: 'نقداً' | 'آجل' | 'شبكة';
  sales_discount_limit_percent?: number;
  customer_default_credit_limit?: number;
  customer_default_payment_days?: number;
  customer_credit_warning_percent?: number;
  customer_block_credit_over_limit?: boolean;
  customer_auto_classification?: boolean;
  debt_reminder_days_before?: number;
  debt_reminder_days_after?: number;
  report_default_period?: 'today' | 'week' | 'month';
  inventory_allow_duplicate_barcode?: boolean;
  inventory_auto_generate_sku?: boolean;
  inventory_expiry_warning_days?: number;
  backup_auto_daily?: boolean;
  backup_retain_count?: number;
  sync_auto_enabled?: boolean;
  sync_wifi_only?: boolean;
  cloud_backup_frequency?: 'manual' | 'daily' | 'weekly' | 'shift_close';
  auto_lock_minutes?: 1 | 5 | 15 | 30 | 60;
  thermal_printer?: string;
  barcode_source?: 'camera' | 'external';
  tax_registration_number?: string;
  vat_enabled?: boolean;
  vat_percent?: number;
}
