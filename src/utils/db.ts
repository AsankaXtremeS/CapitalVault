import * as SQLite from 'expo-sqlite';

let databaseInstance: SQLite.SQLiteDatabase | null = null;

/**
 * Retrieves or opens the SQLite database instance asynchronously.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
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

  // Seed sample transactions if database is empty to wow the user immediately
  const transactionCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM transactions');
  if (transactionCount && transactionCount.count === 0) {
    await seedDatabase(db);
  }
}

/**
 * Seeds high-fidelity mock data mimicking the screenshots.
 */
async function seedDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  const now = new Date();
  
  // Seed dates relative to May 2026 as per screenshots (or active current time)
  // Let's seed relative to the current month to make the charts alive!
  const getRelativeDateMs = (dayOffset: number): number => {
    const d = new Date();
    d.setDate(d.getDate() - dayOffset);
    return d.getTime();
  };

  // Seed Transactions
  const sampleTransactions = [
    { id: 'tx-1', type: 'income', amount: 13000, category: 'Salary', account: 'Accounts', date: getRelativeDateMs(21), note: 'Monthly Salary payout', description: 'Core salary transfer from employer', bill_path: null, sync_status: 'synced', updated_at: Date.now() },
    { id: 'tx-2', type: 'income', amount: 5000, category: 'Allowance', account: 'Cash', date: getRelativeDateMs(15), note: 'Birthday present allowance', description: 'Gift from parents', bill_path: null, sync_status: 'synced', updated_at: Date.now() },
    { id: 'tx-3', type: 'expense', amount: 6500, category: 'Household', account: 'Accounts', date: getRelativeDateMs(21), note: 'Appartment Rent payment', description: 'Monthly lease due', bill_path: null, sync_status: 'synced', updated_at: Date.now() },
    { id: 'tx-4', type: 'expense', amount: 4125, category: 'Food', account: 'Cash', date: getRelativeDateMs(19), note: 'Groceries stocking', description: 'Supermarket bulk buy', bill_path: null, sync_status: 'synced', updated_at: Date.now() },
    { id: 'tx-5', type: 'expense', amount: 2040, category: 'Transport', account: 'Card', date: getRelativeDateMs(12), note: 'Train ticket subscription', description: 'Train seasonal card', bill_path: null, sync_status: 'synced', updated_at: Date.now() },
    { id: 'tx-6', type: 'expense', amount: 1800, category: 'Beauty', account: 'Card', date: getRelativeDateMs(7), note: 'Hair care treatments', description: 'Salon package reservation', bill_path: null, sync_status: 'synced', updated_at: Date.now() },
    { id: 'tx-7', type: 'expense', amount: 1100, category: 'Social Life', account: 'Cash', date: getRelativeDateMs(6), note: 'Dinner outing with friends', description: 'Fine dining', bill_path: null, sync_status: 'synced', updated_at: Date.now() },
    { id: 'tx-8', type: 'expense', amount: 945, category: 'Telecommunications', account: 'Card', date: getRelativeDateMs(2), note: 'Internet and Mobile packages', description: 'Unlimited connection plan', bill_path: null, sync_status: 'synced', updated_at: Date.now() },
    { id: 'tx-9', type: 'expense', amount: 175, category: 'Other', account: 'Cash', date: getRelativeDateMs(0), note: 'Miscellaneous small items', description: 'Quick buy', bill_path: null, sync_status: 'pending', updated_at: Date.now() }
  ];

  for (const t of sampleTransactions) {
    await db.runAsync(
      `INSERT INTO transactions (id, type, amount, category, account, date, note, description, bill_path, sync_status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [t.id, t.type, t.amount, t.category, t.account, t.date, t.note, t.description, t.bill_path, t.sync_status, t.updated_at]
    );
  }

  // Seed Debts (Lendings/Borrowings)
  const sampleDebts = [
    { id: 'debt-1', type: 'lending', contact_name: 'John Doe', contact_phone: '+94771234567', principal: 1500, due_date: getRelativeDateMs(-30), interest_rate: 2.5, payment_progress: 500, sync_status: 'synced', updated_at: Date.now() },
    { id: 'debt-2', type: 'borrowing', contact_name: 'Jane Smith', contact_phone: '+94711122334', principal: 2500, due_date: getRelativeDateMs(-15), interest_rate: 0.0, payment_progress: 1000, sync_status: 'synced', updated_at: Date.now() }
  ];

  for (const d of sampleDebts) {
    await db.runAsync(
      `INSERT INTO debts_lending (id, type, contact_name, contact_phone, principal, due_date, interest_rate, payment_progress, sync_status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.id, d.type, d.contact_name, d.contact_phone, d.principal, d.due_date, d.interest_rate, d.payment_progress, d.sync_status, d.updated_at]
    );
  }

  // Seed Loans (EMI trackers)
  const sampleLoans = [
    { id: 'loan-1', name: 'Car Leasing (Toyota Prius)', principal: 18000, annual_rate: 8.5, tenure_months: 36, start_date: getRelativeDateMs(120), monthly_emi: 568.21, reminders_enabled: 1, sync_status: 'synced', updated_at: Date.now() },
    { id: 'loan-2', name: 'Education Loan (Harvard Online)', principal: 5000, annual_rate: 5.0, tenure_months: 12, start_date: getRelativeDateMs(60), monthly_emi: 428.04, reminders_enabled: 1, sync_status: 'synced', updated_at: Date.now() }
  ];

  for (const l of sampleLoans) {
    await db.runAsync(
      `INSERT INTO loans_installments (id, name, principal, annual_rate, tenure_months, start_date, monthly_emi, reminders_enabled, sync_status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [l.id, l.name, l.principal, l.annual_rate, l.tenure_months, l.start_date, l.monthly_emi, l.reminders_enabled, l.sync_status, l.updated_at]
    );
  }
}
