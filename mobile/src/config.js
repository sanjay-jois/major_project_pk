import { Platform } from "react-native";

// On Android Emulator, localhost is reached via 10.0.2.2
// On iOS Simulator or Web, localhost is 127.0.0.1
// On physical mobile device, replace with your development machine's local Wi-Fi IP (e.g. 192.168.1.100)
export const DEFAULT_API_HOST = Platform.select({
  android: "http://10.0.2.2:8000/api",
  ios: "http://127.0.0.1:8000/api",
  default: "http://127.0.0.1:8000/api"
});

export const APP_CONFIG = {
  title: "PK-ML Clinical",
  subtitle: "Target-Controlled Infusion Suite",
  disclaimer: "For research and educational use only. Not for clinical treatment or dosing."
};
