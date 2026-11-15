type SqliteRunner = {
  run: (statement: string, values?: unknown[]) => Promise<unknown>;
};

/** Execute a single mutation with run(), which participates in the current transaction. */
export async function clearApplicationRecords(db: SqliteRunner): Promise<void> {
  await db.run('DELETE FROM app_records;');
}
