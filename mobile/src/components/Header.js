import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Alert } from "react-native";
import { theme } from "../theme";
import { api, getApiBaseUrl, setApiBaseUrl } from "../api";
import { APP_CONFIG } from "../config";

export const Header = () => {
  const [online, setOnline] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [urlInput, setUrlInput] = useState(getApiBaseUrl());

  const checkStatus = async () => {
    try {
      const h = await api.getHealth();
      setOnline(h && h.status === "online");
    } catch (_) {
      setOnline(false);
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const saveUrl = () => {
    if (!urlInput.trim()) return;
    setApiBaseUrl(urlInput.trim());
    setModalVisible(false);
    checkStatus();
  };

  return (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <View style={styles.brandBox}>
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeText}>PK</Text>
          </View>
          <View>
            <Text style={styles.title}>{APP_CONFIG.title}</Text>
            <Text style={styles.subtitle}>{APP_CONFIG.subtitle}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.statusPill}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={[styles.dot, online ? styles.dotOnline : styles.dotOffline]} />
          <Text style={styles.statusText}>{online ? "Online" : "Offline"}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.disclaimerBar}>
        <Text style={styles.disclaimerText}>
          ⚠️ Research Prototype: Not approved for clinical dosing decisions.
        </Text>
      </View>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Backend API Host Configuration</Text>
            <Text style={styles.modalSubtitle}>
              Connect the mobile app to your running FastAPI backend server:
            </Text>
            <TextInput
              style={styles.input}
              value={urlInput}
              onChangeText={setUrlInput}
              placeholder="http://192.168.1.xxx:8000/api"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setModalVisible(false)}>
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSave} onPress={saveUrl}>
                <Text style={[styles.btnText, { color: "#041426", fontWeight: "700" }]}>Save & Reconnect</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: theme.colors.bgSurface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
    paddingTop: 45,
    paddingBottom: 0
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md
  },
  brandBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  brandBadge: {
    width: 32,
    height: 32,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.cyanPrimary,
    alignItems: "center",
    justifyContent: "center"
  },
  brandBadgeText: {
    color: "#041426",
    fontWeight: "800",
    fontSize: 14
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.textMain
  },
  subtitle: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    textTransform: "uppercase"
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: theme.colors.bgCard,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4
  },
  dotOnline: {
    backgroundColor: theme.colors.emeraldPrimary
  },
  dotOffline: {
    backgroundColor: theme.colors.roseDanger
  },
  statusText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: "600"
  },
  disclaimerBar: {
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "rgba(245, 158, 11, 0.15)"
  },
  disclaimerText: {
    fontSize: 10,
    color: "#fde68a"
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    padding: theme.spacing.lg
  },
  modalContent: {
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.borderHighlight
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.textMain,
    marginBottom: 6
  },
  modalSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 14,
    lineHeight: 18
  },
  input: {
    backgroundColor: theme.colors.bgCard,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderRadius: theme.radii.md,
    color: theme.colors.textMain,
    padding: theme.spacing.md,
    fontSize: 13,
    marginBottom: 16
  },
  btnRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10
  },
  btnCancel: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.bgCard
  },
  btnSave: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.cyanPrimary
  },
  btnText: {
    color: theme.colors.textMain,
    fontSize: 13,
    fontWeight: "600"
  }
});
