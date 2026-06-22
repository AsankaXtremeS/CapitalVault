import NetInfo from "@react-native-community/netinfo";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { create } from "zustand";
import { getDatabase } from "../utils/db";
import {
  isSupabaseConfigured,
  simulatedCloud,
  supabase,
} from "../utils/supabase";

export interface Transaction {
  id: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  category: string;
  account: string;
  date: number; // unix ms
  note?: string;
  description?: string;
  bill_path?: string;
  sync_status: "synced" | "pending" | "deleted";
  updated_at: number;
}

export interface Debt {
  id: string;
  type: "lending" | "borrowing";
  contact_name: string;
  contact_phone?: string;
  principal: number;
  due_date?: number;
  interest_rate: number;
  payment_progress: number;
  note?: string;
  sync_status: "synced" | "pending" | "deleted";
  updated_at: number;
}

export interface Loan {
  id: string;
  name: string;
  entry_type: "income" | "expense";
  principal: number;
  annual_rate: number;
  tenure_months: number;
  start_date: number;
  monthly_emi: number;
  reminders_enabled: number; // 0 or 1
  sync_status: "synced" | "pending" | "deleted";
  updated_at: number;
}

export interface RecurringTemplate {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  account: string;
  note?: string;
  day_of_month: number;
  is_active: number; // 0 or 1
  last_applied_month?: string; // FORMAT: 'YYYY-MM'
  sync_status: "synced" | "pending" | "deleted";
  updated_at: number;
}

export interface Account {
  id: string;
  name: string;
  type: string;
  initial_balance: number;
  color?: string;
  icon?: string;
  sync_status: "synced" | "pending" | "deleted";
  updated_at: number;
}

interface LocalStoreState {
  transactions: Transaction[];
  accounts: Account[];
  debts: Debt[];
  loans: Loan[];
  recurringTemplates: RecurringTemplate[];
  isDbLoaded: boolean;
  isSyncing: boolean;
  isOnline: boolean;
  isCellular: boolean;

  // Cloud Sync & Auth States
  user: { id: string; email: string } | null;
  syncOnMobileData: boolean;
  autoCloudSync: boolean;
  lastSyncedAt: string | null;

  // Floating Calculator Pipe & State
  calculatorPipeValue: string | null;
  isCalculatorOpen: boolean;
  pipeValue: (val: string) => void;
  clearPipeValue: () => void;
  openCalculator: () => void;
  closeCalculator: () => void;

  // Custom Categories
  customCategories: {
    name: string;
    emoji: string;
    type: "income" | "expense";
  }[];
  addCustomCategory: (cat: {
    name: string;
    emoji: string;
    type: "income" | "expense";
  }) => Promise<void>;
  loadCustomCategoriesList: () => Promise<void>;

  // Category Budgets
  categoryBudgets: Record<string, number>;
  updateCategoryBudget: (category: string, limit: number) => Promise<void>;

  // Important Notes
  importantNotes: string;
  updateImportantNotes: (notes: string) => Promise<void>;
  loadImportantNotes: () => Promise<void>;

  // App Settings
  currencySymbol: string;
  isAppLockEnabled: boolean;
  appPin: string | null;
  isBiometricEnabled: boolean;
  theme: "dark" | "light";
  hapticsEnabled: boolean;
  activeBalanceAccountId: string;
  updateSettings: (
    settings: Partial<
      Pick<
        LocalStoreState,
        | "currencySymbol"
        | "isAppLockEnabled"
        | "appPin"
        | "isBiometricEnabled"
        | "theme"
        | "hapticsEnabled"
        | "activeBalanceAccountId"
      >
    >,
  ) => Promise<void>;
  loadSettings: () => Promise<void>;

  // Cache utilities
  loadAllData: () => Promise<void>;
  setOnlineStatus: (status: boolean) => void;
  triggerCloudSync: (force?: boolean) => Promise<void>;

  // Authentication & Cloud Sync actions
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (
    email: string,
    newPasswordForMock?: string,
  ) => Promise<string | null>;
  recoverDataFromCloud: () => Promise<void>;
  simulateAppReset: () => Promise<void>;
  toggleSyncOnMobileData: (val: boolean) => Promise<void>;
  toggleAutoCloudSync: (val: boolean) => Promise<void>;
  loadCloudSyncSettings: () => Promise<void>;

  // Accounts CRUD
  addAccount: (
    account: Omit<Account, "sync_status" | "updated_at">,
  ) => Promise<void>;
  updateAccount: (account: Account) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;

  // Transaction CRUD
  addTransaction: (
    tx: Omit<Transaction, "sync_status" | "updated_at">,
  ) => Promise<void>;
  updateTransaction: (tx: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;

  // Debts CRUD
  addDebt: (debt: Omit<Debt, "sync_status" | "updated_at">) => Promise<void>;
  updateDebt: (debt: Debt) => Promise<void>;
  deleteDebt: (id: string) => Promise<void>;

  // Loans CRUD
  addLoan: (loan: Omit<Loan, "sync_status" | "updated_at">) => Promise<void>;
  updateLoan: (loan: Loan) => Promise<void>;
  deleteLoan: (id: string) => Promise<void>;

  // Recurring Templates CRUD & Auto-Processor
  addRecurringTemplate: (
    tmpl: Omit<RecurringTemplate, "sync_status" | "updated_at">,
  ) => Promise<void>;
  updateRecurringTemplate: (tmpl: RecurringTemplate) => Promise<void>;
  deleteRecurringTemplate: (id: string) => Promise<void>;
  checkAndApplyRecurringTransactions: () => Promise<void>;
}

export const useLocalStore = create<LocalStoreState>((set, get) => {
  // Key helpers for local store persistence
  const saveKey = async (key: string, value: string) => {
    if (Platform.OS === "web") {
      localStorage.setItem(key, value);
    } else {
      try {
        await SecureStore.setItemAsync(key, value);
      } catch (e) {}
    }
  };

  const getKey = async (key: string): Promise<string | null> => {
    if (Platform.OS === "web") {
      return localStorage.getItem(key);
    } else {
      try {
        return await SecureStore.getItemAsync(key);
      } catch (e) {
        return null;
      }
    }
  };

  const removeKey = async (key: string) => {
    if (Platform.OS === "web") {
      localStorage.removeItem(key);
    } else {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch (e) {}
    }
  };

  const normalizeCustomCategories = (
    categories: { name: string; emoji: string; type: "income" | "expense" }[],
  ) => {
    const seen = new Map<
      string,
      { name: string; emoji: string; type: "income" | "expense" }
    >();
    for (const cat of categories) {
      const key = `${cat.name}|${cat.type}`;
      if (!seen.has(key)) {
        seen.set(key, cat);
      }
    }
    return Array.from(seen.values());
  };

  // Setup reactive network connectivity listeners on file load
  NetInfo.addEventListener((state) => {
    const isOnline = !!state.isConnected;
    const isCellular = state.type === "cellular";
    set({ isOnline, isCellular });

    // Sync on reconnect if cloud sync is already available
    const store = get();
    if (isOnline && typeof store.triggerCloudSync === "function") {
      store.triggerCloudSync();
    }
  });

  // Seeding disabled for fresh empty vault setup

  return {
    transactions: [],
    accounts: [],
    debts: [],
    loans: [],
    recurringTemplates: [],
    isDbLoaded: false,
    isSyncing: false,
    isOnline: true,
    isCellular: false,
    user: null,
    syncOnMobileData: true,
    autoCloudSync: true,
    lastSyncedAt: null,
    calculatorPipeValue: null,
    isCalculatorOpen: false,

    pipeValue: (val: string) => set({ calculatorPipeValue: val }),
    clearPipeValue: () => set({ calculatorPipeValue: null }),
    openCalculator: () => set({ isCalculatorOpen: true }),
    closeCalculator: () => set({ isCalculatorOpen: false }),

    // App Settings default state
    currencySymbol: "$",
    isAppLockEnabled: false,
    appPin: null,
    isBiometricEnabled: false,
    theme: "dark",
    hapticsEnabled: true,
    activeBalanceAccountId: "all",

    updateSettings: async (settings) => {
      set(settings);

      const current = get();
      const settingsObj = {
        currencySymbol: current.currencySymbol,
        isAppLockEnabled: current.isAppLockEnabled,
        appPin: current.appPin,
        isBiometricEnabled: current.isBiometricEnabled,
        theme: current.theme,
        hapticsEnabled: current.hapticsEnabled,
        activeBalanceAccountId: current.activeBalanceAccountId,
      };

      const json = JSON.stringify(settingsObj);
      if (Platform.OS === "web") {
        localStorage.setItem("money_app_global_settings", json);
      } else {
        try {
          await SecureStore.setItemAsync("money_app_global_settings", json);
        } catch (e) {}
      }
    },

    loadSettings: async () => {
      let json: string | null = null;
      if (Platform.OS === "web") {
        json = localStorage.getItem("money_app_global_settings");
      } else {
        try {
          json = await SecureStore.getItemAsync("money_app_global_settings");
        } catch (e) {}
      }

      if (json) {
        try {
          const parsed = JSON.parse(json);
          let symbol = parsed.currencySymbol ?? "$";
          if (symbol === "LKR") {
            symbol = "Rs";
          }
          set({
            currencySymbol: symbol,
            isAppLockEnabled: parsed.isAppLockEnabled ?? false,
            appPin: parsed.appPin ?? null,
            isBiometricEnabled: parsed.isBiometricEnabled ?? false,
            theme: parsed.theme ?? "dark",
            hapticsEnabled: parsed.hapticsEnabled ?? true,
            activeBalanceAccountId: parsed.activeBalanceAccountId ?? "all",
          });
        } catch (e) {}
      }
    },

    customCategories: [],
    addCustomCategory: async (cat) => {
      const list = normalizeCustomCategories([...get().customCategories, cat]);
      set({ customCategories: list });
      const json = JSON.stringify(list);
      if (Platform.OS === "web") {
        localStorage.setItem("money_app_custom_categories", json);
      } else {
        try {
          await SecureStore.setItemAsync("money_app_custom_categories", json);
        } catch (e) {
          // ignore
        }
      }
    },
    loadCustomCategoriesList: async () => {
      let json: string | null = null;
      if (Platform.OS === "web") {
        json = localStorage.getItem("money_app_custom_categories");
      } else {
        try {
          json = await SecureStore.getItemAsync("money_app_custom_categories");
        } catch (e) {
          // ignore
        }
      }
      if (json) {
        try {
          const list = normalizeCustomCategories(JSON.parse(json));
          set({ customCategories: list });
        } catch (e) {
          // ignore
        }
      }
    },

    categoryBudgets: {},
    updateCategoryBudget: async (category, limit) => {
      const budgets = { ...get().categoryBudgets, [category]: limit };
      set({ categoryBudgets: budgets });
      const json = JSON.stringify(budgets);
      if (Platform.OS === "web") {
        localStorage.setItem("money_app_category_budgets", json);
      } else {
        try {
          await SecureStore.setItemAsync("money_app_category_budgets", json);
        } catch (e) {}
      }

      // Auto cloud sync
      if (get().isOnline) {
        get().triggerCloudSync();
      }
    },

    importantNotes: "",
    updateImportantNotes: async (notes) => {
      set({ importantNotes: notes });
      if (Platform.OS === "web") {
        localStorage.setItem("money_app_important_notes", notes);
      } else {
        try {
          await SecureStore.setItemAsync("money_app_important_notes", notes);
        } catch (e) {}
      }
    },
    loadImportantNotes: async () => {
      let notes: string | null = null;
      if (Platform.OS === "web") {
        notes = localStorage.getItem("money_app_important_notes");
      } else {
        try {
          notes = await SecureStore.getItemAsync("money_app_important_notes");
        } catch (e) {}
      }
      set({ importantNotes: notes || "" });
    },

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
          "SELECT * FROM transactions WHERE sync_status != 'deleted' ORDER BY date DESC",
        );

        // 2. Fetch debts
        const dbDebts = await db.getAllAsync<Debt>(
          "SELECT * FROM debts_lending WHERE sync_status != 'deleted' ORDER BY updated_at DESC",
        );

        // 3. Fetch loans
        const dbLoans = await db.getAllAsync<Loan>(
          "SELECT * FROM loans_installments WHERE sync_status != 'deleted' ORDER BY start_date DESC",
        );
        const normalizedLoans = (dbLoans || []).map((loan) => ({
          ...loan,
          entry_type: (loan as any).entry_type ?? "expense",
        }));

        // 4. Fetch recurring templates
        const dbTemplates = await db.getAllAsync<RecurringTemplate>(
          "SELECT * FROM recurring_templates WHERE sync_status != 'deleted' ORDER BY day_of_month ASC",
        );

        // 5. Fetch accounts
        let dbAccounts = await db.getAllAsync<Account>(
          "SELECT * FROM accounts WHERE sync_status != 'deleted' ORDER BY name ASC",
        );

        if (dbAccounts.length === 0) {
          const txAccounts = await db.getAllAsync<{ account: string }>(
            "SELECT DISTINCT account FROM transactions"
          );
          const uniqueNames = new Set<string>();
          if (txAccounts) {
            txAccounts.forEach((t) => {
              if (t.account && t.account.trim()) {
                uniqueNames.add(t.account.trim());
              }
            });
          }
          const standardDefaults = ["Cash", "Card", "Savings"];
          standardDefaults.forEach((d) => uniqueNames.add(d));

          const colors = ["#34C759", "#0A84FF", "#5856D6", "#FF9500", "#FF3B30", "#AF52DE"];
          let colorIdx = 0;
          for (const name of uniqueNames) {
            const id = `acc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const type = name.toLowerCase() === "card" ? "Card" : (name.toLowerCase() === "savings" ? "Savings" : "Cash");
            const color = colors[colorIdx % colors.length];
            colorIdx++;
            await db.runAsync(
              `INSERT INTO accounts (id, name, type, initial_balance, color, sync_status, updated_at)
               VALUES (?, ?, ?, 0.0, ?, 'pending', ?)`,
              [id, name, type, color, Date.now()]
            );
          }

          dbAccounts = await db.getAllAsync<Account>(
            "SELECT * FROM accounts WHERE sync_status != 'deleted' ORDER BY name ASC"
          );
        }

        // Load custom categories
        await get().loadCustomCategoriesList();

        // Load important notes
        await get().loadImportantNotes();

        // Load Global App Settings
        await get().loadSettings();

        set({
          transactions: dbTxs,
          accounts: dbAccounts,
          debts: dbDebts,
          loans: normalizedLoans,
          recurringTemplates: dbTemplates,
          isDbLoaded: true,
        });

        // Trigger auto-apply check for recurring transactions in background
        await get().checkAndApplyRecurringTransactions();
      } catch (error) {
        console.error("Failed to load local SQLite records:", error);
        set({ isDbLoaded: true }); // Always clear the loader to prevent white screens!
      }
    },

    triggerCloudSync: async (force = false) => {
      const {
        isSyncing,
        isOnline,
        isCellular,
        syncOnMobileData,
        autoCloudSync,
        user,
      } = get();
      if (isSyncing || !isOnline || !user) return;

      // Restrict sync on cellular unless autoCloudSync is off & manual backup is clicked (force=true)
      if (isCellular && !syncOnMobileData && !force) {
        console.log(
          "Cloud Sync deferred: mobile data disabled by user settings.",
        );
        return;
      }

      // Restrict automatic sync if disabled by user settings, unless forced
      if (!autoCloudSync && !force) {
        return;
      }

      set({ isSyncing: true });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      try {
        const db = await getDatabase();
        const userId = user.id;

        // 1. Fetch local queue
        const pendingTxs = await db.getAllAsync<Transaction>(
          "SELECT * FROM transactions WHERE sync_status IN ('pending', 'deleted')",
        );
        const pendingAccounts = await db.getAllAsync<Account>(
          "SELECT * FROM accounts WHERE sync_status IN ('pending', 'deleted')",
        );
        const pendingDebts = await db.getAllAsync<Debt>(
          "SELECT * FROM debts_lending WHERE sync_status IN ('pending', 'deleted')",
        );
        const pendingLoans = await db.getAllAsync<Loan>(
          "SELECT * FROM loans_installments WHERE sync_status IN ('pending', 'deleted')",
        );
        const pendingTemplates = await db.getAllAsync<RecurringTemplate>(
          "SELECT * FROM recurring_templates WHERE sync_status IN ('pending', 'deleted')",
        );

        const totalPending =
          pendingTxs.length +
          pendingAccounts.length +
          pendingDebts.length +
          pendingLoans.length +
          pendingTemplates.length;

        if (totalPending > 0 || force) {
          // Simulate latency for premium sync indicator feel
          await new Promise((resolve) => setTimeout(resolve, 1500));

          if (isSupabaseConfigured && supabase) {
            // ==========================================
            // LIVE SUPABASE SYNC ROUTINE
            // ==========================================

            // Sync Transactions
            for (const tx of pendingTxs) {
              if (tx.sync_status === "deleted") {
                const { error } = await supabase
                  .from("transactions")
                  .delete()
                  .eq("id", tx.id)
                  .eq("user_id", userId);
                if (error) {
                  throw new Error(
                    `Database synchronization failed. Please copy and paste the SQL commands from "supabase_schema.sql" into your Supabase Dashboard SQL Editor to create your database tables! (Error: ${error.message})`,
                  );
                }
                await db.runAsync("DELETE FROM transactions WHERE id = ?", [
                  tx.id,
                ]);
              } else {
                const { error } = await supabase.from("transactions").upsert({
                  id: tx.id,
                  user_id: userId,
                  type: tx.type,
                  amount: tx.amount,
                  category: tx.category,
                  account: tx.account,
                  date: tx.date,
                  note: tx.note || null,
                  description: tx.description || null,
                  bill_path: tx.bill_path || null,
                  updated_at: tx.updated_at,
                });
                if (error) {
                  throw new Error(
                    `Database synchronization failed. It looks like your tables are not provisioned in Supabase. Please copy and paste the SQL schema from "supabase_schema.sql" into your Supabase SQL Editor first to instantly create your database tables! (Error: ${error.message})`,
                  );
                }
                await db.runAsync(
                  "UPDATE transactions SET sync_status = 'synced' WHERE id = ?",
                  [tx.id],
                );
              }
            }

            // Sync Accounts
            for (const acc of pendingAccounts) {
              if (acc.sync_status === "deleted") {
                const { error } = await supabase
                  .from("accounts")
                  .delete()
                  .eq("id", acc.id)
                  .eq("user_id", userId);
                if (error) {
                  throw new Error(
                    `Database synchronization failed. Please copy and paste the SQL commands from "supabase_schema.sql" into your Supabase Dashboard SQL Editor to create your accounts table! (Error: ${error.message})`,
                  );
                }
                await db.runAsync("DELETE FROM accounts WHERE id = ?", [
                  acc.id,
                ]);
              } else {
                const { error } = await supabase.from("accounts").upsert({
                  id: acc.id,
                  user_id: userId,
                  name: acc.name,
                  type: acc.type,
                  initial_balance: acc.initial_balance,
                  color: acc.color || null,
                  icon: acc.icon || null,
                  updated_at: acc.updated_at,
                });
                if (error) {
                  throw new Error(
                    `Database synchronization failed. It looks like your accounts table is not provisioned in Supabase. Please copy and paste the SQL schema from "supabase_schema.sql" into your Supabase SQL Editor first to instantly create your database tables! (Error: ${error.message})`,
                  );
                }
                await db.runAsync(
                  "UPDATE accounts SET sync_status = 'synced' WHERE id = ?",
                  [acc.id],
                );
              }
            }

            // Sync Debts
            for (const debt of pendingDebts) {
              if (debt.sync_status === "deleted") {
                const { error } = await supabase
                  .from("debts_lending")
                  .delete()
                  .eq("id", debt.id)
                  .eq("user_id", userId);
                if (error) {
                  throw new Error(
                    `Database synchronization failed. Please copy and paste the SQL commands from "supabase_schema.sql" into your Supabase SQL Editor first! (Error: ${error.message})`,
                  );
                }
                await db.runAsync("DELETE FROM debts_lending WHERE id = ?", [
                  debt.id,
                ]);
              } else {
                const { error } = await supabase.from("debts_lending").upsert({
                  id: debt.id,
                  user_id: userId,
                  type: debt.type,
                  contact_name: debt.contact_name,
                  contact_phone: debt.contact_phone || null,
                  principal: debt.principal,
                  due_date: debt.due_date || null,
                  interest_rate: debt.interest_rate,
                  payment_progress: debt.payment_progress,
                  note: debt.note || null,
                  updated_at: debt.updated_at,
                });
                if (error) {
                  throw new Error(
                    `Database synchronization failed. It looks like your debts_lending table is not provisioned. Please copy and paste the SQL schema from "supabase_schema.sql" into your Supabase SQL Editor first! (Error: ${error.message})`,
                  );
                }
                await db.runAsync(
                  "UPDATE debts_lending SET sync_status = 'synced' WHERE id = ?",
                  [debt.id],
                );
              }
            }

            // Sync Loans
            for (const loan of pendingLoans) {
              if (loan.sync_status === "deleted") {
                const { error } = await supabase
                  .from("loans_installments")
                  .delete()
                  .eq("id", loan.id)
                  .eq("user_id", userId);
                if (error) {
                  throw new Error(
                    `Database synchronization failed. Please copy and paste the SQL commands from "supabase_schema.sql" into your Supabase SQL Editor first! (Error: ${error.message})`,
                  );
                }
                await db.runAsync(
                  "DELETE FROM loans_installments WHERE id = ?",
                  [loan.id],
                );
              } else {
                const { error } = await supabase
                  .from("loans_installments")
                  .upsert({
                    id: loan.id,
                    user_id: userId,
                    name: loan.name,
                    entry_type: loan.entry_type,
                    principal: loan.principal,
                    annual_rate: loan.annual_rate,
                    tenure_months: loan.tenure_months,
                    start_date: loan.start_date,
                    monthly_emi: loan.monthly_emi,
                    reminders_enabled: loan.reminders_enabled,
                    updated_at: loan.updated_at,
                  });
                if (error) {
                  throw new Error(
                    `Database synchronization failed. It looks like your loans_installments table is not provisioned. Please copy and paste the SQL schema from "supabase_schema.sql" into your Supabase SQL Editor first! (Error: ${error.message})`,
                  );
                }
                await db.runAsync(
                  "UPDATE loans_installments SET sync_status = 'synced' WHERE id = ?",
                  [loan.id],
                );
              }
            }

            // Sync Recurring Templates
            for (const tmpl of pendingTemplates) {
              if (tmpl.sync_status === "deleted") {
                const { error } = await supabase
                  .from("recurring_templates")
                  .delete()
                  .eq("id", tmpl.id)
                  .eq("user_id", userId);
                if (error) {
                  throw new Error(
                    `Database synchronization failed. Please copy and paste the SQL commands from "supabase_schema.sql" into your Supabase SQL Editor first! (Error: ${error.message})`,
                  );
                }
                await db.runAsync(
                  "DELETE FROM recurring_templates WHERE id = ?",
                  [tmpl.id],
                );
              } else {
                const { error } = await supabase
                  .from("recurring_templates")
                  .upsert({
                    id: tmpl.id,
                    user_id: userId,
                    type: tmpl.type,
                    amount: tmpl.amount,
                    category: tmpl.category,
                    account: tmpl.account,
                    note: tmpl.note || null,
                    day_of_month: tmpl.day_of_month,
                    is_active: tmpl.is_active,
                    last_applied_month: tmpl.last_applied_month || null,
                    updated_at: tmpl.updated_at,
                  });
                if (error) {
                  throw new Error(
                    `Database synchronization failed. It looks like your recurring_templates table is not provisioned. Please copy and paste the SQL schema from "supabase_schema.sql" into your Supabase SQL Editor first! (Error: ${error.message})`,
                  );
                }
                await db.runAsync(
                  "UPDATE recurring_templates SET sync_status = 'synced' WHERE id = ?",
                  [tmpl.id],
                );
              }
            }

            // Backup Custom Categories
            const customCats = normalizeCustomCategories(
              get().customCategories,
            );
            if (customCats.length !== get().customCategories.length) {
              const normalizedJson = JSON.stringify(customCats);
              if (Platform.OS === "web") {
                localStorage.setItem(
                  "money_app_custom_categories",
                  normalizedJson,
                );
              } else {
                try {
                  await SecureStore.setItemAsync(
                    "money_app_custom_categories",
                    normalizedJson,
                  );
                } catch (e) {
                  // ignore
                }
              }
              set({ customCategories: customCats });
            }

            if (customCats.length > 0) {
              const { error } = await supabase.from("custom_categories").upsert(
                customCats.map((c) => ({
                  user_id: userId,
                  name: c.name,
                  emoji: c.emoji,
                  type: c.type,
                })),
                { onConflict: "user_id,name,type" },
              );
              if (error) {
                const duplicateHint = error.message?.includes(
                  "duplicate key value violates unique constraint",
                )
                  ? " Duplicate custom categories were detected during upload. Please remove or merge duplicate categories and retry."
                  : "";
                throw new Error(
                  `Database synchronization failed. It looks like your custom_categories table is not provisioned. Please copy and paste the SQL schema from "supabase_schema.sql" into your Supabase SQL Editor first!${duplicateHint} (Error: ${error.message})`,
                );
              }
            }
          } else {
            // ==========================================
            // SIMULATED MOCK CLOUD SYNC ROUTINE
            // ==========================================

            // Clean local deletions
            for (const tx of pendingTxs) {
              if (tx.sync_status === "deleted") {
                await db.runAsync("DELETE FROM transactions WHERE id = ?", [
                  tx.id,
                ]);
              } else {
                await db.runAsync(
                  "UPDATE transactions SET sync_status = 'synced' WHERE id = ?",
                  [tx.id],
                );
              }
            }

            for (const acc of pendingAccounts) {
              if (acc.sync_status === "deleted") {
                await db.runAsync("DELETE FROM accounts WHERE id = ?", [
                  acc.id,
                ]);
              } else {
                await db.runAsync(
                  "UPDATE accounts SET sync_status = 'synced' WHERE id = ?",
                  [acc.id],
                );
              }
            }

            for (const debt of pendingDebts) {
              if (debt.sync_status === "deleted") {
                await db.runAsync("DELETE FROM debts_lending WHERE id = ?", [
                  debt.id,
                ]);
              } else {
                await db.runAsync(
                  "UPDATE debts_lending SET sync_status = 'synced' WHERE id = ?",
                  [debt.id],
                );
              }
            }

            for (const loan of pendingLoans) {
              if (loan.sync_status === "deleted") {
                await db.runAsync(
                  "DELETE FROM loans_installments WHERE id = ?",
                  [loan.id],
                );
              } else {
                await db.runAsync(
                  "UPDATE loans_installments SET sync_status = 'synced' WHERE id = ?",
                  [loan.id],
                );
              }
            }

            for (const tmpl of pendingTemplates) {
              if (tmpl.sync_status === "deleted") {
                await db.runAsync(
                  "DELETE FROM recurring_templates WHERE id = ?",
                  [tmpl.id],
                );
              } else {
                await db.runAsync(
                  "UPDATE recurring_templates SET sync_status = 'synced' WHERE id = ?",
                  [tmpl.id],
                );
              }
            }

            // Sync complete arrays to the mock registry
            const freshTxs = await db.getAllAsync<Transaction>(
              "SELECT * FROM transactions",
            );
            const freshDebts = await db.getAllAsync<Debt>(
              "SELECT * FROM debts_lending",
            );
            const freshLoans = await db.getAllAsync<Loan>(
              "SELECT * FROM loans_installments",
            );
            const freshTemplates = await db.getAllAsync<RecurringTemplate>(
              "SELECT * FROM recurring_templates",
            );
            const freshAccounts = await db.getAllAsync<Account>(
              "SELECT * FROM accounts",
            );

            await simulatedCloud.db.backupTable(
              userId,
              "transactions",
              freshTxs,
            );
            await simulatedCloud.db.backupTable(
              userId,
              "accounts",
              freshAccounts,
            );
            await simulatedCloud.db.backupTable(
              userId,
              "debts_lending",
              freshDebts,
            );
            await simulatedCloud.db.backupTable(
              userId,
              "loans_installments",
              freshLoans,
            );
            await simulatedCloud.db.backupTable(
              userId,
              "recurring_templates",
              freshTemplates,
            );
            await simulatedCloud.db.backupTable(
              userId,
              "custom_categories",
              get().customCategories,
            );
          }

          // Update sync stats
          const syncTime = new Date().toLocaleString();
          set({ lastSyncedAt: syncTime });
          await saveKey("money_app_last_synced_at", syncTime);

          // Reload Zustand cache to update in-memory state
          await get().loadAllData();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (error) {
        console.error("Cloud synchronization failed:", error);
        if (force) throw error;
      } finally {
        set({ isSyncing: false });
      }
    },

    // Accounts Actions
    addAccount: async (acc) => {
      const now = Date.now();
      const newAcc: Account = {
        ...acc,
        sync_status: "pending",
        updated_at: now,
      };

      try {
        const db = await getDatabase();
        await db.runAsync(
          `INSERT INTO accounts (id, name, type, initial_balance, color, icon, sync_status, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
          [
            newAcc.id,
            newAcc.name,
            newAcc.type,
            newAcc.initial_balance,
            newAcc.color || null,
            newAcc.icon || null,
            newAcc.updated_at,
          ],
        );

        set({ accounts: [...get().accounts, newAcc] });

        // Trigger auto cloud sync
        if (get().isOnline) {
          get().triggerCloudSync();
        }
      } catch (error) {
        console.error("Failed to insert account in local SQLite:", error);
        throw error;
      }
    },

    updateAccount: async (acc) => {
      const updatedAcc: Account = {
        ...acc,
        sync_status: "pending",
        updated_at: Date.now(),
      };

      try {
        const db = await getDatabase();
        await db.runAsync(
          `UPDATE accounts
           SET name = ?, type = ?, initial_balance = ?, color = ?, icon = ?, sync_status = 'pending', updated_at = ?
           WHERE id = ?`,
          [
            updatedAcc.name,
            updatedAcc.type,
            updatedAcc.initial_balance,
            updatedAcc.color || null,
            updatedAcc.icon || null,
            updatedAcc.updated_at,
            updatedAcc.id,
          ],
        );

        set({
          accounts: get().accounts.map((a) => (a.id === acc.id ? updatedAcc : a)),
        });

        // Trigger auto cloud sync
        if (get().isOnline) {
          get().triggerCloudSync();
        }
      } catch (error) {
        console.error("Failed to update account in local SQLite:", error);
        throw error;
      }
    },

    deleteAccount: async (id) => {
      try {
        const db = await getDatabase();
        await db.runAsync(
          "UPDATE accounts SET sync_status = 'deleted', updated_at = ? WHERE id = ?",
          [Date.now(), id],
        );

        set({
          accounts: get().accounts.filter((a) => a.id !== id),
        });

        // Trigger auto cloud sync
        if (get().isOnline) {
          get().triggerCloudSync();
        }
      } catch (error) {
        console.error("Failed to soft-delete account in local SQLite:", error);
        throw error;
      }
    },

    // Transaction Actions
    addTransaction: async (tx) => {
      const now = Date.now();
      const newTx: Transaction = {
        ...tx,
        sync_status: "pending",
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
          [
            newTx.id,
            newTx.type,
            newTx.amount,
            newTx.category,
            newTx.account,
            newTx.date,
            newTx.note ?? null,
            newTx.description ?? null,
            newTx.bill_path ?? null,
            newTx.sync_status,
            newTx.updated_at,
          ],
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        if (get().isOnline) {
          get().triggerCloudSync();
        }
      } catch (error) {
        console.error("Failed to insert transaction into SQLite:", error);
      }
    },

    updateTransaction: async (tx) => {
      const updatedTx: Transaction = {
        ...tx,
        sync_status: "pending",
        updated_at: Date.now(),
      };

      // Optimistic in-memory update
      set((state) => ({
        transactions: state.transactions.map((t) =>
          t.id === tx.id ? updatedTx : t,
        ),
      }));

      try {
        const db = await getDatabase();
        await db.runAsync(
          `UPDATE transactions 
           SET type = ?, amount = ?, category = ?, account = ?, date = ?, note = ?, description = ?, bill_path = ?, sync_status = ?, updated_at = ?
           WHERE id = ?`,
          [
            updatedTx.type,
            updatedTx.amount,
            updatedTx.category,
            updatedTx.account,
            updatedTx.date,
            updatedTx.note ?? null,
            updatedTx.description ?? null,
            updatedTx.bill_path ?? null,
            updatedTx.sync_status,
            updatedTx.updated_at,
            updatedTx.id,
          ],
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        if (get().isOnline) {
          get().triggerCloudSync();
        }
      } catch (error) {
        console.error("Failed to update transaction in SQLite:", error);
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
          [Date.now(), id],
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        if (get().isOnline) {
          get().triggerCloudSync();
        }
      } catch (error) {
        console.error("Failed to delete transaction from SQLite:", error);
      }
    },

    // Debt Actions
    addDebt: async (debt) => {
      const now = Date.now();
      const newDebt: Debt = {
        ...debt,
        sync_status: "pending",
        updated_at: now,
      };

      set((state) => ({
        debts: [newDebt, ...state.debts],
      }));

      try {
        const db = await getDatabase();
        await db.runAsync(
          `INSERT INTO debts_lending (id, type, contact_name, contact_phone, principal, due_date, interest_rate, payment_progress, note, sync_status, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newDebt.id,
            newDebt.type,
            newDebt.contact_name,
            newDebt.contact_phone ?? null,
            newDebt.principal,
            newDebt.due_date ?? null,
            newDebt.interest_rate,
            newDebt.payment_progress,
            newDebt.note ?? null,
            newDebt.sync_status,
            newDebt.updated_at,
          ],
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        if (get().isOnline) {
          get().triggerCloudSync();
        }
      } catch (error) {
        console.error("Failed to insert debt into SQLite:", error);
      }
    },

    updateDebt: async (debt) => {
      const updatedDebt: Debt = {
        ...debt,
        sync_status: "pending",
        updated_at: Date.now(),
      };

      set((state) => ({
        debts: state.debts.map((d) => (d.id === debt.id ? updatedDebt : d)),
      }));

      try {
        const db = await getDatabase();
        await db.runAsync(
          `UPDATE debts_lending 
           SET type = ?, contact_name = ?, contact_phone = ?, principal = ?, due_date = ?, interest_rate = ?, payment_progress = ?, note = ?, sync_status = ?, updated_at = ?
           WHERE id = ?`,
          [
            updatedDebt.type,
            updatedDebt.contact_name,
            updatedDebt.contact_phone ?? null,
            updatedDebt.principal,
            updatedDebt.due_date ?? null,
            updatedDebt.interest_rate,
            updatedDebt.payment_progress,
            updatedDebt.note ?? null,
            updatedDebt.sync_status,
            updatedDebt.updated_at,
            updatedDebt.id,
          ],
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        if (get().isOnline) {
          get().triggerCloudSync();
        }
      } catch (error) {
        console.error("Failed to update debt in SQLite:", error);
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
          [Date.now(), id],
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        if (get().isOnline) {
          get().triggerCloudSync();
        }
      } catch (error) {
        console.error("Failed to delete debt from SQLite:", error);
      }
    },

    // Loan Actions
    addLoan: async (loan) => {
      const now = Date.now();
      const newLoan: Loan = {
        ...loan,
        sync_status: "pending",
        updated_at: now,
      };

      set((state) => ({
        loans: [newLoan, ...state.loans],
      }));

      try {
        const db = await getDatabase();
        await db.runAsync(
          `INSERT INTO loans_installments (id, name, entry_type, principal, annual_rate, tenure_months, start_date, monthly_emi, reminders_enabled, sync_status, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newLoan.id,
            newLoan.name,
            newLoan.entry_type,
            newLoan.principal,
            newLoan.annual_rate,
            newLoan.tenure_months,
            newLoan.start_date,
            newLoan.monthly_emi,
            newLoan.reminders_enabled,
            newLoan.sync_status,
            newLoan.updated_at,
          ],
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        if (get().isOnline) {
          get().triggerCloudSync();
        }
      } catch (error) {
        console.error("Failed to insert loan into SQLite:", error);
      }
    },

    updateLoan: async (loan) => {
      const updatedLoan: Loan = {
        ...loan,
        sync_status: "pending",
        updated_at: Date.now(),
      };

      set((state) => ({
        loans: state.loans.map((l) => (l.id === loan.id ? updatedLoan : l)),
      }));

      try {
        const db = await getDatabase();
        await db.runAsync(
          `UPDATE loans_installments 
           SET name = ?, entry_type = ?, principal = ?, annual_rate = ?, tenure_months = ?, start_date = ?, monthly_emi = ?, reminders_enabled = ?, sync_status = ?, updated_at = ?
           WHERE id = ?`,
          [
            updatedLoan.name,
            updatedLoan.entry_type,
            updatedLoan.principal,
            updatedLoan.annual_rate,
            updatedLoan.tenure_months,
            updatedLoan.start_date,
            updatedLoan.monthly_emi,
            updatedLoan.reminders_enabled,
            updatedLoan.sync_status,
            updatedLoan.updated_at,
            updatedLoan.id,
          ],
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        if (get().isOnline) {
          get().triggerCloudSync();
        }
      } catch (error) {
        console.error("Failed to update loan in SQLite:", error);
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
          [Date.now(), id],
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        if (get().isOnline) {
          get().triggerCloudSync();
        }
      } catch (error) {
        console.error("Failed to delete loan from SQLite:", error);
      }
    },

    // ==========================================
    // CLOUD AUTHENTICATION & RECOVERY ACTIONS
    // ==========================================

    signUp: async (email, password) => {
      set({ isSyncing: true });
      try {
        if (isSupabaseConfigured && supabase) {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
          });
          if (error) throw error;
          if (data.user) {
            set({
              user: { id: data.user.id, email: data.user.email || email },
            });
          }
        } else {
          const { data, error } = await simulatedCloud.auth.signUp(
            email,
            password,
          );
          if (error) throw error;
          if (data?.user) {
            set({ user: data.user });
          }
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Sync any offline records currently waiting to be uploaded
        get().triggerCloudSync();
      } catch (error: any) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        throw error;
      } finally {
        set({ isSyncing: false });
      }
    },

    signIn: async (email, password) => {
      set({ isSyncing: true });
      try {
        if (isSupabaseConfigured && supabase) {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (error) throw error;
          if (data.user) {
            set({
              user: { id: data.user.id, email: data.user.email || email },
            });
          }
        } else {
          const { data, error } = await simulatedCloud.auth.signIn(
            email,
            password,
          );
          if (error) throw error;
          if (data?.user) {
            set({ user: data.user });
          }
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Automatically fetch cloud settings & sync
        get().triggerCloudSync();
      } catch (error: any) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        throw error;
      } finally {
        set({ isSyncing: false });
      }
    },

    signOut: async () => {
      set({ isSyncing: true });
      try {
        if (isSupabaseConfigured && supabase) {
          await supabase.auth.signOut();
        } else {
          await simulatedCloud.auth.signOut();
        }
        set({ user: null, lastSyncedAt: null });
        await removeKey("money_app_last_synced_at");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (error) {
        console.error("Logout error:", error);
      } finally {
        set({ isSyncing: false });
      }
    },

    resetPassword: async (email, newPasswordForMock) => {
      try {
        if (isSupabaseConfigured && supabase) {
          const { error } = await supabase.auth.resetPasswordForEmail(email);
          if (error) throw error;
          return "link_sent";
        } else {
          const { data, error } =
            await simulatedCloud.auth.resetPasswordForEmail(email);
          if (error) throw error;
          if (newPasswordForMock && data?.simulatedEmail) {
            const { error: updError } =
              await simulatedCloud.auth.updatePasswordForSimulatedUser(
                data.simulatedEmail,
                newPasswordForMock,
              );
            if (updError) throw updError;
            return "mock_reset_success";
          }
          return "mock_email_found";
        }
      } catch (error: any) {
        throw error;
      }
    },

    recoverDataFromCloud: async () => {
      const { user } = get();
      if (!user) {
        throw new Error("Please sign in to recover your database backup.");
      }

      set({ isSyncing: true });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      try {
        const db = await getDatabase();
        const userId = user.id;

        let txs: Transaction[] = [];
        let cloudAccounts: Account[] = [];
        let debts: Debt[] = [];
        let loans: Loan[] = [];
        let templates: RecurringTemplate[] = [];
        let cats: any[] = [];

        if (isSupabaseConfigured && supabase) {
          const { data: dbTxs, error: tErr } = await supabase
            .from("transactions")
            .select("*")
            .eq("user_id", userId);
          const { data: dbAccounts, error: aErr } = await supabase
            .from("accounts")
            .select("*")
            .eq("user_id", userId);
          const { data: dbDebts, error: dErr } = await supabase
            .from("debts_lending")
            .select("*")
            .eq("user_id", userId);
          const { data: dbLoans, error: lErr } = await supabase
            .from("loans_installments")
            .select("*")
            .eq("user_id", userId);
          const { data: dbTemplates, error: tmplErr } = await supabase
            .from("recurring_templates")
            .select("*")
            .eq("user_id", userId);
          const { data: dbCats, error: cErr } = await supabase
            .from("custom_categories")
            .select("*")
            .eq("user_id", userId);

          if (tErr || aErr || dErr || lErr || tmplErr || cErr) {
            console.error("Supabase fetch details:", {
              tErr,
              aErr,
              dErr,
              lErr,
              tmplErr,
              cErr,
            });
            throw new Error(
              'Cloud fetch failed. It looks like your database tables are not provisioned in Supabase. Please copy and paste the SQL schema from the file "supabase_schema.sql" into your Supabase Dashboard SQL Editor first to instantly create your database tables!',
            );
          }

          txs = (dbTxs || []) as Transaction[];
          cloudAccounts = (dbAccounts || []) as Account[];
          debts = (dbDebts || []) as Debt[];
          loans = (dbLoans || []) as Loan[];
          templates = (dbTemplates || []) as RecurringTemplate[];
          cats = (dbCats || []) as any[];
        } else {
          txs = await simulatedCloud.db.fetchTable(userId, "transactions");
          cloudAccounts = await simulatedCloud.db.fetchTable(userId, "accounts");
          debts = await simulatedCloud.db.fetchTable(userId, "debts_lending");
          loans = await simulatedCloud.db.fetchTable(
            userId,
            "loans_installments",
          );
          templates = await simulatedCloud.db.fetchTable(
            userId,
            "recurring_templates",
          );
          cats = await simulatedCloud.db.fetchTable(
            userId,
            "custom_categories",
          );
        }

        // Wipe local tables cleanly
        await db.runAsync("DELETE FROM transactions");
        await db.runAsync("DELETE FROM accounts");
        await db.runAsync("DELETE FROM debts_lending");
        await db.runAsync("DELETE FROM loans_installments");
        await db.runAsync("DELETE FROM recurring_templates");

        // Restore downloaded records
        for (const t of txs) {
          await db.runAsync(
            `INSERT OR REPLACE INTO transactions (id, type, amount, category, account, date, note, description, bill_path, sync_status, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
            [
              t.id,
              t.type,
              t.amount,
              t.category,
              t.account,
              t.date,
              t.note ?? null,
              t.description ?? null,
              t.bill_path ?? null,
              t.updated_at,
            ],
          );
        }

        for (const acc of cloudAccounts) {
          await db.runAsync(
            `INSERT OR REPLACE INTO accounts (id, name, type, initial_balance, color, icon, sync_status, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 'synced', ?)`,
            [
              acc.id,
              acc.name,
              acc.type,
              acc.initial_balance,
              acc.color ?? null,
              acc.icon ?? null,
              acc.updated_at,
            ],
          );
        }

        for (const d of debts) {
          await db.runAsync(
            `INSERT OR REPLACE INTO debts_lending (id, type, contact_name, contact_phone, principal, due_date, interest_rate, payment_progress, note, sync_status, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
            [
              d.id,
              d.type,
              d.contact_name,
              d.contact_phone ?? null,
              d.principal,
              d.due_date ?? null,
              d.interest_rate,
              d.payment_progress,
              d.note ?? null,
              d.updated_at,
            ],
          );
        }

        for (const l of loans) {
          await db.runAsync(
            `INSERT OR REPLACE INTO loans_installments (id, name, entry_type, principal, annual_rate, tenure_months, start_date, monthly_emi, reminders_enabled, sync_status, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
            [
              l.id,
              l.name,
              (l as any).entry_type ?? "expense",
              l.principal,
              l.annual_rate,
              l.tenure_months,
              l.start_date,
              l.monthly_emi,
              l.reminders_enabled,
              l.updated_at,
            ],
          );
        }

        for (const tmpl of templates) {
          await db.runAsync(
            `INSERT OR REPLACE INTO recurring_templates (id, type, amount, category, account, note, day_of_month, is_active, last_applied_month, sync_status, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
            [
              tmpl.id,
              tmpl.type,
              tmpl.amount,
              tmpl.category,
              tmpl.account,
              tmpl.note ?? null,
              tmpl.day_of_month,
              tmpl.is_active,
              tmpl.last_applied_month ?? null,
              tmpl.updated_at,
            ],
          );
        }

        // Restore Custom Categories
        if (cats.length > 0) {
          const normalizedCats = normalizeCustomCategories(
            cats.map((c) => ({ name: c.name, emoji: c.emoji, type: c.type })),
          );
          const json = JSON.stringify(normalizedCats);
          if (Platform.OS === "web") {
            localStorage.setItem("money_app_custom_categories", json);
          } else {
            await SecureStore.setItemAsync("money_app_custom_categories", json);
          }
        }

        // Load into state
        await get().loadAllData();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (error: any) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        throw error;
      } finally {
        set({ isSyncing: false });
      }
    },

    simulateAppReset: async () => {
      set({ isSyncing: true });
      try {
        const db = await getDatabase();
        await db.runAsync("DELETE FROM transactions");
        await db.runAsync("DELETE FROM accounts");
        await db.runAsync("DELETE FROM debts_lending");
        await db.runAsync("DELETE FROM loans_installments");
        await db.runAsync("DELETE FROM recurring_templates");

        if (Platform.OS === "web") {
          localStorage.removeItem("money_app_custom_categories");
          localStorage.removeItem("money_app_important_notes");
        } else {
          await SecureStore.deleteItemAsync("money_app_custom_categories");
          try {
            await SecureStore.deleteItemAsync("money_app_important_notes");
          } catch (e) {}
        }

        set({
          transactions: [],
          accounts: [],
          debts: [],
          loans: [],
          recurringTemplates: [],
          customCategories: [],
          importantNotes: "",
        });

        // Trigger loadAllData to repopulate initial seeded defaults as if fresh install
        await get().loadAllData();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {
        console.error(e);
      } finally {
        set({ isSyncing: false });
      }
    },

    toggleSyncOnMobileData: async (val) => {
      set({ syncOnMobileData: val });
      await saveKey("money_app_sync_on_mobile_data", val ? "true" : "false");
    },

    toggleAutoCloudSync: async (val) => {
      set({ autoCloudSync: val });
      await saveKey("money_app_auto_cloud_sync", val ? "true" : "false");
    },

    loadCloudSyncSettings: async () => {
      let sessionUser: any = null;

      if (isSupabaseConfigured && supabase) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          sessionUser = { id: session.user.id, email: session.user.email };
        }
      } else {
        const data = await getKey("mock_cloud_active_session");
        if (data) {
          try {
            const session = JSON.parse(data);
            if (session?.user) {
              sessionUser = session.user;
            }
          } catch (e) {}
        }
      }

      const syncMobile = await getKey("money_app_sync_on_mobile_data");
      const autoSync = await getKey("money_app_auto_cloud_sync");
      const lastSync = await getKey("money_app_last_synced_at");
      const budgetsJson = await getKey("money_app_category_budgets");
      let budgets: Record<string, number> = {};
      if (budgetsJson) {
        try {
          budgets = JSON.parse(budgetsJson);
        } catch (e) {}
      }

      set({
        user: sessionUser,
        syncOnMobileData: syncMobile === "false" ? false : true,
        autoCloudSync: autoSync === "false" ? false : true,
        lastSyncedAt: lastSync || null,
        categoryBudgets: budgets,
      });
    },

    addRecurringTemplate: async (tmpl) => {
      const now = Date.now();
      const newTmpl: RecurringTemplate = {
        ...tmpl,
        sync_status: "pending",
        updated_at: now,
      };

      set((state) => ({
        recurringTemplates: [newTmpl, ...state.recurringTemplates],
      }));

      try {
        const db = await getDatabase();
        await db.runAsync(
          `INSERT INTO recurring_templates (id, type, amount, category, account, note, day_of_month, is_active, last_applied_month, sync_status, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newTmpl.id,
            newTmpl.type,
            newTmpl.amount,
            newTmpl.category,
            newTmpl.account,
            newTmpl.note ?? null,
            newTmpl.day_of_month,
            newTmpl.is_active,
            newTmpl.last_applied_month ?? null,
            newTmpl.sync_status,
            newTmpl.updated_at,
          ],
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        if (get().isOnline) {
          get().triggerCloudSync();
        }
      } catch (error) {
        console.error(
          "Failed to insert recurring template into SQLite:",
          error,
        );
      }
    },

    updateRecurringTemplate: async (tmpl) => {
      const updatedTmpl: RecurringTemplate = {
        ...tmpl,
        sync_status: "pending",
        updated_at: Date.now(),
      };

      set((state) => ({
        recurringTemplates: state.recurringTemplates.map((t) =>
          t.id === tmpl.id ? updatedTmpl : t,
        ),
      }));

      try {
        const db = await getDatabase();
        await db.runAsync(
          `UPDATE recurring_templates 
           SET type = ?, amount = ?, category = ?, account = ?, note = ?, day_of_month = ?, is_active = ?, last_applied_month = ?, sync_status = ?, updated_at = ?
           WHERE id = ?`,
          [
            updatedTmpl.type,
            updatedTmpl.amount,
            updatedTmpl.category,
            updatedTmpl.account,
            updatedTmpl.note ?? null,
            updatedTmpl.day_of_month,
            updatedTmpl.is_active,
            updatedTmpl.last_applied_month ?? null,
            updatedTmpl.sync_status,
            updatedTmpl.updated_at,
            updatedTmpl.id,
          ],
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        if (get().isOnline) {
          get().triggerCloudSync();
        }
      } catch (error) {
        console.error("Failed to update recurring template in SQLite:", error);
      }
    },

    deleteRecurringTemplate: async (id) => {
      set((state) => ({
        recurringTemplates: state.recurringTemplates.filter((t) => t.id !== id),
      }));

      try {
        const db = await getDatabase();
        await db.runAsync(
          "UPDATE recurring_templates SET sync_status = 'deleted', updated_at = ? WHERE id = ?",
          [Date.now(), id],
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        if (get().isOnline) {
          get().triggerCloudSync();
        }
      } catch (error) {
        console.error(
          "Failed to delete recurring template from SQLite:",
          error,
        );
      }
    },

    checkAndApplyRecurringTransactions: async () => {
      const { recurringTemplates } = get();
      const activeTemplates = recurringTemplates.filter(
        (t) => t.is_active === 1,
      );

      const now = new Date();
      const currentMonthStr = now.toISOString().substring(0, 7); // 'YYYY-MM'
      const currentDay = now.getDate();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

      let hasAppliedAny = false;

      for (const t of activeTemplates) {
        const effectiveDay = Math.min(t.day_of_month, daysInMonth);
        if (
          t.last_applied_month !== currentMonthStr &&
          currentDay >= effectiveDay
        ) {
          try {
            const transactionDate = new Date(
              currentYear,
              currentMonth,
              effectiveDay,
            ).getTime();

            // 1. Generate Transaction
            await get().addTransaction({
              id: `tx-recurring-${Date.now()}-${t.id}`,
              type: t.type,
              amount: t.amount,
              category: t.category,
              account: t.account,
              date: transactionDate,
              note: `[Recurring] ${t.note || ""}`.trim(),
            });

            // 2. Mark as applied
            const updatedTmpl = {
              ...t,
              last_applied_month: currentMonthStr,
            };

            // Execute updating template logic (avoid triggerCloudSync inside loops, we trigger once at the end)
            const updatedTmplWithPending = {
              ...updatedTmpl,
              sync_status: "pending" as const,
              updated_at: Date.now(),
            };

            set((state) => ({
              recurringTemplates: state.recurringTemplates.map((item) =>
                item.id === t.id ? updatedTmplWithPending : item,
              ),
            }));

            const db = await getDatabase();
            await db.runAsync(
              `UPDATE recurring_templates 
               SET last_applied_month = ?, sync_status = 'pending', updated_at = ?
               WHERE id = ?`,
              [currentMonthStr, Date.now(), t.id],
            );

            hasAppliedAny = true;
          } catch (e) {
            console.error("Failed to apply recurring transaction template:", e);
          }
        }
      }

      if (hasAppliedAny && get().isOnline) {
        get().triggerCloudSync();
      }
    },
  };
});
