/**
 * frontend/js/trajectory.js — Interactive TCI Pharmacokinetic Simulation & Trajectory Chart.
 */

let chartTrajectory = null;

async function initTrajectoryPage() {
  setupTrajectoryFormListeners();
  await loadModelPicker();
  // Run initial trajectory simulation
  await runTrajectorySimulation();
}

function setupTrajectoryFormListeners() {
  const subjectSelect = document.getElementById("traj-select-subject");
  if (subjectSelect) {
    subjectSelect.addEventListener("change", async (e) => {
      const sid = e.target.value;
      if (sid) {
        await populateSubjectRegimen(sid);
      }
    });
  }

  const btnSimulate = document.getElementById("btn-run-trajectory");
  if (btnSimulate) {
    btnSimulate.addEventListener("click", (e) => {
      e.preventDefault();
      runTrajectorySimulation();
    });
  }

  const btnAddInfusion = document.getElementById("btn-add-infusion");
  if (btnAddInfusion) {
    btnAddInfusion.addEventListener("click", () => addInfusionRow());
  }

  const btnAddBolus = document.getElementById("btn-add-bolus");
  if (btnAddBolus) {
    btnAddBolus.addEventListener("click", () => addBolusRow());
  }
}

async function loadModelPicker() {
  const modelSelect = document.getElementById("traj-select-model");
  if (!modelSelect) return;

  try {
    const res = await window.api.getModels();
    modelSelect.innerHTML = "";
    res.models.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m === "Minto" ? "Minto (Mechanistic Baseline)" : `${m} (Grey-Box ML)`;
      if (m === res.default) opt.selected = true;
      modelSelect.appendChild(opt);
    });
  } catch (err) {
    console.error("Failed to load models list:", err);
  }
}

async function populateSubjectRegimen(subjectId) {
  try {
    const data = await window.api.getSubject(subjectId);
    if (!data) return;

    // Set Patient Demographics
    document.getElementById("traj-age").value = data.patient.age;
    document.getElementById("traj-weight").value = data.patient.weight;
    document.getElementById("traj-height").value = data.patient.height;
    document.getElementById("traj-sex").value = data.patient.sex;
    document.getElementById("traj-duration").value = Math.max(60, Math.ceil(data.max_time + 5));

    // Clear and populate infusions
    const infContainer = document.getElementById("infusion-rows-container");
    infContainer.innerHTML = "";
    if (data.regimen.infusions && data.regimen.infusions.length > 0) {
      data.regimen.infusions.forEach(inf => {
        addInfusionRow(inf.start, inf.end, inf.rate);
      });
    } else {
      addInfusionRow(0, 20, 70);
    }

    // Clear and populate boluses
    const bolContainer = document.getElementById("bolus-rows-container");
    bolContainer.innerHTML = "";
    if (data.regimen.boluses && data.regimen.boluses.length > 0) {
      data.regimen.boluses.forEach(b => {
        addBolusRow(b.time, b.amt);
      });
    }

    // Automatically simulate
    await runTrajectorySimulation();
  } catch (err) {
    console.error("Failed to populate subject regimen:", err);
  }
}

function addInfusionRow(start = 0, end = 20, rate = 70) {
  const container = document.getElementById("infusion-rows-container");
  if (!container) return;

  const row = document.createElement("div");
  row.className = "segment-row";
  row.innerHTML = `
    <div class="row-inputs">
      <input type="number" class="input-field inf-start" value="${start}" step="0.5" min="0" placeholder="Start (min)" />
      <span>to</span>
      <input type="number" class="input-field inf-end" value="${end}" step="0.5" min="0" placeholder="End (min)" />
      <span>at</span>
      <input type="number" class="input-field inf-rate" value="${rate}" step="1" min="0" placeholder="Rate (ug/min)" />
      <span class="unit">ug/min</span>
    </div>
    <button type="button" class="btn-icon-del" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(row);
}

function addBolusRow(time = 0, amt = 50) {
  const container = document.getElementById("bolus-rows-container");
  if (!container) return;

  const row = document.createElement("div");
  row.className = "segment-row";
  row.innerHTML = `
    <div class="row-inputs">
      <input type="number" class="input-field bolus-time" value="${time}" step="0.5" min="0" placeholder="Time (min)" />
      <span>at</span>
      <input type="number" class="input-field bolus-amt" value="${amt}" step="5" min="0" placeholder="Amt (ug)" />
      <span class="unit">ug</span>
    </div>
    <button type="button" class="btn-icon-del" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(row);
}

function collectRegimenFromUI() {
  const infusions = [];
  document.querySelectorAll("#infusion-rows-container .segment-row").forEach(row => {
    const s = parseFloat(row.querySelector(".inf-start").value) || 0;
    const e = parseFloat(row.querySelector(".inf-end").value) || 0;
    const r = parseFloat(row.querySelector(".inf-rate").value) || 0;
    if (e > s && r > 0) infusions.push({ start: s, end: e, rate: r });
  });

  const boluses = [];
  document.querySelectorAll("#bolus-rows-container .segment-row").forEach(row => {
    const t = parseFloat(row.querySelector(".bolus-time").value) || 0;
    const a = parseFloat(row.querySelector(".bolus-amt").value) || 0;
    if (a > 0) boluses.push({ time: t, amt: a });
  });

  return { infusions, boluses };
}

async function runTrajectorySimulation() {
  const btn = document.getElementById("btn-run-trajectory");
  if (btn) btn.disabled = true;

  try {
    const patient = {
      age: parseFloat(document.getElementById("traj-age").value) || 40,
      weight: parseFloat(document.getElementById("traj-weight").value) || 70,
      height: parseFloat(document.getElementById("traj-height").value) || 170,
      sex: document.getElementById("traj-sex").value || "Male"
    };

    const regimen = collectRegimenFromUI();
    const duration = parseFloat(document.getElementById("traj-duration").value) || 90;
    const model = document.getElementById("traj-select-model").value || "XGBoost";
    const subjectId = document.getElementById("traj-select-subject").value || null;

    const payload = {
      patient: patient,
      regimen: regimen,
      duration: duration,
      model: model,
      subject_id: subjectId ? parseInt(subjectId) : null
    };

    const res = await window.api.predictTrajectory(payload);
    renderTrajectoryChart(res);
    renderTrajectorySummaryMetrics(res);
  } catch (err) {
    alert(`Simulation error: ${err.message}`);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function renderTrajectorySummaryMetrics(res) {
  const traj = res.trajectory || [];
  const ode = (res.metrics && res.metrics.ode_parameters) ? res.metrics.ode_parameters : {};

  const setT = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  setT("traj-stat-peak-cp", `${res.metrics.peak_Cp || 0} ng/mL`);
  setT("traj-stat-peak-ce", `${res.metrics.peak_Ce || 0} ng/mL`);
  setT("traj-stat-v1", ode.V1 ? `${ode.V1.toFixed(2)} L` : "—");
  setT("traj-stat-cl1", ode.Cl1 ? `${ode.Cl1.toFixed(2)} L/min` : "—");
  setT("traj-stat-thalf", ode.t_half_alpha ? `${ode.t_half_alpha.toFixed(1)} min` : "—");
}

function renderTrajectoryChart(res) {
  const ctx = document.getElementById("canvas-trajectory");
  if (!ctx) return;
  if (chartTrajectory) chartTrajectory.destroy();

  const traj = res.trajectory || [];
  const times = traj.map(pt => pt.time);
  const cpMinto = traj.map(pt => pt.Cp_minto);
  const cpPred = traj.map(pt => pt.Cp_pred);
  const ce = traj.map(pt => pt.Ce);
  const confLow = traj.map(pt => pt.conformal_low);
  const confHigh = traj.map(pt => pt.conformal_high);
  const rates = traj.map(pt => pt.infusion_rate);

  // Observed points
  const obsPoints = (res.observed || []).map(o => ({ x: o.time, y: o.conc }));

  chartTrajectory = new Chart(ctx, {
    type: "line",
    data: {
      labels: times,
      datasets: [
        // 1. Conformal Uncertainty Band (High)
        {
          label: "95% Conformal Upper Bound",
          data: confHigh,
          borderColor: "transparent",
          backgroundColor: "rgba(6, 182, 212, 0.12)",
          fill: "+1",
          pointRadius: 0,
          borderWidth: 0,
          yAxisID: "y"
        },
        // 2. Conformal Uncertainty Band (Low)
        {
          label: "95% Conformal Lower Bound",
          data: confLow,
          borderColor: "transparent",
          backgroundColor: "transparent",
          fill: false,
          pointRadius: 0,
          borderWidth: 0,
          yAxisID: "y"
        },
        // 3. ML-Corrected Grey-Box Prediction
        {
          label: `Grey-Box Prediction (${res.model})`,
          data: cpPred,
          borderColor: "#06b6d4",
          backgroundColor: "#06b6d4",
          borderWidth: 2.8,
          pointRadius: 0,
          tension: 0.1,
          yAxisID: "y"
        },
        // 4. Minto Mechanistic Baseline
        {
          label: "Minto (1997) Mechanistic Baseline",
          data: cpMinto,
          borderColor: "#a855f7",
          borderWidth: 1.8,
          borderDash: [5, 4],
          pointRadius: 0,
          tension: 0.1,
          yAxisID: "y"
        },
        // 5. Effect-Site Concentration (Ce)
        {
          label: "Effect-Site Conc (Ce)",
          data: ce,
          borderColor: "#f59e0b",
          borderWidth: 1.8,
          borderDash: [2, 2],
          pointRadius: 0,
          tension: 0.1,
          yAxisID: "y"
        },
        // 6. Real Patient Blood Observations (if applicable)
        {
          label: "Observed Plasma Samples (Cp)",
          type: "scatter",
          data: obsPoints,
          backgroundColor: "#10b981",
          borderColor: "#ffffff",
          borderWidth: 1.5,
          pointRadius: 5.5,
          pointHoverRadius: 8,
          yAxisID: "y"
        },
        // 7. Infusion Rate Profile (Secondary Y-Axis)
        {
          label: "Infusion Rate (ug/min)",
          data: rates,
          borderColor: "rgba(100, 116, 139, 0.6)",
          backgroundColor: "rgba(100, 116, 139, 0.08)",
          fill: true,
          stepped: "before",
          borderWidth: 1.5,
          pointRadius: 0,
          yAxisID: "y1"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: {
          position: "top",
          labels: { color: "#94a3b8", font: { size: 11 }, usePointStyle: true }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const label = context.dataset.label || "";
              const val = context.parsed.y !== null ? context.parsed.y.toFixed(2) : "";
              if (context.dataset.yAxisID === "y1") {
                return `${label}: ${val} ug/min`;
              }
              return `${label}: ${val} ng/mL`;
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: "Time (minutes)", color: "#94a3b8" },
          ticks: { color: "#94a3b8", maxTicksLimit: 15 },
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
          title: { display: true, text: "Infusion Rate (ug/min)", color: "#64748b" },
          ticks: { color: "#64748b" },
          grid: { drawOnChartArea: false },
          min: 0
        }
      }
    }
  });
}
