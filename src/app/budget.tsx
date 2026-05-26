import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  Modal, 
  TextInput, 
  Alert,
  Dimensions
} from 'react-native';
import { 
  ChevronLeft, 
  ChevronRight, 
  Database,
  Bookmark,
  Sparkles,
  Percent,
  HandCoins,
  Wallet
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useLocalStore } from '@/hooks/useLocalStore';
import { generateBudgetReportPDF } from '@/utils/pdfGenerator';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const EXPENSE_CATEGORIES = ['Food', 'Social Life', 'Pets', 'Transport', 'Culture', 'Household', 'Apparel', 'Beauty', 'Health', 'Education', 'Gift', 'Other'];

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
  Other: '📦',
};

export default function BudgetScreen() {
  const { 
    transactions, 
    debts,
    loans,
    categoryBudgets,
    updateCategoryBudget,
    user,
    customCategories
  } = useLocalStore();

  const [selectedMonth, setSelectedMonth] = useState(new Date());

  // Budget Limit Config Modal States
  const [budgetLimitModalVisible, setBudgetLimitModalVisible] = useState(false);
  const [limitCatName, setLimitCatName] = useState('');
  const [limitInputVal, setLimitInputVal] = useState('');

  const getCategoryEmoji = (catName: string) => {
    if (CATEGORY_EMOJIS[catName]) return CATEGORY_EMOJIS[catName];
    const found = customCategories.find(c => c.name === catName);
    return found ? found.emoji : '📦';
  };

  const handleMonthChange = (direction: 'next' | 'prev') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newMonth = new Date(selectedMonth);
    newMonth.setMonth(selectedMonth.getMonth() + (direction === 'next' ? 1 : -1));
    setSelectedMonth(newMonth);
  };

  // 1. Math and Calculations crunched dynamically
  const periodTxs = transactions.filter(tx => {
    const d = new Date(tx.date);
    return d.getMonth() === selectedMonth.getMonth() && d.getFullYear() === selectedMonth.getFullYear();
  });

  const totalIncome = periodTxs
    .filter(tx => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalExpenses = periodTxs
    .filter(tx => tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const emiSum = loans.reduce((sum, loan) => sum + loan.monthly_emi, 0);
  
  const borrowingSum = debts
    .filter(d => d.type === 'borrowing')
    .reduce((sum, debt) => sum + (debt.principal - debt.payment_progress), 0);

  const lendingSum = debts
    .filter(d => d.type === 'lending')
    .reduce((sum, debt) => sum + (debt.principal - debt.payment_progress), 0);

  const activeDebts = debts.filter(d => (d.principal - d.payment_progress) > 0);

  const discretionaryCushion = totalIncome - totalExpenses - emiSum - borrowingSum;

  const formatPercent = (pct: number) => {
    return `${Math.round(pct)}%`;
  };

  const handleSetLimitModal = (catName: string, currentLimit: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLimitCatName(catName);
    setLimitInputVal(currentLimit > 0 ? currentLimit.toString() : '');
    setBudgetLimitModalVisible(true);
  };

  const handleSaveBudgetLimit = async () => {
    const numericLimit = parseFloat(limitInputVal);
    if (isNaN(numericLimit) || numericLimit < 0) {
      Alert.alert('Invalid Limit', 'Please enter a valid numeric value.');
      return;
    }
    await updateCategoryBudget(limitCatName, numericLimit);
    setBudgetLimitModalVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDownloadPDF = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await generateBudgetReportPDF({
        monthName: selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        userEmail: user?.email || 'Offline Vault User',
        totalIncome,
        totalExpenses,
        totalEmi: emiSum,
        totalBorrowed: borrowingSum,
        totalLent: lendingSum,
        netDiscretionary: discretionaryCushion,
        transactions: periodTxs,
        categoryBudgets,
        customCategories,
        debts,
        loans,
      });
    } catch (e: any) {
      Alert.alert('Export Error', e.message || 'Failed to export PDF.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Period Header Row switcher */}
      <View style={styles.topPeriodHeader}>
        <View style={styles.periodSelector}>
          <TouchableOpacity onPress={() => handleMonthChange('prev')} style={styles.chevronBtn}>
            <ChevronLeft color="#FFFFFF" size={20} />
          </TouchableOpacity>
          <Text style={styles.periodText}>
            {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Text>
          <TouchableOpacity onPress={() => handleMonthChange('next')} style={styles.chevronBtn}>
            <ChevronRight color="#FFFFFF" size={20} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.listContent}>
        {/* Executive Cash Flow Summary Card */}
        <Text style={styles.sectionTitle}>Discretionary Projection</Text>
        <View style={styles.budgetDashboardCard}>
          <View style={styles.budgetHeaderRow}>
            <View>
              <Text style={styles.budgetValueSubLabel}>Discretionary Cash Cushion</Text>
              <Text style={[styles.budgetValueAmt, discretionaryCushion >= 0 ? styles.greenText : styles.redText]}>
                {discretionaryCushion >= 0 ? '+' : ''}${discretionaryCushion.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.pdfDownloadBtn}
              onPress={handleDownloadPDF}
            >
              <Database color="#FFFFFF" size={14} style={{ marginRight: 6 }} />
              <Text style={styles.pdfDownloadBtnText}>PDF Report</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.budgetSummaryGrid}>
            <View style={styles.budgetGridItem}>
              <Text style={styles.budgetGridLabel}>Net Income</Text>
              <Text style={[styles.budgetGridValue, styles.blueText]}>+${totalIncome.toLocaleString()}</Text>
            </View>
            <View style={styles.budgetGridItem}>
              <Text style={styles.budgetGridLabel}>Expenses</Text>
              <Text style={[styles.budgetGridValue, styles.redText]}>-${totalExpenses.toLocaleString()}</Text>
            </View>
            <View style={styles.budgetGridItem}>
              <Text style={styles.budgetGridLabel}>Active EMIs</Text>
              <Text style={[styles.budgetGridValue, styles.redText]}>-${emiSum.toLocaleString()}</Text>
            </View>
            <View style={styles.budgetGridItem}>
              <Text style={styles.budgetGridLabel}>Debts Payable</Text>
              <Text style={[styles.budgetGridValue, styles.redText]}>-${borrowingSum.toLocaleString()}</Text>
            </View>
            <View style={styles.budgetGridItem}>
              <Text style={styles.budgetGridLabel}>Debts Receivable</Text>
              <Text style={[styles.budgetGridValue, styles.greenText]}>+${lendingSum.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {/* Budget Limits & Settings */}
        <View style={styles.budgetSectionHeader}>
          <Text style={styles.sectionTitle}>Monthly Limits & Burn Rates</Text>
        </View>

        {EXPENSE_CATEGORIES.map(cat => {
          const limit = categoryBudgets[cat] || 0;
          const spent = periodTxs
            .filter(t => t.category === cat && t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);

          const remaining = limit - spent;
          const pct = limit > 0 ? (spent / limit) * 100 : 0;
          const progressColor = pct >= 100 ? '#FF453A' : pct >= 75 ? '#FF9500' : '#30D158';

          return (
            <View key={cat} style={styles.budgetLimitCard}>
              <View style={styles.budgetCategoryMetaRow}>
                <View>
                  <Text style={styles.budgetCategoryTitle}>
                    {getCategoryEmoji(cat)} {cat}
                  </Text>
                  {limit > 0 ? (
                    <Text style={styles.budgetCategoryStatusSubtitle}>
                      {pct >= 100 
                        ? '❌ OVER BUDGET' 
                        : pct >= 75 
                          ? '⚠️ WARN: High Burn Rate' 
                          : `✅ ${formatPercent(pct)} utilized`}
                    </Text>
                  ) : (
                    <Text style={styles.budgetCategoryStatusSubtitle}>No spending limit set</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.setLimitBtn}
                  onPress={() => handleSetLimitModal(cat, limit)}
                >
                  <Text style={styles.setLimitBtnText}>{limit > 0 ? `$${limit}` : 'Set Limit'}</Text>
                </TouchableOpacity>
              </View>

              {limit > 0 && (
                <View style={{ marginTop: 10 }}>
                  <View style={styles.budgetLimitTextRow}>
                    <Text style={styles.budgetSpentText}>Spent: ${spent.toLocaleString()}</Text>
                    <Text style={[styles.budgetRemainingText, remaining >= 0 ? styles.greenText : styles.redText]}>
                      {remaining >= 0 ? 'Left' : 'Over'}: ${Math.abs(remaining).toLocaleString()}
                    </Text>
                  </View>
                  {/* Glassmorphic progress bar container */}
                  <View style={styles.progressBarBg}>
                    <View 
                      style={[
                        styles.progressBarFill, 
                        { 
                          width: `${Math.min(pct, 100)}%`, 
                          backgroundColor: progressColor 
                        }
                      ]} 
                    />
                  </View>
                </View>
              )}
            </View>
          );
        })}

        {/* Active Debt / Liabilities Overview */}
        <Text style={styles.sectionTitle}>Outstanding Receivables & Debts</Text>
        {activeDebts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No active debts logged.</Text>
          </View>
        ) : (
          activeDebts.map(debt => {
            const outstanding = debt.principal - debt.payment_progress;
            return (
              <View key={debt.id} style={styles.budgetDebtCard}>
                <View style={styles.budgetCategoryMetaRow}>
                  <Text style={styles.budgetDebtName}>
                    {debt.type === 'lending' ? '🤝 Lent to' : '💸 Borrowed from'} {debt.contact_name}
                  </Text>
                  <Text style={[styles.budgetDebtBadge, debt.type === 'lending' ? styles.badgeLending : styles.badgeBorrowing]}>
                    {debt.type === 'lending' ? 'Receivable' : 'Liability'}
                  </Text>
                </View>
                <View style={[styles.budgetSummaryGrid, { marginTop: 10, borderTopWidth: 0, paddingBottom: 0 }]}>
                  <View style={styles.budgetGridItem}>
                    <Text style={styles.budgetGridLabel}>Principal</Text>
                    <Text style={[styles.budgetGridValue, styles.whiteText]}>${debt.principal.toLocaleString()}</Text>
                  </View>
                  <View style={styles.budgetGridItem}>
                    <Text style={styles.budgetGridLabel}>Repaid</Text>
                    <Text style={[styles.budgetGridValue, styles.greenText]}>${debt.payment_progress.toLocaleString()}</Text>
                  </View>
                  <View style={styles.budgetGridItem}>
                    <Text style={styles.budgetGridLabel}>Outstanding</Text>
                    <Text style={[styles.budgetGridValue, styles.redText]}>${outstanding.toLocaleString()}</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}

        {/* Active Fixed Loans overview */}
        <Text style={styles.sectionTitle}>Fixed Loan Amortizations</Text>
        {loans.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No loans or fixed installment plans registered.</Text>
          </View>
        ) : (
          loans.map(loan => (
            <View key={loan.id} style={styles.budgetLoanCard}>
              <View style={styles.budgetCategoryMetaRow}>
                <Text style={styles.budgetLoanTitle}>🏦 {loan.name}</Text>
                <Text style={styles.budgetLoanEmiLabel}>${loan.monthly_emi}/mo</Text>
              </View>
              <View style={[styles.budgetSummaryGrid, { marginTop: 10, borderTopWidth: 0, paddingBottom: 0 }]}>
                <View style={styles.budgetGridItem}>
                  <Text style={styles.budgetGridLabel}>Principal</Text>
                  <Text style={[styles.budgetGridValue, styles.whiteText]}>${loan.principal.toLocaleString()}</Text>
                </View>
                <View style={styles.budgetGridItem}>
                  <Text style={styles.budgetGridLabel}>Interest (APR)</Text>
                  <Text style={[styles.budgetGridValue, styles.orangeText]}>{loan.annual_rate}%</Text>
                </View>
                <View style={styles.budgetGridItem}>
                  <Text style={styles.budgetGridLabel}>Tenure</Text>
                  <Text style={[styles.budgetGridValue, styles.blueText]}>{loan.tenure_months} Mo.</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Set Category Budget Limit Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={budgetLimitModalVisible}
        onRequestClose={() => setBudgetLimitModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set {limitCatName} Target</Text>
            
            <View style={styles.formItem}>
              <Text style={styles.formLabel}>Monthly Limit Amount ($)</Text>
              <TextInput
                keyboardType="numeric"
                placeholder="e.g. 500 (Enter 0 to clear)"
                placeholderTextColor="#8E8E93"
                style={styles.textInput}
                value={limitInputVal}
                onChangeText={setLimitInputVal}
                autoFocus={true}
              />
            </View>

            <View style={styles.btnRow}>
              <TouchableOpacity 
                style={styles.cancelBtn}
                onPress={() => {
                  setBudgetLimitModalVisible(false);
                  setLimitInputVal('');
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.saveBtn}
                onPress={handleSaveBudgetLimit}
              >
                <Text style={styles.saveBtnText}>Save</Text>
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
    backgroundColor: '#121214', // obsidian canvas background
    paddingTop: 48,
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
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginHorizontal: 4,
    marginTop: 16,
    marginBottom: 10,
  },
  budgetDashboardCard: {
    backgroundColor: '#1C1C1E',
    borderColor: '#2C2C2E',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  budgetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  budgetValueSubLabel: {
    color: '#8E8E93',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  budgetValueAmt: {
    fontSize: 24,
    fontWeight: '800',
  },
  pdfDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A84FF',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  pdfDownloadBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  budgetSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: 0.5,
    borderTopColor: '#2C2C2E',
    paddingTop: 12,
  },
  budgetGridItem: {
    width: '50%',
    marginBottom: 10,
  },
  budgetGridLabel: {
    color: '#8E8E93',
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  budgetGridValue: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  budgetSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetLimitCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    padding: 14,
    marginBottom: 10,
  },
  budgetCategoryMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetCategoryTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  budgetCategoryStatusSubtitle: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: 2,
  },
  setLimitBtn: {
    backgroundColor: '#2C2C2E',
    borderWidth: 1,
    borderColor: '#3A3A3C',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  setLimitBtnText: {
    color: '#0A84FF',
    fontSize: 12,
    fontWeight: '600',
  },
  budgetLimitTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  budgetSpentText: {
    color: '#8E8E93',
    fontSize: 11,
  },
  budgetRemainingText: {
    fontSize: 11,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#2C2C2E',
    borderRadius: 3,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  budgetDebtCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    padding: 14,
    marginBottom: 10,
  },
  budgetDebtName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  budgetDebtBadge: {
    fontSize: 10,
    fontWeight: '700',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    overflow: 'hidden',
  },
  badgeLending: {
    backgroundColor: '#E8F8EE',
    color: '#34C759',
  },
  badgeBorrowing: {
    backgroundColor: '#FFEBEB',
    color: '#FF453A',
  },
  budgetLoanCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    padding: 14,
    marginBottom: 10,
  },
  budgetLoanTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  budgetLoanEmiLabel: {
    color: '#FF453A',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 24,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '500',
  },
  blueText: { color: '#0A84FF' },
  redText: { color: '#FF453A' },
  greenText: { color: '#30D158' },
  whiteText: { color: '#FFFFFF' },
  orangeText: { color: '#FF9500' },

  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
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
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  formItem: {
    marginBottom: 16,
  },
  formLabel: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#121214',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: '#FFFFFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 8,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#2C2C2E',
  },
  cancelBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 8,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#0A84FF',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
