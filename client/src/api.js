const STORAGE_USER_KEY = "campusos_user";
const STORAGE_TOKEN_KEY = "campusos_token";

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
    return raw ? JSON.parse(raw) : DEFAULT_USER;
  } catch {
    return DEFAULT_USER;
  }
}

function loadStoredToken() {
  try {
    return localStorage.getItem(STORAGE_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

let currentUser = loadStoredUser();
let currentToken = loadStoredToken();
let currentProfile = {
  student_id: currentUser?.student_id || DEFAULT_USER.student_id,
  name: currentUser?.name || DEFAULT_USER.name,
  role: currentUser?.role_id || DEFAULT_USER.role_id,
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
  setAuth(DEFAULT_USER, "");
}

async function request(method, path, body) {
  const headers = {};
  if (currentToken) {
    headers["Authorization"] = `Bearer ${currentToken}`;
  }
  if (currentProfile.student_id) {
    headers["X-Student-Id"] = currentProfile.student_id;
  }
  if (currentProfile.name) {
    headers["X-Student-Name"] = currentProfile.name;
  }
  if (currentUser?.role_id || currentProfile.role) {
    headers["X-Role"] = currentUser?.role_id || currentProfile.role || "student";
  }
  if (body) headers["Content-Type"] = "application/json";

  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.error || `HTTP ${res.status}`);
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

