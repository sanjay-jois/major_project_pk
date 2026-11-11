/**
 * frontend/js/greybox.js — Grey-Box Mechanistic PK Model derivation & live ODE simulator.
 */

let chartGreyboxOde = null;

function initGreyboxPage() {
  setupGreyboxSliders();
  runMechanisticSimulation();
}

function setupGreyboxSliders() {
  const inputs = [
    "gb-age", "gb-weight", "gb-height", "gb-rate", "gb-bolus", "gb-duration"
  ];

  inputs.forEach(id => {
    const el = document.getElementById(id);
    const badge = document.getElementById(`${id}-val`);
    if (el && badge) {
      badge.textContent = el.value;
      el.addEventListener("input", () => {
        badge.textContent = el.value;
        runMechanisticSimulation();
      });
    }
  });

  const sexEl = document.getElementById("gb-sex");
  if (sexEl) {
    sexEl.addEventListener("change", () => runMechanisticSimulation());
  }

  const formulaEl = document.getElementById("gb-lbm-formula");
  if (formulaEl) {
    formulaEl.addEventListener("change", () => runMechanisticSimulation());
  }
}

async function runMechanisticSimulation() {
  const age = parseFloat(document.getElementById("gb-age").value) || 40;
  const wt = parseFloat(document.getElementById("gb-weight").value) || 70;
  const ht = parseFloat(document.getElementById("gb-height").value) || 170;
  const sex = document.getElementById("gb-sex").value || "Male";
  const rate = parseFloat(document.getElementById("gb-rate").value) || 70;
  const bolus = parseFloat(document.getElementById("gb-bolus").value) || 50;
  const duration = parseFloat(document.getElementById("gb-duration").value) || 60;
  const formula = document.getElementById("gb-lbm-formula").value || "james";

  // Build simple test regimen: 20-min infusion + initial bolus
  const infusions = rate > 0 ? [{ start: 0, end: 20, rate: rate }] : [];
  const boluses = bolus > 0 ? [{ time: 0, amt: bolus }] : [];

  const payload = {
    age: age,
    weight: wt,
    height: ht,
    sex: sex,
    regimen: { infusions, boluses },
    duration: duration,
    dt: 0.1,
    lbm_formula: formula
  };

  try {
    const res = await window.api.simulatePK(payload);
    renderMechanisticParameters(res.parameters, res.summary);
    renderMechanisticChart(res);
  } catch (err) {
    console.error("Mechanistic simulation failed:", err);
  }
}

function renderMechanisticParameters(params, summary) {
  if (!params) return;

  document.getElementById("gb-param-v1").textContent = `${params.V1.toFixed(2)} L`;
  document.getElementById("gb-param-v2").textContent = `${params.V2.toFixed(2)} L`;
  document.getElementById("gb-param-v3").textContent = `${params.V3.toFixed(2)} L`;
  document.getElementById("gb-param-vss").textContent = `${params.Vss.toFixed(2)} L`;

  document.getElementById("gb-param-cl1").textContent = `${params.Cl1.toFixed(2)} L/min`;
  document.getElementById("gb-param-cl2").textContent = `${params.Cl2.toFixed(2)} L/min`;
  document.getElementById("gb-param-cl3").textContent = `${params.Cl3.toFixed(3)} L/min`;
  document.getElementById("gb-param-ke0").textContent = `${params.ke0.toFixed(3)} min⁻¹`;

  document.getElementById("gb-param-lbm").textContent = `${summary.lbm_computed.toFixed(1)} kg`;
  document.getElementById("gb-param-bmi").textContent = `${summary.bmi_computed.toFixed(1)} kg/m²`;
  document.getElementById("gb-param-bsa").textContent = `${summary.bsa_computed.toFixed(2)} m²`;

  document.getElementById("gb-param-t-alpha").textContent = `${params.t_half_alpha.toFixed(1)} min`;
  document.getElementById("gb-param-t-beta").textContent = `${params.t_half_beta.toFixed(1)} min`;
  document.getElementById("gb-param-t-gamma").textContent = `${params.t_half_gamma.toFixed(1)} min`;
}

function renderMechanisticChart(res) {
  const ctx = document.getElementById("canvas-greybox-ode");
  if (!ctx) return;
  if (chartGreyboxOde) chartGreyboxOde.destroy();

  const times = res.time || [];
  const cp = res.Cp || [];
  const ce = res.Ce || [];
  const a1 = res.A1 || [];
  const a2 = res.A2 || [];
  const a3 = res.A3 || [];

  chartGreyboxOde = new Chart(ctx, {
    type: "line",
    data: {
      labels: times.map(t => t.toFixed(1)),
      datasets: [
        {
          label: "Plasma Conc (Cp, ng/mL)",
          data: cp,
          borderColor: "#06b6d4",
          backgroundColor: "#06b6d4",
          borderWidth: 2.8,
          pointRadius: 0,
          yAxisID: "y"
        },
        {
          label: "Effect-Site Conc (Ce, ng/mL)",
          data: ce,
          borderColor: "#f59e0b",
          borderWidth: 2.2,
          borderDash: [4, 4],
          pointRadius: 0,
          yAxisID: "y"
        },
        {
          label: "Central Compartment Amount (A1, ug)",
          data: a1,
          borderColor: "rgba(168, 85, 247, 0.7)",
          borderWidth: 1.5,
          pointRadius: 0,
          yAxisID: "y1"
        },
        {
          label: "Shallow Peripheral (A2, ug)",
          data: a2,
          borderColor: "rgba(16, 185, 129, 0.7)",
          borderWidth: 1.5,
          pointRadius: 0,
          yAxisID: "y1"
        },
        {
          label: "Deep Peripheral (A3, ug)",
          data: a3,
          borderColor: "rgba(100, 116, 139, 0.7)",
          borderWidth: 1.5,
          pointRadius: 0,
          yAxisID: "y1"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#94a3b8", font: { size: 11 } } },
        tooltip: { mode: "index", intersect: false }
      },
      scales: {
        x: {
          title: { display: true, text: "Simulation Time (minutes)", color: "#94a3b8" },
          ticks: { color: "#94a3b8", maxTicksLimit: 12 },
          grid: { color: "#1e3156" }
        },
        y: {
          type: "linear",
          position: "left",
          title: { display: true, text: "Concentration (ng/mL)", color: "#06b6d4" },
          ticks: { color: "#94a3b8" },
          grid: { color: "#1e3156" },
          min: 0
        },
        y1: {
          type: "linear",
          position: "right",
          title: { display: true, text: "Drug Amount (ug)", color: "#a855f7" },
          ticks: { color: "#a855f7" },
          grid: { drawOnChartArea: false },
          min: 0
        }
      }
    }
  });
}
