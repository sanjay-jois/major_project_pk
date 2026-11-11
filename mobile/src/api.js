import { DEFAULT_API_HOST } from "./config";

let apiBaseUrl = DEFAULT_API_HOST;

export const setApiBaseUrl = (url) => {
  apiBaseUrl = url.endsWith("/api") ? url : `${url.replace(/\/$/, "")}/api`;
};

export const getApiBaseUrl = () => apiBaseUrl;

const request = async (endpoint, options = {}) => {
  const url = `${apiBaseUrl}${endpoint}`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...options.headers
      },
      ...options
    });

    if (!res.ok) {
      let message = `HTTP ${res.status}: ${res.statusText}`;
      try {
        const json = await res.json();
        if (json && json.detail) message = json.detail;
      } catch (_) {}
      throw new Error(message);
    }

    return await res.json();
  } catch (err) {
    console.error(`Mobile API Error [${endpoint}]:`, err);
    throw err;
  }
};

export const api = {
  getHealth: () => request("/health"),
  getDatasetSummary: () => request("/data/summary"),
  getSubjects: () => request("/subjects"),
  getSubject: (id) => request(`/subjects/${id}`),
  getModels: () => request("/models"),
  getLeaderboard: () => request("/models/leaderboard"),
  predictTrajectory: (payload) => request("/predict", {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  simulatePK: (payload) => request("/pk/simulate", {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  getValidationPlots: (model = null) => {
    const q = model ? `?model=${encodeURIComponent(model)}` : "";
    return request(`/validation/plots${q}`);
  }
};
