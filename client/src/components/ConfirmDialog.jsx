import { useEffect, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import { Button } from "./ui.jsx";

let emit = null;

/**
 * Promise-based replacement for window.confirm — themed, focus-trapped and
 * keyboard-dismissable. Resolves true when the user confirms.
 */
export function confirmAction({ title, message, confirmLabel = "Confirm", tone = "danger" }) {
  if (!emit) return Promise.resolve(false);
  return new Promise((resolve) => emit({ title, message, confirmLabel, tone, resolve }));
}

export default function ConfirmHost() {
  const [request, setRequest] = useState(null);
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);

  useEffect(() => {
    // A second request while one is open would orphan the first promise.
    emit = (next) =>
      setRequest((current) => {
        current?.resolve(false);
        return next;
      });
    return () => {
      emit = null;
    };
  }, []);

  const settle = (value) => {
    request?.resolve(value);
    setRequest(null);
  };

  if (!request) return null;
  const destructive = request.tone === "danger";

  return (
    <Modal
      title={request.title}
      size="sm"
      onClose={() => settle(false)}
      // Never put initial focus on the destructive action: a reflexive Enter
      // would delete a record the user has not read the warning for.
      initialFocusRef={destructive ? cancelRef : confirmRef}
      footer={
        <>
          <Button ref={cancelRef} variant="ghost" onClick={() => settle(false)}>
            Cancel
          </Button>
          <Button ref={confirmRef} variant={destructive ? "dangerSolid" : "primary"} onClick={() => settle(true)}>
            {request.confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-ink-2">{request.message}</p>
    </Modal>
  );
}
