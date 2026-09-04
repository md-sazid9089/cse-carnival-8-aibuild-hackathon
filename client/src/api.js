// Deployed frontend (e.g. Vercel) points at the hosted backend; empty = same-origin/Vite proxy
export const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

const STORAGE_USER_KEY = "campusos_user";
const STORAGE_TOKEN_KEY = "campusos_token";

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

export function getStoredUser() {
  return currentUser;
}

export function getStoredToken() {
  return currentToken;
}

export function setAuth(user, token) {
  currentUser = user;
  currentToken = token || "";
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

/** The session token is the only thing that identifies a caller; the server ignores
 *  anything the client claims about itself. */
export function authHeaders() {
  return currentToken ? { Authorization: `Bearer ${currentToken}` } : {};
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
  // An expired or revoked session must drop us back to sign-in, not fail every panel silently.
  if (res.status === 401 && currentToken) clearAuth();
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
};

export function toast(message, kind = "info") {
  window.dispatchEvent(new CustomEvent("toast", { detail: { message, kind } }));
}

