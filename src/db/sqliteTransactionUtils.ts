type SqliteRunner = {
  run: (statement: string, values?: unknown[], transaction?: boolean) => Promise<unknown>;
};

/** Run a statement inside the caller's open transaction without starting a nested transaction. */
export async function runInExistingTransaction(db: SqliteRunner, statement: string, values: unknown[] = []): Promise<void> {
  await db.run(statement, values, false);
}

export async function clearApplicationRecords(db: SqliteRunner): Promise<void> {
  await runInExistingTransaction(db, 'DELETE FROM app_records;');
}
