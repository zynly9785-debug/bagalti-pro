import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';
import { clearApplicationRecords, runInExistingTransaction } from './sqliteTransactionUtils.ts';

const DATABASE_NAME = 'bagalati_pro';
const DATABASE_VERSION = 1;

type StoredRow = { entity: string; store_id: number; record_id: string; payload_json: string };

/** Native Android persistence backed by encrypted SQLite/SQLCipher. */
export class NativeSqliteStore {
  private connection: SQLiteConnection | null = null;
  private database: SQLiteDBConnection | null = null;
  private writeQueue: Promise<void> = Promise.resolve();
  private lastError: string | null = null;

  get isOpen(): boolean { return this.database !== null; }
  get error(): string | null { return this.lastError; }

  async open(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    const storedSecret = await CapacitorSQLite.isSecretStored();
    if (!storedSecret.result) {
      const bytes = new Uint8Array(32);
      globalThis.crypto.getRandomValues(bytes);
      const passphrase = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
      await CapacitorSQLite.setEncryptionSecret({ passphrase });
    }

    this.connection = new SQLiteConnection(CapacitorSQLite);
    await this.connection.checkConnectionsConsistency();
    const exists = await this.connection.isConnection(DATABASE_NAME, false);
    this.database = exists.result
      ? await this.connection.retrieveConnection(DATABASE_NAME, false)
      : await this.connection.createConnection(DATABASE_NAME, true, 'secret', DATABASE_VERSION, false);
    await this.database.open();
    await this.database.execute(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS app_records (
        entity TEXT NOT NULL,
        store_id INTEGER NOT NULL DEFAULT 0,
        record_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        PRIMARY KEY (entity, store_id, record_id)
      );
      CREATE INDEX IF NOT EXISTS app_records_store_entity_idx ON app_records(store_id, entity);
      CREATE TABLE IF NOT EXISTS app_metadata (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS app_preferences (
        key TEXT PRIMARY KEY NOT NULL,
        value_json TEXT NOT NULL
      );
    `);
  }

  async loadState<T>(): Promise<T | null> {
    const db = this.requireDatabase();
    const marker = await db.query("SELECT value FROM app_metadata WHERE key = 'state_schema_version' LIMIT 1");
    if (!marker.values?.length) return null;

    const result = await db.query('SELECT entity, store_id, record_id, payload_json FROM app_records ORDER BY entity, store_id, record_id');
    const state: Record<string, unknown[]> = {};
    for (const row of (result.values || []) as StoredRow[]) {
      if (!state[row.entity]) state[row.entity] = [];
      state[row.entity].push(JSON.parse(row.payload_json));
    }
    return state as T;
  }

  async replaceState(state: unknown): Promise<void> {
    const db = this.requireDatabase();
    const rows = this.toRows(state);
    await db.beginTransaction();
    try {
      await clearApplicationRecords(db);
      for (const row of rows) await this.upsertRow(db, row);
      await runInExistingTransaction(db, "INSERT INTO app_metadata(key,value) VALUES('state_schema_version','1') ON CONFLICT(key) DO UPDATE SET value=excluded.value");
      await db.commitTransaction();
    } catch (error) {
      await db.rollbackTransaction().catch(() => undefined);
      throw error;
    }
  }

  saveStateDelta(previous: unknown, next: unknown): void {
    this.enqueue(async () => {
      const db = this.requireDatabase();
      const before = new Map(this.toRows(previous).map((row) => [this.rowKey(row), row]));
      const after = new Map(this.toRows(next).map((row) => [this.rowKey(row), row]));
      await db.beginTransaction();
      try {
        for (const [key, row] of after) {
          const old = before.get(key);
          if (!old || old.payload_json !== row.payload_json) await this.upsertRow(db, row);
        }
        for (const [key, row] of before) {
          if (!after.has(key)) {
            await runInExistingTransaction(db, 'DELETE FROM app_records WHERE entity = ? AND store_id = ? AND record_id = ?', [row.entity, row.store_id, row.record_id]);
          }
        }
        await runInExistingTransaction(db, "INSERT INTO app_metadata(key,value) VALUES('state_schema_version','1') ON CONFLICT(key) DO UPDATE SET value=excluded.value");
        await db.commitTransaction();
      } catch (error) {
        await db.rollbackTransaction().catch(() => undefined);
        throw error;
      }
    });
  }

  async loadPreferences<T>(): Promise<T | null> {
    const result = await this.requireDatabase().query('SELECT key, value_json FROM app_preferences');
    if (!result.values?.length) return null;
    const prefs: Record<string, unknown> = {};
    for (const row of result.values as { key: string; value_json: string }[]) prefs[row.key] = JSON.parse(row.value_json);
    return prefs as T;
  }

  savePreferences(prefs: object): void {
    this.enqueue(async () => {
      const db = this.requireDatabase();
      await db.beginTransaction();
      try {
        for (const [key, value] of Object.entries(prefs)) {
          await runInExistingTransaction(db, 'INSERT INTO app_preferences(key,value_json) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json', [key, JSON.stringify(value)]);
        }
        await db.commitTransaction();
      } catch (error) {
        await db.rollbackTransaction().catch(() => undefined);
        throw error;
      }
    });
  }

  async flush(): Promise<void> { await this.writeQueue; }

  private enqueue(task: () => Promise<void>): void {
    this.writeQueue = this.writeQueue
      .then(task)
      .catch((error: unknown) => {
        this.lastError = error instanceof Error ? error.message : 'تعذر حفظ البيانات في SQLite';
      });
  }

  private async upsertRow(db: SQLiteDBConnection, row: StoredRow): Promise<void> {
    await runInExistingTransaction(db,
      'INSERT INTO app_records(entity,store_id,record_id,payload_json) VALUES(?,?,?,?) ON CONFLICT(entity,store_id,record_id) DO UPDATE SET payload_json=excluded.payload_json',
      [row.entity, row.store_id, row.record_id, row.payload_json],
    );
  }

  private rowKey(row: StoredRow): string { return `${row.entity}\u0000${row.store_id}\u0000${row.record_id}`; }

  private toRows(value: unknown): StoredRow[] {
    const state = (value || {}) as Record<string, any>;
    const rows: StoredRow[] = [];
    const append = (entity: string, records: any[], getId: (record: any) => string | number, getStore: (record: any) => number) => {
      for (const record of records || []) {
        rows.push({ entity, store_id: Number(getStore(record)) || 0, record_id: String(getId(record)), payload_json: JSON.stringify(record) });
      }
    };

    append('users', state.users || [], (record) => record.id, (record) => record.id);
    append('products', state.products || [], (record) => record.id, (record) => record.store_id);
    append('customers', state.customers || [], (record) => record.id, (record) => record.store_id);
    append('sales', state.sales || [], (record) => record.id, (record) => record.store_id);
    const salesById = new Map<number, number>((state.sales || []).map((sale: any) => [sale.id, sale.store_id]));
    append('sale_items', state.sale_items || [], (record) => record.id, (record) => salesById.get(record.sale_id) || 0);
    append('returns', state.returns || [], (record) => record.id, (record) => record.store_id);
    append('expenses', state.expenses || [], (record) => record.id, (record) => record.store_id);
    append('subscription_packages', state.subscription_packages || [], (record) => record.id, () => 0);
    append('parked_sales', state.parked_sales || [], (record) => record.id, (record) => record.store_id);
    append('quick_products', state.quick_products || [], (record) => record.product_id, (record) => record.store_id);
    return rows;
  }

  private requireDatabase(): SQLiteDBConnection {
    if (!this.database) throw new Error('قاعدة SQLite غير مهيأة');
    return this.database;
  }
}
