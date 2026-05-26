import { useLocalStore } from "@/hooks/useLocalStore";
import AnimatedScreenWrapper from "@/components/AnimatedScreenWrapper";
import { generateBudgetReportPDF } from "@/utils/pdfGenerator";
import * as Haptics from "expo-haptics";
import {
    ChevronLeft,
    ChevronRight,
    Database,
    Plus,
    Trash2
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

const EXPENSE_CATEGORIES = [
  "Food",
  "Social Life",
  "Pets",
  "Transport",
  "Culture",
  "Household",
  "Apparel",
  "Beauty",
  "Health",
  "Education",
  "Gift",
  "Other",
];
const INCOME_CATEGORIES = [
  "Salary",
  "Allowance",
  "Bonus",
  "Petty cash",
  "Other",
];
const ACCOUNTS = ["Cash", "Accounts", "Card"];

const CATEGORY_EMOJIS: Record<string, string> = {
  Food: "🍜",
  "Social Life": "🥳",
  Pets: "🐱",
  Transport: "🚖",
  Culture: "🎬",
  Household: "🏠",
  Apparel: "👕",
  Beauty: "💄",
  Health: "💊",
  Education: "📚",
  Gift: "🎁",
  Salary: "💼",
  Allowance: "🪙",
  Bonus: "✨",
  "Petty cash": "💵",
  Other: "📦",
};

export default function BudgetScreen() {
  const {
    transactions,
    debts,
    loans,
    categoryBudgets,
    updateCategoryBudget,
    user,
    customCategories,
    recurringTemplates,
    addRecurringTemplate,
    updateRecurringTemplate,
    deleteRecurringTemplate,
  } = useLocalStore();

  const [selectedMonth, setSelectedMonth] = useState(new Date());

  // Budget Limit Config Modal States
  const [budgetLimitModalVisible, setBudgetLimitModalVisible] = useState(false);
  const [limitCatName, setLimitCatName] = useState("");
  const [limitInputVal, setLimitInputVal] = useState("");

  // Recurring Template Modal States
  const [addTemplateModalVisible, setAddTemplateModalVisible] = useState(false);
  const [tmplType, setTmplType] = useState<"income" | "expense">("expense");
  const [tmplAmount, setTmplAmount] = useState("");
  const [tmplCategory, setTmplCategory] = useState("");
  const [tmplAccount, setTmplAccount] = useState("Cash");
  const [tmplDayOfMonth, setTmplDayOfMonth] = useState("");
  const [tmplNote, setTmplNote] = useState("");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null,
  );
  const isEditingTemplate = editingTemplateId !== null;

  const handleAddRecurringTemplate = async () => {
    const amt = parseFloat(tmplAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount.");
      return;
    }
    const day = parseInt(tmplDayOfMonth, 10);
    if (isNaN(day) || day < 1 || day > 31) {
      Alert.alert("Invalid Day", "Please enter a valid day of month (1-31).");
      return;
    }
    if (!tmplCategory) {
      Alert.alert("Invalid Category", "Please select a category.");
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (isEditingTemplate) {
        const existing = recurringTemplates.find(
          (tmpl) => tmpl.id === editingTemplateId,
        );
        if (!existing) {
          Alert.alert("Error", "Recurring template not found.");
          return;
        }
        await updateRecurringTemplate({
          ...existing,
          type: tmplType,
          amount: amt,
          category: tmplCategory,
          account: tmplAccount,
          note: tmplNote.trim(),
          day_of_month: day,
          is_active: existing.is_active,
        });
      } else {
        await addRecurringTemplate({
          id: `tmpl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: tmplType,
          amount: amt,
          category: tmplCategory,
          account: tmplAccount,
          note: tmplNote.trim(),
          day_of_month: day,
          is_active: 1,
        });
      }

      // Reset form & close modal
      setAddTemplateModalVisible(false);
      setEditingTemplateId(null);
      setTmplAmount("");
      setTmplCategory("");
      setTmplAccount("Cash");
      setTmplDayOfMonth("");
      setTmplNote("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save recurring template.");
    }
  };

  const getCategoryEmoji = (catName: string) => {
    if (CATEGORY_EMOJIS[catName]) return CATEGORY_EMOJIS[catName];
    const found = customCategories.find((c) => c.name === catName);
    return found ? found.emoji : "📦";
  };

  const handleMonthChange = (direction: "next" | "prev") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newMonth = new Date(selectedMonth);
    newMonth.setMonth(
      selectedMonth.getMonth() + (direction === "next" ? 1 : -1),
    );
    setSelectedMonth(newMonth);
  };

  // 1. Math and Calculations crunched dynamically
  const periodTxs = transactions.filter((tx) => {
    const d = new Date(tx.date);
    return (
      d.getMonth() === selectedMonth.getMonth() &&
      d.getFullYear() === selectedMonth.getFullYear()
    );
  });

  const totalIncome = periodTxs
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalExpenses = periodTxs
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const emiSum = loans.reduce((sum, loan) => sum + loan.monthly_emi, 0);

  const borrowingSum = debts
    .filter((d) => d.type === "borrowing")
    .reduce((sum, debt) => sum + (debt.principal - debt.payment_progress), 0);

  const lendingSum = debts
    .filter((d) => d.type === "lending")
    .reduce((sum, debt) => sum + (debt.principal - debt.payment_progress), 0);

  const activeDebts = debts.filter((d) => d.principal - d.payment_progress > 0);

  const discretionaryCushion =
    totalIncome - totalExpenses - emiSum - borrowingSum;

  const formatPercent = (pct: number) => {
    return `${Math.round(pct)}%`;
  };

  const handleSetLimitModal = (catName: string, currentLimit: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLimitCatName(catName);
    setLimitInputVal(currentLimit > 0 ? currentLimit.toString() : "");
    setBudgetLimitModalVisible(true);
  };

  const handleSaveBudgetLimit = async () => {
    const numericLimit = parseFloat(limitInputVal);
    if (isNaN(numericLimit) || numericLimit < 0) {
      Alert.alert("Invalid Limit", "Please enter a valid numeric value.");
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
        monthName: selectedMonth.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        }),
        userEmail: user?.email || "Offline Vault User",
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
      Alert.alert("Export Error", e.message || "Failed to export PDF.");
    }
  };

  return (
    <AnimatedScreenWrapper>
      <View style={styles.container}>
      {/* Top Period Header Row switcher */}
      <View style={styles.topPeriodHeader}>
        <View style={styles.periodSelector}>
          <TouchableOpacity
            onPress={() => handleMonthChange("prev")}
            style={styles.chevronBtn}
          >
            <ChevronLeft color="#FFFFFF" size={20} />
          </TouchableOpacity>
          <Text style={styles.periodText}>
            {selectedMonth.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </Text>
          <TouchableOpacity
            onPress={() => handleMonthChange("next")}
            style={styles.chevronBtn}
          >
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
              <Text style={styles.budgetValueSubLabel}>
                Discretionary Cash Cushion
              </Text>
              <Text
                style={[
                  styles.budgetValueAmt,
                  discretionaryCushion >= 0 ? styles.greenText : styles.redText,
                ]}
              >
                {discretionaryCushion >= 0 ? "+" : ""}$
                {discretionaryCushion.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
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
              <Text style={[styles.budgetGridValue, styles.blueText]}>
                +${totalIncome.toLocaleString()}
              </Text>
            </View>
            <View style={styles.budgetGridItem}>
              <Text style={styles.budgetGridLabel}>Expenses</Text>
              <Text style={[styles.budgetGridValue, styles.redText]}>
                -${totalExpenses.toLocaleString()}
              </Text>
            </View>
            <View style={styles.budgetGridItem}>
              <Text style={styles.budgetGridLabel}>Active EMIs</Text>
              <Text style={[styles.budgetGridValue, styles.redText]}>
                -${emiSum.toLocaleString()}
              </Text>
            </View>
            <View style={styles.budgetGridItem}>
              <Text style={styles.budgetGridLabel}>Debts Payable</Text>
              <Text style={[styles.budgetGridValue, styles.redText]}>
                -${borrowingSum.toLocaleString()}
              </Text>
            </View>
            <View style={styles.budgetGridItem}>
              <Text style={styles.budgetGridLabel}>Debts Receivable</Text>
              <Text style={[styles.budgetGridValue, styles.greenText]}>
                +${lendingSum.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Budget Limits & Settings */}
        <View style={styles.budgetSectionHeader}>
          <Text style={styles.sectionTitle}>Monthly Limits & Burn Rates</Text>
        </View>

        {EXPENSE_CATEGORIES.map((cat) => {
          const limit = categoryBudgets[cat] || 0;
          const spent = periodTxs
            .filter((t) => t.category === cat && t.type === "expense")
            .reduce((sum, t) => sum + t.amount, 0);

          const remaining = limit - spent;
          const pct = limit > 0 ? (spent / limit) * 100 : 0;
          const progressColor =
            pct >= 100 ? "#FF453A" : pct >= 75 ? "#FF9500" : "#30D158";

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
                        ? "❌ OVER BUDGET"
                        : pct >= 75
                          ? "⚠️ WARN: High Burn Rate"
                          : `✅ ${formatPercent(pct)} utilized`}
                    </Text>
                  ) : (
                    <Text style={styles.budgetCategoryStatusSubtitle}>
                      No spending limit set
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.setLimitBtn}
                  onPress={() => handleSetLimitModal(cat, limit)}
                >
                  <Text style={styles.setLimitBtnText}>
                    {limit > 0 ? `$${limit}` : "Set Limit"}
                  </Text>
                </TouchableOpacity>
              </View>

              {limit > 0 && (
                <View style={{ marginTop: 10 }}>
                  <View style={styles.budgetLimitTextRow}>
                    <Text style={styles.budgetSpentText}>
                      Spent: ${spent.toLocaleString()}
                    </Text>
                    <Text
                      style={[
                        styles.budgetRemainingText,
                        remaining >= 0 ? styles.greenText : styles.redText,
                      ]}
                    >
                      {remaining >= 0 ? "Left" : "Over"}: $
                      {Math.abs(remaining).toLocaleString()}
                    </Text>
                  </View>
                  {/* Glassmorphic progress bar container */}
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min(pct, 100)}%`,
                          backgroundColor: progressColor,
                        },
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
          activeDebts.map((debt) => {
            const outstanding = debt.principal - debt.payment_progress;
            return (
              <View key={debt.id} style={styles.budgetDebtCard}>
                <View style={styles.budgetCategoryMetaRow}>
                  <Text style={styles.budgetDebtName}>
                    {debt.type === "lending"
                      ? "🤝 Lent to"
                      : "💸 Borrowed from"}{" "}
                    {debt.contact_name}
                  </Text>
                  <Text
                    style={[
                      styles.budgetDebtBadge,
                      debt.type === "lending"
                        ? styles.badgeLending
                        : styles.badgeBorrowing,
                    ]}
                  >
                    {debt.type === "lending" ? "Receivable" : "Liability"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.budgetSummaryGrid,
                    { marginTop: 10, borderTopWidth: 0, paddingBottom: 0 },
                  ]}
                >
                  <View style={styles.budgetGridItem}>
                    <Text style={styles.budgetGridLabel}>Principal</Text>
                    <Text style={[styles.budgetGridValue, styles.whiteText]}>
                      ${debt.principal.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.budgetGridItem}>
                    <Text style={styles.budgetGridLabel}>Repaid</Text>
                    <Text style={[styles.budgetGridValue, styles.greenText]}>
                      ${debt.payment_progress.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.budgetGridItem}>
                    <Text style={styles.budgetGridLabel}>Outstanding</Text>
                    <Text style={[styles.budgetGridValue, styles.redText]}>
                      ${outstanding.toLocaleString()}
                    </Text>
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
            <Text style={styles.emptyText}>
              No loans or fixed installment plans registered.
            </Text>
          </View>
        ) : (
          loans.map((loan) => (
            <View key={loan.id} style={styles.budgetLoanCard}>
              <View style={styles.budgetCategoryMetaRow}>
                <Text style={styles.budgetLoanTitle}>🏦 {loan.name}</Text>
                <Text style={styles.budgetLoanEmiLabel}>
                  ${loan.monthly_emi}/mo
                </Text>
              </View>
              <View
                style={[
                  styles.budgetSummaryGrid,
                  { marginTop: 10, borderTopWidth: 0, paddingBottom: 0 },
                ]}
              >
                <View style={styles.budgetGridItem}>
                  <Text style={styles.budgetGridLabel}>Principal</Text>
                  <Text style={[styles.budgetGridValue, styles.whiteText]}>
                    ${loan.principal.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.budgetGridItem}>
                  <Text style={styles.budgetGridLabel}>Interest (APR)</Text>
                  <Text style={[styles.budgetGridValue, styles.orangeText]}>
                    {loan.annual_rate}%
                  </Text>
                </View>
                <View style={styles.budgetGridItem}>
                  <Text style={styles.budgetGridLabel}>Tenure</Text>
                  <Text style={[styles.budgetGridValue, styles.blueText]}>
                    {loan.tenure_months} Mo.
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}

        {/* Recurring Outlays & Inflows section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recurring Outlays & Inflows</Text>
          <TouchableOpacity
            style={styles.addTemplateBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setEditingTemplateId(null);
              setTmplType("expense");
              setTmplAmount("");
              setTmplCategory("");
              setTmplAccount("Cash");
              setTmplDayOfMonth("");
              setTmplNote("");
              setAddTemplateModalVisible(true);
            }}
          >
            <Plus color="#0A84FF" size={14} style={{ marginRight: 4 }} />
            <Text style={styles.addTemplateBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {recurringTemplates.filter((tmpl) => tmpl.sync_status !== "deleted")
          .length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No recurring bills or scheduled incomes set up.
            </Text>
          </View>
        ) : (
          recurringTemplates
            .filter((tmpl) => tmpl.sync_status !== "deleted")
            .map((tmpl) => {
              const isExpense = tmpl.type === "expense";
              return (
                <View key={tmpl.id} style={styles.recurringTemplateCard}>
                  <View style={styles.templateMainRow}>
                    <View style={styles.templateLeftCol}>
                      <View style={styles.templateEmojiContainer}>
                        <Text style={styles.templateEmoji}>
                          {getCategoryEmoji(tmpl.category)}
                        </Text>
                      </View>
                      <View style={styles.templateMeta}>
                        <Text style={styles.templateNote} numberOfLines={1}>
                          {tmpl.note || tmpl.category}
                        </Text>
                        <Text style={styles.templateSubtitle}>
                          Repeats on Day {tmpl.day_of_month} • {tmpl.category} •{" "}
                          {tmpl.account}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.templateRightCol}>
                      <Text
                        style={[
                          styles.templateAmount,
                          isExpense ? styles.redText : styles.greenText,
                        ]}
                      >
                        {isExpense ? "-" : "+"}$
                        {tmpl.amount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </Text>
                      <View style={styles.templateActionRow}>
                        <TouchableOpacity
                          style={styles.templateEditBtn}
                          onPress={() => {
                            Haptics.impactAsync(
                              Haptics.ImpactFeedbackStyle.Light,
                            );
                            setEditingTemplateId(tmpl.id);
                            setTmplType(tmpl.type);
                            setTmplAmount(tmpl.amount.toString());
                            setTmplCategory(tmpl.category);
                            setTmplAccount(tmpl.account);
                            setTmplDayOfMonth(tmpl.day_of_month.toString());
                            setTmplNote(tmpl.note || "");
                            setAddTemplateModalVisible(true);
                          }}
                        >
                          <Text style={styles.templateEditBtnText}>Edit</Text>
                        </TouchableOpacity>
                        <Switch
                          value={tmpl.is_active === 1}
                          onValueChange={async (newValue) => {
                            Haptics.impactAsync(
                              Haptics.ImpactFeedbackStyle.Light,
                            );
                            await updateRecurringTemplate({
                              ...tmpl,
                              is_active: newValue ? 1 : 0,
                            });
                          }}
                          trackColor={{ false: "#2C2C2E", true: "#30D158" }}
                          thumbColor="#FFFFFF"
                          ios_backgroundColor="#2C2C2E"
                          style={styles.templateSwitch}
                        />
                        <TouchableOpacity
                          style={styles.templateDeleteBtn}
                          onPress={() => {
                            Alert.alert(
                              "Delete Template",
                              "Are you sure you want to remove this recurring template?",
                              [
                                { text: "Cancel", style: "cancel" },
                                {
                                  text: "Delete",
                                  style: "destructive",
                                  onPress: async () => {
                                    Haptics.impactAsync(
                                      Haptics.ImpactFeedbackStyle.Heavy,
                                    );
                                    await deleteRecurringTemplate(tmpl.id);
                                  },
                                },
                              ],
                            );
                          }}
                        >
                          <Trash2 color="#FF453A" size={16} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })
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
                  setLimitInputVal("");
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

      {/* Add Recurring Template Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={addTemplateModalVisible}
        onRequestClose={() => {
          setAddTemplateModalVisible(false);
          setEditingTemplateId(null);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, styles.largeModalContent]}>
            <Text style={styles.modalTitle}>
              {isEditingTemplate
                ? "Edit Recurring Template"
                : "Add Recurring Template"}
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 10 }}
            >
              {/* Type Switch Tab */}
              <View style={styles.typeTabContainer}>
                <TouchableOpacity
                  style={[
                    styles.typeTab,
                    tmplType === "expense"
                      ? styles.typeTabExpenseActive
                      : styles.typeTabInactive,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setTmplType("expense");
                    setTmplCategory("");
                  }}
                >
                  <Text
                    style={[
                      styles.typeTabText,
                      tmplType === "expense"
                        ? styles.whiteText
                        : styles.grayText,
                    ]}
                  >
                    Expense
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeTab,
                    tmplType === "income"
                      ? styles.typeTabIncomeActive
                      : styles.typeTabInactive,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setTmplType("income");
                    setTmplCategory("");
                  }}
                >
                  <Text
                    style={[
                      styles.typeTabText,
                      tmplType === "income"
                        ? styles.whiteText
                        : styles.grayText,
                    ]}
                  >
                    Income
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Amount Field */}
              <View style={styles.formItem}>
                <Text style={styles.formLabel}>Amount ($)</Text>
                <TextInput
                  keyboardType="numeric"
                  placeholder="e.g. 99.99"
                  placeholderTextColor="#8E8E93"
                  style={styles.textInput}
                  value={tmplAmount}
                  onChangeText={setTmplAmount}
                />
              </View>

              {/* Day of Month Field */}
              <View style={styles.formItem}>
                <Text style={styles.formLabel}>Due Day of Month (1 - 31)</Text>
                <TextInput
                  keyboardType="number-pad"
                  placeholder="e.g. 1"
                  placeholderTextColor="#8E8E93"
                  style={styles.textInput}
                  value={tmplDayOfMonth}
                  onChangeText={setTmplDayOfMonth}
                />
              </View>

              {/* Category Selector Grid */}
              <View style={styles.formItem}>
                <Text style={styles.formLabel}>Select Category</Text>
                <View style={styles.categoryChipContainer}>
                  {(tmplType === "expense"
                    ? EXPENSE_CATEGORIES.concat(
                        customCategories
                          .filter((c) => c.type === "expense")
                          .map((c) => c.name),
                      )
                    : INCOME_CATEGORIES.concat(
                        customCategories
                          .filter((c) => c.type === "income")
                          .map((c) => c.name),
                      )
                  ).map((cat) => {
                    const isSelected = tmplCategory === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.categoryChip,
                          isSelected &&
                            (tmplType === "expense"
                              ? styles.categoryChipExpenseSelected
                              : styles.categoryChipIncomeSelected),
                        ]}
                        onPress={() => {
                          Haptics.impactAsync(
                            Haptics.ImpactFeedbackStyle.Light,
                          );
                          setTmplCategory(cat);
                        }}
                      >
                        <Text
                          style={[
                            styles.categoryChipText,
                            isSelected && styles.whiteText,
                          ]}
                        >
                          {getCategoryEmoji(cat)} {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Account Selector Row */}
              <View style={styles.formItem}>
                <Text style={styles.formLabel}>Select Account</Text>
                <View style={styles.accountRow}>
                  {ACCOUNTS.map((acc) => {
                    const isSelected = tmplAccount === acc;
                    return (
                      <TouchableOpacity
                        key={acc}
                        style={[
                          styles.accountChip,
                          isSelected && styles.accountChipSelected,
                        ]}
                        onPress={() => {
                          Haptics.impactAsync(
                            Haptics.ImpactFeedbackStyle.Light,
                          );
                          setTmplAccount(acc);
                        }}
                      >
                        <Text
                          style={[
                            styles.accountChipText,
                            isSelected && styles.whiteText,
                          ]}
                        >
                          {acc}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Remarks/Note Field */}
              <View style={styles.formItem}>
                <Text style={styles.formLabel}>
                  Remarks / Remarks Note (Optional)
                </Text>
                <TextInput
                  placeholder="e.g. Netflix, Rent, Salary Bonus"
                  placeholderTextColor="#8E8E93"
                  style={styles.textInput}
                  value={tmplNote}
                  onChangeText={setTmplNote}
                />
              </View>
            </ScrollView>

            <View style={styles.btnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setAddTemplateModalVisible(false);
                  setEditingTemplateId(null);
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  tmplType === "expense"
                    ? styles.saveBtnExpense
                    : styles.saveBtnIncome,
                ]}
                onPress={handleAddRecurringTemplate}
              >
                <Text style={styles.saveBtnText}>
                  {isEditingTemplate ? "Update" : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
    </AnimatedScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121214", // obsidian canvas background
    paddingTop: 48,
  },
  topPeriodHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 12,
  },
  periodSelector: {
    flexDirection: "row",
    alignItems: "center",
  },
  chevronBtn: {
    padding: 6,
  },
  periodText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    marginHorizontal: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    color: "#8E8E93",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginHorizontal: 4,
    marginTop: 16,
    marginBottom: 10,
  },
  budgetDashboardCard: {
    backgroundColor: "#1C1C1E",
    borderColor: "#2C2C2E",
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  budgetHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  budgetValueSubLabel: {
    color: "#8E8E93",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  budgetValueAmt: {
    fontSize: 24,
    fontWeight: "800",
  },
  pdfDownloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0A84FF",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  pdfDownloadBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  budgetSummaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopWidth: 0.5,
    borderTopColor: "#2C2C2E",
    paddingTop: 12,
  },
  budgetGridItem: {
    width: "50%",
    marginBottom: 10,
  },
  budgetGridLabel: {
    color: "#8E8E93",
    fontSize: 9,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  budgetGridValue: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },
  budgetSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  budgetLimitCard: {
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2C2C2E",
    padding: 14,
    marginBottom: 10,
  },
  budgetCategoryMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  budgetCategoryTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  budgetCategoryStatusSubtitle: {
    color: "#8E8E93",
    fontSize: 11,
    marginTop: 2,
  },
  setLimitBtn: {
    backgroundColor: "#2C2C2E",
    borderWidth: 1,
    borderColor: "#3A3A3C",
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  setLimitBtnText: {
    color: "#0A84FF",
    fontSize: 12,
    fontWeight: "600",
  },
  budgetLimitTextRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  budgetSpentText: {
    color: "#8E8E93",
    fontSize: 11,
  },
  budgetRemainingText: {
    fontSize: 11,
    fontWeight: "600",
  },
  progressBarBg: {
    height: 6,
    backgroundColor: "#2C2C2E",
    borderRadius: 3,
    marginTop: 6,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  budgetDebtCard: {
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2C2C2E",
    padding: 14,
    marginBottom: 10,
  },
  budgetDebtName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  budgetDebtBadge: {
    fontSize: 10,
    fontWeight: "700",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    overflow: "hidden",
  },
  badgeLending: {
    backgroundColor: "#E8F8EE",
    color: "#34C759",
  },
  badgeBorrowing: {
    backgroundColor: "#FFEBEB",
    color: "#FF453A",
  },
  budgetLoanCard: {
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2C2C2E",
    padding: 14,
    marginBottom: 10,
  },
  budgetLoanTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  budgetLoanEmiLabel: {
    color: "#FF453A",
    fontSize: 14,
    fontWeight: "700",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    padding: 24,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#2C2C2E",
  },
  emptyText: {
    color: "#8E8E93",
    fontSize: 13,
    fontWeight: "500",
  },
  blueText: { color: "#0A84FF" },
  redText: { color: "#FF453A" },
  greenText: { color: "#30D158" },
  whiteText: { color: "#FFFFFF" },
  orangeText: { color: "#FF9500" },

  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#1C1C1E",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#2C2C2E",
    padding: 20,
    width: "100%",
    maxWidth: 320,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 12,
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
  },
  formItem: {
    marginBottom: 16,
  },
  formLabel: {
    color: "#8E8E93",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: "#121214",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: "#FFFFFF",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#2C2C2E",
  },
  btnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 8,
    alignItems: "center",
    borderRadius: 10,
    backgroundColor: "#2C2C2E",
  },
  cancelBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 8,
    alignItems: "center",
    borderRadius: 10,
    backgroundColor: "#0A84FF",
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },

  // Recurring items styles
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 10,
  },
  addTemplateBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(10, 132, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(10, 132, 255, 0.3)",
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  addTemplateBtnText: {
    color: "#0A84FF",
    fontSize: 12,
    fontWeight: "700",
  },
  recurringTemplateCard: {
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2C2C2E",
    padding: 14,
    marginBottom: 10,
  },
  templateMainRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  templateLeftCol: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  templateEmojiContainer: {
    width: 38,
    height: 38,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  emojiBgExpense: {
    backgroundColor: "rgba(255, 69, 58, 0.12)",
  },
  emojiBgIncome: {
    backgroundColor: "rgba(48, 209, 88, 0.12)",
  },
  templateEmoji: {
    fontSize: 18,
  },
  templateMeta: {
    flex: 1,
    marginRight: 8,
  },
  templateNote: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  templateSubtitle: {
    color: "#8E8E93",
    fontSize: 11,
    marginTop: 2,
  },
  templateRightCol: {
    alignItems: "flex-end",
  },
  templateAmount: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
  },
  templateActionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  templateSwitch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
    marginRight: -4,
  },
  templateEditBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#2C2C2E",
    marginRight: 8,
  },
  templateEditBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  templateDeleteBtn: {
    padding: 6,
    marginLeft: 8,
  },
  largeModalContent: {
    maxWidth: 400,
    maxHeight: "85%",
  },
  typeTabContainer: {
    flexDirection: "row",
    backgroundColor: "#121214",
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  typeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
  },
  typeTabExpenseActive: {
    backgroundColor: "#FF453A",
  },
  typeTabIncomeActive: {
    backgroundColor: "#30D158",
  },
  typeTabInactive: {
    backgroundColor: "transparent",
  },
  typeTabText: {
    fontSize: 13,
    fontWeight: "700",
  },
  categoryChipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 6,
    marginHorizontal: -4,
  },
  categoryChip: {
    backgroundColor: "#121214",
    borderWidth: 1,
    borderColor: "#2C2C2E",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    margin: 4,
  },
  categoryChipExpenseSelected: {
    borderColor: "#FF453A",
    backgroundColor: "rgba(255, 69, 58, 0.15)",
  },
  categoryChipIncomeSelected: {
    borderColor: "#30D158",
    backgroundColor: "rgba(48, 209, 88, 0.15)",
  },
  categoryChipText: {
    color: "#8E8E93",
    fontSize: 12,
    fontWeight: "600",
  },
  accountRow: {
    flexDirection: "row",
    marginTop: 6,
  },
  accountChip: {
    flex: 1,
    backgroundColor: "#121214",
    borderWidth: 1,
    borderColor: "#2C2C2E",
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
    marginHorizontal: 4,
  },
  accountChipSelected: {
    borderColor: "#0A84FF",
    backgroundColor: "rgba(10, 132, 255, 0.15)",
  },
  accountChipText: {
    color: "#8E8E93",
    fontSize: 12,
    fontWeight: "600",
  },
  saveBtnExpense: {
    backgroundColor: "#FF453A",
  },
  saveBtnIncome: {
    backgroundColor: "#30D158",
  },
  grayText: {
    color: "#8E8E93",
  },
});
