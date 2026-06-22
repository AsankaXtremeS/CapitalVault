import AnimatedScreenWrapper from "@/components/AnimatedScreenWrapper";
import { useLocalStore } from "@/hooks/useLocalStore";
import { getThemedStyles } from "@/utils/themeHelper";
import * as Haptics from "expo-haptics";
import {
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle, G, Line, Path, Text as SvgText } from "react-native-svg";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Color mapping precisely aligned with the user's screenshot
const CATEGORY_COLORS: Record<string, string> = {
  Salary: "#30D158", // Emerald Green
  Allowance: "#64D2FF", // Mint Sky Blue
  Bonus: "#AF52DE", // Vibrant Purple
  "Petty cash": "#0A84FF", // Electric Sapphire Blue

  Household: "#FF453A", // Crimson Coral Red
  Food: "#FF9F0A", // Vivid Orange/Amber
  Transport: "#FFD60A", // Sunny Gold Yellow
  Beauty: "#FF375F", // Hot Rose Pink
  "Social Life": "#BF5AF2", // Amethyst Purple
  Telecommunications: "#5AC8FA", // Soft Sky Blue
  Pets: "#FF9500", // Deep Tangerine
  Culture: "#FF2D55", // Ruby Pink
  Apparel: "#D3B2FF", // Soft Lilac / Lavender
  Health: "#FF3B30", // Deep Red
  Education: "#007AFF", // Royal Blue
  Gift: "#FF2D55", // Ruby Pink
  Liquor: "#C68B59", // Warm Amber
  Cigarettes: "#A28A67", // Smokey Ash Bronze
  Weed: "#28CD41", // Herbal Green
  Party: "#D352F3", // Vibrant Violet
  Wedding: "#E5C158", // Premium Gold
  Other: "#AEAEB2", // Platinum Silver Gray
};

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
  Telecommunications: "📞",
  Liquor: "🥃",
  Cigarettes: "🚬",
  Weed: "🌿",
  Party: "🎉",
  Wedding: "💍",
  Salary: "💼",
  Allowance: "🪙",
  Bonus: "✨",
  "Petty cash": "💵",
  Other: "📦",
};

export default function StatsView() {
  const { transactions, currencySymbol, theme } = useLocalStore();
  const isDark = theme === "dark";
  const styles = useMemo(() => getThemedStyles(staticStyles, isDark), [isDark]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [statsType, setStatsType] = useState<"income" | "expense">("expense");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [hasUserSelected, setHasUserSelected] = useState(false);

  const handleMonthChange = (direction: "next" | "prev") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newMonth = new Date(selectedMonth);
    newMonth.setMonth(
      selectedMonth.getMonth() + (direction === "next" ? 1 : -1),
    );
    setSelectedMonth(newMonth);
    setActiveCategory(null);
    setHasUserSelected(false);
  };

  // Filter transactions
  const monthTxs = transactions.filter((tx) => {
    const d = new Date(tx.date);
    return (
      d.getMonth() === selectedMonth.getMonth() &&
      d.getFullYear() === selectedMonth.getFullYear() &&
      tx.type === statsType
    );
  });

  const totalSum = monthTxs.reduce((sum, tx) => sum + tx.amount, 0);

  // Group by category
  const categoryMap: Record<string, number> = {};
  monthTxs.forEach((tx) => {
    categoryMap[tx.category] = (categoryMap[tx.category] || 0) + tx.amount;
  });

  // Convert to sorted array
  const categoryStats = Object.keys(categoryMap)
    .map((name) => {
      const amount = categoryMap[name];
      const percentage = totalSum > 0 ? (amount / totalSum) * 100 : 0;
      return {
        name,
        amount,
        percentage: Number(percentage.toFixed(1)),
        color: CATEGORY_COLORS[name] || "#8E8E93",
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const handleCategoryPress = (name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHasUserSelected(true);
    if (resolvedActiveCategory === name) {
      setActiveCategory(null);
    } else {
      setActiveCategory(name);
    }
  };

  // Dynamic active category selection helper
  const resolvedActiveCategory = useMemo(() => {
    if (hasUserSelected) {
      return activeCategory;
    }
    return categoryStats[0]?.name || null;
  }, [activeCategory, categoryStats, hasUserSelected]);

  // SVG Geometry Dimensions
  const Cx = SCREEN_WIDTH / 2;
  const Cy = 140;
  const R = 75; // Standard pie radius

  let accumulatedAngle = -Math.PI / 2; // Start polar at 12 o'clock (-90 deg)

  // Mathematically plot each slice and its connected lines/tags
  const wedges = categoryStats.map((cat) => {
    let angleDelta = (cat.percentage / 100) * 360 * (Math.PI / 180);
    if (cat.percentage >= 99.9 || categoryStats.length === 1) {
      angleDelta = 2 * Math.PI - 0.0001; // Avoid identical start/end angles causing zero-length path in SVG arc
    }
    const startAngle = accumulatedAngle;
    const endAngle = accumulatedAngle + angleDelta;
    accumulatedAngle = endAngle;

    const midAngle = startAngle + angleDelta / 2;
    const largeArcFlag = cat.percentage > 50 ? 1 : 0;

    // Outer pop-out translation offset when active
    const isActive = resolvedActiveCategory === cat.name;
    const popDistance = isActive ? 10 : 0;
    const dx = popDistance * Math.cos(midAngle);
    const dy = popDistance * Math.sin(midAngle);

    // polar points for path edges
    const x1 = Cx + R * Math.cos(startAngle);
    const y1 = Cy + R * Math.sin(startAngle);
    const x2 = Cx + R * Math.cos(endAngle);
    const y2 = Cy + R * Math.sin(endAngle);

    const pathData = `M ${Cx} ${Cy} L ${x1} ${y1} A ${R} ${R} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

    // Connective guide lines from slice to label
    const lineStartX = Cx + dx + (R - 5) * Math.cos(midAngle);
    const lineStartY = Cy + dy + (R - 5) * Math.sin(midAngle);

    const lineEndX = Cx + dx + (R + 25) * Math.cos(midAngle);
    const lineEndY = Cy + dy + (R + 25) * Math.sin(midAngle);

    // Label position coordinates
    const labelX = Cx + dx + (R + 32) * Math.cos(midAngle);
    const labelY = Cy + dy + (R + 32) * Math.sin(midAngle);

    return {
      ...cat,
      pathData,
      dx,
      dy,
      lineStartX,
      lineStartY,
      lineEndX,
      lineEndY,
      labelX,
      labelY,
      midAngle,
      isActive,
    };
  });

  const activeWedge = wedges.find((w) => w.isActive);

  return (
    <AnimatedScreenWrapper>
      <View style={styles.container}>
        {/* Header Selector */}
        <View style={styles.header}>
          <View style={styles.monthSelector}>
            <TouchableOpacity onPress={() => handleMonthChange("prev")}>
              <ChevronLeft color="#8E8E93" size={24} />
            </TouchableOpacity>
            <Text style={styles.monthText}>
              {selectedMonth.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </Text>
            <TouchableOpacity onPress={() => handleMonthChange("next")}>
              <ChevronRight color="#8E8E93" size={24} />
            </TouchableOpacity>
          </View>
          <SlidersHorizontal color={isDark ? "#FFFFFF" : "#000000"} size={20} />
        </View>

        {/* Tabs Row */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.tab,
              statsType === "expense" && styles.tabExpenseActive,
            ]}
            onPress={() => {
              setStatsType("expense");
              setActiveCategory(null);
              setHasUserSelected(false);
            }}
          >
            <Text
              style={[
                styles.tabText,
                statsType === "expense" && styles.tabExpenseTextActive,
              ]}
            >
              Expenses
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.tab,
              statsType === "income" && styles.tabIncomeActive,
            ]}
            onPress={() => {
              setStatsType("income");
              setActiveCategory(null);
              setHasUserSelected(false);
            }}
          >
            <Text
              style={[
                styles.tabText,
                statsType === "income" && styles.tabIncomeTextActive,
              ]}
            >
              Income
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Dynamic Vector Pie Chart Section */}
          {totalSum > 0 ? (
            <View style={styles.chartSection}>
              <View style={styles.chartWrapper}>
                <Svg width={SCREEN_WIDTH} height={280}>
                  {wedges.map((wedge, idx) => {
                    const labelAlign =
                      Math.cos(wedge.midAngle) >= 0 ? "start" : "end";

                    return (
                      <G key={idx}>
                        {/* Segment Wedge Path */}
                        <Path
                          d={wedge.pathData}
                          fill={wedge.color}
                          stroke={isDark ? "#121214" : "#FFFFFF"}
                          strokeWidth={1.5}
                          transform={`translate(${wedge.dx}, ${wedge.dy})`}
                          onPress={() => handleCategoryPress(wedge.name)}
                        />

                        {/* Slice connecting pointer lines */}
                        <Line
                          x1={wedge.lineStartX}
                          y1={wedge.lineStartY}
                          x2={wedge.lineEndX}
                          y2={wedge.lineEndY}
                          stroke={wedge.color}
                          strokeWidth={1}
                        />

                        {/* Small anchor dot on pointer */}
                        <Circle
                          cx={wedge.lineEndX}
                          cy={wedge.lineEndY}
                          r={1.5}
                          fill={wedge.color}
                        />

                        {/* Percentage floating text */}
                        <SvgText
                          x={wedge.labelX}
                          y={wedge.labelY + 4}
                          fill={isDark ? "#FFFFFF" : "#000000"}
                          fontSize="9"
                          fontWeight="600"
                          textAnchor={labelAlign}
                        >
                          {wedge.name.substring(0, 9)}...
                        </SvgText>
                        <SvgText
                          x={wedge.labelX}
                          y={wedge.labelY + 13}
                          fill="#8E8E93"
                          fontSize="8.5"
                          fontWeight="700"
                          textAnchor={labelAlign}
                        >
                          {wedge.percentage}%
                        </SvgText>
                      </G>
                    );
                  })}
                </Svg>

                {/* Active wedge popup info box (exactly as shown in screenshot) */}
                {activeWedge && (
                  <View
                    style={[
                      styles.activeBadge,
                      {
                        left: activeWedge.labelX > Cx ? Cx + 10 : Cx - 130,
                        top: activeWedge.labelY > Cy ? Cy + 30 : Cy - 60,
                        borderColor: activeWedge.color,
                      },
                    ]}
                  >
                    <Text style={styles.activeBadgeTitle}>
                      {CATEGORY_EMOJIS[activeWedge.name] || "📦"}{" "}
                      {activeWedge.name}
                    </Text>
                    <Text style={styles.activeBadgeAmount}>
                      {currencySymbol}{" "}
                      {activeWedge.amount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </Text>
                    <Text style={styles.activeBadgePercent}>
                      {activeWedge.percentage}% share
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.emptyChart}>
              <Text style={styles.emptyChartText}>
                No transactional entries logged for this period.
              </Text>
            </View>
          )}

          {/* Detailed Category Progress breakdown */}
          <View style={styles.breakdownSection}>
            {categoryStats.map((cat) => (
              <TouchableOpacity
                key={cat.name}
                activeOpacity={0.85}
                style={[
                  styles.categoryCard,
                  resolvedActiveCategory === cat.name && styles.categoryCardActive,
                ]}
                onPress={() => handleCategoryPress(cat.name)}
              >
                <View style={styles.categoryMetaRow}>
                  <View style={styles.catLeft}>
                    {/* Color-Coded Percentage Badge */}
                    <View
                      style={[
                        styles.percentageBadge,
                        { backgroundColor: cat.color },
                      ]}
                    >
                      <Text style={styles.percentageText}>
                        {Math.round(cat.percentage)}%
                      </Text>
                    </View>
                    <Text style={styles.catName}>
                      {CATEGORY_EMOJIS[cat.name] || "📦"} {cat.name}
                    </Text>
                  </View>
                  <Text style={styles.catAmount}>
                    {currencySymbol}{" "}
                    {cat.amount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    </AnimatedScreenWrapper>
  );
}

const staticStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121214", // Deep Charcoal
    paddingTop: 48,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  monthSelector: {
    flexDirection: "row",
    alignItems: "center",
  },
  monthText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    marginHorizontal: 16,
  },
  tabRow: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: "#2C2C2E",
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
  },
  tabExpenseActive: {
    borderBottomWidth: 3,
    borderBottomColor: "#FF453A",
  },
  tabIncomeActive: {
    borderBottomWidth: 3,
    borderBottomColor: "#0A84FF",
  },
  tabText: {
    fontSize: 15,
    color: "#8E8E93",
    fontWeight: "700",
  },
  tabExpenseTextActive: {
    color: "#FF453A",
  },
  tabIncomeTextActive: {
    color: "#0A84FF",
  },
  scrollContent: {
    paddingBottom: 40,
  },
  chartSection: {
    alignItems: "center",
    justifyContent: "center",
    height: 290,
  },
  chartWrapper: {
    position: "relative",
    width: SCREEN_WIDTH,
    height: 280,
  },
  activeBadge: {
    position: "absolute",
    backgroundColor: "#FFFFFF", // High-fidelity White Background overlay from screenshots
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    width: 120,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
    zIndex: 999,
  },
  activeBadgeTitle: {
    color: "#1C1C1E",
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 2,
  },
  activeBadgeAmount: {
    color: "#121214",
    fontSize: 13,
    fontWeight: "800",
  },
  activeBadgePercent: {
    color: "#8E8E93",
    fontSize: 9,
    fontWeight: "600",
    marginTop: 2,
  },
  emptyChart: {
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1C1C1E",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2C2C2E",
    marginHorizontal: 16,
    marginTop: 20,
    padding: 16,
  },
  emptyChartText: {
    color: "#8E8E93",
    fontSize: 14,
    textAlign: "center",
  },
  breakdownSection: {
    marginTop: 10,
    paddingHorizontal: 16,
  },
  categoryCard: {
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#2C2C2E",
  },
  categoryCardActive: {
    borderColor: "#FFFFFF",
    borderWidth: 1.2,
  },
  categoryMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  catLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  percentageBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginRight: 12,
    width: 44,
    alignItems: "center",
  },
  percentageText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  catName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  catAmount: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
