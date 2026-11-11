# PK-ML Clinical — Cross-Platform Mobile Application

A React Native & Expo mobile application for target-controlled infusion (TCI) pharmacokinetic modeling on iOS, Android, and tablets, connected to the FastAPI backend.

---

## 📱 Features

- **Clinical Overview**: Live observation counts, cohort statistics, and top ML model performance.
- **TCI Trajectory Simulation**: Adjust patient covariates (Age, Weight, Height, Sex), set infusion rates, and inspect 95% split-conformal uncertainty intervals over Minto ODE base.
- **Model Leaderboard**: Inspect all 8 machine learning models with sortable metrics (MAE, RMSE, R², MDAPE%, 95% Conformal Coverage).
- **Minto (1997) ODE Engine**: Interactive physiological sliders dynamically updating $V_1, V_2, V_3, Cl_1, Cl_2, Cl_3, k_{e0}$, and half-lives $t_{1/2\alpha}, t_{1/2\beta}, t_{1/2\gamma}$.
- **Validation & Uncertainty**: Empirical split-conformal calibration with distribution-free coverage guarantees.
- **Backend Reconnection**: Tap the online/offline indicator in the header to change the backend API endpoint IP address anytime on a physical mobile device.

---

## 🚀 Quick Start

### 1. Ensure the Backend Server is Running
From the repository root (`c:\major_project_pk`):
```bash
python run.py
```
This runs the FastAPI backend at `http://127.0.0.1:8000`.

### 2. Navigate to Mobile Directory
```bash
cd mobile
```

### 3. Install Mobile Dependencies
```bash
npm install
```

### 4. Start Expo Development Server
```bash
npx expo start
```

### 5. Running on Devices

- **Android Emulator**:
  Press `a` in the terminal to launch on the Android emulator. The app automatically connects via `http://10.0.2.2:8000/api`.
- **iOS Simulator**:
  Press `i` in the terminal to launch on the iOS simulator. Connects via `http://127.0.0.1:8000/api`.
- **Physical Phone (iOS & Android via Expo Go)**:
  1. Install the free **Expo Go** app from the App Store or Google Play Store.
  2. Ensure your phone is connected to the same Wi-Fi network as your computer.
  3. Scan the QR code displayed in your terminal.
  4. In the app header, tap the status pill and enter your computer's local network IP (e.g. `http://192.168.1.50:8000/api`).
