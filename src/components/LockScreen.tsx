import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Animated } from 'react-native';
import { useLocalStore } from '../hooks/useLocalStore';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import { Fingerprint, Delete } from 'lucide-react-native';

interface LockScreenProps {
  onUnlock: () => void;
}

export default function LockScreen({ onUnlock }: LockScreenProps) {
  const { appPin, isBiometricEnabled, simulateAppReset, hapticsEnabled } = useLocalStore();
  const [pinEntry, setPinEntry] = useState('');
  const shakeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isBiometricEnabled) {
      handleBiometricAuth();
    }
  }, [isBiometricEnabled]);

  const handleBiometricAuth = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    
    if (hasHardware && isEnrolled) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Money Manager',
        fallbackLabel: 'Use PIN',
      });
      if (result.success) {
        if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onUnlock();
      }
    }
  };

  const handleKeyPress = (num: string) => {
    if (pinEntry.length < 4) {
      if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newPin = pinEntry + num;
      setPinEntry(newPin);
      
      if (newPin.length === 4) {
        verifyPin(newPin);
      }
    }
  };

  const handleDelete = () => {
    if (pinEntry.length > 0) {
      if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPinEntry(pinEntry.slice(0, -1));
    }
  };

  const verifyPin = (enteredPin: string) => {
    if (enteredPin === appPin) {
      if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onUnlock();
    } else {
      if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      // Shake animation for error
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true })
      ]).start();
      
      setTimeout(() => setPinEntry(''), 400);
    }
  };

  const handleForgotPin = () => {
    Alert.alert(
      'Reset App Data',
      'Are you sure you want to completely reset the app data? This will clear all local transactions, debts, and settings to factory defaults. This is required if you forgot your PIN.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset App', 
          style: 'destructive',
          onPress: async () => {
            await simulateAppReset();
            onUnlock(); // Unlocks after reset
            Alert.alert('App Reset', 'Your app data has been wiped.');
          }
        }
      ]
    );
  };

  const renderDot = (index: number) => {
    const isFilled = pinEntry.length > index;
    return (
      <View key={index} style={[styles.dot, isFilled && styles.dotFilled]} />
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Money Manager</Text>
      <Text style={styles.subtitle}>Enter your PIN to unlock</Text>
      
      <Animated.View style={[styles.dotsContainer, { transform: [{ translateX: shakeAnim }] }]}>
        {[0, 1, 2, 3].map(renderDot)}
      </Animated.View>
      
      <View style={styles.keypad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
          <TouchableOpacity key={num} style={styles.key} onPress={() => handleKeyPress(num)}>
            <Text style={styles.keyText}>{num}</Text>
          </TouchableOpacity>
        ))}
        
        <TouchableOpacity style={styles.key} onPress={handleBiometricAuth}>
          {isBiometricEnabled ? <Fingerprint color="#1FA89B" size={32} /> : null}
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.key} onPress={() => handleKeyPress('0')}>
          <Text style={styles.keyText}>0</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.key} onPress={handleDelete}>
          <Delete color="#FFFFFF" size={28} />
        </TouchableOpacity>
      </View>
      
      <TouchableOpacity onPress={handleForgotPin} style={styles.forgotBtn}>
        <Text style={styles.forgotText}>Forgot PIN? (Reset Data)</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121214',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 9999,
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 48,
  },
  dotsContainer: {
    flexDirection: 'row',
    marginBottom: 60,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#2C2C2E',
    marginHorizontal: 12,
  },
  dotFilled: {
    backgroundColor: '#1FA89B',
    borderColor: '#1FA89B',
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 280,
    justifyContent: 'space-between',
  },
  key: {
    width: 75,
    height: 75,
    borderRadius: 37.5,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  keyText: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  forgotBtn: {
    marginTop: 20,
    padding: 12,
  },
  forgotText: {
    color: '#FF453A',
    fontSize: 14,
    fontWeight: '600',
  }
});
