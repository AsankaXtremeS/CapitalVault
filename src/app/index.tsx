import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  Modal, 
  TextInput, 
  Image, 
  Alert,
  Dimensions
} from 'react-native';
import { 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  SlidersHorizontal,
  Camera, 
  Calendar as CalendarIcon, 
  Wallet, 
  Sparkles, 
  CloudLightning,
  CheckCircle2,
  Trash2,
  Bookmark
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useLocalStore, Transaction } from '@/hooks/useLocalStore';
import { parseNaturalLanguageTransaction } from '@/utils/edgeNLPParser';
import { compressImageToLimit } from '@/utils/imageCompressor';
import NumericalKeyboard from '@/components/NumericalKeyboard';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const EXPENSE_CATEGORIES = ['Food', 'Social Life', 'Pets', 'Transport', 'Culture', 'Household', 'Apparel', 'Beauty', 'Health', 'Education', 'Gift', 'Other'];
const INCOME_CATEGORIES = ['Salary', 'Allowance', 'Bonus', 'Petty cash', 'Other'];
const ACCOUNTS = ['Cash', 'Accounts', 'Card'];

const CATEGORY_EMOJIS: Record<string, string> = {
  Food: '🍜',
  'Social Life': '🥳',
  Pets: '🐱',
  Transport: '🚖',
  Culture: '🎬',
  Household: '🏠',
  Apparel: '👕',
  Beauty: '💄',
  Health: '💊',
  Education: '📚',
  Gift: '🎁',
  Salary: '💼',
  Allowance: '🪙',
  Bonus: '✨',
  'Petty cash': '💵',
  Other: '📦',
};

const getDayBadgeStyle = (date: Date) => {
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday, 1-5 = Weekdays
  if (day === 0) {
    return {
      bg: '#FF453A', // Red background for Sunday
      color: '#FFFFFF'
    };
  } else if (day === 6) {
    return {
      bg: '#0A84FF', // Light blue background for Saturday
      color: '#FFFFFF'
    };
  } else {
    return {
      bg: '#3A3A3C', // Ash / Grey background for weekdays
      color: '#FFFFFF'
    };
  }
};

export default function DailyLedger() {
  const { 
    transactions, 
    addTransaction, 
    deleteTransaction,
    isSyncing, 
    isOnline, 
    triggerCloudSync,
    calculatorPipeValue,
    clearPipeValue,
    openCalculator,
    customCategories,
    addCustomCategory
  } = useLocalStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  
  // Transaction Form States
  const [txType, setTxType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('0');
  const [category, setCategory] = useState('Other');
  const [account, setAccount] = useState('Cash');
  const [note, setNote] = useState('');
  const [description, setDescription] = useState('');
  const [billPath, setBillPath] = useState<string | null>(null);
  const [billSize, setBillSize] = useState<string | null>(null);
  const [aiText, setAiText] = useState('');

  // UI Interactive States
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [showCategoryGrid, setShowCategoryGrid] = useState(false);
  const [showAccountGrid, setShowAccountGrid] = useState(false);

  // Custom Category Form States
  const [showCustomCatModal, setShowCustomCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('✨');

  const getCategoryEmoji = (catName: string) => {
    if (CATEGORY_EMOJIS[catName]) return CATEGORY_EMOJIS[catName];
    const found = customCategories.find(c => c.name === catName);
    return found ? found.emoji : '📦';
  };

  // Subscribe to the global floating calculator pipe
  useEffect(() => {
    if (calculatorPipeValue && modalVisible) {
      setAmount(calculatorPipeValue);
      clearPipeValue();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [calculatorPipeValue, modalVisible]);

  // Group transactions for display
  const currentMonthTxs = transactions.filter(tx => {
    const txDate = new Date(tx.date);
    return txDate.getMonth() === selectedMonth.getMonth() &&
           txDate.getFullYear() === selectedMonth.getFullYear();
  });

  const totalIncome = currentMonthTxs
    .filter(tx => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalExpenses = currentMonthTxs
    .filter(tx => tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalNet = totalIncome - totalExpenses;

  // Group transactions by day
  const groupedTxs: Record<string, Transaction[]> = {};
  currentMonthTxs.forEach(tx => {
    const dateStr = new Date(tx.date).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    if (!groupedTxs[dateStr]) groupedTxs[dateStr] = [];
    groupedTxs[dateStr].push(tx);
  });

  const handleMonthChange = (direction: 'next' | 'prev') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newMonth = new Date(selectedMonth);
    newMonth.setMonth(selectedMonth.getMonth() + (direction === 'next' ? 1 : -1));
    setSelectedMonth(newMonth);
  };

  const handlePickBill = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Denied', 'Camera access is required to capture bill receipts.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const sourceUri = result.assets[0].uri;
      // Compress offline image progressively below 300KB
      const compressionResult = await compressImageToLimit(sourceUri);
      if (compressionResult.success) {
        setBillPath(compressionResult.uri);
        setBillSize(`${Math.round(compressionResult.sizeBytes / 1024)}KB`);
      } else {
        setBillPath(sourceUri);
        setBillSize('Large');
      }
    }
  };

  const handleParseNLP = () => {
    if (!aiText.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Process input text using Regex offline extractor
    const parsed = parseNaturalLanguageTransaction(aiText);
    
    setTxType(parsed.type);
    if (parsed.amount) {
      setAmount(parsed.amount.toString());
    }
    setCategory(parsed.category);
    setAccount(parsed.account);
    setNote(parsed.note);
    setAiText(''); // Clear input
  };

  const handleSave = () => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid monetary amount.');
      return;
    }

    addTransaction({
      id: `tx-${Date.now()}`,
      type: txType,
      amount: numericAmount,
      category,
      account,
      date: Date.now(),
      note: note.trim() || undefined,
      description: description.trim() || undefined,
      bill_path: billPath || undefined,
    });

    // Reset Form
    setAmount('0');
    setCategory('Other');
    setAccount('Cash');
    setNote('');
    setDescription('');
    setBillPath(null);
    setBillSize(null);
    setModalVisible(false);
  };

  return (
    <View style={styles.container}>
      {/* Header Controls */}
      <View style={styles.header}>
        <View style={styles.monthSelector}>
          <TouchableOpacity onPress={() => handleMonthChange('prev')}>
            <ChevronLeft color="#8E8E93" size={24} />
          </TouchableOpacity>
          <Text style={styles.monthText}>
            {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Text>
          <TouchableOpacity onPress={() => handleMonthChange('next')}>
            <ChevronRight color="#8E8E93" size={24} />
          </TouchableOpacity>
        </View>

        <View style={styles.headerActions}>
          {/* Cloud Sync Indicator */}
          <TouchableOpacity 
            onPress={() => isOnline && triggerCloudSync()} 
            style={[styles.syncIcon, !isOnline && styles.offlineIcon]}
          >
            {isSyncing ? (
              <Text style={styles.syncingLabel}>Syncing...</Text>
            ) : isOnline ? (
              <CheckCircle2 color="#0A84FF" size={20} />
            ) : (
              <CloudLightning color="#FF453A" size={20} />
            )}
          </TouchableOpacity>
          <SlidersHorizontal color="#FFFFFF" size={20} style={styles.actionIcon} />
        </View>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Income</Text>
          <Text style={[styles.summaryVal, styles.incomeText]}>
            ${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Expenses</Text>
          <Text style={[styles.summaryVal, styles.expenseText]}>
            ${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Net</Text>
          <Text style={[styles.summaryVal, totalNet >= 0 ? styles.incomeText : styles.expenseText]}>
            ${totalNet.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </Text>
        </View>
      </View>

      {/* Transaction List */}
      <ScrollView contentContainerStyle={styles.listContent}>
        {Object.keys(groupedTxs).length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No transactions logged for this month.</Text>
            <Text style={styles.emptySubText}>Tap the "+" button below to log offline files.</Text>
          </View>
        ) : (
          Object.keys(groupedTxs).map(dayKey => {
            const dayTxs = groupedTxs[dayKey];
            const dayDate = new Date(dayTxs[0].date);
            
            // Calculate daily statistics
            const dayIncome = dayTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
            const dayExpense = dayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

            return (
              <View key={dayKey} style={styles.dayGroup}>
                {/* Day Header row */}
                <View style={styles.dayHeader}>
                  <View style={styles.dayHeaderDate}>
                    <Text style={styles.dayNum}>{dayDate.getDate()}</Text>
                    <View style={[
                      styles.dayNameBadge,
                      { backgroundColor: getDayBadgeStyle(dayDate).bg }
                    ]}>
                      <Text style={[
                        styles.dayNameText,
                        { color: getDayBadgeStyle(dayDate).color }
                      ]}>
                        {dayDate.toLocaleDateString('en-US', { weekday: 'short' })}
                      </Text>
                    </View>
                    <Text style={styles.dayYearText}>
                      {`${(dayDate.getMonth() + 1).toString().padStart(2, '0')}.${dayDate.getFullYear()}`}
                    </Text>
                  </View>
                  <View style={styles.dayTotals}>
                    <Text style={styles.dayIncomeVal}>
                      ${dayIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                    <Text style={styles.dayExpenseVal}>
                      ${dayExpense.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                </View>

                {/* Day Transactions */}
                {dayTxs.map(tx => (
                  <View key={tx.id} style={styles.txRow}>
                    {/* Left: Category + Emoji */}
                    <View style={styles.txCategoryContainer}>
                      <Text style={styles.txCategoryText}>
                        {getCategoryEmoji(tx.category)} {tx.category}
                      </Text>
                    </View>

                    {/* Middle: Note & Account details */}
                    <View style={styles.txMiddleContainer}>
                      {tx.note ? (
                        <View>
                          <Text style={styles.txNoteText}>{tx.note}</Text>
                          <Text style={styles.txAccountBelowNote}>{tx.account}</Text>
                        </View>
                      ) : (
                        <Text style={styles.txAccountOnly}>{tx.account}</Text>
                      )}
                      {tx.bill_path && (
                        <Text style={styles.attachmentLabel}>📎 Bill Attached</Text>
                      )}
                    </View>

                    {/* Right: Amount & Delete button */}
                    <View style={styles.txRightContainer}>
                      <Text style={[
                        styles.txAmountText,
                        tx.type === 'income' ? styles.incomeText : styles.expenseText
                      ]}>
                        ${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                      <TouchableOpacity 
                        style={styles.deleteBtn} 
                        onPress={() => {
                          Alert.alert(
                            'Delete Transaction',
                            'Are you sure you want to remove this ledger entry?',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Delete', style: 'destructive', onPress: () => deleteTransaction(tx.id) }
                            ]
                          );
                        }}
                      >
                        <Trash2 color="#8E8E93" size={14} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Red FAB Plus Trigger */}
      <TouchableOpacity 
        style={styles.fab} 
        activeOpacity={0.8}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setModalVisible(true);
        }}
      >
        <Plus color="#FFFFFF" size={32} />
      </TouchableOpacity>

      {/* Add Transaction Entry Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            
            {/* Modal Title bar */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Transaction</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelLink}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalFormContent}>
              {/* AI Natural Language Text Box */}
              <View style={styles.aiBox}>
                <View style={styles.aiHeader}>
                  <Sparkles color="#AF52DE" size={16} />
                  <Text style={styles.aiTitle}>AI Natural Language Smart Entry</Text>
                </View>
                <TextInput
                  placeholder="e.g. Spent 45 dollars on lunch yesterday"
                  placeholderTextColor="#8E8E93"
                  style={styles.aiInput}
                  value={aiText}
                  onChangeText={setAiText}
                />
                <TouchableOpacity style={styles.parseBtn} onPress={handleParseNLP}>
                  <Text style={styles.parseBtnText}>Parse Transaction Details</Text>
                </TouchableOpacity>
              </View>

              {/* Transaction Type Selectors */}
              <View style={styles.typeRow}>
                <TouchableOpacity 
                  style={[styles.typeBtn, txType === 'expense' && styles.typeExpenseActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setTxType('expense');
                  }}
                >
                  <Text style={[styles.typeBtnText, txType === 'expense' && styles.typeActiveText]}>Expense</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.typeBtn, txType === 'income' && styles.typeIncomeActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setTxType('income');
                  }}
                >
                  <Text style={[styles.typeBtnText, txType === 'income' && styles.typeActiveText]}>Income</Text>
                </TouchableOpacity>
              </View>

              {/* Manual Form Inputs */}
              <View style={styles.formItem}>
                <Text style={styles.formLabel}>Amount ($)</Text>
                <TouchableOpacity 
                  style={styles.amountSelector}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsKeyboardVisible(true);
                  }}
                >
                  <Text style={styles.amountSelectorVal}>${amount}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.formItem}>
                <Text style={styles.formLabel}>Category</Text>
                <TouchableOpacity 
                  style={styles.dropdownTrigger}
                  onPress={() => setShowCategoryGrid(!showCategoryGrid)}
                >
                  <Text style={styles.dropdownText}>
                    {getCategoryEmoji(category)} {category}
                  </Text>
                </TouchableOpacity>

                {showCategoryGrid && (
                  <View style={styles.gridSelector}>
                    {[
                      ...(txType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES),
                      ...customCategories.filter(c => c.type === txType).map(c => c.name)
                    ].map(cat => (
                      <TouchableOpacity 
                        key={cat} 
                        style={[styles.gridItem, category === cat && styles.gridItemActive]}
                        onPress={() => {
                          setCategory(cat);
                          setShowCategoryGrid(false);
                        }}
                      >
                        <Text style={[styles.gridItemText, category === cat && styles.gridItemTextActive]}>
                          {getCategoryEmoji(cat)} {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity 
                      style={[styles.gridItem, styles.addCustomGridItem]}
                      onPress={() => {
                        setShowCustomCatModal(true);
                      }}
                    >
                      <Text style={styles.addCustomGridItemText}>+ Custom</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View style={styles.formItem}>
                <Text style={styles.formLabel}>Account</Text>
                <TouchableOpacity 
                  style={styles.dropdownTrigger}
                  onPress={() => setShowAccountGrid(!showAccountGrid)}
                >
                  <Text style={styles.dropdownText}>{account}</Text>
                </TouchableOpacity>

                {showAccountGrid && (
                  <View style={styles.gridSelector}>
                    {ACCOUNTS.map(acc => (
                      <TouchableOpacity 
                        key={acc} 
                        style={[styles.gridItem, account === acc && styles.gridItemActive]}
                        onPress={() => {
                          setAccount(acc);
                          setShowAccountGrid(false);
                        }}
                      >
                        <Text style={[styles.gridItemText, account === acc && styles.gridItemTextActive]}>
                          {acc}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.formItem}>
                <Text style={styles.formLabel}>Note</Text>
                <TextInput
                  placeholder="Short transaction annotation"
                  placeholderTextColor="#8E8E93"
                  style={styles.textInput}
                  value={note}
                  onChangeText={setNote}
                />
              </View>

              {/* Bill Attachment Picker Section */}
              <View style={styles.formItem}>
                <Text style={styles.formLabel}>Bill Receipt Receipt</Text>
                <TouchableOpacity style={styles.cameraRow} onPress={handlePickBill}>
                  <Camera color="#8E8E93" size={20} />
                  <Text style={styles.cameraText}>
                    {billPath ? `Re-Capture Bill (${billSize})` : 'Attach Bill Image'}
                  </Text>
                </TouchableOpacity>
                {billPath && (
                  <View style={styles.attachedImageContainer}>
                    <Text style={styles.attachedText}>Attached Image Ready for Sync</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>Save Transaction</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Custom bottom numerical keypad overlay */}
            {isKeyboardVisible && (
              <NumericalKeyboard
                value={amount === '0' ? '' : amount}
                onChange={(newVal) => setAmount(newVal === '' ? '0' : newVal)}
                onDone={() => setIsKeyboardVisible(false)}
                onOpenCalculator={openCalculator}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Create Custom Category Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showCustomCatModal}
        onRequestClose={() => setShowCustomCatModal(false)}
      >
        <View style={styles.catModalBackdrop}>
          <View style={styles.catModalContent}>
            <Text style={styles.catModalTitle}>Create Category</Text>
            
            <View style={styles.catFormItem}>
              <Text style={styles.catFormLabel}>Category Name</Text>
              <TextInput
                placeholder="e.g. Subscriptions, Gym"
                placeholderTextColor="#8E8E93"
                style={styles.catTextInput}
                value={newCatName}
                onChangeText={setNewCatName}
              />
            </View>

            <View style={styles.catFormItem}>
              <Text style={styles.catFormLabel}>Category Emoji</Text>
              <TextInput
                placeholder="e.g. 🎮, 🏋️"
                placeholderTextColor="#8E8E93"
                style={styles.catTextInput}
                value={newCatEmoji}
                onChangeText={setNewCatEmoji}
                maxLength={2}
              />
            </View>

            <View style={styles.catBtnRow}>
              <TouchableOpacity 
                style={styles.catCancelBtn}
                onPress={() => {
                  setShowCustomCatModal(false);
                  setNewCatName('');
                  setNewCatEmoji('✨');
                }}
              >
                <Text style={styles.catCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.catCreateBtn}
                onPress={async () => {
                  if (!newCatName.trim()) {
                    Alert.alert('Required', 'Please enter a category name');
                    return;
                  }
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  await addCustomCategory({
                    name: newCatName.trim(),
                    emoji: newCatEmoji.trim() || '✨',
                    type: txType,
                  });
                  setCategory(newCatName.trim());
                  setShowCustomCatModal(false);
                  setNewCatName('');
                  setNewCatEmoji('✨');
                }}
              >
                <Text style={styles.catCreateBtnText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121214', // Modern Dark theme background
    paddingTop: 48,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginHorizontal: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncIcon: {
    padding: 6,
    marginRight: 10,
  },
  offlineIcon: {
    opacity: 0.6,
  },
  syncingLabel: {
    color: '#AF52DE',
    fontSize: 12,
    fontWeight: '600',
  },
  actionIcon: {
    marginLeft: 8,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#1C1C1E', // Sleek cards
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  summaryLabel: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  summaryVal: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  incomeText: {
    color: '#0A84FF', // Electric blue Income
  },
  expenseText: {
    color: '#FF453A', // Coral red Expense
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubText: {
    color: '#8E8E93',
    fontSize: 13,
    opacity: 0.7,
  },
  dayGroup: {
    marginBottom: 24,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
    paddingBottom: 6,
    marginBottom: 8,
  },
  dayHeaderDate: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayNum: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  dayNameBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayNameText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dayYearText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  dayTotals: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayIncomeVal: {
    color: '#0A84FF',
    fontSize: 14,
    fontWeight: '700',
    marginRight: 16,
  },
  dayExpenseVal: {
    color: '#FF453A',
    fontSize: 14,
    fontWeight: '700',
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1C1C1E',
  },
  txCategoryContainer: {
    width: 120,
    justifyContent: 'center',
  },
  txCategoryText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '500',
  },
  txMiddleContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  txNoteText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  txAccountBelowNote: {
    color: '#8E8E93',
    fontSize: 12,
  },
  txAccountOnly: {
    color: '#8E8E93',
    fontSize: 14,
  },
  txRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  txAmountText: {
    fontSize: 14,
    fontWeight: '700',
    marginRight: 10,
  },
  txMeta: {
    flex: 1,
  },
  txCategory: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  txAccount: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: 2,
  },
  txNote: {
    color: '#8E8E93',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
  attachmentLabel: {
    color: '#AF52DE',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
  txRight: {
    alignItems: 'flex-end',
    flexDirection: 'row',
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
    marginRight: 10,
  },
  deleteBtn: {
    padding: 6,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF453A', // Vibrant red FAB accent
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#FF5E55',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.9,
    paddingTop: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  cancelLink: {
    color: '#FF453A',
    fontSize: 15,
  },
  modalFormContent: {
    padding: 20,
    paddingBottom: 40,
  },
  aiBox: {
    backgroundColor: '#121214',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#AF52DE', // Purple smart-entry highlight
    marginBottom: 20,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiTitle: {
    color: '#AF52DE',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  aiInput: {
    color: '#FFFFFF',
    fontSize: 14,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
    marginBottom: 10,
  },
  parseBtn: {
    backgroundColor: '#AF52DE',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  parseBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  typeRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  typeBtn: {
    flex: 1,
    backgroundColor: '#121214',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  typeExpenseActive: {
    backgroundColor: '#FF453A',
    borderColor: '#FF5E55',
  },
  typeIncomeActive: {
    backgroundColor: '#0A84FF',
    borderColor: '#2B96FF',
  },
  typeBtnText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '700',
  },
  typeActiveText: {
    color: '#FFFFFF',
  },
  formItem: {
    marginBottom: 18,
  },
  formLabel: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  amountSelector: {
    backgroundColor: '#121214',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  amountSelectorVal: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  dropdownTrigger: {
    backgroundColor: '#121214',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  dropdownText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  gridSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#121214',
    borderRadius: 10,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  gridItem: {
    width: '30%',
    margin: '1.5%',
    backgroundColor: '#1C1C1E',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  gridItemActive: {
    backgroundColor: '#AF52DE',
    borderColor: '#C382E6',
  },
  gridItemText: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '600',
  },
  gridItemTextActive: {
    color: '#FFFFFF',
  },
  textInput: {
    backgroundColor: '#121214',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    color: '#FFFFFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  cameraRow: {
    backgroundColor: '#121214',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    flexDirection: 'row',
    alignItems: 'center',
  },
  cameraText: {
    color: '#8E8E93',
    marginLeft: 8,
    fontSize: 13,
  },
  attachedImageContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    alignItems: 'center',
  },
  attachedText: {
    color: '#0A84FF',
    fontSize: 11,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#0A84FF', // Save trigger
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#0A84FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  catModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  catModalContent: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#2C2C2E',
    padding: 20,
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 12,
  },
  catModalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  catFormItem: {
    marginBottom: 14,
  },
  catFormLabel: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  catTextInput: {
    backgroundColor: '#121214',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: '#FFFFFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  catBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  catCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 8,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#2C2C2E',
  },
  catCancelBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  catCreateBtn: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 8,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#AF52DE',
  },
  catCreateBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  addCustomGridItem: {
    borderColor: '#AF52DE',
    borderStyle: 'dashed',
    borderWidth: 1.5,
  },
  addCustomGridItemText: {
    color: '#AF52DE',
    fontSize: 11,
    fontWeight: '700',
  },
});
