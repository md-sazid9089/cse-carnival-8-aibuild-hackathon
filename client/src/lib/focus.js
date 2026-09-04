import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Shared overlay behaviour: focus save/restore, Tab cycling inside the panel,
 * Escape to dismiss and body scroll lock.
 *
 * `onClose` is held in a ref on purpose — callers pass inline arrows, and this
 * app re-renders constantly from live data. Depending on the callback identity
 * would tear the trap down mid-interaction and steal focus from the user.
 */
export function useFocusTrap({ active, containerRef, onClose, initialFocusRef, lockScroll = true }) {
  const closeRef = useRef(onClose);
  const initialRef = useRef(initialFocusRef);
  closeRef.current = onClose;
  initialRef.current = initialFocusRef;

  useEffect(() => {
    if (!active) return undefined;
    const container = containerRef.current;
    const restoreTo = document.activeElement;

    let unlock = () => {};
    if (lockScroll) {
      const { overflow, paddingRight } = document.body.style;
      const gap = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = "hidden";
      if (gap > 0) document.body.style.paddingRight = `${gap}px`;
      unlock = () => {
        document.body.style.overflow = overflow;
        document.body.style.paddingRight = paddingRight;
      };
    }

    const focusables = () =>
      Array.from(container?.querySelectorAll(FOCUSABLE) ?? []).filter((el) => el.offsetParent !== null);

    const focusTarget = () => initialRef.current?.current ?? focusables()[0] ?? container;
    // Focus immediately so it works even when rAF is throttled (background tab),
    // then once more after the entrance animation settles the layout.
    focusTarget()?.focus({ preventScroll: true });
    const raf = requestAnimationFrame(() => {
      if (!container?.contains(document.activeElement)) focusTarget()?.focus({ preventScroll: true });
    });

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        // A native select swallows Escape to close its own popup; dismissing the
        // dialog too would silently discard the form.
        if (event.target?.tagName === "SELECT") return;
        event.stopImmediatePropagation();
        closeRef.current?.();
        return;
      }
      if (event.key !== "Tab" || !container) return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active_ = document.activeElement;
      if (event.shiftKey && (active_ === first || !container.contains(active_))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active_ === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown, true);
      unlock();
      // The trigger may be gone (the row it lived in was just deleted); falling
      // back to <main> keeps the user somewhere sensible instead of <body>.
      const target = restoreTo && document.contains(restoreTo) ? restoreTo : document.getElementById("main");
      target?.focus?.({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, lockScroll]);
}
