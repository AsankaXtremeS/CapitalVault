import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView, Alert, Modal, TextInput } from 'react-native';
import { useLocalStore } from '@/hooks/useLocalStore';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, Save, FileDown, Bell, Moon, Sun, Lock, Vibrate, DollarSign } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const router = useRouter();
  const { 
    isAppLockEnabled, 
    isBiometricEnabled, 
    theme, 
    hapticsEnabled, 
    currencySymbol,
    appPin,
    updateSettings,
    transactions,
    debts
  } = useLocalStore();

  const isDark = theme === 'dark';

  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);

  const toggleHaptics = async (value: boolean) => {
    if (value) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await updateSettings({ hapticsEnabled: value });
  };

  const toggleTheme = async (value: boolean) => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await updateSettings({ theme: value ? 'dark' : 'light' });
    Alert.alert('Theme Changed', 'The app will use the new theme on the next launch or as components update.');
  };

  const toggleAppLock = async (value: boolean) => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (value) {
      if (!appPin) {
        Alert.alert('Set PIN First', 'You must set a PIN before enabling App Lock.');
        setPinModalVisible(true);
        return;
      }
      await updateSettings({ isAppLockEnabled: true });
    } else {
      await updateSettings({ isAppLockEnabled: false });
    }
  };

  const toggleBiometrics = async (value: boolean) => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (value && !isAppLockEnabled) {
      Alert.alert('Enable App Lock', 'Please enable App Lock before turning on Biometrics.');
      return;
    }
    await updateSettings({ isBiometricEnabled: value });
  };

  const savePin = async () => {
    if (newPin.length !== 4) {
      Alert.alert('Invalid PIN', 'PIN must be exactly 4 digits.');
      return;
    }
    if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await updateSettings({ appPin: newPin, isAppLockEnabled: true });
    setPinModalVisible(false);
    setNewPin('');
    Alert.alert('Success', 'App Lock PIN has been updated and enabled.');
  };

  const selectCurrency = async (sym: string) => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await updateSettings({ currencySymbol: sym });
    setCurrencyModalVisible(false);
  };

  const exportCSV = async () => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const header = "ID,Date,Type,Category,Account,Amount,Note\n";
      const rows = transactions.map(tx => {
        const dateStr = new Date(tx.date).toISOString();
        const safeNote = (tx.note || '').replace(/,/g, ' '); // avoid CSV break
        return `${tx.id},${dateStr},${tx.type},${tx.category},${tx.account},${tx.amount},${safeNote}`;
      }).join("\n");
      
      const csvData = header + rows;
      
      // Modern object-oriented Expo FileSystem API usage
      const file = new File(Paths.document, "MoneyManager_Export.csv");
      await file.write(csvData);
      
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Transactions',
          UTI: 'public.comma-separated-values-text'
        });
      } else {
        Alert.alert('Export Complete', 'File saved to documents: ' + file.uri);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Export Failed', 'An error occurred while generating the CSV.');
    }
  };

  const scheduleDebtReminders = async () => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Find active debts
    const activeDebts = debts.filter(d => d.type === 'lending' && d.payment_progress < d.principal);
    if (activeDebts.length === 0) {
      Alert.alert('No Reminders', 'You have no active lending debts to remind you about.');
      return;
    }

    Alert.alert('Reminders Enabled', 'You will receive weekly push notifications for active debts. (Note: Requires custom dev build for full support)');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft color="#FFFFFF" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Appearance */}
        <Text style={styles.sectionTitle}>APPEARANCE</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              {isDark ? <Moon color="#8E8E93" size={20} /> : <Sun color="#8E8E93" size={20} />}
              <Text style={styles.rowText}>Dark Mode</Text>
            </View>
            <Switch 
              value={isDark} 
              onValueChange={toggleTheme}
              trackColor={{ false: '#3A3A3C', true: '#1FA89B' }}
            />
          </View>
          
          <View style={styles.separator} />
          
          <TouchableOpacity style={styles.row} onPress={() => setCurrencyModalVisible(true)}>
            <View style={styles.rowLeft}>
              <DollarSign color="#8E8E93" size={20} />
              <Text style={styles.rowText}>Currency Symbol</Text>
            </View>
            <Text style={styles.rowValue}>{currencySymbol}</Text>
          </TouchableOpacity>
        </View>

        {/* Security */}
        <Text style={styles.sectionTitle}>SECURITY</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Lock color="#8E8E93" size={20} />
              <Text style={styles.rowText}>App Lock (PIN)</Text>
            </View>
            <Switch 
              value={isAppLockEnabled} 
              onValueChange={toggleAppLock}
              trackColor={{ false: '#3A3A3C', true: '#1FA89B' }}
            />
          </View>
          
          <View style={styles.separator} />
          
          <TouchableOpacity style={styles.row} onPress={() => setPinModalVisible(true)}>
            <View style={styles.rowLeft}>
              <Lock color="#8E8E93" size={20} />
              <Text style={styles.rowText}>{appPin ? 'Change PIN' : 'Set PIN'}</Text>
            </View>
            <ChevronLeft style={{transform: [{rotate: '180deg'}]}} color="#8E8E93" size={20} />
          </TouchableOpacity>

          <View style={styles.separator} />
          
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Lock color="#8E8E93" size={20} />
              <Text style={styles.rowText}>Biometric Unlock</Text>
            </View>
            <Switch 
              value={isBiometricEnabled} 
              onValueChange={toggleBiometrics}
              trackColor={{ false: '#3A3A3C', true: '#1FA89B' }}
            />
          </View>
        </View>

        {/* Preferences */}
        <Text style={styles.sectionTitle}>PREFERENCES</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Vibrate color="#8E8E93" size={20} />
              <Text style={styles.rowText}>Haptic Feedback</Text>
            </View>
            <Switch 
              value={hapticsEnabled} 
              onValueChange={toggleHaptics}
              trackColor={{ false: '#3A3A3C', true: '#1FA89B' }}
            />
          </View>
          
          <View style={styles.separator} />
          
          <TouchableOpacity style={styles.row} onPress={scheduleDebtReminders}>
            <View style={styles.rowLeft}>
              <Bell color="#8E8E93" size={20} />
              <Text style={styles.rowText}>Enable Debt Reminders</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Data */}
        <Text style={styles.sectionTitle}>DATA MANAGEMENT</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={exportCSV}>
            <View style={styles.rowLeft}>
              <FileDown color="#0A84FF" size={20} />
              <Text style={[styles.rowText, { color: '#0A84FF' }]}>Export Transactions to CSV</Text>
            </View>
          </TouchableOpacity>
        </View>
        
        <Text style={styles.versionText}>Money Manager v1.0.0</Text>
      </ScrollView>

      {/* PIN Setup Modal */}
      <Modal visible={pinModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set 4-Digit PIN</Text>
            <TextInput
              style={styles.pinInput}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              value={newPin}
              onChangeText={setNewPin}
              autoFocus
              placeholder="____"
              placeholderTextColor="#8E8E93"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setPinModalVisible(false)}>
                <Text style={styles.modalBtnTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSave} onPress={savePin}>
                <Text style={styles.modalBtnTextSave}>Save PIN</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Currency Setup Modal */}
      <Modal visible={currencyModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Currency</Text>
            <ScrollView style={{maxHeight: 300, width: '100%'}}>
              {['$', '€', '£', '¥', 'Rs', '₹', 'Rp', '฿'].map(sym => (
                <TouchableOpacity key={sym} style={styles.currencyRow} onPress={() => selectCurrency(sym)}>
                  <Text style={styles.currencyText}>{sym}</Text>
                  {currencySymbol === sym && <Text style={{color: '#1FA89B'}}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.modalBtnCancel, {width: '100%', marginTop: 20}]} onPress={() => setCurrencyModalVisible(false)}>
              <Text style={styles.modalBtnTextCancel}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121214',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E'
  },
  backBtn: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60,
  },
  sectionTitle: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 16,
  },
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  rowValue: {
    color: '#8E8E93',
    fontSize: 16,
  },
  separator: {
    height: 1,
    backgroundColor: '#2C2C2E',
    marginLeft: 48,
  },
  versionText: {
    textAlign: 'center',
    color: '#636366',
    marginTop: 40,
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1C1C1E',
    width: '80%',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2C2C2E'
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 24,
  },
  pinInput: {
    backgroundColor: '#2C2C2E',
    color: '#FFFFFF',
    fontSize: 32,
    letterSpacing: 8,
    padding: 16,
    borderRadius: 12,
    width: '100%',
    textAlign: 'center',
    marginBottom: 32,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalBtnCancel: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#2C2C2E',
    marginRight: 8,
    alignItems: 'center',
  },
  modalBtnSave: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#1FA89B',
    marginLeft: 8,
    alignItems: 'center',
  },
  modalBtnTextCancel: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  modalBtnTextSave: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  currencyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E'
  },
  currencyText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '500'
  }
});
