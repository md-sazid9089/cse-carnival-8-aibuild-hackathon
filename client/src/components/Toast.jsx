import { useCallback, useEffect, useRef, useState } from "react";
import { cx } from "../lib/format.js";
import { Alert, CheckCircle, Info, X } from "../lib/icons.jsx";

const KINDS = {
  success: { icon: CheckCircle, className: "text-positive" },
  error: { icon: Alert, className: "text-critical" },
  info: { icon: Info, className: "text-accent" },
};

const DURATION = 4200;

export default function Toast() {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const handler = (event) => {
      const id = `${Date.now()}-${Math.random()}`;
      // Cap the stack so a burst of SSE-driven writes cannot bury the UI.
      setToasts((list) => [...list.slice(-2), { id, ...event.detail }]);
      timers.current.set(id, setTimeout(() => dismiss(id), DURATION));
    };
    window.addEventListener("toast", handler);
    const pending = timers.current;
    return () => {
      window.removeEventListener("toast", handler);
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, [dismiss]);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-60 flex flex-col items-center gap-2 px-4"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => {
        const kind = KINDS[toast.kind] ?? KINDS.info;
        const Icon = kind.icon;
        return (
          <div
            key={toast.id}
            role={toast.kind === "error" ? "alert" : "status"}
            aria-live={toast.kind === "error" ? "assertive" : "polite"}
            className="pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-3 shadow-lg animate-rise"
          >
            <Icon size={17} className={cx("mt-px", kind.className)} />
            <p className="min-w-0 flex-1 text-[13px] leading-snug text-ink">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="-my-1 -mr-1 grid size-7 place-items-center rounded-md text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
