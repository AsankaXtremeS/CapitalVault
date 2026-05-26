import { create } from 'zustand';
import { getDatabase } from '../utils/db';
import NetInfo from '@react-native-community/netinfo';
import * as Haptics from 'expo-haptics';

export interface Transaction {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  category: string;
  account: string;
  date: number; // unix ms
  note?: string;
  description?: string;
  bill_path?: string;
  sync_status: 'synced' | 'pending' | 'deleted';
  updated_at: number;
}

export interface Debt {
  id: string;
  type: 'lending' | 'borrowing';
  contact_name: string;
  contact_phone?: string;
  principal: number;
  due_date?: number;
  interest_rate: number;
  payment_progress: number;
  sync_status: 'synced' | 'pending' | 'deleted';
  updated_at: number;
}

export interface Loan {
  id: string;
  name: string;
  principal: number;
  annual_rate: number;
  tenure_months: number;
  start_date: number;
  monthly_emi: number;
  reminders_enabled: number; // 0 or 1
  sync_status: 'synced' | 'pending' | 'deleted';
  updated_at: number;
}

interface LocalStoreState {
  transactions: Transaction[];
  debts: Debt[];
  loans: Loan[];
  isDbLoaded: boolean;
  isSyncing: boolean;
  isOnline: boolean;
  
  // Cache utilities
  loadAllData: () => Promise<void>;
  setOnlineStatus: (status: boolean) => void;
  triggerCloudSync: () => Promise<void>;

  // Transaction CRUD
  addTransaction: (tx: Omit<Transaction, 'sync_status' | 'updated_at'>) => Promise<void>;
  updateTransaction: (tx: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;

  // Debts CRUD
  addDebt: (debt: Omit<Debt, 'sync_status' | 'updated_at'>) => Promise<void>;
  updateDebt: (debt: Debt) => Promise<void>;
  deleteDebt: (id: string) => Promise<void>;

  // Loans CRUD
  addLoan: (loan: Omit<Loan, 'sync_status' | 'updated_at'>) => Promise<void>;
  updateLoan: (loan: Loan) => Promise<void>;
  deleteLoan: (id: string) => Promise<void>;
}

export const useLocalStore = create<LocalStoreState>((set, get) => {
  // Setup reactive network connectivity listeners on file load
  NetInfo.addEventListener(state => {
    get().setOnlineStatus(!!state.isConnected);
  });

  return {
    transactions: [],
    debts: [],
    loans: [],
    isDbLoaded: false,
    isSyncing: false,
    isOnline: true,

    setOnlineStatus: (isOnline: boolean) => {
      const wasOffline = !get().isOnline;
      set({ isOnline });

      // Automatically sync if transitioning from offline to online
      if (wasOffline && isOnline) {
        get().triggerCloudSync();
      }
    },

    loadAllData: async () => {
      try {
        const db = await getDatabase();

        // 1. Fetch transactions (excluding soft-deleted ones)
        const dbTxs = await db.getAllAsync<Transaction>(
          "SELECT * FROM transactions WHERE sync_status != 'deleted' ORDER BY date DESC"
        );

        // 2. Fetch debts
        const dbDebts = await db.getAllAsync<Debt>(
          "SELECT * FROM debts_lending WHERE sync_status != 'deleted' ORDER BY updated_at DESC"
        );

        // 3. Fetch loans
        const dbLoans = await db.getAllAsync<Loan>(
          "SELECT * FROM loans_installments WHERE sync_status != 'deleted' ORDER BY start_date DESC"
        );

        set({
          transactions: dbTxs || [],
          debts: dbDebts || [],
          loans: dbLoans || [],
          isDbLoaded: true,
        });
      } catch (error) {
        console.error('Failed to load local SQLite records:', error);
      }
    },

    triggerCloudSync: async () => {
      const { isSyncing, isOnline } = get();
      if (isSyncing || !isOnline) return;

      set({ isSyncing: true });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      try {
        const db = await getDatabase();

        // 1. Collect all pending creations, edits, or deletes
        const pendingTxs = await db.getAllAsync<Transaction>(
          "SELECT * FROM transactions WHERE sync_status IN ('pending', 'deleted')"
        );
        const pendingDebts = await db.getAllAsync<Debt>(
          "SELECT * FROM debts_lending WHERE sync_status IN ('pending', 'deleted')"
        );
        const pendingLoans = await db.getAllAsync<Loan>(
          "SELECT * FROM loans_installments WHERE sync_status IN ('pending', 'deleted')"
        );

        const totalPending = pendingTxs.length + pendingDebts.length + pendingLoans.length;

        if (totalPending > 0) {
          // Simulate network latency (2 seconds) for high-fidelity sync progress spinner
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Mock cloud API sync: Resolve deletions and mark pending edits as synced
          for (const tx of pendingTxs) {
            if (tx.sync_status === 'deleted') {
              await db.runAsync('DELETE FROM transactions WHERE id = ?', [tx.id]);
            } else {
              await db.runAsync("UPDATE transactions SET sync_status = 'synced' WHERE id = ?", [tx.id]);
            }
          }

          for (const debt of pendingDebts) {
            if (debt.sync_status === 'deleted') {
              await db.runAsync('DELETE FROM debts_lending WHERE id = ?', [debt.id]);
            } else {
              await db.runAsync("UPDATE debts_lending SET sync_status = 'synced' WHERE id = ?", [debt.id]);
            }
          }

          for (const loan of pendingLoans) {
            if (loan.sync_status === 'deleted') {
              await db.runAsync('DELETE FROM loans_installments WHERE id = ?', [loan.id]);
            } else {
              await db.runAsync("UPDATE loans_installments SET sync_status = 'synced' WHERE id = ?", [loan.id]);
            }
          }

          // Reload from SQLite to sync Zustand in-memory state
          await get().loadAllData();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (error) {
        console.error('Sync process error:', error);
      } finally {
        set({ isSyncing: false });
      }
    },

    // Transaction Actions
    addTransaction: async (tx) => {
      const now = Date.now();
      const newTx: Transaction = {
        ...tx,
        sync_status: 'pending',
        updated_at: now,
      };

      // Optimistic in-memory update for fast response times
      set((state) => ({
        transactions: [newTx, ...state.transactions],
      }));

      // Async disk persistence
      try {
        const db = await getDatabase();
        await db.runAsync(
          `INSERT INTO transactions (id, type, amount, category, account, date, note, description, bill_path, sync_status, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [newTx.id, newTx.type, newTx.amount, newTx.category, newTx.account, newTx.date, newTx.note ?? null, newTx.description ?? null, newTx.bill_path ?? null, newTx.sync_status, newTx.updated_at]
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        if (get().isOnline) {
          get().triggerCloudSync();
        }
      } catch (error) {
        console.error('Failed to insert transaction into SQLite:', error);
      }
    },

    updateTransaction: async (tx) => {
      const updatedTx: Transaction = {
        ...tx,
        sync_status: 'pending',
        updated_at: Date.now(),
      };

      // Optimistic in-memory update
      set((state) => ({
        transactions: state.transactions.map((t) => (t.id === tx.id ? updatedTx : t)),
      }));

      try {
        const db = await getDatabase();
        await db.runAsync(
          `UPDATE transactions 
           SET type = ?, amount = ?, category = ?, account = ?, date = ?, note = ?, description = ?, bill_path = ?, sync_status = ?, updated_at = ?
           WHERE id = ?`,
          [updatedTx.type, updatedTx.amount, updatedTx.category, updatedTx.account, updatedTx.date, updatedTx.note ?? null, updatedTx.description ?? null, updatedTx.bill_path ?? null, updatedTx.sync_status, updatedTx.updated_at, updatedTx.id]
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        if (get().isOnline) {
          get().triggerCloudSync();
        }
      } catch (error) {
        console.error('Failed to update transaction in SQLite:', error);
      }
    },

    deleteTransaction: async (id) => {
      // Optimistic in-memory deletion
      set((state) => ({
        transactions: state.transactions.filter((t) => t.id !== id),
      }));

      try {
        const db = await getDatabase();
        // Relational soft delete to support eventual cloud cleanup
        await db.runAsync(
          "UPDATE transactions SET sync_status = 'deleted', updated_at = ? WHERE id = ?",
          [Date.now(), id]
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        if (get().isOnline) {
          get().triggerCloudSync();
        }
      } catch (error) {
        console.error('Failed to delete transaction from SQLite:', error);
      }
    },

    // Debt Actions
    addDebt: async (debt) => {
      const now = Date.now();
      const newDebt: Debt = {
        ...debt,
        sync_status: 'pending',
        updated_at: now,
      };

      set((state) => ({
        debts: [newDebt, ...state.debts],
      }));

      try {
        const db = await getDatabase();
        await db.runAsync(
          `INSERT INTO debts_lending (id, type, contact_name, contact_phone, principal, due_date, interest_rate, payment_progress, sync_status, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [newDebt.id, newDebt.type, newDebt.contact_name, newDebt.contact_phone ?? null, newDebt.principal, newDebt.due_date ?? null, newDebt.interest_rate, newDebt.payment_progress, newDebt.sync_status, newDebt.updated_at]
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        if (get().isOnline) {
          get().triggerCloudSync();
        }
      } catch (error) {
        console.error('Failed to insert debt into SQLite:', error);
      }
    },

    updateDebt: async (debt) => {
      const updatedDebt: Debt = {
        ...debt,
        sync_status: 'pending',
        updated_at: Date.now(),
      };

      set((state) => ({
        debts: state.debts.map((d) => (d.id === debt.id ? updatedDebt : d)),
      }));

      try {
        const db = await getDatabase();
        await db.runAsync(
          `UPDATE debts_lending 
           SET type = ?, contact_name = ?, contact_phone = ?, principal = ?, due_date = ?, interest_rate = ?, payment_progress = ?, sync_status = ?, updated_at = ?
           WHERE id = ?`,
          [updatedDebt.type, updatedDebt.contact_name, updatedDebt.contact_phone ?? null, updatedDebt.principal, updatedDebt.due_date ?? null, updatedDebt.interest_rate, updatedDebt.payment_progress, updatedDebt.sync_status, updatedDebt.updated_at, updatedDebt.id]
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        if (get().isOnline) {
          get().triggerCloudSync();
        }
      } catch (error) {
        console.error('Failed to update debt in SQLite:', error);
      }
    },

    deleteDebt: async (id) => {
      set((state) => ({
        debts: state.debts.filter((d) => d.id !== id),
      }));

      try {
        const db = await getDatabase();
        await db.runAsync(
          "UPDATE debts_lending SET sync_status = 'deleted', updated_at = ? WHERE id = ?",
          [Date.now(), id]
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        if (get().isOnline) {
          get().triggerCloudSync();
        }
      } catch (error) {
        console.error('Failed to delete debt from SQLite:', error);
      }
    },

    // Loan Actions
    addLoan: async (loan) => {
      const now = Date.now();
      const newLoan: Loan = {
        ...loan,
        sync_status: 'pending',
        updated_at: now,
      };

      set((state) => ({
        loans: [newLoan, ...state.loans],
      }));

      try {
        const db = await getDatabase();
        await db.runAsync(
          `INSERT INTO loans_installments (id, name, principal, annual_rate, tenure_months, start_date, monthly_emi, reminders_enabled, sync_status, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [newLoan.id, newLoan.name, newLoan.principal, newLoan.annual_rate, newLoan.tenure_months, newLoan.start_date, newLoan.monthly_emi, newLoan.reminders_enabled, newLoan.sync_status, newLoan.updated_at]
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        if (get().isOnline) {
          get().triggerCloudSync();
        }
      } catch (error) {
        console.error('Failed to insert loan into SQLite:', error);
      }
    },

    updateLoan: async (loan) => {
      const updatedLoan: Loan = {
        ...loan,
        sync_status: 'pending',
        updated_at: Date.now(),
      };

      set((state) => ({
        loans: state.loans.map((l) => (l.id === loan.id ? updatedLoan : l)),
      }));

      try {
        const db = await getDatabase();
        await db.runAsync(
          `UPDATE loans_installments 
           SET name = ?, principal = ?, annual_rate = ?, tenure_months = ?, start_date = ?, monthly_emi = ?, reminders_enabled = ?, sync_status = ?, updated_at = ?
           WHERE id = ?`,
          [updatedLoan.name, updatedLoan.principal, updatedLoan.annual_rate, updatedLoan.tenure_months, updatedLoan.start_date, updatedLoan.monthly_emi, updatedLoan.reminders_enabled, updatedLoan.sync_status, updatedLoan.updated_at, updatedLoan.id]
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        if (get().isOnline) {
          get().triggerCloudSync();
        }
      } catch (error) {
        console.error('Failed to update loan in SQLite:', error);
      }
    },

    deleteLoan: async (id) => {
      set((state) => ({
        loans: state.loans.filter((l) => l.id !== id),
      }));

      try {
        const db = await getDatabase();
        await db.runAsync(
          "UPDATE loans_installments SET sync_status = 'deleted', updated_at = ? WHERE id = ?",
          [Date.now(), id]
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        if (get().isOnline) {
          get().triggerCloudSync();
        }
      } catch (error) {
        console.error('Failed to delete loan from SQLite:', error);
      }
    },
  };
});
