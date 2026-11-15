import test from 'node:test';
import assert from 'node:assert/strict';
import { authAliasForPhone, normalizePhoneForAuth } from '../utils/phoneAuth.ts';

test('normalizes Yemeni local phone input to E.164', () => {
  assert.equal(normalizePhoneForAuth('0778 228 995'), '+967778228995');
  assert.equal(normalizePhoneForAuth('967778228995'), '+967778228995');
  assert.equal(normalizePhoneForAuth('+967 778-228-995'), '+967778228995');
});

test('generates a deterministic non-deliverable auth alias without exposing the phone', () => {
  const alias = authAliasForPhone('+967778228995');
  assert.equal(alias, 'p967778228995@login.baqalati-pro.app');
  assert.ok(!alias.includes('+'));
  assert.equal(authAliasForPhone('0778228995'), alias);
});

test('rejects malformed phone numbers before any authentication request', () => {
  assert.throws(() => normalizePhoneForAuth('abc'), /رقم هاتف صحيح/);
  assert.throws(() => authAliasForPhone('123'), /رقم هاتف صحيح/);
});
