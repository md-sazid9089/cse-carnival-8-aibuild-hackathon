// Deployed frontend (e.g. Vercel) points at the hosted backend; empty = same-origin/Vite proxy
export const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

const STORAGE_USER_KEY = "campusos_user";
const STORAGE_TOKEN_KEY = "campusos_token";

// Same-origin: Vite proxies /api in dev, FastAPI serves the built client in prod.
export const API_BASE = "";

const DEFAULT_USER = {
  id: "usr-001",
  student_id: "20-40532",
  name: "Sakibul Hassan",
  email: "sakibul.hassan@aust.edu",
  role_id: "student",
  department: "CSE",
  permissions: [
    "schedules:view",
    "rooms:view",
    "rooms:book",
    "rooms:cancel_own",
    "events:view",
    "events:register",
    "events:cancel_own",
    "announcements:view",
    "assignments:view",
    "assignments:submit",
  ],
};

function loadStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function loadStoredToken() {
  try {
    return localStorage.getItem(STORAGE_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

let currentToken = loadStoredToken();
// A stored user only counts while a token backs it — there is no anonymous identity.
let currentUser = currentToken ? loadStoredUser() : null;
let currentProfile = {
  student_id: currentUser?.student_id || "",
  name: currentUser?.name || "",
  role: currentUser?.role_id || "",
};

export function getStoredUser() {
  return currentUser;
}

export function getStoredToken() {
  return currentToken;
}

export function setProfile(p) {
  currentProfile = { ...currentProfile, ...p };
}

export function setAuth(user, token) {
  currentUser = user;
  currentToken = token || "";
  currentProfile = {
    student_id: user?.student_id || "",
    name: user?.name || "User",
    role: user?.role_id || "student",
  };
  try {
    if (user) localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_USER_KEY);
    if (token) localStorage.setItem(STORAGE_TOKEN_KEY, token);
    else localStorage.removeItem(STORAGE_TOKEN_KEY);
  } catch {
    // Ignore storage errors in restricted contexts
  }
  window.dispatchEvent(new CustomEvent("campusos:auth_change", { detail: { user, token } }));
}

export function clearAuth() {
  setAuth(null, "");
}

/** Identity headers for every call: a signed token when present, plus the acting profile. */
export function authHeaders() {
  const headers = {};
  if (currentToken) headers["Authorization"] = `Bearer ${currentToken}`;
  if (currentProfile.student_id) headers["X-Student-Id"] = currentProfile.student_id;
  if (currentProfile.name) headers["X-Student-Name"] = currentProfile.name;
  return headers;
}

/** FastAPI 422 bodies carry an array of validation objects; 5xx bodies can carry
 *  internal detail. Turn both into one sentence a user can act on. */
function readError(status, data) {
  if (Array.isArray(data?.detail)) return data.detail.map((d) => d?.msg ?? "Invalid value").join(", ");
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.error === "string" && status < 500) return data.error;
  if (status >= 500) return "The campus server had a problem. Please try again.";
  return `Request failed (${status})`;
}

const TIMEOUT_MS = 20000;

async function request(method, path, body) {
  const headers = authHeaders();
  if (body) headers["Content-Type"] = "application/json";

  // Without a deadline a stalled connection leaves dialogs stuck in "Saving…".
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") throw new Error("The campus server did not respond in time.");
    throw new Error("Could not reach the campus server. Check that the backend is running.");
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(readError(res.status, data));
  return data;
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body),
  put: (path, body) => request("PUT", path, body),
  del: (path) => request("DELETE", path),
  signin: (credentials) => request("POST", "/api/auth/signin", credentials),
  signup: (userData) => request("POST", "/api/auth/signup", userData),
  getMe: () => request("GET", "/api/auth/me"),
  getUsers: () => request("GET", "/api/auth/users"),
};

export function toast(message, kind = "info") {
  window.dispatchEvent(new CustomEvent("toast", { detail: { message, kind } }));
}

