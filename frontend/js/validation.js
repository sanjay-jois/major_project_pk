/**
 * frontend/js/validation.js — Validation Protocol, Conformal Uncertainty, and Residual Diagnostics.
 */

let chartValObsPred = null;
let chartValResTime = null;
let chartValErrDist = null;
let chartValSubjectPerf = null;

async function initValidationPage() {
  setupValidationModelPicker();
  await loadValidationDiagnostics();
}

async function setupValidationModelPicker() {
  const select = document.getElementById("select-val-model");
  if (!select) return;

  try {
    const res = await window.api.getModels();
    select.innerHTML = "";
    res.models.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      if (m === res.default) opt.selected = true;
      select.appendChild(opt);
    });

    select.addEventListener("change", () => {
      loadValidationDiagnostics(select.value);
    });
  } catch (err) {
    console.error("Failed to populate validation models:", err);
  }
}

async function loadValidationDiagnostics(modelName = null) {
  try {
    const [summary, plotsData] = await Promise.all([
      window.api.getValidationSummary(modelName),
      window.api.getValidationPlots(modelName)
    ]);

    renderValidationHeader(summary, plotsData);
    renderValObsPred(plotsData);
    renderValResTime(plotsData);
    renderValErrDist(plotsData);
    renderValSubjectPerf(plotsData);
  } catch (err) {
    console.error("Failed to load validation diagnostics:", err);
  }
}

function renderValidationHeader(summary, plotsData) {
  if (!summary || !summary.metrics) return;
  const m = summary.metrics;

  const setT = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  setT("val-stat-coverage", `${plotsData.empirical_coverage.toFixed(1)}%`);
  setT("val-stat-qscore", `q = ${plotsData.conformal_q95.toFixed(3)}`);
  setT("val-stat-mae", `${m.MAE} ng/mL`);
  setT("val-stat-mdape", `${m.MDAPE}%`);
  setT("val-stat-r2", m.R2);
}

function renderValObsPred(data) {
  const ctx = document.getElementById("canvas-val-obs-pred");
  if (!ctx || !data) return;
  if (chartValObsPred) chartValObsPred.destroy();

  const maxVal = Math.ceil(Math.max(...data.observed, ...data.predicted) * 1.05);
  const points = data.observed.map((obs, i) => ({
    x: obs,
    y: data.predicted[i],
    sid: data.subjects ? data.subjects[i] : null,
    time: data.times ? data.times[i] : null
  }));

  chartValObsPred = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "Held-Out Patient Points",
          data: points,
          backgroundColor: "rgba(6, 182, 212, 0.65)",
          borderColor: "#06b6d4",
          pointRadius: 4,
          pointHoverRadius: 7
        },
        {
          label: "Perfect Agreement (y = x)",
          type: "line",
          data: [{ x: 0, y: 0 }, { x: maxVal, y: maxVal }],
          borderColor: "rgba(244, 63, 94, 0.8)",
          borderWidth: 2,
          borderDash: [5, 4],
          pointRadius: 0,
          fill: false
        },
        {
          label: "+20% Error Margin",
          type: "line",
          data: [{ x: 0, y: 0 }, { x: maxVal, y: maxVal * 1.2 }],
          borderColor: "rgba(100, 116, 139, 0.4)",
          borderWidth: 1.5,
          borderDash: [3, 3],
          pointRadius: 0,
          fill: false
        },
        {
          label: "-20% Error Margin",
          type: "line",
          data: [{ x: 0, y: 0 }, { x: maxVal, y: maxVal * 0.8 }],
          borderColor: "rgba(100, 116, 139, 0.4)",
          borderWidth: 1.5,
          borderDash: [3, 3],
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#94a3b8" } },
        tooltip: {
          callbacks: {
            label: (item) => {
              const p = item.raw;
              return `Subject: ${p.sid || '—'} | Time: ${p.time || '—'}m | Obs: ${p.x.toFixed(2)} | Pred: ${p.y.toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: "Observed Concentration (ng/mL)", color: "#94a3b8" },
          ticks: { color: "#94a3b8" },
          grid: { color: "#1e3156" },
          min: 0, max: maxVal
        },
        y: {
          title: { display: true, text: "Predicted Concentration (ng/mL)", color: "#94a3b8" },
          ticks: { color: "#94a3b8" },
          grid: { color: "#1e3156" },
          min: 0, max: maxVal
        }
      }
    }
  });
}

function renderValResTime(data) {
  const ctx = document.getElementById("canvas-val-res-time");
  if (!ctx || !data) return;
  if (chartValResTime) chartValResTime.destroy();

  const infusionPoints = [];
  const washoutPoints = [];

  data.times.forEach((t, i) => {
    const pt = { x: t, y: data.residuals[i] };
    if (data.is_infusion[i]) {
      infusionPoints.push(pt);
    } else {
      washoutPoints.push(pt);
    }
  });

  const maxT = Math.ceil(Math.max(...data.times) * 1.05);

  chartValResTime = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "Infusion Phase Residuals",
          data: infusionPoints,
          backgroundColor: "rgba(6, 182, 212, 0.7)",
          borderColor: "#06b6d4",
          pointRadius: 4
        },
        {
          label: "Washout Phase Residuals",
          data: washoutPoints,
          backgroundColor: "rgba(245, 158, 11, 0.7)",
          borderColor: "#f59e0b",
          pointRadius: 4
        },
        {
          label: "Zero Bias Baseline",
          type: "line",
          data: [{ x: 0, y: 0 }, { x: maxT, y: 0 }],
          borderColor: "rgba(244, 63, 94, 0.7)",
          borderWidth: 1.5,
          borderDash: [4, 4],
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#94a3b8" } }
      },
      scales: {
        x: {
          title: { display: true, text: "Time (minutes)", color: "#94a3b8" },
          ticks: { color: "#94a3b8" },
          grid: { color: "#1e3156" }
        },
        y: {
          title: { display: true, text: "Residual: Obs - Pred (ng/mL)", color: "#94a3b8" },
          ticks: { color: "#94a3b8" },
          grid: { color: "#1e3156" }
        }
      }
    }
  });
}

function renderValErrDist(data) {
  const ctx = document.getElementById("canvas-val-err-dist");
  if (!ctx || !data || !data.residuals) return;
  if (chartValErrDist) chartValErrDist.destroy();

  const res = data.residuals;
  const minR = Math.floor(Math.min(...res));
  const maxR = Math.ceil(Math.max(...res));
  const step = 2.0;
  const numBins = Math.ceil((maxR - minR) / step) || 1;
  const counts = new Array(numBins).fill(0);
  const labels = [];

  for (let i = 0; i < numBins; i++) {
    const low = minR + i * step;
    labels.push(`${low} to ${low + step}`);
  }

  res.forEach(r => {
    const idx = Math.min(numBins - 1, Math.max(0, Math.floor((r - minR) / step)));
    counts[idx]++;
  });

  chartValErrDist = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "Frequency",
        data: counts,
        backgroundColor: "rgba(16, 185, 129, 0.65)",
        borderColor: "#10b981",
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          title: { display: true, text: "Residual Error Bin (ng/mL)", color: "#94a3b8" },
          ticks: { color: "#94a3b8", font: { size: 10 } },
          grid: { display: false }
        },
        y: {
          title: { display: true, text: "Count", color: "#94a3b8" },
          ticks: { color: "#94a3b8" },
          grid: { color: "#1e3156" }
        }
      }
    }
  });
}

function renderValSubjectPerf(data) {
  const ctx = document.getElementById("canvas-val-subject-perf");
  if (!ctx || !data || !data.subjects) return;
  if (chartValSubjectPerf) chartValSubjectPerf.destroy();

  // Compute MAE per subject
  const subjectErrors = {};
  data.subjects.forEach((sid, i) => {
    if (!subjectErrors[sid]) subjectErrors[sid] = [];
    subjectErrors[sid].push(Math.abs(data.residuals[i]));
  });

  const sids = Object.keys(subjectErrors).sort((a, b) => parseInt(a) - parseInt(b));
  const maes = sids.map(sid => {
    const arr = subjectErrors[sid];
    return parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2));
  });

  chartValSubjectPerf = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sids.map(s => `Subject ${s}`),
      datasets: [{
        label: "Held-Out Subject MAE (ng/mL)",
        data: maes,
        backgroundColor: "rgba(14, 165, 233, 0.7)",
        borderColor: "#0ea5e9",
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#94a3b8" } }
      },
      scales: {
        x: {
          ticks: { color: "#94a3b8", font: { size: 10 } },
          grid: { display: false }
        },
        y: {
          title: { display: true, text: "MAE (ng/mL)", color: "#94a3b8" },
          ticks: { color: "#94a3b8" },
          grid: { color: "#1e3156" }
        }
      }
    }
  });
}
