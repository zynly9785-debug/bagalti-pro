import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APP_VERSION,
  OFFICIAL_APK_DOWNLOAD_URL,
  OWNER_SUPPORT_PHONE,
  buildAppShareMessage,
  buildPackageActivationMessage,
  calculatePiecePurchaseBreakdown,
  computeInventoryAudit,
  evaluateCalculatorExpression,
  isStoreRestricted,
  scanCooldownCheck,
  validateFullNameParts,
  validateStructuredFullName,
} from './appRules.ts';

test('validateFullNameParts enforces 4 or 5 full name parts including compound Arabic names', () => {
  assert.equal(validateFullNameParts('محمد أحمد').isValid, false);
  assert.equal(validateFullNameParts('محمد أحمد علي').isValid, false);
  assert.equal(validateFullNameParts('أحمد محمد علي صالح يحيى سيف').isValid, false);
  assert.equal(validateFullNameParts('محمد أحمد علي صالح').isValid, true);
  assert.equal(validateFullNameParts('  محمد   أحمد علي صالح المعمري ').isValid, true);
  assert.equal(validateFullNameParts('أحمد عبد الله محمد صالح الحيمي').isValid, true);
  assert.equal(validateFullNameParts('عبد الرحمن صلاح الدين علي آل حيمي').isValid, true);
  assert.equal(validateFullNameParts('م أ ع ص').isValid, false);
});

test('validateStructuredFullName supports 4th+surname and surname-only 4th field', () => {
  const fiveParts = validateStructuredFullName({
    firstName: 'أحمد',
    secondName: 'عبد الله',
    thirdName: 'محمد',
    fourthAndLastName: 'صالح الحيمي',
  });
  assert.equal(fiveParts.isValid, true);
  assert.equal(fiveParts.combinedName, 'أحمد عبد الله محمد صالح الحيمي');
  assert.equal(fiveParts.parts.length, 5);

  const fourPartsNoFourth = validateStructuredFullName({
    firstName: 'أحمد',
    secondName: 'محمد',
    thirdName: 'علي',
    fourthAndLastName: 'الحيمي',
  });
  assert.equal(fourPartsNoFourth.isValid, true);
  assert.equal(fourPartsNoFourth.parts.length, 4);

  const missingThird = validateStructuredFullName({
    firstName: 'أحمد',
    secondName: 'محمد',
    thirdName: '',
    fourthAndLastName: 'الحيمي',
  });
  assert.equal(missingThird.isValid, false);
  assert.match(missingThird.error || '', /الاسم الثالث/);

  const tooManyInFirst = validateStructuredFullName({
    firstName: 'أحمد محمد',
    secondName: 'علي',
    thirdName: 'صالح',
    fourthAndLastName: 'الحيمي',
  });
  assert.equal(tooManyInFirst.isValid, false);
});

test('isStoreRestricted detects suspended or expired stores accurately', () => {
  const now = 1_700_000_000_000;
  assert.deepEqual(isStoreRestricted(null, now), { restricted: false, reason: null });
  assert.equal(
    isStoreRestricted({ status: 'active', subscription_end: now + 86_400_000 }, now).restricted,
    false,
  );
  assert.equal(
    isStoreRestricted({ status: 'suspended', subscription_end: now + 86_400_000, suspension_reason: 'تأخر سداد' }, now)
      .reason,
    'suspended',
  );
  assert.equal(
    isStoreRestricted({ status: 'active', subscription_end: now - 1000 }, now).reason,
    'expired',
  );
});

test('calculatePiecePurchaseBreakdown calculates unit cost, unit profit, and total profit', () => {
  const res = calculatePiecePurchaseBreakdown(2400, 12, 250);
  assert.equal(res.isValid, true);
  assert.equal(res.unitCostPrice, 200);
  assert.equal(res.unitProfit, 50);
  assert.equal(res.totalProfit, 600);

  const single = calculatePiecePurchaseBreakdown(100, 1, 150);
  assert.equal(single.unitCostPrice, 100);
  assert.equal(single.unitProfit, 50);
  assert.equal(single.totalProfit, 50);

  assert.equal(calculatePiecePurchaseBreakdown(100, 0, 150).isValid, false);
});

test('scanCooldownCheck blocks accidental double-read within cooldown while allowing distinct codes', () => {
  assert.equal(scanCooldownCheck(null, 0, '6281001', 1000), true);
  assert.equal(scanCooldownCheck('6281001', 1000, '6281001', 1500, 1500), false);
  assert.equal(scanCooldownCheck('6281001', 1000, '6281002', 1200, 1500), true);
  assert.equal(scanCooldownCheck('6281001', 1000, '6281001', 2600, 1500), true);
});

test('computeInventoryAudit builds complete store valuation and warnings', () => {
  const audit = computeInventoryAudit(
    [
      {
        id: 1,
        store_id: 1,
        name: 'حليب',
        barcode: '111',
        unit_type: 'قطعة',
        category: 'ألبان',
        cost_price: 200,
        sale_price: 250,
        quantity: 10,
        min_stock: 5,
        is_active: 1,
      },
      {
        id: 2,
        store_id: 1,
        name: 'عصير',
        barcode: '222',
        unit_type: 'قطعة',
        category: 'مشروبات',
        cost_price: 100,
        sale_price: 150,
        quantity: 2,
        min_stock: 5,
        expiry_date: '2020-01-01',
        is_active: 1,
      },
    ],
    'بقالة الاختبار',
    new Date('2026-11-24T12:00:00Z'),
  );
  assert.equal(audit.totalSkus, 2);
  assert.equal(audit.totalBaseUnits, 12);
  assert.equal(audit.totalCostValue, 2200);
  assert.equal(audit.totalRetailValue, 2800);
  assert.equal(audit.expectedGrossProfit, 600);
  assert.equal(audit.lowStockProducts.length, 1);
  assert.equal(audit.expiredProducts.length, 1);
  assert.ok(audit.formattedText.includes('بقالة الاختبار'));
});

test('evaluateCalculatorExpression computes standard grocery math accurately', () => {
  assert.deepEqual(evaluateCalculatorExpression('250+150'), { ok: true, value: '400' });
  assert.deepEqual(evaluateCalculatorExpression('100+25×4'), { ok: true, value: '200' });
  assert.deepEqual(evaluateCalculatorExpression('1000÷8'), { ok: true, value: '125' });
  const divZero = evaluateCalculatorExpression('50÷0');
  assert.equal(divZero.ok, false);
});

test('official APK link, version, and support phone stay intact', () => {
  assert.equal(APP_VERSION, '1.4.6');
  assert.equal(OWNER_SUPPORT_PHONE, '+967778228995');
  assert.ok(buildAppShareMessage().includes(OFFICIAL_APK_DOWNLOAD_URL));
  assert.ok(buildPackageActivationMessage('باقة سنوية', 365, 25000, 'بقالة النور').includes('باقة سنوية'));
});
