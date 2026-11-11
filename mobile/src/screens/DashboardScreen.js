import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { theme } from "../theme";
import { api } from "../api";
import { StatCard } from "../components/StatCard";

export const DashboardScreen = () => {
  const [summary, setSummary] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sumRes, lbRes] = await Promise.all([
        api.getDatasetSummary(),
        api.getLeaderboard()
      ]);
      setSummary(sumRes);
      setLeaderboard(lbRes.models || []);
    } catch (err) {
      console.log("Error loading dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const bestModel = leaderboard.find((m) => !m.is_baseline) || leaderboard[0];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor={theme.colors.cyanPrimary} />}
    >
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Overview & Clinical Cohort</Text>
        <Text style={styles.sectionSubtitle}>Pharmacokinetic modeling summary and dataset metrics</Text>
      </View>

      <View style={styles.row}>
        <View style={styles.col}>
          <StatCard
            label="Total Observations"
            value={summary ? summary.total_rows?.toLocaleString() : "2,108"}
            desc="Measured blood samples"
            accentColor={theme.colors.cyanPrimary}
          />
        </View>
        <View style={styles.col}>
          <StatCard
            label="Unique Subjects"
            value={summary ? summary.total_subjects : "65"}
            desc="Clinical cohort count"
            accentColor={theme.colors.bluePrimary}
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.col}>
          <StatCard
            label="Target Drug"
            value="Remifentanil"
            desc="Ultra-short acting opioid"
            accentColor={theme.colors.purpleMinto}
          />
        </View>
        <View style={styles.col}>
          <StatCard
            label="ML Learners"
            value={leaderboard.length > 0 ? `${leaderboard.length} Models` : "8 ML + ODE"}
            desc="Cross-subject validated"
            accentColor={theme.colors.emeraldPrimary}
          />
        </View>
      </View>

      {bestModel && (
        <View style={styles.cardHighlight}>
          <Text style={styles.highlightTag}>TOP BENCHMARK PERFORMER</Text>
          <Text style={styles.highlightModel}>{bestModel.model}</Text>
          <View style={styles.metricGrid}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>MAE</Text>
              <Text style={styles.metricVal}>{bestModel.MAE} ng/mL</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>RMSE</Text>
              <Text style={styles.metricVal}>{bestModel.RMSE} ng/mL</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>R² Score</Text>
              <Text style={styles.metricVal}>{bestModel.R2}</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>MDAPE</Text>
              <Text style={styles.metricVal}>{bestModel.MDAPE}%</Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>🔬 Scientific Grey-Box Architecture</Text>
        <Text style={styles.infoText}>
          This framework couples the classical Minto (1997) 3-compartment + effect-site differential equation model with
          machine learning estimators predicting log-residuals r = ln(obs) - ln(Cp_minto).
          Final predictions strictly preserve mass conservation and physical washout decay while providing 95% split-conformal
          prediction intervals.
        </Text>
      </View>
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
    marginBottom: theme.spacing.md
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
  row: {
    flexDirection: "row",
    gap: 12
  },
  col: {
    flex: 1
  },
  cardHighlight: {
    backgroundColor: theme.colors.bgSurface,
    borderColor: theme.colors.cyanPrimary,
    borderWidth: 1.5,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    shadowColor: theme.colors.cyanPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 10
  },
  highlightTag: {
    fontSize: 10,
    fontWeight: "800",
    color: theme.colors.cyanPrimary,
    letterSpacing: 0.8
  },
  highlightModel: {
    fontSize: 20,
    fontWeight: "800",
    color: theme.colors.textMain,
    marginTop: 2,
    marginBottom: 12
  },
  metricGrid: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  metricBox: {
    alignItems: "center"
  },
  metricLabel: {
    fontSize: 10,
    color: theme.colors.textMuted,
    fontWeight: "600"
  },
  metricVal: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.textMain,
    marginTop: 2
  },
  infoCard: {
    backgroundColor: theme.colors.bgCard,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.md,
    marginTop: theme.spacing.sm
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.textMain,
    marginBottom: 6
  },
  infoText: {
    fontSize: 11.5,
    color: theme.colors.textSecondary,
    lineHeight: 18
  }
});
