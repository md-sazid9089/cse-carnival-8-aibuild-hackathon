import { useCallback, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { cx } from "../lib/format.js";
import { X } from "../lib/icons.jsx";
import { IconButton } from "./ui.jsx";

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog: focus trap, focus restore, Esc to dismiss, scroll lock,
 * and a bottom-sheet presentation on small screens.
 */
export default function Modal({
  open = true,
  title,
  description,
  onClose,
  children,
  footer,
  size = "md",
  initialFocusRef,
}) {
  const panelRef = useRef(null);
  const restoreRef = useRef(null);
  const headingId = useId();
  const descId = useId();

  const focusables = useCallback(
    () => Array.from(panelRef.current?.querySelectorAll(FOCUSABLE) ?? []).filter((el) => el.offsetParent !== null),
    [],
  );

  useEffect(() => {
    if (!open) return undefined;
    restoreRef.current = document.activeElement;

    const { overflow, paddingRight } = document.body.style;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;

    const target = initialFocusRef?.current ?? focusables()[0] ?? panelRef.current;
    // Wait a frame so the entrance animation does not fight the scroll-into-view.
    const raf = requestAnimationFrame(() => target?.focus({ preventScroll: true }));

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose?.();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panelRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      restoreRef.current?.focus?.({ preventScroll: true });
    };
  }, [open, onClose, focusables, initialFocusRef]);

  if (!open) return null;

  const width = { sm: "sm:max-w-sm", md: "sm:max-w-lg", lg: "sm:max-w-2xl" }[size];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-overlay animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? headingId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cx(
          "relative flex max-h-[92vh] w-full flex-col overflow-hidden bg-surface shadow-lg animate-sheet",
          "rounded-t-2xl sm:rounded-2xl border border-line",
          width,
        )}
      >
        {title ? (
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <h2 id={headingId} className="truncate text-base font-semibold text-ink">
                {title}
              </h2>
              {description ? (
                <p id={descId} className="mt-0.5 text-[13px] text-ink-3">
                  {description}
                </p>
              ) : null}
            </div>
            <IconButton icon={X} label="Close dialog" onClick={onClose} className="-mr-1.5 -mt-1" />
          </header>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-line bg-surface-2 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
