import test from 'node:test';
import assert from 'node:assert/strict';
import { clearApplicationRecords } from './sqliteTransactionUtils.ts';

test('clears records using run so it does not start a nested transaction', async () => {
  const calls: string[] = [];
  const fakeDb = {
    run: async (statement: string) => { calls.push(`run:${statement}`); },
    execute: async () => { calls.push('execute'); },
  };
  await clearApplicationRecords(fakeDb);
  assert.deepEqual(calls, ['run:DELETE FROM app_records;']);
});
