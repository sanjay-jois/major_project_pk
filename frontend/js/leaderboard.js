/**
 * frontend/js/leaderboard.js — Model Leaderboard, Metric Sorting, and Inspection.
 */

let leaderboardData = [];
let currentSortColumn = "MAE";
let isSortAsc = true;

async function initLeaderboardPage() {
  setupLeaderboardHandlers();
  await loadLeaderboard();
}

function setupLeaderboardHandlers() {
  const btnRetrain = document.getElementById("btn-retrain-models");
  if (btnRetrain) {
    btnRetrain.addEventListener("click", () => triggerRetraining());
  }

  // Setup sortable headers
  document.querySelectorAll("#leaderboard-table th.sortable").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.getAttribute("data-col");
      if (currentSortColumn === col) {
        isSortAsc = !isSortAsc;
      } else {
        currentSortColumn = col;
        isSortAsc = (col === "R2" || col.startsWith("accuracy") || col.startsWith("coverage")) ? false : true;
      }
      sortAndRenderLeaderboard();
    });
  });

  // Modal close handlers
  const modalClose = document.getElementById("modal-detail-close");
  if (modalClose) {
    modalClose.addEventListener("click", () => {
      document.getElementById("modal-model-detail").classList.remove("active");
    });
  }
}

async function loadLeaderboard() {
  const tbody = document.getElementById("tbody-leaderboard");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;"><span class="spinner"></span> Loading leaderboard metrics...</td></tr>`;

  try {
    const res = await window.api.getLeaderboard();
    leaderboardData = res.models || [];
    sortAndRenderLeaderboard();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="12" style="text-align:center; color:var(--rose-danger);">Failed to load leaderboard: ${err.message}</td></tr>`;
  }
}

function sortAndRenderLeaderboard() {
  const tbody = document.getElementById("tbody-leaderboard");
  if (!tbody) return;

  if (leaderboardData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;">No trained models found. Click "Retrain Models" to build benchmarks.</td></tr>`;
    return;
  }

  // Sort
  leaderboardData.sort((a, b) => {
    let valA = a[currentSortColumn];
    let valB = b[currentSortColumn];

    if (valA === null || valA === undefined) valA = isSortAsc ? Infinity : -Infinity;
    if (valB === null || valB === undefined) valB = isSortAsc ? Infinity : -Infinity;

    if (typeof valA === "string") {
      return isSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return isSortAsc ? (valA - valB) : (valB - valA);
  });

  tbody.innerHTML = "";
  leaderboardData.forEach((m, idx) => {
    const tr = document.createElement("tr");
    if (m.is_baseline) tr.classList.add("baseline-row");
    if (idx === 0 && !m.is_baseline) tr.classList.add("highlight-row");

    tr.innerHTML = `
      <td><strong>${idx + 1}</strong></td>
      <td>
        <strong>${m.model}</strong>
        ${m.is_baseline ? '<span class="pill-badge" style="margin-left:6px; color:#d8b4fe;">Baseline</span>' : ''}
        ${idx === 0 && !m.is_baseline ? '<span class="pill-badge" style="margin-left:6px; color:var(--cyan-primary);">Top Performer</span>' : ''}
      </td>
      <td><strong>${m.MAE}</strong></td>
      <td>${m.RMSE}</td>
      <td>${m.R2}</td>
      <td>${m.MDPE > 0 ? '+' : ''}${m.MDPE}%</td>
      <td>${m.MDAPE}%</td>
      <td>${m.WAPE}%</td>
      <td>${m.accuracy_10}%</td>
      <td>${m.accuracy_20}%</td>
      <td>${m.coverage_95 !== null ? m.coverage_95 + '%' : '—'}</td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="openModelDetailModal('${m.model}')">Inspect</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openModelDetailModal(modelName) {
  const model = leaderboardData.find(m => m.model === modelName);
  if (!model) return;

  const titleEl = document.getElementById("modal-title");
  if (titleEl) titleEl.textContent = `${model.model} — Model Architecture & Diagnostics`;
  const bodyEl = document.getElementById("modal-body");
  if (bodyEl) {
    bodyEl.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:14px;">
        <p style="color:var(--text-secondary); line-height:1.6;">${model.description || "Grey-box residual regression learner."}</p>
        
        <div class="grid-2" style="margin:10px 0;">
          <div class="card" style="padding:12px;">
            <span style="font-size:11px; color:var(--text-muted); text-transform:uppercase;">Supervised Performance</span>
            <p style="margin-top:6px; font-size:13px;"><strong>MAE:</strong> ${model.MAE} ng/mL</p>
            <p style="font-size:13px;"><strong>RMSE:</strong> ${model.RMSE} ng/mL</p>
            <p style="font-size:13px;"><strong>R² Score:</strong> ${model.R2}</p>
            <p style="font-size:13px;"><strong>Training Latency:</strong> ${model.training_time_sec ? model.training_time_sec + 's' : '<0.1s'}</p>
          </div>

          <div class="card" style="padding:12px;">
            <span style="font-size:11px; color:var(--text-muted); text-transform:uppercase;">Clinical & Conformal Bounds</span>
            <p style="margin-top:6px; font-size:13px;"><strong>Varvel MDPE (Bias):</strong> ${model.MDPE}%</p>
            <p style="font-size:13px;"><strong>Varvel MDAPE:</strong> ${model.MDAPE}%</p>
            <p style="font-size:13px;"><strong>95% Empirical Coverage:</strong> ${model.coverage_95 ? model.coverage_95 + '%' : 'N/A'}</p>
            <p style="font-size:13px;"><strong>Mean Interval Width:</strong> ${model.mean_interval_width ? model.mean_interval_width.toFixed(2) + ' ng/mL' : 'N/A'}</p>
          </div>
        </div>

        <div style="background:var(--bg-card); padding:12px; border-radius:var(--radius-md); font-family:var(--font-mono); font-size:12px; border:1px solid var(--border-subtle);">
          <span style="color:var(--cyan-primary);">// Mathematical Formulation:</span><br>
          r(t) = ln(Observed) - ln(Cp_minto(t))<br>
          Cp_predicted(t) = Cp_minto(t) * exp(lambda * r_hat(t))<br>
          95% Interval: [Cp_hat * exp(-q_0.95), Cp_hat * exp(+q_0.95)]
        </div>
      </div>
    `;
  }

  const modalEl = document.getElementById("modal-model-detail");
  if (modalEl) modalEl.classList.add("active");
}

async function triggerRetraining() {
  const btn = document.getElementById("btn-retrain-models");
  const statusEl = document.getElementById("train-status-indicator");
  btn.disabled = true;
  statusEl.innerHTML = `<span class="spinner"></span> Retraining all 8 models via subject-wise GroupShuffleSplit...`;
  statusEl.style.display = "block";

  try {
    const res = await window.api.trainModels({ test_size: 0.2, random_state: 42 });
    leaderboardData = res.leaderboard || [];
    sortAndRenderLeaderboard();
    statusEl.innerHTML = `<span style="color:var(--emerald-primary);">✓ Models retrained and conformal calibration updated successfully!</span>`;
    setTimeout(() => { statusEl.style.display = "none"; }, 4000);
    // Refresh dashboard and trajectory model selector
    if (typeof initDashboard === "function") initDashboard();
    if (typeof loadModelPicker === "function") loadModelPicker();
  } catch (err) {
    statusEl.innerHTML = `<span style="color:var(--rose-danger);">Training failed: ${err.message}</span>`;
  } finally {
    btn.disabled = false;
  }
}
