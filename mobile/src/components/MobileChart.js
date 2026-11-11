import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Polyline, Polygon, Line, Text as SvgText } from "react-native-svg";
import { theme } from "../theme";

export const MobileChart = ({
  points = [],
  height = 200,
  showConformal = true,
  title = "Concentration-Time Profile (ng/mL)"
}) => {
  if (!points || points.length === 0) {
    return (
      <View style={[styles.container, { height, justifyContent: "center", alignItems: "center" }]}>
        <Text style={styles.emptyText}>No simulation points to display</Text>
      </View>
    );
  }

  const width = 340;
  const paddingLeft = 35;
  const paddingRight = 15;
  const paddingTop = 20;
  const paddingBottom = 25;

  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  const maxT = Math.max(...points.map((p) => p.time), 1);
  const maxC = Math.max(
    ...points.map((p) => Math.max(p.Cp_pred || 0, p.Ce || 0, p.conformal_high || 0)),
    10
  );

  const getX = (t) => paddingLeft + (t / maxT) * chartW;
  const getY = (c) => paddingTop + chartH - (c / maxC) * chartH;

  // Build point strings for Svg
  const cpPoints = points.map((p) => `${getX(p.time)},${getY(p.Cp_pred)}`).join(" ");
  const cePoints = points.map((p) => `${getX(p.time)},${getY(p.Ce)}`).join(" ");
  const mintoPoints = points.map((p) => `${getX(p.time)},${getY(p.Cp_minto)}`).join(" ");

  // Conformal area polygon
  let conformalPoly = "";
  if (showConformal) {
    const highPoints = points.map((p) => `${getX(p.time)},${getY(p.conformal_high || p.Cp_pred)}`);
    const lowPoints = [...points]
      .reverse()
      .map((p) => `${getX(p.time)},${getY(p.conformal_low || p.Cp_pred)}`);
    conformalPoly = [...highPoints, ...lowPoints].join(" ");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.chartTitle}>{title}</Text>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Horizontal Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
          const y = paddingTop + chartH * pct;
          const val = ((1 - pct) * maxC).toFixed(1);
          return (
            <React.Fragment key={idx}>
              <Line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke={theme.colors.borderSubtle}
                strokeWidth={1}
              />
              <SvgText
                x={paddingLeft - 6}
                y={y + 3}
                fill={theme.colors.textMuted}
                fontSize={9}
                textAnchor="end"
              >
                {val}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Time labels */}
        {[0, 0.5, 1].map((pct, idx) => {
          const x = paddingLeft + chartW * pct;
          const tVal = (pct * maxT).toFixed(0);
          return (
            <SvgText
              key={idx}
              x={x}
              y={height - 6}
              fill={theme.colors.textMuted}
              fontSize={9}
              textAnchor="middle"
            >
              {tVal}m
            </SvgText>
          );
        })}

        {/* 95% Conformal Shaded Region */}
        {showConformal && conformalPoly.length > 0 && (
          <Polygon points={conformalPoly} fill="rgba(6, 182, 212, 0.15)" stroke="none" />
        )}

        {/* Minto Mechanistic Baseline */}
        <Polyline
          points={mintoPoints}
          fill="none"
          stroke={theme.colors.purpleMinto}
          strokeWidth={1.5}
          strokeDasharray="4, 3"
        />

        {/* Effect-Site Concentration (Ce) */}
        <Polyline
          points={cePoints}
          fill="none"
          stroke={theme.colors.amberPrimary}
          strokeWidth={1.8}
          strokeDasharray="2, 2"
        />

        {/* ML Grey-Box Prediction (Cp) */}
        <Polyline
          points={cpPoints}
          fill="none"
          stroke={theme.colors.cyanPrimary}
          strokeWidth={2.6}
        />
      </Svg>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { backgroundColor: theme.colors.cyanPrimary }]} />
          <Text style={styles.legendText}>Cp (Grey-Box ML)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { backgroundColor: theme.colors.purpleMinto }]} />
          <Text style={styles.legendText}>Cp (Minto ODE)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { backgroundColor: theme.colors.amberPrimary }]} />
          <Text style={styles.legendText}>Ce (Effect-Site)</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.bgSurface,
    borderColor: theme.colors.borderSubtle,
    borderWidth: 1,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md
  },
  chartTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.textMain,
    marginBottom: 6
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 12
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
    justifyContent: "center"
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  legendBox: {
    width: 10,
    height: 10,
    borderRadius: 2
  },
  legendText: {
    fontSize: 10,
    color: theme.colors.textSecondary
  }
});
