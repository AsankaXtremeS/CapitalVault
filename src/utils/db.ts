import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';

let databaseInstance: SQLite.SQLiteDatabase | null = null;

/**
 * Retrieves or opens the SQLite database instance asynchronously.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (Platform.OS === 'web') {
    // Return a robust mock database interface to support flawless web previewing
    return {
      execAsync: async () => {},
      runAsync: async () => ({ lastInsertRowId: 1, changes: 1 }),
      getFirstAsync: async () => null,
      getAllAsync: async () => [],
    } as any;
  }

  if (!databaseInstance) {
    databaseInstance = await SQLite.openDatabaseAsync('offline_money_manager.db');
  }
  return databaseInstance;
}

/**
 * Initializes the database schemas and runs migrations/setup.
 */
export async function initializeDatabase(): Promise<void> {
  const db = await getDatabase();

  // Create tables in a transactional execution
  await db.execAsync(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      type TEXT CHECK(type IN ('income', 'expense', 'transfer')) NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      account TEXT NOT NULL,
      date INTEGER NOT NULL,
      note TEXT,
      description TEXT,
      bill_path TEXT,
      sync_status TEXT CHECK(sync_status IN ('synced', 'pending', 'deleted')) DEFAULT 'pending',
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS debts_lending (
      id TEXT PRIMARY KEY,
      type TEXT CHECK(type IN ('lending', 'borrowing')) NOT NULL,
      contact_name TEXT NOT NULL,
      contact_phone TEXT,
      principal REAL NOT NULL,
      due_date INTEGER,
      interest_rate REAL DEFAULT 0.0,
      payment_progress REAL DEFAULT 0.0,
      sync_status TEXT CHECK(sync_status IN ('synced', 'pending', 'deleted')) DEFAULT 'pending',
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS loans_installments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      principal REAL NOT NULL,
      annual_rate REAL NOT NULL,
      tenure_months INTEGER NOT NULL,
      start_date INTEGER NOT NULL,
      monthly_emi REAL NOT NULL,
      reminders_enabled INTEGER CHECK(reminders_enabled IN (0, 1)) DEFAULT 1,
      sync_status TEXT CHECK(sync_status IN ('synced', 'pending', 'deleted')) DEFAULT 'pending',
      updated_at INTEGER NOT NULL
    );
  `);

}
