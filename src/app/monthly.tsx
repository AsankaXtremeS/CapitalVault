import React, { useMemo,  useState } from 'react';
import { getThemedStyles } from '@/utils/themeHelper';;
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useLocalStore, Transaction } from '@/hooks/useLocalStore';

export default function MonthlyView() {
  const {transactions, currencySymbol, theme} = useLocalStore();
  const isDark = theme === 'dark';
  const styles = useMemo(() => getThemedStyles(staticStyles, isDark), [isDark]);

  const [selectedYear, setSelectedYear] = useState(2026);
  const [expandedMonth, setExpandedMonth] = useState<number | null>(new Date().getMonth()); // Default active month expanded

  const handleYearChange = (direction: 'next' | 'prev') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedYear((prev) => prev + (direction === 'next' ? 1 : -1));
  };

  const toggleMonth = (monthIndex: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (expandedMonth === monthIndex) {
      setExpandedMonth(null);
    } else {
      setExpandedMonth(monthIndex);
    }
  };

  // Filter transactions for the selected year
  const yearTxs = transactions.filter((tx) => {
    const date = new Date(tx.date);
    return date.getFullYear() === selectedYear;
  });

  const totalYearIncome = yearTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalYearExpenses = yearTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalYearNet = totalYearIncome - totalYearExpenses;

  // Months lists
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Utility to calculate weekly breakdown
  const getWeeklyStatsForMonth = (monthIndex: number) => {
    const monthTxs = yearTxs.filter(tx => new Date(tx.date).getMonth() === monthIndex);
    
    // Split month into standard weeks (7 days slots starting from day 1)
    const weeks: Array<{
      rangeStr: string;
      income: number;
      expense: number;
      net: number;
      isActive: boolean;
    }> = [];

    // Let's create 4 or 5 standard weekly ranges for the selected month
    const totalDays = new Date(selectedYear, monthIndex + 1, 0).getDate();
    const weekIntervals = [
      { start: 1, end: 7 },
      { start: 8, end: 14 },
      { start: 15, end: 21 },
      { start: 22, end: 28 },
      { start: 29, end: totalDays }
    ].filter(w => w.start <= totalDays);

    weekIntervals.reverse().forEach((week) => {
      const weekTxs = monthTxs.filter(tx => {
        const day = new Date(tx.date).getDate();
        return day >= week.start && day <= week.end;
      });

      const income = weekTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = weekTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const net = income - expense;

      // Format month strings e.g. "05.24 ~ 05.30"
      const formatNum = (num: number) => num.toString().padStart(2, '0');
      const monthPrefix = formatNum(monthIndex + 1);
      
      const rangeStr = `${monthPrefix}.${formatNum(week.start)} ~ ${monthPrefix}.${formatNum(week.end)}`;
      
      // Mark current calendar week as active
      const today = new Date();
      const isActive = 
        today.getFullYear() === selectedYear && 
        today.getMonth() === monthIndex && 
        today.getDate() >= week.start && 
        today.getDate() <= week.end;

      weeks.push({
        rangeStr,
        income,
        expense,
        net,
        isActive
      });
    });

    return weeks;
  };

  const getMonthStats = (monthIndex: number) => {
    const monthTxs = yearTxs.filter(tx => new Date(tx.date).getMonth() === monthIndex);
    const income = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const net = income - expense;

    return { income, expense, net };
  };

  return (
    <View style={styles.container}>
      {/* Year Selection Header */}
      <View style={styles.header}>
        <View style={styles.yearSelector}>
          <TouchableOpacity onPress={() => handleYearChange('prev')}>
            <ChevronLeft color="#8E8E93" size={24} />
          </TouchableOpacity>
          <Text style={styles.yearText}>{selectedYear}</Text>
          <TouchableOpacity onPress={() => handleYearChange('next')}>
            <ChevronRight color="#8E8E93" size={24} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Year Summary Header Row */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Income</Text>
          <Text style={[styles.summaryVal, styles.incomeText]}>
            {currencySymbol} {totalYearIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Expenses</Text>
          <Text style={[styles.summaryVal, styles.expenseText]}>
            {currencySymbol} {totalYearExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Net</Text>
          <Text style={[styles.summaryVal, totalYearNet >= 0 ? styles.incomeText : styles.expenseText]}>
            {currencySymbol} {totalYearNet.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </Text>
        </View>
      </View>

      {/* Scrollable Month List */}
      <ScrollView contentContainerStyle={styles.listContent}>
        {monthNames.map((name, index) => {
          const { income, expense, net } = getMonthStats(index);
          const isExpanded = expandedMonth === index;
          const weeklyBreakdown = isExpanded ? getWeeklyStatsForMonth(index) : [];

          // Skip future months in mock seeds unless they have transactions
          if (index > new Date().getMonth() && income === 0 && expense === 0) {
            return null;
          }

          return (
            <View key={name} style={styles.monthGroup}>
              {/* Month summary row */}
              <TouchableOpacity 
                activeOpacity={0.85}
                style={[styles.monthHeader, isExpanded && styles.monthHeaderExpanded]} 
                onPress={() => toggleMonth(index)}
              >
                <View>
                  <Text style={styles.monthNameText}>{name}</Text>
                  <Text style={styles.monthDateRangeText}>{`${index + 1}.1 ~ ${index + 1}.${new Date(selectedYear, index + 1, 0).getDate()}`}</Text>
                </View>

                <View style={styles.monthFigures}>
                  <Text style={[styles.figureText, styles.incomeText]}>
                    {currencySymbol} {income.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </Text>
                  <Text style={[styles.figureText, styles.expenseText]}>
                    {currencySymbol} {expense.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </Text>
                  <Text style={styles.netText}>
                    {currencySymbol} {net.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Collapsible Weekly Drill down */}
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
                          {currencySymbol} {week.income.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </Text>
                        <Text style={[styles.weekFigureVal, styles.expenseText]}>
                          {currencySymbol} {week.expense.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </Text>
                        <Text style={styles.weekNetVal}>
                          {currencySymbol} {week.net.toLocaleString(undefined, { maximumFractionDigits: 0 })}
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
    </View>
  );
}

const staticStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121214', // Deep Charcoal
    paddingTop: 48,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  yearText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginHorizontal: 16,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#1C1C1E',
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
    color: '#0A84FF',
  },
  expenseText: {
    color: '#FF453A',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  monthGroup: {
    marginBottom: 10,
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
    backgroundColor: '#3A2022', // Muted reddish-brown active indicator matching original screens
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
});
