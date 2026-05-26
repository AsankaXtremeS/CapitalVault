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
  Bookmark,
  Star
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
    updateTransaction,
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
  const [txDate, setTxDate] = useState<Date>(new Date());
  const [pickerMonth, setPickerMonth] = useState<Date>(new Date());

  // UI Interactive States
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [showCategoryGrid, setShowCategoryGrid] = useState(false);
  const [showAccountGrid, setShowAccountGrid] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);

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

  // Sub-Tab Switcher State
  const [activeSubTab, setActiveSubTab] = useState<'Daily' | 'Calendar' | 'Monthly' | 'Total' | 'Note'>('Daily');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [expandedMonth, setExpandedMonth] = useState<number | null>(new Date().getMonth());

  // Filter transactions based on active view period
  const periodTxs = transactions.filter(tx => {
    const d = new Date(tx.date);
    if (activeSubTab === 'Monthly' || activeSubTab === 'Total') {
      return d.getFullYear() === selectedYear;
    }
    return d.getMonth() === selectedMonth.getMonth() && d.getFullYear() === selectedMonth.getFullYear();
  });

  const totalIncome = periodTxs
    .filter(tx => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalExpenses = periodTxs
    .filter(tx => tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalNet = totalIncome - totalExpenses;

  // Group only month transactions for the daily ledger list
  const dailyTxs = transactions.filter(tx => {
    const txDate = new Date(tx.date);
    return txDate.getMonth() === selectedMonth.getMonth() &&
           txDate.getFullYear() === selectedMonth.getFullYear();
  });

  const groupedTxs: Record<string, Transaction[]> = {};
  dailyTxs.forEach(tx => {
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
    setSelectedYear(newMonth.getFullYear());
  };

  const handlePrevPeriod = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (activeSubTab === 'Monthly' || activeSubTab === 'Total') {
      setSelectedYear(prev => prev - 1);
    } else {
      const newMonth = new Date(selectedMonth);
      newMonth.setMonth(selectedMonth.getMonth() - 1);
      setSelectedMonth(newMonth);
      setSelectedYear(newMonth.getFullYear());
    }
  };

  const handleNextPeriod = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (activeSubTab === 'Monthly' || activeSubTab === 'Total') {
      setSelectedYear(prev => prev + 1);
    } else {
      const newMonth = new Date(selectedMonth);
      newMonth.setMonth(selectedMonth.getMonth() + 1);
      setSelectedMonth(newMonth);
      setSelectedYear(newMonth.getFullYear());
    }
  };

  // Calendar cells setup
  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday, 1 = Monday ...
  const totalDays = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) cells.push(null);
  for (let day = 1; day <= totalDays; day++) cells.push(day);

  const calendarRows: (number | null)[][] = [];
  let currentCalRow: (number | null)[] = [];
  
  cells.forEach((cell, idx) => {
    currentCalRow.push(cell);
    if (currentCalRow.length === 7 || idx === cells.length - 1) {
      while (currentCalRow.length < 7) currentCalRow.push(null);
      calendarRows.push(currentCalRow);
      currentCalRow = [];
    }
  });

  const getDailyStatsForCalendar = (dayNum: number) => {
    const dayTxs = dailyTxs.filter(tx => new Date(tx.date).getDate() === dayNum);
    const income = dayTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = dayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const net = income - expense;
    return { income, expense, net };
  };

  // Annual view weekly breakdown helpers
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const getWeeklyStatsForMonth = (monthIndex: number) => {
    const yearTxs = transactions.filter(tx => new Date(tx.date).getFullYear() === selectedYear);
    const monthTxs = yearTxs.filter(tx => new Date(tx.date).getMonth() === monthIndex);
    const totalDaysInMonth = new Date(selectedYear, monthIndex + 1, 0).getDate();
    
    const weekIntervals = [
      { start: 1, end: 7 },
      { start: 8, end: 14 },
      { start: 15, end: 21 },
      { start: 22, end: 28 },
      { start: 29, end: totalDaysInMonth }
    ].filter(w => w.start <= totalDaysInMonth);

    const weeks: Array<{ rangeStr: string; income: number; expense: number; net: number; isActive: boolean }> = [];

    weekIntervals.reverse().forEach((week) => {
      const weekTxs = monthTxs.filter(tx => {
        const day = new Date(tx.date).getDate();
        return day >= week.start && day <= week.end;
      });

      const income = weekTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = weekTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const net = income - expense;
      const formatNum = (num: number) => num.toString().padStart(2, '0');
      const rangeStr = `${formatNum(monthIndex + 1)}.${formatNum(week.start)} ~ ${formatNum(monthIndex + 1)}.${formatNum(week.end)}`;
      
      const today = new Date();
      const isActive = today.getFullYear() === selectedYear && today.getMonth() === monthIndex && today.getDate() >= week.start && today.getDate() <= week.end;

      weeks.push({ rangeStr, income, expense, net, isActive });
    });

    return weeks;
  };

  const getMonthStats = (monthIndex: number) => {
    const yearTxs = transactions.filter(tx => new Date(tx.date).getFullYear() === selectedYear);
    const monthTxs = yearTxs.filter(tx => new Date(tx.date).getMonth() === monthIndex);
    const income = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const net = income - expense;
    return { income, expense, net };
  };

  // Category totals selector helper
  const getCategoryTotalsList = () => {
    const map: Record<string, { income: number; expense: number }> = {};
    periodTxs.forEach(tx => {
      if (!map[tx.category]) map[tx.category] = { income: 0, expense: 0 };
      if (tx.type === 'income') map[tx.category].income += tx.amount;
      else map[tx.category].expense += tx.amount;
    });
    return Object.keys(map).map(catName => {
      const inc = map[catName].income;
      const exp = map[catName].expense;
      return {
        name: catName,
        income: inc,
        expense: exp,
        net: inc - exp,
      };
    }).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  };

  // Notes extractor helper
  const notesTxs = periodTxs.filter(tx => tx.note && tx.note.trim() !== '');

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

  const handlePickerMonthChange = (direction: 'next' | 'prev') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newMonth = new Date(pickerMonth);
    newMonth.setMonth(pickerMonth.getMonth() + (direction === 'next' ? 1 : -1));
    setPickerMonth(newMonth);
  };

  const handleEditTransaction = (tx: Transaction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditingTransactionId(tx.id);
    setTxType(tx.type as 'income' | 'expense');
    setAmount(tx.amount.toString());
    setCategory(tx.category);
    setAccount(tx.account);
    setNote(tx.note || '');
    setDescription(tx.description || '');
    setBillPath(tx.bill_path || null);
    const dateObj = new Date(tx.date);
    setTxDate(dateObj);
    setPickerMonth(dateObj);
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setAmount('0');
    setCategory('Other');
    setAccount('Cash');
    setNote('');
    setDescription('');
    setBillPath(null);
    setBillSize(null);
    setTxDate(new Date());
    setPickerMonth(new Date());
    setEditingTransactionId(null);
    setShowDatePicker(false);
    setModalVisible(false);
  };

  const handleSave = () => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid monetary amount.');
      return;
    }

    if (editingTransactionId) {
      updateTransaction({
        id: editingTransactionId,
        type: txType,
        amount: numericAmount,
        category,
        account,
        date: txDate.getTime(),
        note: note.trim() || undefined,
        description: description.trim() || undefined,
        bill_path: billPath || undefined,
        sync_status: 'pending',
        updated_at: Date.now(),
      });
    } else {
      addTransaction({
        id: `tx-${Date.now()}`,
        type: txType,
        amount: numericAmount,
        category,
        account,
        date: txDate.getTime(),
        note: note.trim() || undefined,
        description: description.trim() || undefined,
        bill_path: billPath || undefined,
      });
    }

    // Reset Form
    handleCloseModal();
  };

  // Date picker calendar helper calculations
  const pickerYear = pickerMonth.getFullYear();
  const pickerMonthIdx = pickerMonth.getMonth();
  const pickerFirstDayIndex = new Date(pickerYear, pickerMonthIdx, 1).getDay();
  const pickerTotalDays = new Date(pickerYear, pickerMonthIdx + 1, 0).getDate();

  const pickerCells: (number | null)[] = [];
  for (let i = 0; i < pickerFirstDayIndex; i++) pickerCells.push(null);
  for (let day = 1; day <= pickerTotalDays; day++) pickerCells.push(day);

  const pickerRows: (number | null)[][] = [];
  let currentPickerRow: (number | null)[] = [];
  pickerCells.forEach((cell, idx) => {
    currentPickerRow.push(cell);
    if (currentPickerRow.length === 7 || idx === pickerCells.length - 1) {
      while (currentPickerRow.length < 7) currentPickerRow.push(null);
      pickerRows.push(currentPickerRow);
      currentPickerRow = [];
    }
  });

  const pickerMonthName = pickerMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <View style={styles.container}>
      {/* Top Period Header Row switcher */}
      <View style={styles.topPeriodHeader}>
        <View style={styles.periodSelector}>
          <TouchableOpacity onPress={handlePrevPeriod} style={styles.chevronBtn}>
            <ChevronLeft color="#FFFFFF" size={22} />
          </TouchableOpacity>
          <Text style={styles.periodText}>
            {activeSubTab === 'Monthly' || activeSubTab === 'Total'
              ? `${selectedYear}`
              : selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            }
          </Text>
          <TouchableOpacity onPress={handleNextPeriod} style={styles.chevronBtn}>
            <ChevronRight color="#FFFFFF" size={22} />
          </TouchableOpacity>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Star color="#8E8E93" size={20} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Search color="#8E8E93" size={20} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn}>
            <SlidersHorizontal color="#8E8E93" size={20} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Sub-Tab Selector bar */}
      <View style={styles.subTabRow}>
        {(['Daily', 'Calendar', 'Monthly', 'Total', 'Note'] as const).map(tab => {
          const isActive = activeSubTab === tab;
          return (
            <TouchableOpacity 
              key={tab}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveSubTab(tab);
              }}
              style={[styles.subTabItem, isActive && styles.subTabItemActive]}
            >
              <Text style={[styles.subTabText, isActive && styles.subTabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Summary totals row precisely matching screenshot columns */}
      <View style={styles.totalsSummaryRow}>
        <View style={styles.totalsColumn}>
          <Text style={styles.totalsLabel}>Income</Text>
          <Text style={[styles.totalsValue, styles.blueText]}>
            {totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </View>
        <View style={styles.totalsColumn}>
          <Text style={styles.totalsLabel}>Expenses</Text>
          <Text style={[styles.totalsValue, styles.redText]}>
            {totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </View>
        <View style={styles.totalsColumn}>
          <Text style={styles.totalsLabel}>Total</Text>
          <Text style={[styles.totalsValue, styles.whiteText]}>
            {totalNet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </View>
      </View>

      {/* Sub-tab Page content dynamically switched */}
      {activeSubTab === 'Daily' && (
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
              
              const dayIncome = dayTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
              const dayExpense = dayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

              return (
                <View key={dayKey} style={styles.dayGroup}>
                  <View style={styles.dayHeader}>
                    <View style={styles.dayHeaderDate}>
                      <Text style={styles.dayNum}>{dayDate.getDate()}</Text>
                      <View style={[styles.dayNameBadge, { backgroundColor: getDayBadgeStyle(dayDate).bg }]}>
                        <Text style={[styles.dayNameText, { color: getDayBadgeStyle(dayDate).color }]}>
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

                  {dayTxs.map(tx => (
                    <View key={tx.id} style={styles.txRow}>
                      <TouchableOpacity 
                        style={styles.txRowClickable} 
                        activeOpacity={0.7}
                        onPress={() => handleEditTransaction(tx)}
                      >
                        <View style={styles.txCategoryContainer}>
                          <Text style={styles.txCategoryText}>
                            {getCategoryEmoji(tx.category)} {tx.category}
                          </Text>
                        </View>

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

                        <View style={styles.txRightAmountContainer}>
                          <Text style={[styles.txAmountText, tx.type === 'income' ? styles.incomeText : styles.expenseText]}>
                            ${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Text>
                        </View>
                      </TouchableOpacity>

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
                  ))}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {activeSubTab === 'Calendar' && (
        <View style={styles.calendarSubViewContainer}>
          {/* Days of the Week labels */}
          <View style={styles.weekLabelsRow}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
              <Text 
                key={day} 
                style={[
                  styles.weekLabel, 
                  idx === 0 && styles.sundayLabel, 
                  idx === 6 && styles.saturdayLabel
                ]}
              >
                {day}
              </Text>
            ))}
          </View>

          {/* Calendar Grid Container */}
          <ScrollView contentContainerStyle={styles.gridContainer}>
            {calendarRows.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.gridRow}>
                {row.map((dayNum, cellIndex) => {
                  if (dayNum === null) {
                    return <View key={cellIndex} style={styles.gridCellEmpty} />;
                  }

                  const { income, expense, net } = getDailyStatsForCalendar(dayNum);
                  const isToday = 
                    dayNum === new Date().getDate() && 
                    month === new Date().getMonth() && 
                    year === new Date().getFullYear();

                  return (
                    <View 
                      key={cellIndex} 
                      style={[
                        styles.gridCell,
                        isToday && styles.todayCell
                      ]}
                    >
                      <Text 
                        style={[
                          styles.dayNumber,
                          cellIndex === 0 && styles.sundayText,
                          cellIndex === 6 && styles.saturdayText,
                          isToday && styles.todayText
                        ]}
                      >
                        {dayNum}
                      </Text>

                      {income > 0 && (
                        <Text numberOfLines={1} style={styles.cellIncome}>
                          +${Math.round(income)}
                        </Text>
                      )}

                      {expense > 0 && (
                        <Text numberOfLines={1} style={styles.cellExpense}>
                          -${Math.round(expense)}
                        </Text>
                      )}

                      {(income > 0 || expense > 0) && (
                        <Text numberOfLines={1} style={styles.cellNet}>
                          {net >= 0 ? '+' : ''}${Math.round(net)}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {activeSubTab === 'Monthly' && (
        <ScrollView contentContainerStyle={styles.listContent}>
          {monthNames.map((name, index) => {
            const { income, expense, net } = getMonthStats(index);
            const isExpanded = expandedMonth === index;
            const weeklyBreakdown = isExpanded ? getWeeklyStatsForMonth(index) : [];

            if (index > new Date().getMonth() && income === 0 && expense === 0) {
              return null;
            }

            return (
              <View key={name} style={styles.monthGroup}>
                <TouchableOpacity 
                  activeOpacity={0.85}
                  style={[styles.monthHeader, isExpanded && styles.monthHeaderExpanded]} 
                  onPress={() => setExpandedMonth(isExpanded ? null : index)}
                >
                  <View>
                    <Text style={styles.monthNameText}>{name}</Text>
                    <Text style={styles.monthDateRangeText}>{`${index + 1}.1 ~ ${index + 1}.${new Date(selectedYear, index + 1, 0).getDate()}`}</Text>
                  </View>

                  <View style={styles.monthFigures}>
                    <Text style={[styles.figureText, styles.incomeText]}>
                      ${income.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                    <Text style={[styles.figureText, styles.expenseText]}>
                      ${expense.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                    <Text style={styles.netText}>
                      ${net.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.weekContainer}>
                    {weeklyBreakdown.map((week, idx) => (
                      <View 
                        key={idx} 
                        style={[
                          styles.weekRow,
                          week.isActive && styles.weekRowActive
                        ]}
                      >
                        <Text style={styles.weekRange}>{week.rangeStr}</Text>
                        <View style={styles.weekFigures}>
                          <Text style={[styles.weekFigureVal, styles.incomeText]}>
                            ${week.income.toLocaleString()}
                          </Text>
                          <Text style={[styles.weekFigureVal, styles.expenseText]}>
                            ${week.expense.toLocaleString()}
                          </Text>
                          <Text style={styles.weekNetVal}>
                            ${week.net.toLocaleString()}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {activeSubTab === 'Total' && (
        <ScrollView contentContainerStyle={styles.listContent}>
          {getCategoryTotalsList().length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No category breakdowns logged for this period.</Text>
            </View>
          ) : (
            getCategoryTotalsList().map(item => (
              <View key={item.name} style={styles.categoryTotalsCard}>
                <View style={styles.categoryTotalsMeta}>
                  <Text style={styles.categoryTotalsTitle}>
                    {getCategoryEmoji(item.name)} {item.name}
                  </Text>
                  <Text style={[styles.categoryTotalsAmount, item.net >= 0 ? styles.incomeText : styles.expenseText]}>
                    ${item.net.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.categoryTotalsProgressContainer}>
                  <View style={styles.categoryTotalsProgressLabelRow}>
                    <Text style={styles.categoryTotalsProgressText}>
                      In: <Text style={styles.incomeText}>${item.income.toLocaleString()}</Text>
                    </Text>
                    <Text style={styles.categoryTotalsProgressText}>
                      Out: <Text style={styles.expenseText}>${item.expense.toLocaleString()}</Text>
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {activeSubTab === 'Note' && (
        <ScrollView contentContainerStyle={styles.listContent}>
          {notesTxs.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No annotated transactions logged for this period.</Text>
            </View>
          ) : (
            notesTxs.map(tx => {
              const dayDate = new Date(tx.date);
              return (
                <View key={tx.id} style={styles.txRow}>
                  <TouchableOpacity 
                    style={styles.txRowClickable} 
                    activeOpacity={0.7}
                    onPress={() => handleEditTransaction(tx)}
                  >
                    <View style={styles.txCategoryContainer}>
                      <Text style={styles.txCategoryText}>
                        {getCategoryEmoji(tx.category)} {tx.category}
                      </Text>
                      <Text style={styles.noteDateTag}>
                        {`${dayDate.getMonth() + 1}.${dayDate.getDate()}`}
                      </Text>
                    </View>

                    <View style={styles.txMiddleContainer}>
                      <View>
                        <Text style={styles.txNoteText}>{tx.note}</Text>
                        <Text style={styles.txAccountBelowNote}>{tx.account}</Text>
                      </View>
                      {tx.bill_path && (
                        <Text style={styles.attachmentLabel}>📎 Bill Attached</Text>
                      )}
                    </View>

                    <View style={styles.txRightAmountContainer}>
                      <Text style={[styles.txAmountText, tx.type === 'income' ? styles.incomeText : styles.expenseText]}>
                        ${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </Text>
                    </View>
                  </TouchableOpacity>

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
              );
            })
          )}
        </ScrollView>
      )}

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
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            
            {/* Modal Title bar */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingTransactionId ? 'Edit Transaction' : 'Add Transaction'}</Text>
              <TouchableOpacity onPress={handleCloseModal}>
                <Text style={styles.cancelLink}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalFormContent}>
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

              {/* Transaction Date Picker Selector */}
              <View style={styles.formItem}>
                <Text style={styles.formLabel}>Date</Text>
                <TouchableOpacity 
                  style={styles.dropdownTrigger}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowDatePicker(!showDatePicker);
                  }}
                >
                  <Text style={styles.dropdownText}>
                    📅 {txDate.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                  </Text>
                </TouchableOpacity>

                {showDatePicker && (
                  <View style={styles.datePickerContainer}>
                    {/* Picker Month/Year Switcher Header */}
                    <View style={styles.pickerHeader}>
                      <TouchableOpacity 
                        onPress={() => handlePickerMonthChange('prev')}
                        style={styles.pickerChevronBtn}
                      >
                        <ChevronLeft color="#FFFFFF" size={18} />
                      </TouchableOpacity>
                      <Text style={styles.pickerMonthText}>{pickerMonthName}</Text>
                      <TouchableOpacity 
                        onPress={() => handlePickerMonthChange('next')}
                        style={styles.pickerChevronBtn}
                      >
                        <ChevronRight color="#FFFFFF" size={18} />
                      </TouchableOpacity>
                    </View>

                    {/* Picker Weekday Labels */}
                    <View style={styles.pickerWeekLabelsRow}>
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, idx) => (
                        <Text key={idx} style={[styles.pickerWeekLabel, idx === 0 && styles.pickerSundayLabel, idx === 6 && styles.pickerSaturdayLabel]}>
                          {d}
                        </Text>
                      ))}
                    </View>

                    {/* Picker Grid Cells */}
                    <View style={styles.pickerGridContainer}>
                      {pickerRows.map((row, rowIndex) => (
                        <View key={rowIndex} style={styles.pickerGridRow}>
                          {row.map((dayNum, cellIndex) => {
                            if (dayNum === null) {
                              return <View key={cellIndex} style={styles.pickerGridCellEmpty} />;
                            }

                            const isSelected = 
                              txDate.getDate() === dayNum &&
                              txDate.getMonth() === pickerMonthIdx &&
                              txDate.getFullYear() === pickerYear;

                            return (
                              <TouchableOpacity
                                key={cellIndex}
                                style={[
                                  styles.pickerGridCell,
                                  isSelected && styles.pickerGridCellSelected
                                ]}
                                onPress={() => {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  setTxDate(new Date(pickerYear, pickerMonthIdx, dayNum));
                                  setShowDatePicker(false);
                                }}
                              >
                                <Text style={[
                                  styles.pickerDayNumber,
                                  isSelected && styles.pickerDayNumberSelected,
                                  cellIndex === 0 && !isSelected && styles.pickerSundayText,
                                  cellIndex === 6 && !isSelected && styles.pickerSaturdayText,
                                ]}>
                                  {dayNum}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ))}
                    </View>
                  </View>
                )}
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
  topPeriodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 12,
  },
  periodSelector: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chevronBtn: {
    padding: 6,
  },
  periodText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginHorizontal: 12,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconBtn: {
    padding: 6,
    marginLeft: 10,
  },
  subTabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1.5,
    borderBottomColor: '#2C2C2E',
    marginBottom: 14,
  },
  subTabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  subTabItemActive: {
    borderBottomWidth: 3,
    borderBottomColor: '#FF453A',
  },
  subTabText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '600',
  },
  subTabTextActive: {
    color: '#FFFFFF',
  },
  totalsSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  totalsColumn: {
    flex: 1,
    alignItems: 'center',
  },
  totalsLabel: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  totalsValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  blueText: {
    color: '#0A84FF',
  },
  redText: {
    color: '#FF453A',
  },
  whiteText: {
    color: '#FFFFFF',
  },

  // Calendar Sub-View styles
  calendarSubViewContainer: {
    flex: 1,
  },
  weekLabelsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
    paddingBottom: 8,
    marginBottom: 4,
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#8E8E93',
  },
  sundayLabel: {
    color: '#FF453A',
  },
  saturdayLabel: {
    color: '#0A84FF',
  },
  gridContainer: {
    paddingHorizontal: 6,
    paddingBottom: 24,
  },
  gridRow: {
    flexDirection: 'row',
    height: (SCREEN_WIDTH - 12) / 7 + 18,
  },
  gridCell: {
    flex: 1,
    borderColor: '#1D1D20',
    borderWidth: 0.5,
    padding: 4,
    justifyContent: 'space-between',
    margin: 1,
    backgroundColor: '#161618',
    borderRadius: 4,
  },
  gridCellEmpty: {
    flex: 1,
    margin: 1,
  },
  todayCell: {
    borderColor: '#FFFFFF',
    borderWidth: 1.5,
  },
  dayNumber: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  sundayText: {
    color: '#FF453A',
  },
  saturdayText: {
    color: '#0A84FF',
  },
  todayText: {
    fontWeight: '800',
  },
  cellIncome: {
    color: '#0A84FF',
    fontSize: 8,
    fontWeight: '600',
    textAlign: 'right',
  },
  cellExpense: {
    color: '#FF453A',
    fontSize: 8,
    fontWeight: '600',
    textAlign: 'right',
  },
  cellNet: {
    color: '#8E8E93',
    fontSize: 8,
    fontWeight: '700',
    textAlign: 'right',
  },

  // Monthly View extra styles
  monthGroup: {
    marginBottom: 12,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  monthHeaderExpanded: {
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  monthNameText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  monthDateRangeText: {
    fontSize: 10,
    color: '#8E8E93',
    marginTop: 2,
  },
  monthFigures: {
    alignItems: 'flex-end',
  },
  figureText: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  netText: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '700',
  },
  weekContainer: {
    backgroundColor: '#121214',
    paddingVertical: 4,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1C1C1E',
  },
  weekRowActive: {
    backgroundColor: '#3A2022',
  },
  weekRange: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  weekFigures: {
    alignItems: 'flex-end',
  },
  weekFigureVal: {
    fontSize: 11,
    fontWeight: '500',
  },
  weekNetVal: {
    fontSize: 10,
    color: '#8E8E93',
    fontWeight: '700',
  },

  // Category Totals view styles
  categoryTotalsCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  categoryTotalsMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryTotalsTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  categoryTotalsAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  categoryTotalsProgressContainer: {
    marginTop: 4,
  },
  categoryTotalsProgressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  categoryTotalsProgressText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '500',
  },

  // Note tab styles
  noteDateTag: {
    color: '#8E8E93',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 4,
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

  // Date picker custom styles
  datePickerContainer: {
    backgroundColor: '#121214',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  pickerChevronBtn: {
    padding: 4,
  },
  pickerMonthText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  pickerWeekLabelsRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#2C2C2E',
    paddingBottom: 6,
    marginBottom: 6,
  },
  pickerWeekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '600',
    color: '#8E8E93',
  },
  pickerSundayLabel: {
    color: '#FF453A',
  },
  pickerSaturdayLabel: {
    color: '#0A84FF',
  },
  pickerGridContainer: {
    paddingBottom: 4,
  },
  pickerGridRow: {
    flexDirection: 'row',
    height: 32,
    alignItems: 'center',
  },
  pickerGridCell: {
    flex: 1,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
    margin: 1,
  },
  pickerGridCellSelected: {
    backgroundColor: '#FF453A',
  },
  pickerGridCellEmpty: {
    flex: 1,
    margin: 1,
  },
  pickerDayNumber: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  pickerDayNumberSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  pickerSundayText: {
    color: '#FF453A',
  },
  pickerSaturdayText: {
    color: '#0A84FF',
  },

  // Clickable ledger row edit trigger styles
  txRowClickable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  txRightAmountContainer: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 4,
  },
});
