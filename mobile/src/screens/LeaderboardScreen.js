import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { theme } from "../theme";
import { api } from "../api";

export const LeaderboardScreen = () => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState("MAE");

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await api.getLeaderboard();
      setLeaderboard(res.models || []);
    } catch (err) {
      console.log("Leaderboard load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const sortedList = [...leaderboard].sort((a, b) => {
    if (sortKey === "R2" || sortKey === "coverage_95") {
      return (b[sortKey] || 0) - (a[sortKey] || 0);
    }
    return (a[sortKey] || 0) - (b[sortKey] || 0);
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadLeaderboard} tintColor={theme.colors.cyanPrimary} />}
    >
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Model Benchmark Leaderboard</Text>
        <Text style={styles.sectionSubtitle}>8 ML residual families evaluated on held-out subjects</Text>
      </View>

      {/* Sorting bar */}
      <View style={styles.sortBar}>
        <Text style={styles.sortLabel}>Sort By:</Text>
        {["MAE", "RMSE", "R2", "MDAPE"].map((k) => (
          <TouchableOpacity
            key={k}
            style={[styles.sortBtn, sortKey === k && styles.sortBtnActive]}
            onPress={() => setSortKey(k)}
          >
            <Text style={[styles.sortBtnText, sortKey === k && styles.sortBtnTextActive]}>{k}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Model Cards */}
      {sortedList.map((m, idx) => (
        <View
          key={m.model}
          style={[
            styles.modelCard,
            m.is_baseline && styles.baselineCard,
            idx === 0 && !m.is_baseline && styles.topCard
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>#{idx + 1}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.modelName}>{m.model}</Text>
              <Text style={styles.modelRole}>
                {m.is_baseline ? "Mechanistic ODE Baseline" : "Grey-Box ML Residual"}
              </Text>
            </View>
            {idx === 0 && !m.is_baseline && (
              <View style={styles.badgeTop}>
                <Text style={styles.badgeTopText}>Top</Text>
              </View>
            )}
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>MAE</Text>
              <Text style={[styles.metricVal, { color: theme.colors.cyanPrimary }]}>{m.MAE} ng/mL</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>RMSE</Text>
              <Text style={styles.metricVal}>{m.RMSE}</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>R²</Text>
              <Text style={styles.metricVal}>{m.R2}</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>MDAPE</Text>
              <Text style={[styles.metricVal, { color: theme.colors.amberPrimary }]}>{m.MDAPE}%</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>95% Cov</Text>
              <Text style={[styles.metricVal, { color: theme.colors.emeraldPrimary }]}>
                {m.coverage_95 ? `${m.coverage_95.toFixed(1)}%` : "—"}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgBase
  },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: 40
  },
  sectionHeader: {
    marginBottom: theme.spacing.sm
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.colors.textMain,
    letterSpacing: -0.3
  },
  sectionSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2
  },
  sortBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginVertical: 10
  },
  sortLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: "600"
  },
  sortBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.bgSurface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle
  },
  sortBtnActive: {
    backgroundColor: "rgba(6, 182, 212, 0.2)",
    borderColor: theme.colors.cyanPrimary
  },
  sortBtnText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: "600"
  },
  sortBtnTextActive: {
    color: theme.colors.cyanPrimary
  },
  modelCard: {
    backgroundColor: theme.colors.bgSurface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm
  },
  topCard: {
    borderColor: theme.colors.cyanPrimary,
    backgroundColor: "rgba(6, 182, 212, 0.05)"
  },
  baselineCard: {
    borderColor: "rgba(168, 85, 247, 0.4)",
    backgroundColor: "rgba(168, 85, 247, 0.04)"
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10
  },
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.bgCard,
    alignItems: "center",
    justifyContent: "center"
  },
  rankText: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.textSecondary
  },
  modelName: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.textMain
  },
  modelRole: {
    fontSize: 10,
    color: theme.colors.textMuted
  },
  badgeTop: {
    backgroundColor: "rgba(6, 182, 212, 0.2)",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.cyanPrimary
  },
  badgeTopText: {
    fontSize: 9,
    fontWeight: "800",
    color: theme.colors.cyanPrimary
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
    paddingTop: 8
  },
  metricItem: {
    alignItems: "center"
  },
  metricLabel: {
    fontSize: 9,
    color: theme.colors.textMuted,
    fontWeight: "600"
  },
  metricVal: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.textMain,
    marginTop: 2
  }
});
