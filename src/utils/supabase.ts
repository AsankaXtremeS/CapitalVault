import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// ==========================================
// 1. SUPABASE CLOUD CONFIGURATION
// ==========================================
// Loaded dynamically from your root `.env` file (via Expo's EXPO_PUBLIC_ prefix).
// If these environment variables are missing, the app defaults to "Simulated Cloud Mode".
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || ''; 
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''; 

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL.trim() && SUPABASE_ANON_KEY.trim()
);

// Real client instance (will be configured only if credentials are set)
export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;

// ==========================================
// 2. HIGH-FIDELITY SIMULATED CLOUD ENGINE
// ==========================================
// Persists simulated account credentials, sessions, and database backups locally 
// using SecureStore (native) and localStorage (web) to mimic an remote database.

interface SimulatedUser {
  id: string;
  email: string;
  passwordHash: string;
}

// Persistent key helpers that adapt to iOS/Android/Web
async function saveKey(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
  } else {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (e) {
      console.warn('SecureStore error:', e);
    }
  }
}

async function getKey(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  } else {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      console.warn('SecureStore error:', e);
      return null;
    }
  }
}

async function removeKey(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
  } else {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (e) {
      console.warn('SecureStore error:', e);
    }
  }
}

// Registry helpers for registered users
async function getSimulatedUsersRegistry(): Promise<SimulatedUser[]> {
  const data = await getKey('mock_cloud_users_registry');
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

async function saveSimulatedUsersRegistry(users: SimulatedUser[]): Promise<void> {
  await saveKey('mock_cloud_users_registry', JSON.stringify(users));
}

// Mock auth / database engine
export const simulatedCloud = {
  auth: {
    signUp: async (email: string, password: string) => {
      // Simulate network lag
      await new Promise(resolve => setTimeout(resolve, 800));

      const cleanedEmail = email.toLowerCase().trim();
      if (!cleanedEmail || !password) {
        throw new Error('Email and password are required');
      }

      const users = await getSimulatedUsersRegistry();
      if (users.some(u => u.email === cleanedEmail)) {
        throw new Error('User already exists in simulated cloud directory.');
      }

      const newUser: SimulatedUser = {
        id: `usr-${Date.now()}`,
        email: cleanedEmail,
        passwordHash: password, // Store in plain text for simulated purposes
      };

      users.push(newUser);
      await saveSimulatedUsersRegistry(users);

      // Create session
      const session = { user: { id: newUser.id, email: newUser.email } };
      await saveKey('mock_cloud_active_session', JSON.stringify(session));

      return { data: { user: session.user, session }, error: null };
    },

    signIn: async (email: string, password: string) => {
      // Simulate network lag
      await new Promise(resolve => setTimeout(resolve, 800));

      const cleanedEmail = email.toLowerCase().trim();
      const users = await getSimulatedUsersRegistry();
      const user = users.find(u => u.email === cleanedEmail && u.passwordHash === password);

      if (!user) {
        throw new Error('Invalid email or password credentials.');
      }

      const session = { user: { id: user.id, email: user.email } };
      await saveKey('mock_cloud_active_session', JSON.stringify(session));

      return { data: { user: session.user, session }, error: null };
    },

    signOut: async () => {
      await removeKey('mock_cloud_active_session');
      return { error: null };
    },

    getSession: async () => {
      const data = await getKey('mock_cloud_active_session');
      if (!data) return { data: { session: null }, error: null };
      try {
        const session = JSON.parse(data);
        return { data: { session }, error: null };
      } catch (e) {
        return { data: { session: null }, error: null };
      }
    },

    resetPasswordForEmail: async (email: string) => {
      await new Promise(resolve => setTimeout(resolve, 600));
      const cleanedEmail = email.toLowerCase().trim();
      const users = await getSimulatedUsersRegistry();
      const user = users.find(u => u.email === cleanedEmail);
      if (!user) {
        throw new Error('No simulated account found with that email address.');
      }
      // Return details for local password update dialog trigger
      return { data: { simulatedEmail: user.email }, error: null };
    },

    updatePasswordForSimulatedUser: async (email: string, newPass: string) => {
      await new Promise(resolve => setTimeout(resolve, 600));
      const cleanedEmail = email.toLowerCase().trim();
      const users = await getSimulatedUsersRegistry();
      const userIdx = users.findIndex(u => u.email === cleanedEmail);
      if (userIdx === -1) {
        throw new Error('User not found.');
      }
      users[userIdx].passwordHash = newPass;
      await saveSimulatedUsersRegistry(users);
      return { error: null };
    }
  },

  db: {
    // Saves a table backup for a specific simulated user
    backupTable: async (userId: string, tableName: string, records: any[]) => {
      await saveKey(`mock_cloud_db_${tableName}_${userId}`, JSON.stringify(records));
    },

    // Retrieves a table backup for a specific simulated user
    fetchTable: async (userId: string, tableName: string): Promise<any[]> => {
      const data = await getKey(`mock_cloud_db_${tableName}_${userId}`);
      if (!data) return [];
      try {
        return JSON.parse(data);
      } catch (e) {
        return [];
      }
    },

    // Completely wipes all tables for a simulated user (simulating deletion/reset)
    clearAllUserData: async (userId: string) => {
      await removeKey(`mock_cloud_db_transactions_${userId}`);
      await removeKey(`mock_cloud_db_debts_lending_${userId}`);
      await removeKey(`mock_cloud_db_loans_installments_${userId}`);
      await removeKey(`mock_cloud_db_recurring_templates_${userId}`);
      await removeKey(`mock_cloud_db_custom_categories_${userId}`);
    }
  }
};
