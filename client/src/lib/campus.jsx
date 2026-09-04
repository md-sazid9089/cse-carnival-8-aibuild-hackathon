import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { clearAuth, getStoredToken, getStoredUser, setProfile as setApiProfile } from "../api.js";
import { useApi } from "../hooks.js";
import { toIso } from "./format.js";

/** Demo identities for visitors who have not signed in. Identity is then asserted by the
 *  client, which the API mirrors back through X-Student-Id / X-Student-Name; a signed-in
 *  account replaces it with a server-issued token. */
export const PROFILES = [
  { student_id: "20-40532", name: "Sakibul Hassan" },
  { student_id: "20-40511", name: "Farhan Ahmed" },
  { student_id: "21-41205", name: "Rafi Hossain" },
];

const PROFILE_KEY = "campusos-profile";
const CampusContext = createContext(null);

function loadProfile() {
  try {
    const saved = localStorage.getItem(PROFILE_KEY);
    return PROFILES.find((p) => p.student_id === saved) ?? PROFILES[0];
  } catch {
    return PROFILES[0];
  }
}

/** The stored user only counts as an account while a token backs it. */
function loadAccount() {
  return getStoredToken() ? getStoredUser() : null;
}

export function CampusProvider({ children }) {
  const [account, setAccount] = useState(loadAccount);
  const [demoProfile, setProfileState] = useState(loadProfile);
  // Set before first render effects so the very first request carries the identity.
  const [ready] = useState(() => {
    if (!loadAccount()) setApiProfile(loadProfile());
    return true;
  });

  useEffect(() => {
    const onAuthChange = () => {
      const next = loadAccount();
      setAccount(next);
      if (!next) setApiProfile(loadProfile());
    };
    window.addEventListener("campusos:auth_change", onAuthChange);
    return () => window.removeEventListener("campusos:auth_change", onAuthChange);
  }, []);

  const meta = useApi("/api/meta");
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    meta.refresh();
    // Re-reading the campus clock each minute keeps "today"/"now" honest during a long demo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const setProfile = (next) => {
    setApiProfile(next);
    setProfileState(next);
    try {
      localStorage.setItem(PROFILE_KEY, next.student_id);
    } catch {
      /* private mode */
    }
  };

  const profile = account
    ? { student_id: account.student_id ?? "", name: account.name, role: account.role_id }
    : demoProfile;

  const value = useMemo(() => {
    const local = new Date();
    return {
      ready,
      profile,
      setProfile,
      account,
      signOut: clearAuth,
      // Server clock (campus timezone) with a local fallback so the UI still renders offline.
      today: meta.data?.today ?? toIso(local),
      weekday: meta.data?.weekday ?? local.toLocaleDateString(undefined, { weekday: "long" }),
      nowTime: meta.data?.now ? meta.data.now.slice(11, 16) : `${String(local.getHours()).padStart(2, "0")}:${String(local.getMinutes()).padStart(2, "0")}`,
      timezone: meta.data?.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, account, meta.data, ready, tick]);

  return <CampusContext.Provider value={value}>{children}</CampusContext.Provider>;
}

export function useCampus() {
  const context = useContext(CampusContext);
  if (!context) throw new Error("useCampus must be used inside <CampusProvider>");
  return context;
}
