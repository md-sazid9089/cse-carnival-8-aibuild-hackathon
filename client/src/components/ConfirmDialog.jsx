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
  const confirmRef = useRef(null);

  useEffect(() => {
    emit = setRequest;
    return () => {
      emit = null;
    };
  }, []);

  const settle = (value) => {
    request?.resolve(value);
    setRequest(null);
  };

  if (!request) return null;

  return (
    <Modal
      title={request.title}
      size="sm"
      onClose={() => settle(false)}
      initialFocusRef={confirmRef}
      footer={
        <>
          <Button variant="ghost" onClick={() => settle(false)}>
            Cancel
          </Button>
          <Button
            ref={confirmRef}
            variant={request.tone === "danger" ? "dangerSolid" : "primary"}
            onClick={() => settle(true)}
          >
            {request.confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-ink-2">{request.message}</p>
    </Modal>
  );
}
