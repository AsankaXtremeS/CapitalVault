import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useLocalStore } from '@/hooks/useLocalStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function CalendarView() {
  const { transactions } = useLocalStore();
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const handleMonthChange = (direction: 'next' | 'prev') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newMonth = new Date(selectedMonth);
    newMonth.setMonth(selectedMonth.getMonth() + (direction === 'next' ? 1 : -1));
    setSelectedMonth(newMonth);
  };

  // Get days in the selected month
  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday, 1 = Monday ...
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Create an array representing the calendar cells
  const cells: (number | null)[] = [];
  
  // Fill initial padding empty cells
  for (let i = 0; i < firstDayIndex; i++) {
    cells.push(null);
  }

  // Fill actual month days
  for (let day = 1; day <= totalDays; day++) {
    cells.push(day);
  }

  // Group cells into standard 7-day rows
  const rows: (number | null)[][] = [];
  let currentRow: (number | null)[] = [];
  
  cells.forEach((cell, idx) => {
    currentRow.push(cell);
    if (currentRow.length === 7 || idx === cells.length - 1) {
      // Pad end of last row if incomplete
      while (currentRow.length < 7) {
        currentRow.push(null);
      }
      rows.push(currentRow);
      currentRow = [];
    }
  });

  // Calculate Month Totals
  const monthTxs = transactions.filter(tx => {
    const d = new Date(tx.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  const totalIncome = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpenses = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalNet = totalIncome - totalExpenses;

  // Function to evaluate daily figures
  const getDailyStats = (dayNum: number) => {
    const dayTxs = monthTxs.filter(tx => new Date(tx.date).getDate() === dayNum);
    const income = dayTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = dayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const net = income - expense;

    return { income, expense, net };
  };

  return (
    <View style={styles.container}>
      {/* Header Month Selector */}
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
        <SlidersHorizontal color="#FFFFFF" size={20} />
      </View>

      {/* Summary Row */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Income</Text>
          <Text style={[styles.summaryVal, styles.incomeText]}>
            ${totalIncome.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Expenses</Text>
          <Text style={[styles.summaryVal, styles.expenseText]}>
            ${totalExpenses.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Net</Text>
          <Text style={[styles.summaryVal, totalNet >= 0 ? styles.incomeText : styles.expenseText]}>
            ${totalNet.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </Text>
        </View>
      </View>

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
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.gridRow}>
            {row.map((dayNum, cellIndex) => {
              if (dayNum === null) {
                return <View key={cellIndex} style={styles.gridCellEmpty} />;
              }

              const { income, expense, net } = getDailyStats(dayNum);
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
                  {/* Day Number */}
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

                  {/* Daily Income in blue */}
                  {income > 0 && (
                    <Text numberOfLines={1} style={styles.cellIncome}>
                      +{income.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </Text>
                  )}

                  {/* Daily Expense in red */}
                  {expense > 0 && (
                    <Text numberOfLines={1} style={styles.cellExpense}>
                      -{expense.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </Text>
                  )}

                  {/* Daily Net Balance */}
                  {(income > 0 || expense > 0) && (
                    <Text numberOfLines={1} style={styles.cellNet}>
                      {net >= 0 ? '+' : ''}{net.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121214', // Deep Charcoal
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
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
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
    color: '#FF453A', // Sunday red highlight
  },
  saturdayLabel: {
    color: '#0A84FF', // Saturday blue highlight
  },
  gridContainer: {
    paddingHorizontal: 2,
    paddingBottom: 24,
  },
  gridRow: {
    flexDirection: 'row',
    height: (SCREEN_WIDTH - 4) / 7 + 15, // Maintain square cell proportions with expansion padding
  },
  gridCell: {
    flex: 1,
    borderColor: '#1C1C1E',
    borderWidth: 0.5,
    padding: 4,
    justifyContent: 'space-between',
  },
  gridCellEmpty: {
    flex: 1,
  },
  todayCell: {
    backgroundColor: '#1C1C1E', // Highlight cell border
    borderColor: '#FFFFFF',
    borderWidth: 1.5,
    borderRadius: 6,
  },
  dayNumber: {
    color: '#FFFFFF',
    fontSize: 12,
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
});
