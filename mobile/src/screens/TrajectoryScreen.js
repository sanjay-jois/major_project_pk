import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { theme } from "../theme";
import { api } from "../api";
import { MobileChart } from "../components/MobileChart";

export const TrajectoryScreen = () => {
  const [age, setAge] = useState("40");
  const [weight, setWeight] = useState("70");
  const [height, setHeight] = useState("170");
  const [sex, setSex] = useState("Male");
  const [rate, setRate] = useState("70");
  const [duration, setDuration] = useState("60");
  const [selectedModel, setSelectedModel] = useState("GradientBoosting");
  const [models, setModels] = useState([]);
  const [simResult, setSimResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadModels();
    runSimulation();
  }, []);

  const loadModels = async () => {
    try {
      const res = await api.getModels();
      setModels(res.models || []);
      if (res.default) setSelectedModel(res.default);
    } catch (_) {}
  };

  const runSimulation = async () => {
    setLoading(true);
    try {
      const payload = {
        patient: {
          age: parseFloat(age) || 40,
          weight: parseFloat(weight) || 70,
          height: parseFloat(height) || 170,
          sex: sex
        },
        regimen: {
          infusions: [{ start: 0, end: 20, rate: parseFloat(rate) || 70 }],
          boluses: []
        },
        duration: parseFloat(duration) || 60,
        model: selectedModel
      };

      const res = await api.predictTrajectory(payload);
      setSimResult(res);
    } catch (err) {
      console.log("Trajectory error:", err);
    } finally {
      setLoading(false);
    }
  };

  const odeParams = simResult?.metrics?.ode_parameters || {};

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>TCI Trajectory Simulation</Text>
        <Text style={styles.sectionSubtitle}>95% Conformal prediction interval over Minto ODE</Text>
      </View>

      {/* Patient Input Controls */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Patient Covariates</Text>
        <View style={styles.inputRow}>
          <View style={styles.inputCol}>
            <Text style={styles.inputLabel}>Age (yr)</Text>
            <TextInput
              style={styles.input}
              value={age}
              onChangeText={setAge}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputCol}>
            <Text style={styles.inputLabel}>Weight (kg)</Text>
            <TextInput
              style={styles.input}
              value={weight}
              onChangeText={setWeight}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputCol}>
            <Text style={styles.inputLabel}>Height (cm)</Text>
            <TextInput
              style={styles.input}
              value={height}
              onChangeText={setHeight}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputCol}>
            <Text style={styles.inputLabel}>Sex</Text>
            <TouchableOpacity
              style={styles.toggleBtn}
              onPress={() => setSex(sex === "Male" ? "Female" : "Male")}
            >
              <Text style={styles.toggleText}>{sex}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.inputRow, { marginTop: 10 }]}>
          <View style={styles.inputCol}>
            <Text style={styles.inputLabel}>Rate (ug/min)</Text>
            <TextInput
              style={styles.input}
              value={rate}
              onChangeText={setRate}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputCol}>
            <Text style={styles.inputLabel}>Duration (m)</Text>
            <TextInput
              style={styles.input}
              value={duration}
              onChangeText={setDuration}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Model Selector Pills */}
        <Text style={[styles.inputLabel, { marginTop: 12, marginBottom: 6 }]}>Inference Model</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll}>
          {models.map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.pill, selectedModel === m && styles.pillActive]}
              onPress={() => setSelectedModel(m)}
            >
              <Text style={[styles.pillText, selectedModel === m && styles.pillTextActive]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity style={styles.simBtn} onPress={runSimulation} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#041426" size="small" />
          ) : (
            <Text style={styles.simBtnText}>⚡ Simulate Target Trajectory</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Trajectory Curve Chart */}
      <MobileChart
        points={simResult?.trajectory || []}
        height={220}
        title={`Remifentanil ${selectedModel} Trajectory`}
      />

      {/* Summary KPI Badges */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>Peak Cp</Text>
          <Text style={[styles.kpiVal, { color: theme.colors.cyanPrimary }]}>
            {simResult?.metrics?.peak_Cp ? `${simResult.metrics.peak_Cp} ng/mL` : "—"}
          </Text>
        </View>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>Peak Ce</Text>
          <Text style={[styles.kpiVal, { color: theme.colors.amberPrimary }]}>
            {simResult?.metrics?.peak_Ce ? `${simResult.metrics.peak_Ce} ng/mL` : "—"}
          </Text>
        </View>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>Vol V1</Text>
          <Text style={[styles.kpiVal, { color: theme.colors.purpleMinto }]}>
            {odeParams.V1 ? `${odeParams.V1.toFixed(1)} L` : "—"}
          </Text>
        </View>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>Cl1</Text>
          <Text style={[styles.kpiVal, { color: theme.colors.emeraldPrimary }]}>
            {odeParams.Cl1 ? `${odeParams.Cl1.toFixed(1)} L/m` : "—"}
          </Text>
        </View>
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
  card: {
    backgroundColor: theme.colors.bgSurface,
    borderColor: theme.colors.borderSubtle,
    borderWidth: 1,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.textMain,
    marginBottom: 10
  },
  inputRow: {
    flexDirection: "row",
    gap: 8
  },
  inputCol: {
    flex: 1
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: theme.colors.textMuted,
    marginBottom: 4
  },
  input: {
    backgroundColor: theme.colors.bgCard,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderRadius: theme.radii.md,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: theme.colors.textMain,
    fontSize: 13
  },
  toggleBtn: {
    backgroundColor: theme.colors.bgCard,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderRadius: theme.radii.md,
    paddingVertical: 7,
    alignItems: "center"
  },
  toggleText: {
    color: theme.colors.cyanPrimary,
    fontWeight: "700",
    fontSize: 12
  },
  pillsScroll: {
    flexDirection: "row",
    marginBottom: 12
  },
  pill: {
    backgroundColor: theme.colors.bgCard,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 6
  },
  pillActive: {
    backgroundColor: "rgba(6, 182, 212, 0.2)",
    borderColor: theme.colors.cyanPrimary
  },
  pillText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: "600"
  },
  pillTextActive: {
    color: theme.colors.cyanPrimary
  },
  simBtn: {
    backgroundColor: theme.colors.cyanPrimary,
    borderRadius: theme.radii.md,
    paddingVertical: 11,
    alignItems: "center",
    marginTop: 4
  },
  simBtnText: {
    color: "#041426",
    fontWeight: "700",
    fontSize: 13
  },
  kpiRow: {
    flexDirection: "row",
    gap: 8
  },
  kpiBox: {
    flex: 1,
    backgroundColor: theme.colors.bgSurface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderRadius: theme.radii.md,
    padding: 8,
    alignItems: "center"
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: theme.colors.textMuted,
    textTransform: "uppercase"
  },
  kpiVal: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2
  }
});
