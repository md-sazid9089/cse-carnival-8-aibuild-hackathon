import { useCallback, useEffect, useRef, useState } from "react";
import { cx } from "../lib/format.js";
import { Alert, CheckCircle, Info, X } from "../lib/icons.jsx";

const KINDS = {
  success: { icon: CheckCircle, className: "text-positive", noun: "Success" },
  error: { icon: Alert, className: "text-critical", noun: "Error" },
  info: { icon: Info, className: "text-accent", noun: "Note" },
};

const DURATION = 5000;

export default function Toast() {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const clearTimer = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const dismiss = useCallback(
    (id) => {
      clearTimer(id);
      setToasts((list) => list.filter((t) => t.id !== id));
    },
    [clearTimer],
  );

  // Errors stay until dismissed: they are the ones worth reading twice.
  const schedule = useCallback(
    (toast) => {
      if (toast.kind === "error") return;
      clearTimer(toast.id);
      timers.current.set(toast.id, setTimeout(() => dismiss(toast.id), DURATION));
    },
    [clearTimer, dismiss],
  );

  useEffect(() => {
    const handler = (event) => {
      const toast = { id: `${Date.now()}-${Math.random()}`, ...event.detail };
      setToasts((list) => {
        // Cap the stack so a burst of live updates cannot bury the UI.
        const dropped = list.slice(0, Math.max(0, list.length - 2));
        dropped.forEach((t) => clearTimer(t.id));
        return [...list.slice(-2), toast];
      });
      schedule(toast);
    };
    window.addEventListener("toast", handler);
    const pending = timers.current;
    return () => {
      window.removeEventListener("toast", handler);
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, [clearTimer, schedule]);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-60 flex flex-col items-center gap-2 px-4"
      role="region"
      aria-label="Notifications"
    >
      {/* Always mounted so assistive tech announces text written into it. */}
      <p className="sr-only" role="status" aria-live="polite">
        {toasts.map((t) => `${KINDS[t.kind]?.noun ?? "Note"}: ${t.message}`).join(". ")}
      </p>

      {toasts.map((toast) => {
        const kind = KINDS[toast.kind] ?? KINDS.info;
        const Icon = kind.icon;
        return (
          <div
            key={toast.id}
            onMouseEnter={() => clearTimer(toast.id)}
            onMouseLeave={() => schedule(toast)}
            onFocusCapture={() => clearTimer(toast.id)}
            onBlurCapture={() => schedule(toast)}
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
