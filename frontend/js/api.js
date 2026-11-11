/**
 * frontend/js/api.js — Centralized API Client.
 * Automatically defaults to window.location.origin when served by FastAPI,
 * or http://127.0.0.1:8000 when served standalone.
 */
const API_BASE_URL = (window.location.port === "5173" || window.location.port === "3000")
  ? "http://127.0.0.1:8000/api"
  : "/api";

class ApiService {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    try {
      const response = await fetch(url, {
        headers: {
          "Accept": "application/json",
          ...options.headers
        },
        ...options
      });

      if (!response.ok) {
        let errMessage = `HTTP error ${response.status}: ${response.statusText}`;
        try {
          const errData = await response.json();
          if (errData && errData.detail) errMessage = errData.detail;
        } catch (_) {}
        throw new Error(errMessage);
      }

      return await response.json();
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  }

  getHealth() {
    return this.request("/health");
  }

  getDatasetSummary() {
    return this.request("/data/summary");
  }

  getDataPreview(page = 1, pageSize = 50, subjectId = null) {
    const params = new URLSearchParams({ page, page_size: pageSize });
    if (subjectId !== null && subjectId !== undefined && subjectId !== "") {
      params.append("subject_id", subjectId);
    }
    return this.request(`/data/preview?${params.toString()}`);
  }

  uploadDataset(file) {
    const formData = new FormData();
    formData.append("file", file);
    return fetch(`${this.baseUrl}/data/upload`, {
      method: "POST",
      body: formData
    }).then(res => res.json());
  }

  getSubjects() {
    return this.request("/subjects");
  }

  getSubject(subjectId) {
    return this.request(`/subjects/${subjectId}`);
  }

  getModels() {
    return this.request("/models");
  }

  getLeaderboard() {
    return this.request("/models/leaderboard");
  }

  trainModels(payload = {}) {
    return this.request("/models/train", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }

  predictTrajectory(payload) {
    return this.request("/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }

  simulatePK(payload) {
    return this.request("/pk/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }

  getValidationSummary(model = null) {
    const url = model ? `/validation?model=${encodeURIComponent(model)}` : "/validation";
    return this.request(url);
  }

  getValidationPlots(model = null) {
    const url = model ? `/validation/plots?model=${encodeURIComponent(model)}` : "/validation/plots";
    return this.request(url);
  }

  getDownloadUrl() {
    return `${this.baseUrl}/data/download`;
  }
}

window.api = new ApiService(API_BASE_URL);
