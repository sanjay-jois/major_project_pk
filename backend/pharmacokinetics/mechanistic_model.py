"""
pharmacokinetics/mechanistic_model.py — Minto (1997) 3-Compartment Remifentanil ODE Engine.

Reference:
    Minto CF, Schnider TW, Egan TD, et al. "Influence of age and gender on the
    pharmacokinetics and pharmacodynamics of remifentanil. I. Model development."
    Anesthesiology 1997; 86:10-23.
"""
from __future__ import annotations
from typing import Dict, Any, Tuple
import numpy as np

def lbm_james(weight_kg: float, height_cm: float, sex: str | int) -> float:
    """
    James (1976) lean body mass (kg), used by Minto et al. (1997).
    """
    is_male = str(sex).lower() in ("male", "m", "1") or sex == 1
    w, h = float(weight_kg), float(height_cm)
    if is_male:
        return 1.1 * w - 128.0 * (w / h) ** 2
    return 1.07 * w - 148.0 * (w / h) ** 2

def lbm_janmahasatian(weight_kg: float, height_cm: float, sex: str | int) -> float:
    """
    Janmahasatian (2005) fat-free mass (kg).
    """
    is_male = str(sex).lower() in ("male", "m", "1") or sex == 1
    w, h = float(weight_kg), float(height_cm)
    bmi = w / (h / 100.0) ** 2
    if is_male:
        return 9270.0 * w / (6680.0 + 216.0 * bmi)
    return 9270.0 * w / (8780.0 + 244.0 * bmi)

def calculate_bsa(height_cm: float, weight_kg: float) -> float:
    """Mosteller formula for Body Surface Area (m^2)."""
    return float(np.sqrt(max(0.0, height_cm * weight_kg / 3600.0)))

def calculate_bmi(height_cm: float, weight_kg: float) -> float:
    """Body Mass Index (kg/m^2)."""
    h_m = max(0.3, height_cm / 100.0)
    return float(weight_kg / (h_m ** 2))

def minto_parameters(age: float, lbm: float) -> Dict[str, float]:
    """
    Compute Minto (1997) pharmacokinetic and pharmacodynamic parameters.
    Volumes in L, clearances in L/min, ke0 in 1/min.
    Guards against non-physiological negative values at extreme covariate values.
    """
    da = age - 40.0
    dl = lbm - 55.0

    V1 = max(5.1 - 0.0201 * da + 0.072 * dl, 0.5)
    V2 = max(9.82 - 0.0811 * da + 0.108 * dl, 0.5)
    V3 = max(5.42, 0.5)

    Cl1 = max(2.6 - 0.0162 * da + 0.0191 * dl, 0.1)     # metabolic clearance
    Cl2 = max(2.05 - 0.0301 * da, 0.05)                # rapid intercompartmental
    Cl3 = max(0.076 - 0.00113 * da, 0.005)             # slow intercompartmental
    ke0 = max(0.595 - 0.007 * da, 0.05)                # effect-site rate constant

    k10 = Cl1 / V1
    k12 = Cl2 / V1
    k21 = Cl2 / V2
    k13 = Cl3 / V1
    k31 = Cl3 / V3

    # Eigenvalue calculation for tri-exponential disposition half-lives
    # Characteristic polynomial: s^3 + a0*s^2 + a1*s + a2 = 0
    k_sum1 = k10 + k12 + k13
    a0 = k_sum1 + k21 + k31
    a1 = k10 * k21 + k10 * k31 + k21 * k31 + k12 * k31 + k13 * k21
    a2 = k10 * k21 * k31
    roots = np.roots([1.0, a0, a1, a2])
    real_roots = np.sort(np.abs(np.real(roots)))[::-1]  # alpha, beta, gamma
    t_half_alpha = np.log(2.0) / real_roots[0] if len(real_roots) > 0 and real_roots[0] > 0 else 1.0
    t_half_beta = np.log(2.0) / real_roots[1] if len(real_roots) > 1 and real_roots[1] > 0 else 5.0
    t_half_gamma = np.log(2.0) / real_roots[2] if len(real_roots) > 2 and real_roots[2] > 0 else 45.0

    return {
        "V1": float(V1), "V2": float(V2), "V3": float(V3), "Vss": float(V1 + V2 + V3),
        "Cl1": float(Cl1), "Cl2": float(Cl2), "Cl3": float(Cl3), "ke0": float(ke0),
        "k10": float(k10), "k12": float(k12), "k21": float(k21),
        "k13": float(k13), "k31": float(k31),
        "t_half_alpha": float(t_half_alpha),
        "t_half_beta": float(t_half_beta),
        "t_half_gamma": float(t_half_gamma),
        "Css_per_ugmin": float(1.0 / Cl1)
    }

def simulate_ode(
    patient: Dict[str, Any],
    infusions: list,
    boluses: list,
    duration_min: float = 90.0,
    dt: float = 0.05,
    lbm_formula: str = "james"
) -> Dict[str, Any]:
    """
    Simulate the 3-compartment + effect site ODE using Runge-Kutta 4th order (RK4).
    Units:
        Time: minutes
        Rate: ug/min
        Amount A1..A3: ug
        Concentration Cp, Ce: ng/mL (ug/L)
    """
    age = float(patient.get("age", 40.0))
    wt = float(patient.get("weight", 70.0))
    ht = float(patient.get("height", 170.0))
    sex = patient.get("sex", "Male")

    if lbm_formula == "janmahasatian":
        lbm = lbm_janmahasatian(wt, ht, sex)
    else:
        lbm = lbm_james(wt, ht, sex)

    params = minto_parameters(age, lbm)
    V1, V2, V3 = params["V1"], params["V2"], params["V3"]
    k10, k12, k21 = params["k10"], params["k12"], params["k21"]
    k13, k31, ke0 = params["k13"], params["k31"], params["ke0"]

    # Pre-parse infusions and boluses
    norm_infusions = []
    for inf in infusions:
        start = float(inf.get("start", 0.0))
        end = float(inf.get("end", 0.0))
        rate = float(inf.get("rate", 0.0))
        if end > start and rate > 0:
            norm_infusions.append((start, end, rate))

    norm_boluses = []
    for b in boluses:
        t = float(b.get("time", 0.0))
        amt = float(b.get("amt", 0.0))
        if amt > 0:
            norm_boluses.append((t, amt))
    norm_boluses.sort(key=lambda x: x[0])

    n_steps = int(np.ceil(duration_min / dt)) + 1
    times = np.linspace(0.0, duration_min, n_steps)

    A = np.zeros(3, dtype=np.float64)  # A1, A2, A3
    ce = 0.0                           # Ce

    Cp_arr = np.zeros(n_steps, dtype=np.float64)
    Ce_arr = np.zeros(n_steps, dtype=np.float64)
    A1_arr = np.zeros(n_steps, dtype=np.float64)
    A2_arr = np.zeros(n_steps, dtype=np.float64)
    A3_arr = np.zeros(n_steps, dtype=np.float64)

    # Process any bolus exactly at time 0
    bolus_ptr = 0
    while bolus_ptr < len(norm_boluses) and norm_boluses[bolus_ptr][0] <= 0.0:
        A[0] += norm_boluses[bolus_ptr][1]
        bolus_ptr += 1

    Cp_arr[0] = A[0] / V1
    Ce_arr[0] = ce
    A1_arr[0] = A[0]
    A2_arr[0] = A[1]
    A3_arr[0] = A[2]

    def get_rate(t: float) -> float:
        r = 0.0
        for s, e, rate_val in norm_infusions:
            if s <= t < e:
                r += rate_val
        return r

    def deriv(ast: np.ndarray, t: float) -> np.ndarray:
        a1, a2, a3 = ast[0], ast[1], ast[2]
        r = get_rate(t)
        da1 = r - (k10 + k12 + k13) * a1 + k21 * a2 + k31 * a3
        da2 = k12 * a1 - k21 * a2
        da3 = k13 * a1 - k31 * a3
        return np.array([da1, da2, da3], dtype=np.float64)

    for i in range(1, n_steps):
        t_prev = times[i - 1]
        t_curr = times[i]

        # Apply any boluses that occur between t_prev and t_curr
        while bolus_ptr < len(norm_boluses) and t_prev < norm_boluses[bolus_ptr][0] <= t_curr:
            A[0] += norm_boluses[bolus_ptr][1]
            bolus_ptr += 1

        # RK4 step
        k1 = deriv(A, t_prev)
        k2 = deriv(A + 0.5 * dt * k1, t_prev + 0.5 * dt)
        k3 = deriv(A + 0.5 * dt * k2, t_prev + 0.5 * dt)
        k4 = deriv(A + dt * k3, t_curr)

        A = np.maximum(0.0, A + (dt / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4))

        cp = A[0] / V1
        # Exact discrete update for Ce under first-order ke0
        ce = cp + (ce - cp) * np.exp(-ke0 * dt)
        ce = max(0.0, ce)

        Cp_arr[i] = cp
        Ce_arr[i] = ce
        A1_arr[i] = A[0]
        A2_arr[i] = A[1]
        A3_arr[i] = A[2]

    total_dose = sum(r * (e - s) for s, e, r in norm_infusions) + sum(amt for _, amt in norm_boluses)

    def _trapz(y, x):
        if hasattr(np, "trapezoid"):
            return float(np.trapezoid(y, x))
        elif hasattr(np, "trapz"):
            return float(np.trapz(y, x))
        y = np.asarray(y)
        x = np.asarray(x)
        return float(np.sum((y[:-1] + y[1:]) * 0.5 * np.diff(x)))

    summary = {
        "peak_Cp": float(np.max(Cp_arr)),
        "peak_Ce": float(np.max(Ce_arr)),
        "time_to_peak_Ce": float(times[int(np.argmax(Ce_arr))]),
        "total_dose_ug": float(total_dose),
        "auc_Cp": _trapz(Cp_arr, times),
        "auc_Ce": _trapz(Ce_arr, times),
        "lbm_computed": float(lbm),
        "bmi_computed": float(calculate_bmi(ht, wt)),
        "bsa_computed": float(calculate_bsa(ht, wt))
    }

    return {
        "time": times.tolist(),
        "Cp": Cp_arr.tolist(),
        "Ce": Ce_arr.tolist(),
        "A1": A1_arr.tolist(),
        "A2": A2_arr.tolist(),
        "A3": A3_arr.tolist(),
        "parameters": params,
        "summary": summary
    }
