import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { theme } from "../theme";

export const StatCard = ({ label, value, desc, accentColor = theme.colors.cyanPrimary }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: accentColor }]}>{value}</Text>
      {desc ? <Text style={styles.desc}>{desc}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.bgSurface,
    borderColor: theme.colors.borderSubtle,
    borderWidth: 1,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4
  },
  value: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5
  },
  desc: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 4
  }
});
