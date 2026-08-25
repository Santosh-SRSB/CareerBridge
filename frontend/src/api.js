const BASE = "/api";

function getToken() {
  return localStorage.getItem("token");
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new Error("Could not reach the backend. Make sure it is running (backend folder, npm start).");
  }

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(apiErrorMessage(res.status, data.error, path));
  }
  return data;
}

function apiErrorMessage(status, error, path) {
  if (status === 401) return "Your session expired. Please log in again.";
  if (status === 403) return "You do not have permission to change this resume.";
  if (status === 404) {
    if (String(path).includes("rewrite")) {
      return error && error !== "Not found."
        ? error
        : "Rewrite endpoint is unavailable. Restart the backend (cd backend && npm start) and try again.";
    }
    return error || "Resume not found.";
  }
  if (status === 400) return error || "Invalid rewrite request.";
  if (status >= 500) return error || "Backend/server error. Please try again.";
  return error || `Request failed (${status})`;
}

export const api = {
  register: (name, email, password) =>
    request("/auth/register", { method: "POST", body: { name, email, password }, auth: false }),
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: { email, password }, auth: false }),

  templates: () => request("/resumes/templates", { auth: false }),

  listResumes: () => request("/resumes"),
  getResume: (id) => request(`/resumes/${id}`),
  createResume: (payload) => request("/resumes", { method: "POST", body: payload }),
  updateResume: (id, payload) => request(`/resumes/${id}`, { method: "PUT", body: payload }),
  deleteResume: (id) => request(`/resumes/${id}`, { method: "DELETE" }),
  analyzeResume: (payload) => request("/resumes/analyze", { method: "POST", body: payload }),
  rewriteResume: (id, payload) =>
    request(`/resumes/${id}/rewrite`, { method: "POST", body: payload }),
};

export function saveSession(token, user) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function getCurrentUser() {
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}
