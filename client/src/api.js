// Deployed frontend (e.g. Vercel) points at the hosted backend; empty = same-origin/Vite proxy
export const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

let currentProfile = { student_id: "20-40532", name: "Sakibul Hassan" };
export function setProfile(p) {
  currentProfile = p;
}

async function request(method, path, body) {
  const headers = {
    "X-Student-Id": currentProfile.student_id,
    "X-Student-Name": currentProfile.name,
  };
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(API_BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body),
  put: (path, body) => request("PUT", path, body),
  del: (path) => request("DELETE", path),
};

export function toast(message, kind = "info") {
  window.dispatchEvent(new CustomEvent("toast", { detail: { message, kind } }));
}
