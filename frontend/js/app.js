/**
 * frontend/js/app.js — Application Lifecycle, Sidebar Navigation, and Page Switcher.
 */

document.addEventListener("DOMContentLoaded", async () => {
  setupNavigation();
  setupSidebarToggle();
  await checkBackendStatus();

  // Register PWA service worker if supported
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/static/sw.js").catch(() => {});
  }

  // Initialize initial active page (Overview)
  if (typeof initDashboard === "function") {
    await initDashboard();
  }

  // Periodic heartbeat
  setInterval(checkBackendStatus, 30000);
});

function setupSidebarToggle() {
  const toggleBtn = document.getElementById("btn-toggle-sidebar");
  const sidebar = document.getElementById("sidebar");

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
      // Trigger chart resize after layout transition
      setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, 260);
    });
  }
}

function setupNavigation() {
  const allNavItems = document.querySelectorAll(".nav-item, .mobile-nav-item");
  const views = document.querySelectorAll(".page-section");

  const switchTab = (targetViewId) => {
    // Update all matching navigation items (both desktop sidebar and mobile bottom nav)
    allNavItems.forEach(n => {
      if (n.getAttribute("data-view") === targetViewId) {
        n.classList.add("active");
      } else {
        n.classList.remove("active");
      }
    });

    // Update Visible Page View
    views.forEach(v => {
      if (v.id === targetViewId) {
        v.classList.add("active");
      } else {
        v.classList.remove("active");
      }
    });

    // Update Topbar Heading
    updatePageTitle(targetViewId);

    // Lazy-initialize page controllers
    handleViewSwitch(targetViewId);

    // Redraw charts after view becomes visible
    setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 50);
  };

  allNavItems.forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const targetViewId = item.getAttribute("data-view");
      switchTab(targetViewId);
    });
  });
}

function updatePageTitle(viewId) {
  const titleEl = document.getElementById("current-page-title");
  const descEl = document.getElementById("current-page-desc");

  const titles = {
    "view-overview": {
      title: "Overview Dashboard",
      desc: "Pharmacokinetic modeling summary, cohort distributions, and baseline comparison"
    },
    "view-dataset": {
      title: "Dataset Explorer",
      desc: "Clinical CSV upload, schema verification, data quality audit, and preview"
    },
    "view-trajectory": {
      title: "TCI Trajectory Simulation",
      desc: "Target-controlled infusion curves with 95% split-conformal uncertainty intervals"
    },
    "view-leaderboard": {
      title: "Model Leaderboard",
      desc: "Comparative benchmark across 8 machine learning residual model families"
    },
    "view-validation": {
      title: "Validation & Conformal Uncertainty",
      desc: "Subject-wise GroupShuffleSplit protocol, residual diagnostics, and calibration"
    },
    "view-greybox": {
      title: "Grey-Box Pharmacokinetic Model",
      desc: "Minto (1997) 3-compartment ODE equations, micro-rate parameters, and live solver"
    }
  };

  const info = titles[viewId] || titles["view-overview"];
  if (titleEl) titleEl.textContent = info.title;
  if (descEl) descEl.textContent = info.desc;
}

function handleViewSwitch(viewId) {
  if (viewId === "view-overview" && typeof initDashboard === "function") {
    initDashboard();
  } else if (viewId === "view-dataset" && typeof initDatasetExplorer === "function") {
    initDatasetExplorer();
  } else if (viewId === "view-trajectory" && typeof initTrajectoryPage === "function") {
    initTrajectoryPage();
  } else if (viewId === "view-leaderboard" && typeof initLeaderboardPage === "function") {
    initLeaderboardPage();
  } else if (viewId === "view-validation" && typeof initValidationPage === "function") {
    initValidationPage();
  } else if (viewId === "view-greybox" && typeof initGreyboxPage === "function") {
    initGreyboxPage();
  }
}

async function checkBackendStatus() {
  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");

  try {
    const health = await window.api.getHealth();
    if (health.status === "online") {
      if (statusDot) statusDot.className = "status-dot";
      if (statusText) statusText.textContent = "Backend Online";
    }
  } catch (err) {
    if (statusDot) statusDot.className = "status-dot offline";
    if (statusText) statusText.textContent = "Backend Offline";
  }
}
