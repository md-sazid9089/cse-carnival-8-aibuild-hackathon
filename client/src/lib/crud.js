import { useCallback, useState } from "react";
import { api, toast } from "../api.js";
import { confirmAction } from "../components/ConfirmDialog.jsx";
import { titleCase } from "./format.js";

/**
 * Create / edit / delete wiring shared by every resource page.
 * Deletes always go through a confirmation step; every outcome is announced.
 */
export function useCrud({ endpoint, singular, refresh, labelFor = (row) => row.id }) {
  const [modal, setModal] = useState(null);

  const save = useCallback(
    async (form) => {
      try {
        if (modal?.mode === "edit") {
          await api.put(`${endpoint}/${modal.row.id}`, form);
          toast(`${titleCase(singular)} updated`, "success");
        } else {
          await api.post(endpoint, form);
          toast(`${titleCase(singular)} added`, "success");
        }
        setModal(null);
        refresh();
      } catch (error) {
        toast(error.message, "error");
      }
    },
    [endpoint, modal, refresh, singular],
  );

  const remove = useCallback(
    async (row) => {
      const confirmed = await confirmAction({
        title: `Delete this ${singular}?`,
        message: `“${labelFor(row)}” will be removed for everyone, and the assistant will stop seeing it. This cannot be undone.`,
        confirmLabel: `Delete ${singular}`,
      });
      if (!confirmed) return;
      try {
        await api.del(`${endpoint}/${row.id}`);
        toast(`${titleCase(singular)} deleted`, "success");
        refresh();
      } catch (error) {
        toast(error.message, "error");
      }
    },
    [endpoint, labelFor, refresh, singular],
  );

  return {
    modal,
    openCreate: () => setModal({ mode: "create" }),
    openEdit: (row) => setModal({ mode: "edit", row }),
    close: () => setModal(null),
    save,
    remove,
  };
}

/** Runs an action and reports the outcome, keeping pages free of try/catch noise. */
export async function runAction(promise, { success, refresh }) {
  try {
    const result = await promise;
    if (success) toast(success, "success");
    refresh?.();
    return result;
  } catch (error) {
    toast(error.message, "error");
    return null;
  }
}
