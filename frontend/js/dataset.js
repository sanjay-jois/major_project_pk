/**
 * frontend/js/dataset.js — Dataset Explorer, CSV Upload, Data Quality & Preview.
 */

let datasetCurrentPage = 1;
const datasetPageSize = 25;
let datasetTotalRows = 0;

async function initDatasetExplorer() {
  setupUploadHandlers();
  await loadDatasetSummary();
  await loadSubjectsDropdown();
  await loadDatasetPreview(1);
}

function setupUploadHandlers() {
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("csv-file-input");

  if (!dropZone || !fileInput) return;

  dropZone.addEventListener("click", () => fileInput.click());

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("drag-over");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  });

  const subjectFilter = document.getElementById("select-subject-filter");
  if (subjectFilter) {
    subjectFilter.addEventListener("change", () => {
      datasetCurrentPage = 1;
      loadDatasetPreview(1);
    });
  }

  const btnDownload = document.getElementById("btn-download-csv");
  if (btnDownload) {
    btnDownload.addEventListener("click", () => {
      window.location.href = window.api.getDownloadUrl();
    });
  }
}

async function handleFileUpload(file) {
  const statusEl = document.getElementById("upload-status");
  statusEl.innerHTML = `<span class="spinner"></span> Validating and uploading ${file.name}...`;
  statusEl.style.display = "block";

  try {
    const res = await window.api.uploadDataset(file);
    if (res.status === "error" || !res.validation.is_valid) {
      statusEl.className = "alert alert-danger";
      statusEl.innerHTML = `<strong>Upload Failed:</strong> ${res.validation.errors.join("<br>")}`;
    } else {
      statusEl.className = "alert alert-success";
      let msg = `<strong>Upload Successful!</strong> Loaded ${res.summary.total_rows} records across ${res.summary.total_subjects} subjects.`;
      if (res.validation.warnings && res.validation.warnings.length > 0) {
        msg += `<br><small>Warnings: ${res.validation.warnings.join("; ")}</small>`;
      }
      statusEl.innerHTML = msg;

      // Refresh explorer views
      await loadDatasetSummary();
      await loadSubjectsDropdown();
      await loadDatasetPreview(1);
      // Refresh dashboard
      if (typeof initDashboard === "function") initDashboard();
    }
  } catch (err) {
    statusEl.className = "alert alert-danger";
    statusEl.innerHTML = `<strong>Error:</strong> ${err.message}`;
  }
}

async function loadDatasetSummary() {
  try {
    const summary = await window.api.getDatasetSummary();
    renderSummaryStatsTable(summary.numeric_stats || {});
    renderDataQualityPanel(summary);
  } catch (err) {
    console.error("Failed to load dataset summary:", err);
  }
}

function renderSummaryStatsTable(stats) {
  const tbody = document.getElementById("tbody-numeric-stats");
  if (!tbody) return;
  tbody.innerHTML = "";

  const cols = Object.keys(stats);
  if (cols.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;">No numeric data available</td></tr>`;
    return;
  }

  cols.forEach(col => {
    const s = stats[col];
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${col}</strong></td>
      <td>${s.count}</td>
      <td>${s.mean}</td>
      <td>${s.std}</td>
      <td>${s.min}</td>
      <td>${s.p25}</td>
      <td>${s.median}</td>
      <td>${s.p75}</td>
      <td>${s.max}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderDataQualityPanel(summary) {
  const qualityList = document.getElementById("quality-checklist");
  if (!qualityList) return;

  const missingConc = summary.missing_values ? (summary.missing_values.conc || 0) : 0;
  const infCount = summary.infinite_values ? Object.values(summary.infinite_values).reduce((a, b) => a + b, 0) : 0;
  const duplicates = summary.duplicates_count || 0;

  qualityList.innerHTML = `
    <li class="quality-item ok">
      <span class="icon">✓</span>
      <span><strong>Subject Count:</strong> ${summary.total_subjects} unique cohorts</span>
    </li>
    <li class="quality-item ok">
      <span class="icon">✓</span>
      <span><strong>Row Dimensions:</strong> ${summary.total_rows} recorded event rows</span>
    </li>
    <li class="quality-item ${duplicates === 0 ? 'ok' : 'warn'}">
      <span class="icon">${duplicates === 0 ? '✓' : '⚠'}</span>
      <span><strong>Duplicate Rows:</strong> ${duplicates} duplicate entries found</span>
    </li>
    <li class="quality-item ${infCount === 0 ? 'ok' : 'bad'}">
      <span class="icon">${infCount === 0 ? '✓' : '✗'}</span>
      <span><strong>Infinite Values:</strong> ${infCount} non-finite entries</span>
    </li>
    <li class="quality-item info">
      <span class="icon">ℹ</span>
      <span><strong>Dosing Markers (blank conc):</strong> ${missingConc} bolus/infusion initial events (standard NONMEM protocol)</span>
    </li>
  `;
}

async function loadSubjectsDropdown() {
  const select = document.getElementById("select-subject-filter");
  const trajSelect = document.getElementById("traj-select-subject");
  if (!select) return;

  try {
    const subs = await window.api.getSubjects();
    let optionsHtml = `<option value="">All Subjects (${subs.length})</option>`;
    let trajOptionsHtml = `<option value="">Custom Regimen & Patient</option>`;

    subs.forEach(s => {
      const label = `Subject ${s.subject_id} (${s.sex}, ${s.age}y, ${s.weight}kg, ${s.observations_count} pts)`;
      optionsHtml += `<option value="${s.subject_id}">${label}</option>`;
      trajOptionsHtml += `<option value="${s.subject_id}">${label}</option>`;
    });

    select.innerHTML = optionsHtml;
    if (trajSelect) trajSelect.innerHTML = trajOptionsHtml;
  } catch (err) {
    console.error("Failed to load subjects:", err);
  }
}

async function loadDatasetPreview(page = 1) {
  const subjectId = document.getElementById("select-subject-filter") ? document.getElementById("select-subject-filter").value : null;
  const tbody = document.getElementById("tbody-data-preview");
  const thead = document.getElementById("thead-data-preview");
  const pageIndicator = document.getElementById("dataset-page-info");

  if (!tbody || !thead) return;

  tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;"><span class="spinner"></span> Loading preview...</td></tr>`;

  try {
    const res = await window.api.getDataPreview(page, datasetPageSize, subjectId);
    datasetTotalRows = res.total_rows;
    datasetCurrentPage = res.page;

    // Render Table Header
    thead.innerHTML = "";
    const trHead = document.createElement("tr");
    res.columns.forEach(col => {
      const th = document.createElement("th");
      th.textContent = col;
      trHead.appendChild(th);
    });
    thead.appendChild(trHead);

    // Render Table Rows
    tbody.innerHTML = "";
    if (res.rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${res.columns.length}" style="text-align:center;">No records found.</td></tr>`;
      return;
    }

    res.rows.forEach(r => {
      const tr = document.createElement("tr");
      res.columns.forEach(col => {
        const td = document.createElement("td");
        const val = r[col];
        td.textContent = (val === null || val === undefined) ? "—" : val;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    // Update pagination indicator
    const totalPages = Math.ceil(datasetTotalRows / datasetPageSize) || 1;
    if (pageIndicator) {
      pageIndicator.textContent = `Page ${datasetCurrentPage} of ${totalPages} (${datasetTotalRows.toLocaleString()} rows)`;
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="12" style="text-align:center; color:var(--rose-danger);">Error loading data: ${err.message}</td></tr>`;
  }
}

function prevDatasetPage() {
  if (datasetCurrentPage > 1) {
    loadDatasetPreview(datasetCurrentPage - 1);
  }
}

function nextDatasetPage() {
  const totalPages = Math.ceil(datasetTotalRows / datasetPageSize) || 1;
  if (datasetCurrentPage < totalPages) {
    loadDatasetPreview(datasetCurrentPage + 1);
  }
}
