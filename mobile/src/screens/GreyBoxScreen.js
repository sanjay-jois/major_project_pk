import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from "react-native";
import { theme } from "../theme";
import { api } from "../api";
import { MobileChart } from "../components/MobileChart";

export const GreyBoxScreen = () => {
  const [age, setAge] = useState("40");
  const [weight, setWeight] = useState("70");
  const [height, setHeight] = useState("170");
  const [sex, setSex] = useState("Male");
  const [rate, setRate] = useState("70");
  const [bolus, setBolus] = useState("50");
  const [formula, setFormula] = useState("james");
  const [simRes, setSimRes] = useState(null);

  const simulate = async () => {
    try {
      const payload = {
        age: parseFloat(age) || 40,
        weight: parseFloat(weight) || 70,
        height: parseFloat(height) || 170,
        sex: sex,
        regimen: {
          infusions: [{ start: 0, end: 20, rate: parseFloat(rate) || 70 }],
          boluses: [{ time: 0, amt: parseFloat(bolus) || 50 }]
        },
        duration: 60,
        dt: 0.1,
        lbm_formula: formula
      };
      const res = await api.simulatePK(payload);
      setSimRes(res);
    } catch (err) {
      console.log("ODE sim error:", err);
    }
  };

  useEffect(() => {
    simulate();
  }, [age, weight, height, sex, rate, bolus, formula]);

  const p = simRes?.parameters || {};
  const s = simRes?.summary || {};

  // Map trajectory for chart
  const chartPoints = (simRes?.time || []).map((t, idx) => ({
    time: t,
    Cp_pred: simRes.Cp[idx],
    Cp_minto: simRes.Cp[idx],
    Ce: simRes.Ce[idx]
  }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Minto (1997) ODE Engine</Text>
        <Text style={styles.sectionSubtitle}>Mechanistic 3-compartment mammalian pharmacokinetic system</Text>
      </View>

      {/* Covariate Form */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Physiological Parameters</Text>
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Age ({age}y)</Text>
            <TextInput style={styles.input} value={age} onChangeText={setAge} keyboardType="numeric" />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Weight ({weight}kg)</Text>
            <TextInput style={styles.input} value={weight} onChangeText={setWeight} keyboardType="numeric" />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Height ({height}cm)</Text>
            <TextInput style={styles.input} value={height} onChangeText={setHeight} keyboardType="numeric" />
          </View>
        </View>

        <View style={[styles.row, { marginTop: 10 }]}>
          <View style={styles.col}>
            <Text style={styles.label}>Rate (ug/min)</Text>
            <TextInput style={styles.input} value={rate} onChangeText={setRate} keyboardType="numeric" />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Bolus (ug)</Text>
            <TextInput style={styles.input} value={bolus} onChangeText={setBolus} keyboardType="numeric" />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Sex</Text>
            <TouchableOpacity style={styles.toggleBtn} onPress={() => setSex(sex === "Male" ? "Female" : "Male")}>
              <Text style={styles.toggleText}>{sex}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Dynamic Calculated Variables Grid */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Computed Minto Covariate Equations</Text>
        <View style={styles.paramGrid}>
          <View style={styles.paramItem}>
            <Text style={styles.paramLabel}>Central V1</Text>
            <Text style={[styles.paramVal, { color: theme.colors.cyanPrimary }]}>
              {p.V1 ? `${p.V1.toFixed(2)} L` : "—"}
            </Text>
          </View>
          <View style={styles.paramItem}>
            <Text style={styles.paramLabel}>Shallow V2</Text>
            <Text style={styles.paramVal}>{p.V2 ? `${p.V2.toFixed(2)} L` : "—"}</Text>
          </View>
          <View style={styles.paramItem}>
            <Text style={styles.paramLabel}>Deep V3</Text>
            <Text style={styles.paramVal}>{p.V3 ? `${p.V3.toFixed(2)} L` : "—"}</Text>
          </View>
          <View style={styles.paramItem}>
            <Text style={styles.paramLabel}>Total Vss</Text>
            <Text style={styles.paramVal}>{p.Vss ? `${p.Vss.toFixed(2)} L` : "—"}</Text>
          </View>
        </View>

        <View style={[styles.paramGrid, { marginTop: 8 }]}>
          <View style={styles.paramItem}>
            <Text style={styles.paramLabel}>Metabolic Cl1</Text>
            <Text style={[styles.paramVal, { color: theme.colors.emeraldPrimary }]}>
              {p.Cl1 ? `${p.Cl1.toFixed(2)} L/m` : "—"}
            </Text>
          </View>
          <View style={styles.paramItem}>
            <Text style={styles.paramLabel}>Intercomp Cl2</Text>
            <Text style={styles.paramVal}>{p.Cl2 ? `${p.Cl2.toFixed(2)} L/m` : "—"}</Text>
          </View>
          <View style={styles.paramItem}>
            <Text style={styles.paramLabel}>Slow Cl3</Text>
            <Text style={styles.paramVal}>{p.Cl3 ? `${p.Cl3.toFixed(3)} L/m` : "—"}</Text>
          </View>
          <View style={styles.paramItem}>
            <Text style={styles.paramLabel}>ke0 (Effect)</Text>
            <Text style={[styles.paramVal, { color: theme.colors.amberPrimary }]}>
              {p.ke0 ? `${p.ke0.toFixed(3)} m⁻¹` : "—"}
            </Text>
          </View>
        </View>

        <View style={[styles.paramGrid, { marginTop: 8 }]}>
          <View style={styles.paramItem}>
            <Text style={styles.paramLabel}>Lean Body Mass</Text>
            <Text style={styles.paramVal}>{s.lbm_computed ? `${s.lbm_computed.toFixed(1)} kg` : "—"}</Text>
          </View>
          <View style={styles.paramItem}>
            <Text style={styles.paramLabel}>Body Mass Index</Text>
            <Text style={styles.paramVal}>{s.bmi_computed ? `${s.bmi_computed.toFixed(1)}` : "—"}</Text>
          </View>
          <View style={styles.paramItem}>
            <Text style={styles.paramLabel}>t½ Rapid (α)</Text>
            <Text style={[styles.paramVal, { color: theme.colors.cyanPrimary }]}>
              {p.t_half_alpha ? `${p.t_half_alpha.toFixed(1)}m` : "—"}
            </Text>
          </View>
          <View style={styles.paramItem}>
            <Text style={styles.paramLabel}>t½ Elimination (γ)</Text>
            <Text style={[styles.paramVal, { color: theme.colors.purpleMinto }]}>
              {p.t_half_gamma ? `${p.t_half_gamma.toFixed(1)}m` : "—"}
            </Text>
          </View>
        </View>
      </View>

      {/* Live ODE Simulation Chart */}
      <MobileChart
        points={chartPoints}
        height={220}
        showConformal={false}
        title="RK4 Dynamic State Trajectories (Cp vs Ce)"
      />
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
  card: {
    backgroundColor: theme.colors.bgSurface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.textMain,
    marginBottom: 8
  },
  row: {
    flexDirection: "row",
    gap: 8
  },
  col: {
    flex: 1
  },
  label: {
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
  paramGrid: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  paramItem: {
    flex: 1,
    alignItems: "center"
  },
  paramLabel: {
    fontSize: 9,
    color: theme.colors.textMuted,
    fontWeight: "600"
  },
  paramVal: {
    fontSize: 11.5,
    fontWeight: "700",
    color: theme.colors.textMain,
    marginTop: 2
  }
});
