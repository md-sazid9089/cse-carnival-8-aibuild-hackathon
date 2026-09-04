import { createContext, useContext } from "react";

export type Navigate = (path: string) => void;

const NavigateContext = createContext<Navigate>((path) => {
  window.location.assign(path);
});

export const NavigateProvider = NavigateContext.Provider;

export function useNavigate() {
  return useContext(NavigateContext);
}

/** Smooth-scrolls to an in-page anchor without a hard jump, honoring reduced motion. */
export function scrollToHash(hash: string) {
  const el = document.querySelector<HTMLElement>(hash);
  if (!el) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
}
