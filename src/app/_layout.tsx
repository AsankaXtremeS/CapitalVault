import React from 'react';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import PINAppLock from '@/components/PINAppLock';
import FloatingCalculator from '@/components/FloatingCalculator';
import { useLocalStore } from '@/hooks/useLocalStore';
import { initializeDatabase } from '@/utils/db';
import { 
  BookOpen, 
  BarChart3, 
  HandCoins, 
  Percent 
} from 'lucide-react-native';

export default function RootLayout() {
  const { loadAllData, isDbLoaded, pipeValue } = useLocalStore();

  React.useEffect(() => {
    async function setupApp() {
      // 1. Initialize SQLite Database schemas and seeds
      await initializeDatabase();
      // 2. Load SQLite records into Zustand reactive in-memory cache
      await loadAllData();
    }
    setupApp();
  }, []);

  if (!isDbLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0A84FF" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PINAppLock>
        <StatusBar style="light" />
        
        {/* Main Tab Router shell */}
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: '#FF453A', // Coral Red active accent
            tabBarInactiveTintColor: '#8E8E93', // Muted secondary text
            tabBarStyle: {
              backgroundColor: '#1C1C1E', // Sleek slate container
              borderTopColor: '#2C2C2E',
              borderTopWidth: 1.5,
              height: 64,
              paddingBottom: 8,
              paddingTop: 8,
            },
            tabBarLabelStyle: {
              fontSize: 10,
              fontWeight: '600',
            },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'Trans.',
              tabBarIcon: ({ color, size }) => (
                <BookOpen color={color} size={size - 2} />
              ),
            }}
          />
          <Tabs.Screen
            name="calendar"
            options={{
              href: null,
            }}
          />
          <Tabs.Screen
            name="monthly"
            options={{
              href: null,
            }}
          />
          <Tabs.Screen
            name="stats"
            options={{
              title: 'Stats',
              tabBarIcon: ({ color, size }) => (
                <BarChart3 color={color} size={size - 2} />
              ),
            }}
          />
          <Tabs.Screen
            name="debts"
            options={{
              title: 'Debts',
              tabBarIcon: ({ color, size }) => (
                <HandCoins color={color} size={size - 2} />
              ),
            }}
          />
          <Tabs.Screen
            name="loans"
            options={{
              title: 'Loans',
              tabBarIcon: ({ color, size }) => (
                <Percent color={color} size={size - 2} />
              ),
            }}
          />
          {/* Hide default routing files that are not tabs */}
          <Tabs.Screen
            name="explore"
            options={{
              href: null,
            }}
          />
        </Tabs>

        {/* Global floating drag-and-drop calculator snapping to screen boundaries */}
        <FloatingCalculator onInsert={(val) => pipeValue(val)} />
      </PINAppLock>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#121214', // Deep Charcoal background
    justifyContent: 'center',
    alignItems: 'center',
  },
});
