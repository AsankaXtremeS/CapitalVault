import AnimatedScreenWrapper from "@/components/AnimatedScreenWrapper";
import WhatsAppReminder from "@/components/WhatsAppReminder";
import { Debt, useLocalStore } from "@/hooks/useLocalStore";
import { getThemedStyles } from "@/utils/themeHelper";
import * as Haptics from "expo-haptics";
import {
    CheckCircle,
    Clock,
    HandCoins,
    Plus,
    Trash2,
    TrendingUp,
    User,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import {
    Alert,
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function DebtsLedger() {
  const { debts, addDebt, updateDebt, deleteDebt, currencySymbol, theme } =
    useLocalStore();
  const isDark = theme === "dark";
  const styles = useMemo(() => getThemedStyles(staticStyles, isDark), [isDark]);

  const [activeTab, setActiveTab] = useState<"lending" | "borrowing">(
    "lending",
  );
  const [modalVisible, setModalVisible] = useState(false);

  // Form States
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [principal, setPrincipal] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [interestRate, setInterestRate] = useState("0");
  const [note, setNote] = useState("");

  // Settlement Form Modal State
  const [settlementModalVisible, setSettlementModalVisible] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [repayAmount, setRepayAmount] = useState("");

  // Filter debts based on sub-tab
  const activeDebts = debts.filter((d) => d.type === activeTab);

  // Totals calculations
  const totalPrincipal = activeDebts.reduce((sum, d) => sum + d.principal, 0);
  const totalRepaid = activeDebts.reduce(
    (sum, d) => sum + d.payment_progress,
    0,
  );
  const totalOutstanding = totalPrincipal - totalRepaid;

  const handleSaveDebt = () => {
    const numPrincipal = parseFloat(principal);
    if (!contactName.trim()) {
      Alert.alert("Missing Field", "Please enter a contact name.");
      return;
    }
    if (isNaN(numPrincipal) || numPrincipal <= 0) {
      Alert.alert(
        "Invalid Principal",
        "Please enter a valid lending or borrowing amount.",
      );
      return;
    }

    addDebt({
      id: `debt-${Date.now()}`,
      type: activeTab,
      contact_name: contactName.trim(),
      contact_phone: contactPhone.trim() || undefined,
      principal: numPrincipal,
      due_date: dueDate ? new Date(dueDate).getTime() : undefined,
      interest_rate: parseFloat(interestRate) || 0,
      payment_progress: 0,
      note: note.trim() || undefined,
    });

    // Reset
    setContactName("");
    setContactPhone("");
    setPrincipal("");
    setDueDate("");
    setInterestRate("0");
    setNote("");
    setModalVisible(false);
  };

  const handleLogRepayment = () => {
    if (!selectedDebt) return;
    const numRepay = parseFloat(repayAmount);

    if (isNaN(numRepay) || numRepay <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid repayment amount.");
      return;
    }

    const remaining = selectedDebt.principal - selectedDebt.payment_progress;
    if (numRepay > remaining) {
      Alert.alert(
        "Exceeds Balance",
        `Maximum allowed repayment is ${currencySymbol}${remaining.toFixed(2)}`,
      );
      return;
    }

    const updatedProgress = selectedDebt.payment_progress + numRepay;

    updateDebt({
      ...selectedDebt,
      payment_progress: Number(updatedProgress.toFixed(2)),
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setRepayAmount("");
    setSettlementModalVisible(false);
    setSelectedDebt(null);
  };

  return (
    <AnimatedScreenWrapper>
      <View style={styles.container}>
        {/* Tab Row (Lending vs Borrowing) */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.tab,
              activeTab === "lending" && styles.tabLendingActive,
            ]}
            onPress={() => setActiveTab("lending")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "lending" && styles.tabLendingTextActive,
              ]}
            >
              Lendings
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.tab,
              activeTab === "borrowing" && styles.tabBorrowingActive,
            ]}
            onPress={() => setActiveTab("borrowing")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "borrowing" && styles.tabBorrowingTextActive,
              ]}
            >
              Borrowings
            </Text>
          </TouchableOpacity>
        </View>

        {/* Totals Summary */}
        <View style={styles.totalsContainer}>
          <View style={styles.totalsCard}>
            <Text style={styles.totalsLabel}>
              {activeTab === "lending" ? "Total Receivables" : "Total Payables"}
            </Text>
            <Text
              style={[
                styles.totalsVal,
                activeTab === "lending"
                  ? styles.lendingText
                  : styles.borrowingText,
              ]}
            >
              {currencySymbol}{" "}
              {totalOutstanding.toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}
            </Text>
          </View>
        </View>

        {/* Debts List */}
        <ScrollView contentContainerStyle={styles.listContent}>
          {activeDebts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <HandCoins color="#8E8E93" size={48} style={styles.emptyIcon} />
              <Text style={styles.emptyText}>
                No active entries locked here.
              </Text>
              <Text style={styles.emptySubText}>
                Tap the "+" to log lendings or borrowings.
              </Text>
            </View>
          ) : (
            activeDebts.map((debt) => {
              const outstanding = debt.principal - debt.payment_progress;
              const progressPercent =
                debt.principal > 0
                  ? (debt.payment_progress / debt.principal) * 100
                  : 0;
              const isSettled = outstanding <= 0;

              return (
                <View key={debt.id} style={styles.debtCard}>
                  {/* Header Meta Row */}
                  <View style={styles.debtHeader}>
                    <View style={styles.debtHeaderLeft}>
                      <View style={styles.profileCircle}>
                        <User color="#FFFFFF" size={16} />
                      </View>
                      <View>
                        <Text style={styles.contactName}>
                          {debt.contact_name}
                        </Text>
                        {debt.contact_phone && (
                          <Text style={styles.contactPhone}>
                            📱 {debt.contact_phone}
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.debtHeaderRight}>
                      <Text
                        style={[
                          styles.outstandingAmount,
                          activeTab === "lending"
                            ? styles.lendingText
                            : styles.borrowingText,
                        ]}
                      >
                        {currencySymbol}{" "}
                        {outstanding.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </Text>
                      <Text style={styles.outstandingLabel}>outstanding</Text>
                    </View>
                  </View>

                  {/* Progress Details Row */}
                  <View style={styles.progressSection}>
                    <View style={styles.progressLabels}>
                      <Text style={styles.progressText}>
                        Repaid: {currencySymbol} {debt.payment_progress} of{" "}
                        {currencySymbol} {debt.principal}
                      </Text>
                      <Text style={styles.progressPercent}>
                        {Math.round(progressPercent)}%
                      </Text>
                    </View>
                    <View style={styles.progressBarBg}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${progressPercent}%`,
                            backgroundColor:
                              activeTab === "lending" ? "#0A84FF" : "#FF453A",
                          },
                        ]}
                      />
                    </View>
                  </View>

                  {/* Interest Rate & Due Dates */}
                  <View style={styles.metaRow}>
                    <View style={styles.metaCol}>
                      <Clock color="#8E8E93" size={14} />
                      <Text style={styles.metaText}>
                        {debt.due_date
                          ? `Due: ${new Date(debt.due_date).toLocaleDateString()}`
                          : "No due date"}
                      </Text>
                    </View>
                    {debt.interest_rate > 0 && (
                      <View style={styles.metaCol}>
                        <TrendingUp color="#30D158" size={14} />
                        <Text style={styles.metaText}>
                          {debt.interest_rate}% monthly rate
                        </Text>
                      </View>
                    )}
                  </View>

                  {debt.note ? (
                    <View style={styles.noteSection}>
                      <Text style={styles.noteLabel}>Money Lend Note</Text>
                      <Text style={styles.noteText}>{debt.note}</Text>
                    </View>
                  ) : null}

                  {/* Actions Bottom Bar */}
                  <View style={styles.cardActions}>
                    {!isSettled && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={styles.repayBtn}
                        onPress={() => {
                          setSelectedDebt(debt);
                          setSettlementModalVisible(true);
                        }}
                      >
                        <CheckCircle color="#FFFFFF" size={14} />
                        <Text style={styles.repayBtnText}>Log Repayment</Text>
                      </TouchableOpacity>
                    )}

                    {/* WhatsApp Reminder hook */}
                    {!isSettled && (
                      <WhatsAppReminder
                        contactName={debt.contact_name}
                        contactPhone={debt.contact_phone}
                        amount={outstanding}
                        type={debt.type}
                      />
                    )}

                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => {
                        Alert.alert(
                          "Delete Debt Record",
                          "Remove this ledger entry permanently?",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Delete",
                              style: "destructive",
                              onPress: () => deleteDebt(debt.id),
                            },
                          ],
                        );
                      }}
                    >
                      <Trash2 color="#8E8E93" size={15} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Red FAB for new debts */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setModalVisible(true);
          }}
        >
          <Plus color="#FFFFFF" size={32} />
        </TouchableOpacity>

        {/* Add Debt Entry Modal */}
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
                  {activeTab === "lending"
                    ? "Log Money Lent"
                    : "Log Money Borrowed"}
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Text style={styles.cancelLink}>Cancel</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.modalFormContent}>
                <View style={styles.formItem}>
                  <Text style={styles.formLabel}>Contact Name</Text>
                  <TextInput
                    placeholder="e.g. John Doe"
                    placeholderTextColor="#8E8E93"
                    style={styles.textInput}
                    value={contactName}
                    onChangeText={setContactName}
                  />
                </View>

                <View style={styles.formItem}>
                  <Text style={styles.formLabel}>WhatsApp Phone Number</Text>
                  <TextInput
                    placeholder="e.g. +94771234567"
                    placeholderTextColor="#8E8E93"
                    keyboardType="phone-pad"
                    style={styles.textInput}
                    value={contactPhone}
                    onChangeText={setContactPhone}
                  />
                </View>

                <View style={styles.formItem}>
                  <Text style={styles.formLabel}>Money Lend Note</Text>
                  <TextInput
                    placeholder="e.g. Loan for laptop repair"
                    placeholderTextColor="#8E8E93"
                    style={[styles.textInput, styles.multilineInput]}
                    value={note}
                    onChangeText={setNote}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <View style={styles.formItem}>
                  <Text style={styles.formLabel}>
                    Principal Amount ({currencySymbol})
                  </Text>
                  <TextInput
                    placeholder="Amount lent/borrowed"
                    placeholderTextColor="#8E8E93"
                    keyboardType="numeric"
                    style={styles.textInput}
                    value={principal}
                    onChangeText={setPrincipal}
                  />
                </View>

                <View style={styles.formItem}>
                  <Text style={styles.formLabel}>
                    Monthly Interest Rate (%)
                  </Text>
                  <TextInput
                    placeholder="Interest rate (optional)"
                    placeholderTextColor="#8E8E93"
                    keyboardType="numeric"
                    style={styles.textInput}
                    value={interestRate}
                    onChangeText={setInterestRate}
                  />
                </View>

                <View style={styles.formItem}>
                  <Text style={styles.formLabel}>Due Date (YYYY-MM-DD)</Text>
                  <TextInput
                    placeholder="e.g. 2026-08-30"
                    placeholderTextColor="#8E8E93"
                    style={styles.textInput}
                    value={dueDate}
                    onChangeText={setDueDate}
                  />
                </View>

                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleSaveDebt}
                >
                  <Text style={styles.saveBtnText}>Save Debt Record</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Log Repayment / Settlement Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={settlementModalVisible}
          onRequestClose={() => setSettlementModalVisible(false)}
        >
          <View style={styles.modalBackdropCenter}>
            <View style={styles.settlementBox}>
              <Text style={styles.settlementTitle}>Log Repayment</Text>
              <Text style={styles.settlementSub}>
                Register repayment received from {selectedDebt?.contact_name}
              </Text>

              <TextInput
                placeholder={`Repayment amount (${currencySymbol})`}
                placeholderTextColor="#8E8E93"
                keyboardType="numeric"
                style={styles.settleInput}
                value={repayAmount}
                onChangeText={setRepayAmount}
              />

              <View style={styles.settleActions}>
                <TouchableOpacity
                  style={styles.settleCancel}
                  onPress={() => setSettlementModalVisible(false)}
                >
                  <Text style={styles.settleCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.settleConfirm}
                  onPress={handleLogRepayment}
                >
                  <Text style={styles.settleConfirmText}>Confirm Repay</Text>
                </TouchableOpacity>
              </View>
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
  tabRow: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: "#2C2C2E",
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
  },
  tabLendingActive: {
    borderBottomWidth: 3,
    borderBottomColor: "#0A84FF", // Lending blue indicator
  },
  tabBorrowingActive: {
    borderBottomWidth: 3,
    borderBottomColor: "#FF453A", // Borrowing red indicator
  },
  tabText: {
    fontSize: 15,
    color: "#8E8E93",
    fontWeight: "700",
  },
  tabLendingTextActive: {
    color: "#0A84FF",
  },
  tabBorrowingTextActive: {
    color: "#FF453A",
  },
  totalsContainer: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  totalsCard: {
    backgroundColor: "#1C1C1E",
    borderWidth: 1,
    borderColor: "#2C2C2E",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  totalsLabel: {
    color: "#8E8E93",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  totalsVal: {
    fontSize: 26,
    fontWeight: "800",
  },
  lendingText: {
    color: "#0A84FF",
  },
  borrowingText: {
    color: "#FF453A",
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
  debtCard: {
    backgroundColor: "#1C1C1E",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2C2C2E",
  },
  debtHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  debtHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#2C2C2E",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  contactName: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  contactPhone: {
    color: "#8E8E93",
    fontSize: 11,
    marginTop: 2,
  },
  debtHeaderRight: {
    alignItems: "flex-end",
  },
  outstandingAmount: {
    fontSize: 18,
    fontWeight: "800",
  },
  outstandingLabel: {
    color: "#8E8E93",
    fontSize: 10,
    marginTop: 2,
  },
  progressSection: {
    marginBottom: 16,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  progressText: {
    color: "#8E8E93",
    fontSize: 11,
  },
  progressPercent: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  progressBarBg: {
    height: 6,
    backgroundColor: "#121214",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 16,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: "#2C2C2E",
  },
  metaCol: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 20,
  },
  metaText: {
    color: "#8E8E93",
    fontSize: 12,
    marginLeft: 6,
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  repayBtn: {
    backgroundColor: "#30D158", // Green repay success accent
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  repayBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 6,
  },
  deleteBtn: {
    padding: 8,
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#0A84FF", // Electric blue FAB
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#3FA1FF",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalBackdropCenter: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
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
  multilineInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  noteSection: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#161619",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2C2C2E",
  },
  noteLabel: {
    color: "#8E8E93",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  noteText: {
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 18,
  },
  saveBtn: {
    backgroundColor: "#0A84FF",
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
  settlementBox: {
    width: SCREEN_WIDTH * 0.85,
    backgroundColor: "#1C1C1E",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: "#2C2C2E",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  settlementTitle: {
    fontSize: 18,
    color: "#FFFFFF",
    fontWeight: "700",
    marginBottom: 6,
  },
  settlementSub: {
    fontSize: 13,
    color: "#8E8E93",
    marginBottom: 16,
  },
  settleInput: {
    backgroundColor: "#121214",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    color: "#FFFFFF",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#2C2C2E",
    marginBottom: 20,
  },
  settleActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  settleCancel: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    marginRight: 8,
    borderRadius: 10,
    backgroundColor: "#2C2C2E",
  },
  settleCancelText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  settleConfirm: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    marginLeft: 8,
    borderRadius: 10,
    backgroundColor: "#30D158", // confirm green
  },
  settleConfirmText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
