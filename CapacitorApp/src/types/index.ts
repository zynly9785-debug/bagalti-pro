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
  is_active: number; // 1 = active, 0 = inactive
}

export interface Customer {
  id: number;
  sync_id?: string;
  store_id: number;
  name: string;
  phone: string;
  total_debt: number;
  credit_limit?: number; // سقف الدين المسموح
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
}

export interface CartItem {
  product: Product;
  qty: number;
  price: number;
  subtotal: number;
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
}
