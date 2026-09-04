import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE, api } from "./api.js";

/**
 * Live read of an API path. There is no cache anywhere: every mount and every
 * change event re-reads the database, because judges edit data mid-session.
 */
export function useApi(path, { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [staleError, setStaleError] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const alive = useRef(true);
  const ticket = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(
    async (mode = "initial") => {
      if (!enabled) return;
      // A burst of change events fires several reads; only the newest may win.
      const mine = ++ticket.current;
      if (mode === "background") setRefreshing(true);
      try {
        const result = await api.get(path);
        if (!alive.current || mine !== ticket.current) return;
        setData(result);
        setError(null);
        setStaleError(null);
      } catch (err) {
        if (!alive.current || mine !== ticket.current) return;
        const message = err.message || "Could not load data";
        // Never replace a page the user is reading because one refresh blipped.
        if (mode === "background") setStaleError(message);
        else setError(message);
      } finally {
        if (alive.current && mine === ticket.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [path, enabled],
  );

  useEffect(() => {
    if (!enabled) return;
    setLoading(true);
    load("initial");
  }, [load, enabled]);

  const refresh = useCallback(() => load("background"), [load]);

  return { data, error, staleError, loading, refreshing, refresh };
}

/* -------------------------------------------------------------------- SSE */

let source = null;
let closeTimer = null;
const listeners = new Set();
const statusListeners = new Set();
let streamStatus = "connecting";

function setStatus(next) {
  streamStatus = next;
  statusListeners.forEach((fn) => fn(next));
}

function ensureStream() {
  clearTimeout(closeTimer);
  if (source) return;
  setStatus("connecting");
  source = new EventSource(API_BASE + "/api/stream");
  source.onopen = () => setStatus("live");
  source.onerror = () => setStatus(source?.readyState === 2 ? "offline" : "connecting");
  source.onmessage = (event) => {
    setStatus("live");
    try {
      const message = JSON.parse(event.data);
      listeners.forEach((fn) => fn(message));
    } catch {
      /* keep-alive frames are not JSON */
    }
  };
}

/**
 * One EventSource for the whole app — browsers cap concurrent connections per
 * origin and a single page mounts many live views at once. Navigation briefly
 * drops every subscriber, so teardown is deferred rather than immediate.
 */
export function useSSE(entity, onChange) {
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  });
  const key = Array.isArray(entity) ? entity.join(",") : entity;

  useEffect(() => {
    ensureStream();
    const entities = key == null ? null : key.split(",");
    const listener = (message) => {
      if (!entities || entities.includes(message.entity)) cb.current(message);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        closeTimer = setTimeout(() => {
          source?.close();
          source = null;
          setStatus("connecting");
        }, 5000);
      }
    };
  }, [key]);
}

/** "live" | "connecting" | "offline" — so the freshness badge can tell the truth. */
export function useStreamStatus() {
  const [status, setLocal] = useState(streamStatus);
  useEffect(() => {
    statusListeners.add(setLocal);
    setLocal(streamStatus);
    return () => statusListeners.delete(setLocal);
  }, []);
  return status;
}

/* ------------------------------------------------------------------ theme */

const THEME_KEY = "campusos-theme";

export function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme ?? "light");

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* storage can be unavailable in private mode */
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}

/* -------------------------------------------------------------- utilities */

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (event) => setMatches(event.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

/** Debounced mirror of a value — used for type-ahead search. */
export function useDebounced(value, delay = 220) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/** Client-side sort that keeps table headers honest about their state. */
export function useSort(rows, initial = null, columns = []) {
  const [sort, setSort] = useState(initial);

  const sorted = useMemo(() => {
    if (!sort || !rows) return rows;
    const { key, direction } = sort;
    const factor = direction === "desc" ? -1 : 1;
    // Weekday names and other display strings need an explicit ordinal.
    const valueOf = columns.find((c) => c.key === key)?.sortValue ?? ((row) => row[key]);
    return [...rows].sort((a, b) => {
      const av = valueOf(a);
      const bv = valueOf(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * factor;
    });
  }, [rows, sort, columns]);

  const toggle = useCallback((key) => {
    setSort((current) =>
      current?.key === key
        ? current.direction === "asc"
          ? { key, direction: "desc" }
          : null
        : { key, direction: "asc" },
    );
  }, []);

  return { sorted, sort, toggle };
}
