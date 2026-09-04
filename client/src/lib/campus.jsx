import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { clearAuth, getStoredToken, getStoredUser } from "../api.js";
import { useApi } from "../hooks.js";
import { toIso } from "./format.js";

const CampusContext = createContext(null);

/** The stored user only counts as an account while a token backs it. */
function loadAccount() {
  return getStoredToken() ? getStoredUser() : null;
}

export function CampusProvider({ children }) {
  const [account, setAccount] = useState(loadAccount);

  useEffect(() => {
    const onAuthChange = () => setAccount(loadAccount());
    window.addEventListener("campusos:auth_change", onAuthChange);
    return () => window.removeEventListener("campusos:auth_change", onAuthChange);
  }, []);

  const meta = useApi("/api/meta");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((value) => value + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Re-read the campus clock each minute so "today"/"now" stay honest during a
  // long session. Skipped on mount — useApi has already fetched it once.
  useEffect(() => {
    if (tick === 0) return;
    meta.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const profile = useMemo(
    () => ({
      student_id: account?.student_id ?? "",
      name: account?.name ?? "",
      role: account?.role_id ?? "",
    }),
    [account],
  );

  const value = useMemo(() => {
    const local = new Date();
    return {
      profile,
      account,
      signOut: clearAuth,
      // Server clock (campus timezone) with a local fallback so the UI still renders offline.
      today: meta.data?.today ?? toIso(local),
      weekday: meta.data?.weekday ?? local.toLocaleDateString(undefined, { weekday: "long" }),
      nowTime: meta.data?.now ? meta.data.now.slice(11, 16) : `${String(local.getHours()).padStart(2, "0")}:${String(local.getMinutes()).padStart(2, "0")}`,
      timezone: meta.data?.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, account, meta.data, tick]);

  return <CampusContext.Provider value={value}>{children}</CampusContext.Provider>;
}

export function useCampus() {
  const context = useContext(CampusContext);
  if (!context) throw new Error("useCampus must be used inside <CampusProvider>");
  return context;
}
