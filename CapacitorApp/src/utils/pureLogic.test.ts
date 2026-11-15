import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCartonUnitPrices,
  calculateSaleRemaining,
  checkSecretTaps,
  getSubscriptionStatus,
  calculateNewSubscriptionEnd,
  validatePackageInput,
  calculateDiscountedTotal,
  checkCreditLimitWarning,
  checkItemExpiryStatus,
  toggleTheme,
  getThemeClasses,
  calculateZReportBreakdown,
} from './pureLogic.js';

test('calculateCartonUnitPrices divides carton price by pieces correctly', () => {
  const result = calculateCartonUnitPrices(12000, 15000, 24);
  assert.equal(result.unitCostPrice, 500);
  assert.equal(result.unitSalePrice, 625);
});

test('calculateCartonUnitPrices handles division by zero or negative', () => {
  const result = calculateCartonUnitPrices(12000, 15000, 0);
  assert.equal(result.unitCostPrice, 0);
  assert.equal(result.unitSalePrice, 0);
});

test('calculateSaleRemaining calculates remaining and debtToAdd correctly', () => {
  const full = calculateSaleRemaining(5000, 5000);
  assert.equal(full.remainingAmount, 0);
  assert.equal(full.debtToAdd, 0);

  const partial = calculateSaleRemaining(5000, 3000);
  assert.equal(partial.remainingAmount, 2000);
  assert.equal(partial.debtToAdd, 2000);

  const overpaid = calculateSaleRemaining(5000, 6000);
  assert.equal(overpaid.remainingAmount, 0);
  assert.equal(overpaid.debtToAdd, 0);
});

test('checkSecretTaps detects 10 consecutive taps within 500ms', () => {
  const base = 1000000;
  // 10 taps spaced by 200ms
  const validTaps = Array.from({ length: 10 }, (_, i) => base + i * 200);
  assert.equal(checkSecretTaps(validTaps), true);

  // 10 taps with one gap of 600ms
  const invalidTaps = [...validTaps];
  invalidTaps[5] += 600;
  assert.equal(checkSecretTaps(invalidTaps), false);

  // Less than 10 taps
  assert.equal(checkSecretTaps(validTaps.slice(0, 9)), false);
});

test('getSubscriptionStatus calculates remaining days and expiration', () => {
  const now = 1000000000000;
  const in30Days = now + 30 * 24 * 60 * 60 * 1000;
  const status1 = getSubscriptionStatus(in30Days, now);
  assert.equal(status1.isExpired, false);
  assert.equal(status1.daysRemaining, 30);
  assert.equal(status1.isTrial, true);

  const past = now - 5 * 24 * 60 * 60 * 1000;
  const status2 = getSubscriptionStatus(past, now);
  assert.equal(status2.isExpired, true);
});

test('calculateNewSubscriptionEnd computes days correctly in reset and append modes', () => {
  const now = 1000000000000;
  const activeEnd = now + 45 * 24 * 60 * 60 * 1000; // Store currently has 45 days left

  // In reset mode (default): previous 45 days are cleared, sets exactly 30 days from now
  const resetEnd = calculateNewSubscriptionEnd(activeEnd, 30, 'reset', now);
  assert.equal(resetEnd, now + 30 * 24 * 60 * 60 * 1000);

  // In append mode: adds 30 days on top of the existing 45 days (45 + 30 = 75 days)
  const appendEnd = calculateNewSubscriptionEnd(activeEnd, 30, 'append', now);
  assert.equal(appendEnd, activeEnd + 30 * 24 * 60 * 60 * 1000);

  // Expired should count 10 days from now
  const expiredEnd = now - 50000;
  const newEnd1 = calculateNewSubscriptionEnd(expiredEnd, 10, true, now);
  assert.equal(newEnd1, now + 10 * 24 * 60 * 60 * 1000);
});

test('validatePackageInput validates name, days, and price', () => {
  assert.equal(validatePackageInput('باقة ذهبية', 90, 15000).isValid, true);
  assert.equal(validatePackageInput('', 90, 15000).isValid, false);
  assert.equal(validatePackageInput('باقة', 0, 15000).isValid, false);
  assert.equal(validatePackageInput('باقة', -5, 15000).isValid, false);
  assert.equal(validatePackageInput('باقة', 30, -100).isValid, false);
});

test('calculateDiscountedTotal applies discount cleanly without negative total', () => {
  assert.equal(calculateDiscountedTotal(5000, 500), 4500);
  assert.equal(calculateDiscountedTotal(5000, 6000), 0);
  assert.equal(calculateDiscountedTotal(5000, -100), 5000);
});

test('checkCreditLimitWarning alerts when total debt exceeds allowed limit', () => {
  const normal = checkCreditLimitWarning(20000, 5000, 50000);
  assert.equal(normal.isExceeded, false);
  assert.equal(normal.totalProjectedDebt, 25000);

  const exceeded = checkCreditLimitWarning(45000, 10000, 50000);
  assert.equal(exceeded.isExceeded, true);
  assert.equal(exceeded.exceededAmount, 5000);
  assert.equal(exceeded.totalProjectedDebt, 55000);
});

test('checkItemExpiryStatus detects expired and near-expiry items', () => {
  const now = new Date('2026-10-31');
  const expired = checkItemExpiryStatus('2026-10-20', 30, now);
  assert.equal(expired.isExpired, true);

  const near = checkItemExpiryStatus('2026-11-15', 30, now);
  assert.equal(near.isExpired, false);
  assert.equal(near.isNearExpiry, true);

  const safe = checkItemExpiryStatus('2027-05-01', 30, now);
  assert.equal(safe.isExpired, false);
  assert.equal(safe.isNearExpiry, false);
});

test('toggleTheme alternates between light and dark modes', () => {
  assert.equal(toggleTheme(false), true);
  assert.equal(toggleTheme(true), false);
});

test('getThemeClasses provides distinct dark and light styling palettes', () => {
  const light = getThemeClasses(false);
  const dark = getThemeClasses(true);

  assert.equal(light.isDark, false);
  assert.equal(dark.isDark, true);
  assert.match(light.screenBg, /FAF8F3/);
  assert.match(dark.screenBg, /0F1715/);
  assert.match(dark.cardBg, /18221E/);
  assert.match(light.cardBg, /white/);
});

test('calculateZReportBreakdown accurately calculates partial credit (1250 total, 500 paid, 750 remaining)', () => {
  // The exact user case: Sale of 1250, paid 500 cash, 750 remaining credit
  const sales = [
    {
      total_amount: 1250,
      paid_amount: 500,
      remaining_amount: 750,
      payment_type: 'آجل',
    },
  ];

  const report = calculateZReportBreakdown(sales, 0);

  // Cash in drawer must be 500
  assert.equal(report.totalCashSales, 500);
  // Remaining credit must be 750
  assert.equal(report.totalCreditSales, 750);
  // Full volume must be 1250
  assert.equal(report.totalSalesVolume, 1250);
  // Net cash in drawer must match physical cash collected (500)
  assert.equal(report.netCashInDrawer, 500);
});

test('calculateZReportBreakdown handles mixed invoices (pure cash, partial credit, and full debt) with returns', () => {
  const sales = [
    { total_amount: 1250, paid_amount: 500, remaining_amount: 750, payment_type: 'آجل' },
    { total_amount: 800, paid_amount: 800, remaining_amount: 0, payment_type: 'نقداً' },
    { total_amount: 400, paid_amount: 0, remaining_amount: 400, payment_type: 'آجل' },
  ];

  const report = calculateZReportBreakdown(sales, 200); // 200 cash returns refunded from drawer

  // Cash collected = 500 + 800 + 0 = 1300
  assert.equal(report.totalCashSales, 1300);
  // Credit receivables = 750 + 0 + 400 = 1150
  assert.equal(report.totalCreditSales, 1150);
  // Total sales volume = 1250 + 800 + 400 = 2450
  assert.equal(report.totalSalesVolume, 2450);
  // Drawer cash = 1300 - 200 = 1100
  assert.equal(report.netCashInDrawer, 1100);
});

