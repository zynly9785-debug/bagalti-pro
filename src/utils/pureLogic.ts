/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PureCartonCalcResult {
  unitCostPrice: number;
  unitSalePrice: number;
}

/**
 * Calculates single piece cost and sale price from carton pricing
 */
export function calculateCartonUnitPrices(
  cartonCostPrice: number,
  cartonSalePrice: number,
  piecesPerCarton: number
): PureCartonCalcResult {
  if (piecesPerCarton <= 0) {
    return { unitCostPrice: 0, unitSalePrice: 0 };
  }
  const unitCostPrice = Math.round((cartonCostPrice / piecesPerCarton) * 100) / 100;
  const unitSalePrice = Math.round((cartonSalePrice / piecesPerCarton) * 100) / 100;
  return { unitCostPrice, unitSalePrice };
}

/**
 * Calculates remaining debt on a sale.
 * Returns { remainingAmount, debtToAdd }
 */
export function calculateSaleRemaining(totalAmount: number, paidAmount: number): {
  remainingAmount: number;
  debtToAdd: number;
} {
  const safeTotal = Math.max(0, totalAmount);
  const safePaid = Math.max(0, paidAmount);
  const remaining = Math.max(0, Math.round((safeTotal - safePaid) * 100) / 100);
  return {
    remainingAmount: remaining,
    debtToAdd: remaining > 0 ? remaining : 0,
  };
}

/**
 * 10-tap secret detection logic
 * Returns true when 10 consecutive taps happen each with < 500ms difference
 */
export function checkSecretTaps(timestamps: number[], thresholdMs = 500, requiredTaps = 10): boolean {
  if (timestamps.length < requiredTaps) return false;
  const recent = timestamps.slice(-requiredTaps);
  for (let i = 1; i < recent.length; i++) {
    if (recent[i] - recent[i - 1] > thresholdMs) {
      return false;
    }
  }
  return true;
}

/**
 * Checks subscription validity
 */
export function getSubscriptionStatus(subscriptionEnd: number, now = Date.now()): {
  isExpired: boolean;
  daysRemaining: number;
  isTrial: boolean;
} {
  const diffMs = subscriptionEnd - now;
  const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const isExpired = subscriptionEnd < now;
  return {
    isExpired,
    daysRemaining,
    isTrial: daysRemaining <= 60,
  };
}

/**
 * Formats Yemeni Riyal currency nicely in Arabic
 */
export function formatCurrency(amount: number): string {
  let symbol = 'ر.ي';
  try {
    if (typeof localStorage !== 'undefined') {
      const preferences = JSON.parse(localStorage.getItem('grocery_pos_shared_prefs_clean_prod_v1') || '{}');
      if (typeof preferences.currency_symbol === 'string' && preferences.currency_symbol.trim()) symbol = preferences.currency_symbol.trim();
    }
  } catch { /* retain the Yemeni Riyal fallback */ }
  return `${Number(amount || 0).toLocaleString('ar-YE')} ${symbol}`;
}

/**
 * Calculates new subscription expiration timestamp.
 * In 'reset' mode (default): resets previous days and sets exact days starting from now.
 * In 'append' mode: extends existing subscription by adding days to current end.
 */
export function calculateNewSubscriptionEnd(
  currentEnd: number,
  additionalDays: number,
  modeOrFromNow: 'reset' | 'append' | boolean = 'reset',
  now = Date.now()
): number {
  const daysMs = Math.max(0, additionalDays) * 24 * 60 * 60 * 1000;
  if (modeOrFromNow === 'reset') {
    return now + daysMs;
  }
  if (modeOrFromNow === 'append' || modeOrFromNow === true) {
    const base = Math.max(currentEnd, now);
    return base + daysMs;
  }
  return currentEnd + daysMs;
}

/**
 * Calculates net total after discount
 */
export function calculateDiscountedTotal(subtotal: number, discount: number): number {
  const safeSubtotal = Math.max(0, subtotal);
  const safeDiscount = Math.max(0, discount);
  return Math.max(0, Math.round((safeSubtotal - safeDiscount) * 100) / 100);
}

/**
 * Checks if a credit sale exceeds a customer's credit limit
 */
export function checkCreditLimitWarning(
  currentDebt: number,
  newDebt: number,
  limit = 50000
): { isExceeded: boolean; exceededAmount: number; totalProjectedDebt: number } {
  const totalProjectedDebt = currentDebt + newDebt;
  const isExceeded = totalProjectedDebt > limit;
  const exceededAmount = isExceeded ? totalProjectedDebt - limit : 0;
  return {
    isExceeded,
    exceededAmount,
    totalProjectedDebt,
  };
}

/**
 * Checks product expiration status against current date
 */
export function checkItemExpiryStatus(
  expiryDateStr?: string,
  thresholdDays = 30,
  now = new Date()
): { isExpired: boolean; isNearExpiry: boolean; daysLeft: number } {
  if (!expiryDateStr) {
    return { isExpired: false, isNearExpiry: false, daysLeft: 9999 };
  }
  const expiry = new Date(expiryDateStr);
  const diffTime = expiry.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return {
    isExpired: daysLeft <= 0,
    isNearExpiry: daysLeft > 0 && daysLeft <= thresholdDays,
    daysLeft,
  };
}

/**
 * Validates package inputs for the owner panel
 */
export function validatePackageInput(
  name: string,
  days: number,
  price: number
): { isValid: boolean; error?: string } {
  if (!name || !name.trim()) {
    return { isValid: false, error: 'اسم الباقة مطلوب' };
  }
  if (!days || days <= 0) {
    return { isValid: false, error: 'مدة الباقة بالأيام يجب أن تكون أكبر من صفر' };
  }
  if (price === undefined || price < 0) {
    return { isValid: false, error: 'سعر الباقة يجب أن يكون صفراً أو أكثر' };
  }
  return { isValid: true };
}

/**
 * Toggles dark mode boolean state
 */
export function toggleTheme(currentDark: boolean): boolean {
  return !currentDark;
}

/**
 * Returns Tailwind class mappings for dark/light themes
 */
export function getThemeClasses(isDark: boolean) {
  return {
    isDark,
    // Screen container
    screenBg: isDark ? 'bg-[#0F1715] text-[#F3F4F6]' : 'bg-[#FAF8F3] text-gray-900',
    // Cards & Panels
    cardBg: isDark ? 'bg-[#18221E] border-emerald-900/60 text-gray-100 shadow-sm' : 'bg-white border-gray-200 text-gray-900 shadow-xs',
    cardBorder: isDark ? 'border-emerald-900/60' : 'border-gray-200',
    borderColor: isDark ? 'border-emerald-900/60' : 'border-gray-200',
    // Inputs & Selects
    inputBg: isDark ? 'bg-[#121B17] border-emerald-800/80 text-white placeholder-gray-500' : 'bg-[#FAF8F3] border-gray-300 text-gray-900',
    // Secondary subtle box
    secondaryBox: isDark ? 'bg-[#141F1A] border-emerald-900/50 text-gray-200' : 'bg-[#FAF8F3] border-gray-200 text-gray-800',
    // Text labels
    textPrimary: isDark ? 'text-[#F3F4F6]' : 'text-gray-900',
    textSecondary: isDark ? 'text-gray-400' : 'text-gray-600',
    textMuted: isDark ? 'text-gray-500' : 'text-gray-400',
    textBrand: isDark ? 'text-[#C9A961]' : 'text-[#0B3D2E]',
    // Status Bar & Bottom Nav
    statusBar: isDark ? 'bg-[#081813] text-emerald-200 border-b border-emerald-950' : 'bg-[#0B3D2E] text-white',
    bottomNav: isDark ? 'bg-[#050D0A] text-gray-400 border-t border-emerald-950/80' : 'bg-[#06231A] text-gray-300 border-t border-emerald-950/40',
  };
}

export interface ZReportSalesCalculation {
  totalSalesVolume: number;
  totalCashSales: number;
  totalCreditSales: number;
  totalNetworkSales: number;
  netCashInDrawer: number;
}

/**
 * Accurately calculates Z-Report financial figures for sales and drawer cash:
 * - Paid cash amount (paid_amount) enters the drawer regardless of whether invoice is fully cash or partial credit.
 * - Remaining unpaid debt (remaining_amount) is counted as credit sales (ديون).
 * - Total sales volume is the sum of full invoice values.
 * - Net cash in drawer subtracts cash returns from collected cash.
 */
export function calculateZReportBreakdown(
  sales: Array<{
    total_amount: number;
    paid_amount: number;
    remaining_amount: number;
    payment_type?: string;
  }>,
  cashReturnsAmount: number = 0
): ZReportSalesCalculation {
  let totalSalesVolume = 0;
  let totalCashSales = 0;
  let totalCreditSales = 0;
  let totalNetworkSales = 0;

  for (const s of sales) {
    const total = Number(s.total_amount) || 0;
    const paid = Number(s.paid_amount) || 0;
    const remaining = Number(s.remaining_amount) || 0;

    totalSalesVolume += total;

    // The remaining debt represents credit sales (المتبقي آجل / ديون)
    totalCreditSales += remaining;

    if (s.payment_type === 'شبكة') {
      totalNetworkSales += paid;
    } else {
      // For both pure cash ('نقداً') and partial credit ('آجل' with down payment),
      // paid_amount represents actual cash received into the cash drawer!
      totalCashSales += paid;
    }
  }

  const netCashInDrawer = Math.max(0, totalCashSales - cashReturnsAmount);

  return {
    totalSalesVolume,
    totalCashSales,
    totalCreditSales,
    totalNetworkSales,
    netCashInDrawer,
  };
}
