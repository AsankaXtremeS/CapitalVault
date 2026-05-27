import FloatingCalculator from "@/components/FloatingCalculator";
import LockScreen from "@/components/LockScreen";
import { useLocalStore } from "@/hooks/useLocalStore";
import { initializeDatabase } from "@/utils/db";
import { Tabs } from "expo-router";
import { useTheme } from "@/hooks/use-theme";
import { StatusBar } from "expo-status-bar";
import {
  BarChart3,
  BookOpen,
  HandCoins,
  Percent,
  PiggyBank,
} from "lucide-react-native";
import React from "react";
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

interface AnimatedTabBarIconProps {
  IconComponent: any;
  color: string;
  size: number;
  focused: boolean;
}

function AnimatedTabBarIcon({
  IconComponent,
  color,
  size,
  focused,
}: AnimatedTabBarIconProps) {
  const scaleAnim = React.useRef(
    new Animated.Value(focused ? 1.15 : 1.0),
  ).current;
  const bounceAnim = React.useRef(new Animated.Value(focused ? -2 : 0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: focused ? 1.15 : 1.0,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.spring(bounceAnim, {
        toValue: focused ? -3 : 0,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused]);

  return (
    <Animated.View
      style={{
        transform: [{ scale: scaleAnim }, { translateY: bounceAnim }],
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <IconComponent color={color} size={size - 2} />
    </Animated.View>
  );
}

export default function RootLayout() {
  const {
    loadAllData,
    isDbLoaded,
    pipeValue,
    loadCloudSyncSettings,
    isAppLockEnabled,
    theme,
  } = useLocalStore();
  const [animationComplete, setAnimationComplete] = React.useState(false);
  const [isUnlocked, setIsUnlocked] = React.useState(false);
  const progressAnim = React.useRef(new Animated.Value(0)).current;
  const themeColors = useTheme();
  const isDark = theme === 'dark';

  React.useEffect(() => {
    async function setupApp() {
      try {
        // 1. Initialize SQLite Database schemas and seeds
        await initializeDatabase();
      } catch (e) {
        console.error("DB init error (non-fatal):", e);
      }
      // 2. Load SQLite records into Zustand reactive in-memory cache
      await loadAllData();

      // 3. Load cloud settings and session
      await loadCloudSyncSettings();
    }
    setupApp();

    // Start progress bar animation
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 1800, // Smooth 1.8 seconds loading experience
      useNativeDriver: false,
    }).start(() => {
      setAnimationComplete(true);
    });
  }, []);

  if (!isDbLoaded || !animationComplete) {
    const widthInterpolate = progressAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ["0%", "100%"],
    });

    return (
      <View style={styles.splashContainer}>
        <View style={styles.logoContainer}>
          <Image
            source={require("../../assets/Logo.png")}
            style={styles.logo}
            resizeMode="cover"
          />
        </View>

        <Text style={styles.splashTitle}>Money Manager</Text>
        <Text style={styles.splashSubtitle}>PERSONAL FINANCE</Text>

        {/* Elegant Animated Progress Bar */}
        <View style={styles.progressBarContainer}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                width: widthInterpolate,
              },
            ]}
          />
        </View>

        <Text style={styles.loadingText}>Loading your data...</Text>

        {/* Custom Progress Dots Indicator at bottom */}
        <View style={styles.dotsContainer}>
          <View style={styles.dotActive} />
          <View style={styles.dotInactive} />
          <View style={styles.dotInactive} />
        </View>
      </View>
    );
  }


  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <StatusBar style={isDark ? "light" : "dark"} />

      {/* Main Tab Router shell */}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#1FA89B", // Teal-Green active accent
          tabBarInactiveTintColor: themeColors.textSecondary, // Dynamic secondary text color
          detachInactiveScreens: false, // Prevents Android native view attach/detach 1-frame white flicker
          sceneContainerStyle: { backgroundColor: themeColors.background }, // Dynamic container background
          tabBarButton: (props) => (
            <TouchableOpacity {...props} activeOpacity={0.75} />
          ),
          tabBarStyle: {
            backgroundColor: themeColors.backgroundElement, // Dynamic tab bar background
            borderTopColor: themeColors.backgroundSelected, // Dynamic tab bar border
            borderTopWidth: 1.5,
            height: 64,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: "600",
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Trans.",
            tabBarIcon: ({ color, size, focused }) => (
              <AnimatedTabBarIcon
                IconComponent={BookOpen}
                color={color}
                size={size}
                focused={focused}
              />
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
            title: "Stats",
            tabBarIcon: ({ color, size, focused }) => (
              <AnimatedTabBarIcon
                IconComponent={BarChart3}
                color={color}
                size={size}
                focused={focused}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="debts"
          options={{
            title: "Debts",
            tabBarIcon: ({ color, size, focused }) => (
              <AnimatedTabBarIcon
                IconComponent={HandCoins}
                color={color}
                size={size}
                focused={focused}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="loans"
          options={{
            title: "Loans & Invest",
            tabBarIcon: ({ color, size, focused }) => (
              <AnimatedTabBarIcon
                IconComponent={Percent}
                color={color}
                size={size}
                focused={focused}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="budget"
          options={{
            title: "Budget",
            tabBarIcon: ({ color, size, focused }) => (
              <AnimatedTabBarIcon
                IconComponent={PiggyBank}
                color={color}
                size={size}
                focused={focused}
              />
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
        <Tabs.Screen
          name="settings"
          options={{
            href: null,
          }}
        />
      </Tabs>

      {/* Global floating drag-and-drop calculator snapping to screen boundaries */}
      <FloatingCalculator onInsert={(val) => pipeValue(val)} />

      {/* App Lock Overlay */}
      {isAppLockEnabled && !isUnlocked && (
        <LockScreen onUnlock={() => setIsUnlocked(true)} />
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#121214", // Deep Charcoal background
    justifyContent: "center",
    alignItems: "center",
  },
  splashContainer: {
    flex: 1,
    backgroundColor: "#121214", // Matches image exactly
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  logoContainer: {
    width: 110,
    height: 110,
    borderRadius: 28,
    overflow: "hidden",
    marginBottom: 24,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  splashTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  splashSubtitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8E8E93",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 48,
  },
  progressBarContainer: {
    width: 200,
    height: 4,
    backgroundColor: "#2C2C2E",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 16,
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#1FA89B", // Premium Teal progress bar
  },
  loadingText: {
    fontSize: 12,
    color: "#636366",
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  dotsContainer: {
    flexDirection: "row",
    position: "absolute",
    bottom: 50,
    alignItems: "center",
  },
  dotActive: {
    width: 16,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#1FA89B",
    marginHorizontal: 4,
  },
  dotInactive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2C2C2E",
    marginHorizontal: 4,
  },
});
