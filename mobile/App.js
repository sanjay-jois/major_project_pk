import React, { useState } from "react";
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, StatusBar } from "react-native";
import { theme } from "./src/theme";
import { Header } from "./src/components/Header";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { TrajectoryScreen } from "./src/screens/TrajectoryScreen";
import { LeaderboardScreen } from "./src/screens/LeaderboardScreen";
import { GreyBoxScreen } from "./src/screens/GreyBoxScreen";
import { ValidationScreen } from "./src/screens/ValidationScreen";

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");

  const renderScreen = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardScreen />;
      case "trajectory":
        return <TrajectoryScreen />;
      case "leaderboard":
        return <LeaderboardScreen />;
      case "greybox":
        return <GreyBoxScreen />;
      case "validation":
        return <ValidationScreen />;
      default:
        return <DashboardScreen />;
    }
  };

  const tabs = [
    { id: "dashboard", label: "Overview", icon: "📊" },
    { id: "trajectory", label: "Trajectory", icon: "📈" },
    { id: "leaderboard", label: "Leaderboard", icon: "🏆" },
    { id: "greybox", label: "Grey-Box", icon: "⚙️" },
    { id: "validation", label: "Validation", icon: "🛡️" }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.bgSurface} />
      <Header />
      <View style={styles.screenWrapper}>{renderScreen()}</View>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        {tabs.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              style={styles.tabBtn}
              onPress={() => setActiveTab(t.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.tabIcon}>{t.icon}</Text>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {t.label}
              </Text>
              {isActive && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgBase
  },
  screenWrapper: {
    flex: 1
  },
  bottomNav: {
    flexDirection: "row",
    backgroundColor: theme.colors.bgSurface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
    paddingVertical: 8,
    paddingBottom: 16
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative"
  },
  tabIcon: {
    fontSize: 18,
    marginBottom: 3
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: theme.colors.textMuted
  },
  tabLabelActive: {
    color: theme.colors.cyanPrimary,
    fontWeight: "700"
  },
  tabIndicator: {
    position: "absolute",
    top: -8,
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.colors.cyanPrimary
  }
});
