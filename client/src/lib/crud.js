import { useCallback, useState } from "react";
import { api, toast } from "../api.js";
import { confirmAction } from "../components/ConfirmDialog.jsx";
import { titleCase } from "./format.js";

/**
 * Create / edit / delete wiring shared by every resource page.
 *
 * `save` deliberately rethrows: the form shows the server's reason inline and
 * keeps what the user typed. Deletes always go through a confirmation step.
 */
export function useCrud({ endpoint, singular, refresh, labelFor = (row) => row.id }) {
  const [modal, setModal] = useState(null);

  const openCreate = useCallback(() => setModal({ mode: "create" }), []);
  const openEdit = useCallback((row) => setModal({ mode: "edit", row }), []);
  const close = useCallback(() => setModal(null), []);

  const save = useCallback(
    async (form) => {
      if (modal?.mode === "edit") {
        await api.put(`${endpoint}/${modal.row.id}`, form);
        toast(`${titleCase(singular)} updated`, "success");
      } else {
        await api.post(endpoint, form);
        toast(`${titleCase(singular)} added`, "success");
      }
      setModal(null);
      refresh();
    },
    [endpoint, modal, refresh, singular],
  );

  const remove = useCallback(
    async (row) => {
      const confirmed = await confirmAction({
        title: `Delete this ${singular}?`,
        message: `“${labelFor(row)}” will be removed for everyone. This cannot be undone.`,
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

  return { modal, openCreate, openEdit, close, save, remove };
}

/** Runs a one-shot action and reports the outcome, keeping pages free of try/catch noise. */
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
