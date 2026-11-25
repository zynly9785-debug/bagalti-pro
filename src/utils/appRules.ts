/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Product, User } from '../types/index.ts';
import { checkItemExpiryStatus, formatCurrency } from './pureLogic.ts';

export const APP_VERSION = '1.4.6';
export const OWNER_SUPPORT_PHONE = '+967778228995';
export const OWNER_SUPPORT_WHATSAPP_DIGITS = '967778228995';
export const OFFICIAL_APK_DOWNLOAD_URL =
  'https://unylexdkocktkzwvawsu.supabase.co/storage/v1/object/public/APK/baqalaty.apk';

export interface NameValidationResult {
  isValid: boolean;
  parts: string[];
  normalized: string;
  error?: string;
}

export interface StructuredFullNameInput {
  firstName: string;
  secondName: string;
  thirdName: string;
  fourthAndLastName: string;
}

export interface StructuredNameValidationResult {
  isValid: boolean;
  combinedName: string;
  parts: string[];
  error?: string;
}

const COMPOUND_LEADING_TOKENS = new Set([
  'عبد',
  'أبو',
  'ابو',
  'أبي',
  'ابي',
  'أم',
  'ام',
  'ذو',
  'ذي',
  'آل',
  'ال',
  'بن',
  'ابن',
  'بنت',
]);

const COMPOUND_TRAILING_TOKENS = new Set(['الدين', 'الله', 'الإسلام', 'الاسلام', 'الملك', 'العابدين']);

function cleanArabicNameText(value: string): string {
  return (value || '')
    .replace(/\u0640/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripArabicDiacritics(value: string): string {
  return value.replace(/[\u064B-\u065F\u0670]/g, '').trim();
}

/**
 * Merges common two-token Arabic compound names (e.g. "عبد الله", "صلاح الدين", "آل حيمي")
 * into single logical name parts so 4-part and 5-part names are counted accurately.
 */
export function mergeCompoundArabicTokens(tokens: string[]): string[] {
  const merged: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const cur = tokens[i];
    const next = tokens[i + 1];
    const curClean = stripArabicDiacritics(cur);
    const nextClean = next ? stripArabicDiacritics(next) : '';

    if (next && COMPOUND_LEADING_TOKENS.has(curClean)) {
      merged.push(`${cur} ${next}`);
      i += 2;
      continue;
    }
    if (next && COMPOUND_TRAILING_TOKENS.has(nextClean)) {
      merged.push(`${cur} ${next}`);
      i += 2;
      continue;
    }
    merged.push(cur);
    i += 1;
  }
  return merged;
}

/**
 * Enforces mandatory 4-part or 5-part full merchant name on registration,
 * accurately recognizing compound Arabic names.
 */
export function validateFullNameParts(name: string): NameValidationResult {
  const normalized = cleanArabicNameText(name);
  const rawParts = normalized ? normalized.split(' ').filter((p) => p.length > 0) : [];
  const parts = mergeCompoundArabicTokens(rawParts);
  if (parts.length !== 4 && parts.length !== 5) {
    return {
      isValid: false,
      parts,
      normalized,
      error: 'يرجى إدخال الاسم الرباعي أو الخماسي كاملاً (4 أو 5 أسماء) للمتابعة',
    };
  }
  const hasShortPart = parts.some((p) => stripArabicDiacritics(p).replace(/\s+/g, '').length < 2);
  if (hasShortPart) {
    return {
      isValid: false,
      parts,
      normalized,
      error: 'يجب أن يحتوي كل اسم من الاسم الرباعي أو الخماسي على حرفين على الأقل',
    };
  }
  return { isValid: true, parts, normalized };
}

/**
 * Validates the 4 structured registration name fields:
 * 1) First name, 2) Second name, 3) Third name, 4) Fourth name + surname (or surname directly if no fourth name).
 */
export function validateStructuredFullName(input: StructuredFullNameInput): StructuredNameValidationResult {
  const fields: Array<{ value: string; label: string; allowTwoParts?: boolean }> = [
    { value: input.firstName, label: 'الاسم الأول' },
    { value: input.secondName, label: 'الاسم الثاني' },
    { value: input.thirdName, label: 'الاسم الثالث' },
    { value: input.fourthAndLastName, label: 'الاسم الرابع واللقب', allowTwoParts: true },
  ];

  const normalizedFields: string[] = [];
  const allLogicalParts: string[] = [];

  for (const field of fields) {
    const cleaned = cleanArabicNameText(field.value);
    if (!cleaned) {
      return {
        isValid: false,
        combinedName: '',
        parts: allLogicalParts,
        error: `يرجى إدخال ${field.label}`,
      };
    }
    const rawTokens = cleaned.split(' ').filter((t) => t.length > 0);
    const logicalParts = mergeCompoundArabicTokens(rawTokens);
    const maxAllowed = field.allowTwoParts ? 2 : 1;

    if (logicalParts.length > maxAllowed) {
      return {
        isValid: false,
        combinedName: '',
        parts: allLogicalParts,
        error: field.allowTwoParts
          ? 'حقل الاسم الرابع واللقب يقبل الاسم الرابع مع اللقب، أو اللقب مباشرة (اسم أو اسمان فقط)'
          : `يرجى كتابة ${field.label} فقط في هذا الحقل`,
      };
    }

    if (logicalParts.some((p) => stripArabicDiacritics(p).replace(/\s+/g, '').length < 2)) {
      return {
        isValid: false,
        combinedName: '',
        parts: allLogicalParts,
        error: `يجب أن يحتوي ${field.label} على حرفين على الأقل`,
      };
    }

    normalizedFields.push(cleaned);
    allLogicalParts.push(...logicalParts);
  }

  const combinedName = normalizedFields.join(' ');
  const fullCheck = validateFullNameParts(combinedName);
  if (!fullCheck.isValid) {
    return {
      isValid: false,
      combinedName,
      parts: fullCheck.parts,
      error: fullCheck.error,
    };
  }

  return {
    isValid: true,
    combinedName: fullCheck.normalized,
    parts: fullCheck.parts,
  };
}

export interface StoreRestrictionState {
  restricted: boolean;
  reason: 'suspended' | 'expired' | null;
  message?: string;
}

/**
 * Determines whether a merchant store is restricted due to suspension or expired subscription.
 * Note: Does NOT restrict the Customers & Debt module per product requirements.
 */
export function isStoreRestricted(
  user: Pick<User, 'status' | 'subscription_end' | 'suspension_reason'> | null | undefined,
  now = Date.now(),
): StoreRestrictionState {
  if (!user) {
    return { restricted: false, reason: null };
  }
  if (user.status === 'suspended') {
    return {
      restricted: true,
      reason: 'suspended',
      message: user.suspension_reason?.trim()
        ? `تم إيقاف الحساب: ${user.suspension_reason.trim()} — تصفح التقارير والنسخ الاحتياطي فقط متاحان.`
        : 'تم إيقاف الحساب من الإدارة — تصفح التقارير والنسخ الاحتياطي فقط متاحان.',
    };
  }
  if (Number.isFinite(user.subscription_end) && user.subscription_end <= now) {
    return {
      restricted: true,
      reason: 'expired',
      message: 'انتهت صلاحية الاشتراك — يرجى تجديد الاشتراك مع الإدارة لاستعادة كامل الصلاحيات.',
    };
  }
  return { restricted: false, reason: null };
}

export interface PiecePurchaseBreakdown {
  isValid: boolean;
  purchasedQty: number;
  totalPurchaseCost: number;
  unitCostPrice: number;
  salePrice: number;
  unitProfit: number;
  totalProfit: number;
}

/**
 * Computes piece purchase economics when entering purchase price and number of purchased pieces.
 * When purchasedQty > 1, divides totalPurchaseAmount by purchasedQty to compute base-unit cost.
 * When purchasedQty === 1, unitCost equals totalPurchaseAmount.
 */
export function calculatePiecePurchaseBreakdown(
  purchasePriceInput: number,
  purchasedQtyInput: number,
  salePriceInput: number,
): PiecePurchaseBreakdown {
  const purchasedQty = Number.isFinite(purchasedQtyInput) && purchasedQtyInput > 0 ? purchasedQtyInput : 0;
  const totalPurchaseCost = Number.isFinite(purchasePriceInput) && purchasePriceInput >= 0 ? purchasePriceInput : 0;
  const salePrice = Number.isFinite(salePriceInput) && salePriceInput >= 0 ? salePriceInput : 0;

  if (purchasedQty <= 0) {
    return {
      isValid: false,
      purchasedQty: 0,
      totalPurchaseCost,
      unitCostPrice: 0,
      salePrice,
      unitProfit: 0,
      totalProfit: 0,
    };
  }

  const unitCostPrice = Math.round((totalPurchaseCost / purchasedQty) * 100) / 100;
  const unitProfit = Math.round((salePrice - unitCostPrice) * 100) / 100;
  const totalProfit = Math.round(unitProfit * purchasedQty * 100) / 100;

  return {
    isValid: true,
    purchasedQty,
    totalPurchaseCost,
    unitCostPrice,
    salePrice,
    unitProfit,
    totalProfit,
  };
}

/**
 * Cooldown guard for continuous POS barcode scanning: prevents unintentional duplicate reads
 * while a barcode remains inside the camera frame, while letting distinct barcodes scan immediately.
 */
export function scanCooldownCheck(
  lastCode: string | null,
  lastScannedAt: number,
  nextCode: string,
  now: number,
  cooldownMs = 1500,
): boolean {
  const cleanNext = nextCode.trim();
  if (!cleanNext) return false;
  if (!lastCode || lastCode !== cleanNext) return true;
  return now - lastScannedAt >= cooldownMs;
}

export interface CategoryAuditSummary {
  category: string;
  productCount: number;
  totalUnits: number;
  costValue: number;
  retailValue: number;
}

export interface InventoryAuditReport {
  generatedAt: string;
  totalSkus: number;
  totalBaseUnits: number;
  totalCostValue: number;
  totalRetailValue: number;
  expectedGrossProfit: number;
  lowStockProducts: Product[];
  expiredProducts: Product[];
  nearExpiryProducts: Product[];
  categories: CategoryAuditSummary[];
  formattedText: string;
}

/**
 * Computes full store inventory audit report & formatted share text.
 */
export function computeInventoryAudit(
  products: Product[],
  storeName = 'متجري',
  now = new Date(),
): InventoryAuditReport {
  const active = products.filter((p) => p.is_active === 1);
  let totalBaseUnits = 0;
  let totalCostValue = 0;
  let totalRetailValue = 0;
  const lowStockProducts: Product[] = [];
  const expiredProducts: Product[] = [];
  const nearExpiryProducts: Product[] = [];
  const categoryMap = new Map<string, CategoryAuditSummary>();

  for (const product of active) {
    const qty = Math.max(0, Number(product.quantity) || 0);
    const cost = Math.max(0, Number(product.cost_price) || 0);
    const sale = Math.max(0, Number(product.sale_price) || 0);
    totalBaseUnits += qty;
    totalCostValue += qty * cost;
    totalRetailValue += qty * sale;

    if (qty <= (Number(product.min_stock) || 0)) {
      lowStockProducts.push(product);
    }
    const exp = checkItemExpiryStatus(product.expiry_date, 30, now);
    if (exp.isExpired) expiredProducts.push(product);
    else if (exp.isNearExpiry) nearExpiryProducts.push(product);

    const cat = product.category?.trim() || 'بدون تصنيف';
    const current = categoryMap.get(cat) ?? {
      category: cat,
      productCount: 0,
      totalUnits: 0,
      costValue: 0,
      retailValue: 0,
    };
    current.productCount += 1;
    current.totalUnits += qty;
    current.costValue += qty * cost;
    current.retailValue += qty * sale;
    categoryMap.set(cat, current);
  }

  totalCostValue = Math.round(totalCostValue * 100) / 100;
  totalRetailValue = Math.round(totalRetailValue * 100) / 100;
  const expectedGrossProfit = Math.round((totalRetailValue - totalCostValue) * 100) / 100;
  const categories = [...categoryMap.values()].sort((a, b) => b.retailValue - a.retailValue);
  const generatedAt = now.toLocaleString('ar-YE');

  const lines = [
    `📦 تقرير جرد المخزون الشامل — ${storeName}`,
    `تاريخ الجرد: ${generatedAt}`,
    `────────────────────────`,
    `• إجمالي الأصناف النشطة: ${active.length} صنف`,
    `• إجمالي الكميات بالمخزون: ${Math.round(totalBaseUnits * 1000) / 1000} وحدة أساسية`,
    `• إجمالي قيمة التكلفة: ${formatCurrency(totalCostValue)}`,
    `• إجمالي القيمة البيعية: ${formatCurrency(totalRetailValue)}`,
    `• الربح المتوقع من المخزون: ${formatCurrency(expectedGrossProfit)}`,
    `• أصناف منخفضة المخزون: ${lowStockProducts.length}`,
    `• أصناف منتهية الصلاحية: ${expiredProducts.length}`,
    `• أصناف قريبة الانتهاء (≤ 30 يوم): ${nearExpiryProducts.length}`,
    '',
    '📊 توزيع التصنيفات:',
    ...(categories.length
      ? categories.map(
          (c) =>
            `- ${c.category}: ${c.productCount} صنف | ${Math.round(c.totalUnits * 100) / 100} وحدة | قيمة بيع ${formatCurrency(c.retailValue)}`,
        )
      : ['- لا توجد أصناف مسجلة']),
  ];

  if (lowStockProducts.length > 0) {
    lines.push('', '⚠️ أصناف تحتاج تعزيزاً:');
    lowStockProducts.slice(0, 15).forEach((p) => {
      lines.push(`- ${p.name}: المتبقي ${p.quantity} (الحد ${p.min_stock})`);
    });
  }

  return {
    generatedAt,
    totalSkus: active.length,
    totalBaseUnits: Math.round(totalBaseUnits * 1000) / 1000,
    totalCostValue,
    totalRetailValue,
    expectedGrossProfit,
    lowStockProducts,
    expiredProducts,
    nearExpiryProducts,
    categories,
    formattedText: lines.join('\n'),
  };
}

/**
 * Evaluates a safe arithmetic expression from the Dashboard Calculator.
 * Supports +, -, ×/*, ÷//, decimals. Returns error string on invalid math / divide by zero.
 */
export function evaluateCalculatorExpression(expr: string): { ok: true; value: string } | { ok: false; error: string } {
  const normalized = (expr || '')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/[^0-9+\-*/.]/g, '');

  if (!normalized) return { ok: true, value: '0' };
  const tokens = normalized.match(/\d*\.?\d+|[+\-*/]/g);
  if (!tokens || !tokens.length) return { ok: false, error: 'صيغة غير صالحة' };

  // Parse numbers and operators left-to-right respecting * and / precedence
  const values: number[] = [];
  const ops: string[] = [];

  let expectNumber = true;
  let pendingSign = 1;

  for (const token of tokens) {
    if (expectNumber) {
      if (token === '-') {
        pendingSign *= -1;
        continue;
      }
      if (token === '+') continue;
      if (/^[*/]$/.test(token)) return { ok: false, error: 'صيغة غير صالحة' };
      const num = Number(token) * pendingSign;
      if (!Number.isFinite(num)) return { ok: false, error: 'رقم غير صالح' };
      values.push(num);
      pendingSign = 1;
      expectNumber = false;
    } else {
      if (!/^[+\-*/]$/.test(token)) return { ok: false, error: 'صيغة غير صالحة' };
      ops.push(token);
      expectNumber = true;
    }
  }

  if (values.length === 0) return { ok: true, value: '0' };
  if (ops.length >= values.length) ops.pop();

  // Pass 1: * and /
  const passValues: number[] = [values[0]];
  const passOps: string[] = [];
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const rhs = values[i + 1];
    if (op === '*') {
      passValues[passValues.length - 1] *= rhs;
    } else if (op === '/') {
      if (rhs === 0) return { ok: false, error: 'لا يمكن القسمة على صفر' };
      passValues[passValues.length - 1] /= rhs;
    } else {
      passOps.push(op);
      passValues.push(rhs);
    }
  }

  // Pass 2: + and -
  let result = passValues[0];
  for (let i = 0; i < passOps.length; i++) {
    result = passOps[i] === '+' ? result + passValues[i + 1] : result - passValues[i + 1];
  }

  if (!Number.isFinite(result)) return { ok: false, error: 'خطأ في الحساب' };
  const rounded = Math.round(result * 1_000_000) / 1_000_000;
  return { ok: true, value: String(rounded) };
}

export function buildAppShareMessage(): string {
  return [
    '📲 تطبيق بقالتي برو (Baqalaty Pro)',
    'نظام ذكي ومتكامل لإدارة البقالات ونقاط البيع والمخزون والعملاء والديون دون إنترنت مع المزامنة السحابية.',
    '',
    '⬇️ رابط التحميل الرسمي للتطبيق:',
    OFFICIAL_APK_DOWNLOAD_URL,
  ].join('\n');
}

export function buildPackageActivationMessage(pkgName: string, days: number, price: number, storeName?: string): string {
  const storeLine = storeName ? `المتجر: ${storeName}\n` : '';
  return [
    'مرحباً، أرغب في تفعيل باقة الاشتراك التالية في تطبيق بقالتي برو:',
    storeLine + `الباقة: ${pkgName}`,
    `المدة: ${days} يوم`,
    `السعر: ${formatCurrency(price)}`,
  ].join('\n');
}
