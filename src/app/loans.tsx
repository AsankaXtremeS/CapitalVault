import { useMemo } from 'react';
import { getThemedStyles } from '@/utils/themeHelper';
import { useLocalStore } from "@/hooks/useLocalStore";
import AnimatedScreenWrapper from "@/components/AnimatedScreenWrapper";
import {
  calculateEMI,
  generateAmortizationSchedule,
} from "@/utils/amortizationEngine";
import * as Haptics from "expo-haptics";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  Percent,
  Plus,
  Trash2,
} from "lucide-react-native";
import { useState } from "react";
import {
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function LoansLedger() {
  const {loans, addLoan, deleteLoan, currencySymbol, theme} = useLocalStore();
  const isDark = theme === 'dark';
  const styles = useMemo(() => getThemedStyles(staticStyles, isDark), [isDark]);


  const [modalVisible, setModalVisible] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);

  // Form States
  const [loanName, setLoanName] = useState("");
  const [entryType, setEntryType] = useState<"income" | "expense">("expense");
  const [principal, setPrincipal] = useState("");
  const [annualRate, setAnnualRate] = useState("");
  const [tenure, setTenure] = useState("");
  const [startDate, setStartDate] = useState("");
  const [remindersEnabled, setRemindersEnabled] = useState(true);

  // Totals calculations
  const totalPrincipal = loans.reduce((sum, l) => sum + l.principal, 0);
  const totalMonthlyIncome = loans.reduce(
    (sum, l) => sum + (l.entry_type === "income" ? l.monthly_emi : 0),
    0,
  );
  const totalMonthlyExpense = loans.reduce(
    (sum, l) => sum + (l.entry_type === "expense" ? l.monthly_emi : 0),
    0,
  );
  const netMonthlyCashflow = totalMonthlyIncome - totalMonthlyExpense;

  const handleSaveLoan = () => {
    const numPrincipal = parseFloat(principal);
    const numRate = parseFloat(annualRate);
    const numTenure = parseInt(tenure, 10);

    if (!loanName.trim()) {
      Alert.alert(
        "Missing Field",
        "Please enter a loan, deposit or investment description.",
      );
      return;
    }
    if (isNaN(numPrincipal) || numPrincipal <= 0) {
      Alert.alert("Invalid Principal", "Please enter a valid loan amount.");
      return;
    }
    if (isNaN(numRate) || numRate < 0) {
      Alert.alert("Invalid Rate", "Please enter a valid interest rate.");
      return;
    }
    if (isNaN(numTenure) || numTenure <= 0) {
      Alert.alert("Invalid Tenure", "Please enter a valid tenure in months.");
      return;
    }

    const calculatedEMI = calculateEMI(numPrincipal, numRate, numTenure);

    addLoan({
      id: `loan-${Date.now()}`,
      name: loanName.trim(),
      entry_type: entryType,
      principal: numPrincipal,
      annual_rate: numRate,
      tenure_months: numTenure,
      start_date: startDate ? new Date(startDate).getTime() : Date.now(),
      monthly_emi: calculatedEMI,
      reminders_enabled: remindersEnabled ? 1 : 0,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Reset
    setLoanName("");
    setPrincipal("");
    setAnnualRate("");
    setTenure("");
    setStartDate("");
    setRemindersEnabled(true);
    setModalVisible(false);
  };

  const handleToggleDetails = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (selectedLoanId === id) {
      setSelectedLoanId(null);
    } else {
      setSelectedLoanId(id);
    }
  };

  return (
    <AnimatedScreenWrapper>
      <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>Loans & Investments</Text>
        <Text style={styles.screenSubtitle}>
          Track borrowing, fixed deposits, and interest-bearing plans.
        </Text>
      </View>
      {/* Header Cards */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Amount Tracked</Text>
          <Text style={styles.summaryVal}>
            {currencySymbol} {totalPrincipal.toLocaleString("en-US", {
              minimumFractionDigits: 2,
            })}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Monthly Cashflow</Text>
          <Text
            style={[
              styles.summaryVal,
              netMonthlyCashflow >= 0 ? styles.incomeText : styles.debtText,
            ]}
          >
            {netMonthlyCashflow >= 0 ? `+ ${currencySymbol} ` : `- ${currencySymbol} `}
            {Math.abs(netMonthlyCashflow).toLocaleString("en-US", {
              minimumFractionDigits: 2,
            })}
          </Text>
        </View>
      </View>
      {/* Scrollable list of Loans */}
      <ScrollView contentContainerStyle={styles.listContent}>
        {loans.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Percent color="#8E8E93" size={48} style={styles.emptyIcon} />
            <Text style={styles.emptyText}>
              No Active Loans, Deposits, or Investment plans logged.
            </Text>
            <Text style={styles.emptySubText}>
              Tap the "+" to log loans, fixed deposits, or interest-bearing
              installments.
            </Text>
          </View>
        ) : (
          loans.map((loan) => {
            const isSelected = selectedLoanId === loan.id;

            // Amortization Schedule evaluation
            const summary = generateAmortizationSchedule(
              loan.principal,
              loan.annual_rate,
              loan.tenure_months,
              new Date(loan.start_date),
            );

            return (
              <View key={loan.id} style={styles.loanCard}>
                {/* Collapsible header summary */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.cardHeader}
                  onPress={() => handleToggleDetails(loan.id)}
                >
                  <View style={styles.cardHeaderLeft}>
                    <Percent color="#AF52DE" size={20} />
                    <View style={styles.cardMeta}>
                      <Text style={styles.loanName}>{loan.name}</Text>
                      <View style={styles.typeBadgeRow}>
                        <Text
                          style={[
                            styles.typeBadge,
                            loan.entry_type === "income"
                              ? styles.typeBadgeIncome
                              : styles.typeBadgeExpense,
                          ]}
                        >
                          {loan.entry_type === "income" ? "Income" : "Expense"}
                        </Text>
                      </View>
                      <Text style={styles.loanMetaSub}>
                        {loan.tenure_months} months @{" "}
                        {loan.annual_rate.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                        % APR
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardHeaderRight}>
                    <Text
                      style={[
                        styles.loanEMI,
                        loan.entry_type === "income"
                          ? styles.incomeText
                          : styles.debtText,
                      ]}
                    >
                      {currencySymbol} {loan.monthly_emi.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                      /mo
                    </Text>
                    {isSelected ? (
                      <ChevronDown color="#8E8E93" size={20} />
                    ) : (
                      <ChevronRight color="#8E8E93" size={20} />
                    )}
                  </View>
                </TouchableOpacity>

                {/* Expanded payment schedule details */}
                {isSelected && (
                  <View style={styles.cardBody}>
                    {/* Basic Loan metrics stats */}
                    <View style={styles.scheduleMetaRow}>
                      <View style={styles.schedStat}>
                        <Text style={styles.schedStatLabel}>Principal</Text>
                        <Text style={styles.schedStatVal}>
                          {currencySymbol} {loan.principal.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </Text>
                      </View>
                      <View style={styles.schedStat}>
                        <Text style={styles.schedStatLabel}>
                          Total Interest Paid
                        </Text>
                        <Text
                          style={[styles.schedStatVal, styles.interestText]}
                        >
                          {currencySymbol} {summary.totalInterest.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </Text>
                      </View>
                      <View style={styles.schedStat}>
                        <Text style={styles.schedStatLabel}>
                          Total Repayments
                        </Text>
                        <Text style={styles.schedStatVal}>
                          {currencySymbol} {summary.totalRepayment.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </Text>
                      </View>
                    </View>

                    {/* Schedule Header */}
                    <Text style={styles.scheduleTitle}>
                      Amortization Repayment Table
                    </Text>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.tableCol, styles.colIndex]}>
                        Month
                      </Text>
                      <Text style={[styles.tableCol, styles.colVal]}>
                        Principal
                      </Text>
                      <Text style={[styles.tableCol, styles.colVal]}>
                        Interest
                      </Text>
                      <Text style={[styles.tableCol, styles.colBalance]}>
                        Balance
                      </Text>
                    </View>

                    {/* Scrollable Table Rows */}
                    <View style={styles.tableBody}>
                      {summary.schedule.map((row, idx) => {
                        // Display first few months and last month to keep view highly readable
                        if (idx > 3 && idx < loan.tenure_months - 2) {
                          if (idx === 4) {
                            return (
                              <View key="dots" style={styles.tableRowDots}>
                                <Text style={styles.dotsText}>
                                  ••••• Remaining Tenure Schedule •••••
                                </Text>
                              </View>
                            );
                          }
                          return null;
                        }

                        return (
                          <View key={row.monthIndex} style={styles.tableRow}>
                            <Text
                              style={[
                                styles.tableCol,
                                styles.colIndex,
                                styles.rowIdxText,
                              ]}
                            >
                              {row.paymentDate}
                            </Text>
                            <Text
                              style={[
                                styles.tableCol,
                                styles.colVal,
                                styles.rowPrincipalText,
                              ]}
                            >
                              {currencySymbol} {row.principalPaid.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </Text>
                            <Text
                              style={[
                                styles.tableCol,
                                styles.colVal,
                                styles.rowInterestText,
                              ]}
                            >
                              {currencySymbol} {row.interestPaid.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </Text>
                            <Text
                              style={[
                                styles.tableCol,
                                styles.colBalance,
                                styles.rowBalanceText,
                              ]}
                            >
                              {currencySymbol} {row.remainingBalance.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </Text>
                          </View>
                        );
                      })}
                    </View>

                    {/* Quick Settings Action Bar */}
                    <View style={styles.actionsBar}>
                      <View style={styles.notificationToggle}>
                        <Bell color="#8E8E93" size={16} />
                        <Text style={styles.notificationLabel}>
                          Bank Payment Alerts
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => {
                          Alert.alert(
                            "Delete Installment Tracker",
                            "Are you sure you want to delete this amortization calculation?",
                            [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Delete",
                                style: "destructive",
                                onPress: () => deleteLoan(loan.id),
                              },
                            ],
                          );
                        }}
                      >
                        <Trash2 color="#FF453A" size={16} />
                        <Text style={styles.deleteBtnText}>Delete Entry</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Red FAB for new loans */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setEntryType("expense");
          setModalVisible(true);
        }}
      >
        <Plus color="#FFFFFF" size={32} />
      </TouchableOpacity>

      {/* Add Loan Entry Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Track Loan, Deposit or Investment
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelLink}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalFormContent}>
              <View style={styles.formItem}>
                <Text style={styles.formLabel}>Type</Text>
                <View style={styles.typeToggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.typeToggleButton,
                      entryType === "expense" && styles.typeToggleButtonExpense,
                    ]}
                    onPress={() => setEntryType("expense")}
                  >
                    <Text
                      style={[
                        styles.typeToggleText,
                        entryType === "expense" &&
                          styles.typeToggleTextSelected,
                      ]}
                    >
                      Expense
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.typeToggleButton,
                      entryType === "income" && styles.typeToggleButtonIncome,
                    ]}
                    onPress={() => setEntryType("income")}
                  >
                    <Text
                      style={[
                        styles.typeToggleText,
                        entryType === "income" && styles.typeToggleTextSelected,
                      ]}
                    >
                      Income
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.formItem}>
                <Text style={styles.formLabel}>Entry Name / Description</Text>
                <TextInput
                  placeholder="e.g. Netflix subscription or Fixed Deposit"
                  placeholderTextColor="#8E8E93"
                  style={styles.textInput}
                  value={loanName}
                  onChangeText={setLoanName}
                />
              </View>

              <View style={styles.formItem}>
                <Text style={styles.formLabel}>
                  Principal / Deposit Amount ({currencySymbol})
                </Text>
                <TextInput
                  placeholder="e.g. 18000"
                  placeholderTextColor="#8E8E93"
                  keyboardType="numeric"
                  style={styles.textInput}
                  value={principal}
                  onChangeText={setPrincipal}
                />
              </View>

              <View style={styles.formItem}>
                <Text style={styles.formLabel}>Annual Interest Rate (%)</Text>
                <TextInput
                  placeholder="e.g. 8.5"
                  placeholderTextColor="#8E8E93"
                  keyboardType="numeric"
                  style={styles.textInput}
                  value={annualRate}
                  onChangeText={setAnnualRate}
                />
              </View>

              <View style={styles.formItem}>
                <Text style={styles.formLabel}>Term / Duration (Months)</Text>
                <TextInput
                  placeholder="e.g. 36"
                  placeholderTextColor="#8E8E93"
                  keyboardType="numeric"
                  style={styles.textInput}
                  value={tenure}
                  onChangeText={setTenure}
                />
              </View>

              <View style={styles.formItem}>
                <Text style={styles.formLabel}>
                  First Installment Date (YYYY-MM-DD)
                </Text>
                <TextInput
                  placeholder="e.g. 2026-05-30"
                  placeholderTextColor="#8E8E93"
                  style={styles.textInput}
                  value={startDate}
                  onChangeText={setStartDate}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>
                  Configure Reminders for Payment
                </Text>
                <Switch
                  value={remindersEnabled}
                  onValueChange={setRemindersEnabled}
                  trackColor={{ false: "#2C2C2E", true: "#AF52DE" }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveLoan}>
                <Text style={styles.saveBtnText}>
                  Save Entry & Calculate EMI
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
    </AnimatedScreenWrapper>
  );
}

const staticStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121214",
    paddingTop: 48,
  },
  summaryContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#1C1C1E",
    borderWidth: 1,
    borderColor: "#2C2C2E",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 4,
  },
  summaryLabel: {
    color: "#8E8E93",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  summaryVal: {
    fontSize: 18,
    color: "#FFFFFF",
    fontWeight: "800",
  },
  debtText: {
    color: "#FF453A", // Debt red repayments indicator
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyIcon: {
    marginBottom: 12,
    opacity: 0.6,
  },
  emptyText: {
    color: "#8E8E93",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 6,
  },
  emptySubText: {
    color: "#8E8E93",
    fontSize: 13,
    opacity: 0.7,
  },
  loanCard: {
    backgroundColor: "#1C1C1E",
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2C2C2E",
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  cardMeta: {
    marginLeft: 12,
  },
  loanName: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  loanMetaSub: {
    color: "#8E8E93",
    fontSize: 11,
    marginTop: 2,
  },
  cardHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  loanEMI: {
    fontSize: 16,
    color: "#FF453A",
    fontWeight: "700",
    marginRight: 8,
  },
  headerRow: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  screenTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 4,
  },
  screenSubtitle: {
    color: "#8E8E93",
    fontSize: 13,
  },
  cardBody: {
    padding: 16,
    backgroundColor: "#121214",
    borderTopWidth: 1,
    borderTopColor: "#2C2C2E",
  },
  scheduleMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    padding: 10,
    borderWidth: 0.5,
    borderColor: "#2C2C2E",
  },
  schedStat: {
    flex: 1,
    alignItems: "center",
  },
  schedStatLabel: {
    color: "#8E8E93",
    fontSize: 9,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  schedStatVal: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  interestText: {
    color: "#FF453A",
  },
  scheduleTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#2C2C2E",
    paddingBottom: 6,
    marginBottom: 6,
  },
  tableCol: {
    color: "#8E8E93",
    fontSize: 10,
    fontWeight: "700",
  },
  colIndex: {
    flex: 1.5,
  },
  colVal: {
    flex: 1.2,
    textAlign: "right",
  },
  colBalance: {
    flex: 1.5,
    textAlign: "right",
  },
  tableBody: {
    marginBottom: 16,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#2C2C2E",
  },
  tableRowDots: {
    alignItems: "center",
    paddingVertical: 8,
  },
  dotsText: {
    color: "#8E8E93",
    fontSize: 10,
    fontStyle: "italic",
  },
  rowIdxText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  rowPrincipalText: {
    color: "#0A84FF", // blue principal repayments
    textAlign: "right",
  },
  rowInterestText: {
    color: "#FF453A", // red interest portions
    textAlign: "right",
  },
  rowBalanceText: {
    color: "#8E8E93",
    textAlign: "right",
  },
  actionsBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#2C2C2E",
  },
  notificationToggle: {
    flexDirection: "row",
    alignItems: "center",
  },
  notificationLabel: {
    color: "#8E8E93",
    fontSize: 12,
    marginLeft: 6,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 6,
  },
  deleteBtnText: {
    color: "#FF453A",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 6,
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FF453A",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#FF5E55",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1C1C1E",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    borderWidth: 1,
    borderColor: "#2C2C2E",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2C2C2E",
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  cancelLink: {
    color: "#FF453A",
    fontSize: 15,
  },
  modalFormContent: {
    padding: 20,
    paddingBottom: 40,
  },
  formItem: {
    marginBottom: 18,
  },
  formLabel: {
    color: "#8E8E93",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: "#121214",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    color: "#FFFFFF",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#2C2C2E",
  },
  typeToggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  typeToggleButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2C2C2E",
    alignItems: "center",
    marginRight: 8,
    backgroundColor: "#121214",
  },
  typeToggleButtonIncome: {
    backgroundColor: "#0A84FF",
    borderColor: "#0A84FF",
  },
  typeToggleButtonExpense: {
    backgroundColor: "#FF453A",
    borderColor: "#FF453A",
  },
  typeToggleText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  typeToggleTextSelected: {
    color: "#FFFFFF",
  },
  typeBadgeRow: {
    marginTop: 6,
  },
  typeBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  typeBadgeIncome: {
    color: "#0A84FF",
    backgroundColor: "rgba(10, 132, 255, 0.12)",
  },
  typeBadgeExpense: {
    color: "#FF453A",
    backgroundColor: "rgba(255, 69, 58, 0.12)",
  },
  incomeText: {
    color: "#0A84FF",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  switchLabel: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  saveBtn: {
    backgroundColor: "#FF453A",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
