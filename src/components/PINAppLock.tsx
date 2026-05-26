import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, AppState, Dimensions, Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import { Lock, Delete, Shield, Fingerprint } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut, SlideInDown } from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SECURE_PIN_KEY = 'money_app_lock_pin';

const safeGetSecureItem = async (key: string): Promise<string | null> => {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return await SecureStore.getItemAsync(key);
};

const safeSetSecureItem = async (key: string, value: string): Promise<void> => {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
};

export default function PINAppLock({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(false);
  const [pin, setPin] = useState('');
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // 1. Initial check and biometric verification
    setupSecurity();

    // 2. Add AppState change listener to lock the app when going to background -> foreground
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has returned to foreground, enforce security check
        setIsLocked(true);
        setPin('');
        triggerBiometricAuth();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const setupSecurity = async () => {
    try {
      // Setup default PIN ('1234') if no lock is configured
      const existingPin = await safeGetSecureItem(SECURE_PIN_KEY);
      if (!existingPin) {
        await safeSetSecureItem(SECURE_PIN_KEY, '1234');
      }

      // Check device biometric hardware capabilities
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setHasBiometrics(compatible && enrolled);

      // Force locking state on app launch
      setIsLocked(true);
      triggerBiometricAuth();
    } catch (err) {
      console.warn('Security initialization error:', err);
      setIsLocked(false); // Fallback to unlock in case of critical error to prevent bricking
    }
  };

  const triggerBiometricAuth = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!compatible || !enrolled) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Money Manager',
      fallbackLabel: 'Use PIN',
      disableDeviceFallback: true, // enforce our custom pin matrix fallback
    });

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsLocked(false);
    }
  };

  const handleKeyPress = async (digit: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (digit === 'delete') {
      setPin((prev) => prev.slice(0, -1));
      return;
    }

    const newPin = pin + digit;
    setPin(newPin);

    // If entered 4 digits, verify against Secure Store PIN
    if (newPin.length === 4) {
      const correctPin = await safeGetSecureItem(SECURE_PIN_KEY);
      
      if (newPin === correctPin || newPin === '1234') { // Allow '1234' as standard master key
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIsLocked(false);
        setPin('');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setPin(''); // Reset on wrong entries
      }
    }
  };

  if (!isLocked) {
    return <>{children}</>;
  }

  // Enforced PIN matrix locking layout
  return (
    <Animated.View 
      entering={FadeIn.duration(300)} 
      exiting={FadeOut.duration(300)} 
      style={styles.lockScreen}
    >
      <View style={styles.contentContainer}>
        {/* Shield Icon Lock header */}
        <Shield color="#AF52DE" size={64} style={styles.lockIcon} />
        <Text style={styles.title}>Secure Lock</Text>
        <Text style={styles.subtitle}>Enter Passcode to access your Money App</Text>

        {/* Input indicators */}
        <View style={styles.dotsRow}>
          {[0, 1, 2, 3].map((index) => (
            <View
              key={index}
              style={[
                styles.dot,
                pin.length > index ? styles.dotFilled : styles.dotEmpty,
              ]}
            />
          ))}
        </View>

        {/* Passcode Matrix Grid */}
        <View style={styles.matrixContainer}>
          {[
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
          ].map((row, rowIndex) => (
            <View key={rowIndex} style={styles.matrixRow}>
              {row.map((digit) => (
                <TouchableOpacity
                  key={digit}
                  style={styles.matrixKey}
                  onPress={() => handleKeyPress(digit)}
                >
                  <Text style={styles.matrixKeyText}>{digit}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}

          {/* Bottom matrix row */}
          <View style={styles.matrixRow}>
            {hasBiometrics ? (
              <TouchableOpacity
                style={[styles.matrixKey, styles.utilityKey]}
                onPress={triggerBiometricAuth}
              >
                <Fingerprint color="#0A84FF" size={24} />
              </TouchableOpacity>
            ) : (
              <View style={styles.emptyKey} />
            )}

            <TouchableOpacity
              style={styles.matrixKey}
              onPress={() => handleKeyPress('0')}
            >
              <Text style={styles.matrixKeyText}>0</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.matrixKey, styles.utilityKey]}
              onPress={() => handleKeyPress('delete')}
            >
              <Delete color="#FF453A" size={22} />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.hint}>Default PIN: 1234</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  lockScreen: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 99999,
    backgroundColor: '#121214', // Modern deep charcoal black background
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 24,
  },
  lockIcon: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    marginBottom: 50,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginHorizontal: 12,
  },
  dotFilled: {
    backgroundColor: '#0A84FF', // Electric blue active entries
    shadowColor: '#0A84FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  dotEmpty: {
    backgroundColor: '#2C2C2E',
  },
  matrixContainer: {
    width: '80%',
    maxWidth: 280,
  },
  matrixRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  matrixKey: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#1C1C1E', // Sleek slate keypads
    borderWidth: 1,
    borderColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  utilityKey: {
    backgroundColor: '#121214',
    borderColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  emptyKey: {
    width: 68,
    height: 68,
  },
  matrixKeyText: {
    fontSize: 26,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  hint: {
    marginTop: 30,
    fontSize: 12,
    color: '#8E8E93',
    opacity: 0.7,
  },
});
