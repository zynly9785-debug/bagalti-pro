import test from 'node:test';
import assert from 'node:assert/strict';
import { clearApplicationRecords, runInExistingTransaction } from './sqliteTransactionUtils.ts';

test('clears records using run so it does not start a nested transaction', async () => {
  const calls: string[] = [];
  const fakeDb = {
    run: async (statement: string, values: unknown[] = [], transaction = true) => { calls.push(`run:${statement}|${JSON.stringify(values)}|transaction=${transaction}`); },
    execute: async () => { calls.push('execute'); },
  };
  await clearApplicationRecords(fakeDb);
  await runInExistingTransaction(fakeDb, 'INSERT INTO app_records VALUES(?,?,?,?)', ['product', 1, 'id', '{}']);
  assert.deepEqual(calls, [
    'run:DELETE FROM app_records;|[]|transaction=false',
    'run:INSERT INTO app_records VALUES(?,?,?,?)|["product",1,"id","{}"]|transaction=false',
  ]);
});
