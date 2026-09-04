import { useState } from "react";
import { api, toast } from "../api.js";
import DataTable from "../components/DataTable.jsx";
import RecordModal from "../components/RecordModal.jsx";
import { useApi, useSSE } from "../hooks.js";

export default function ResourcePage({ entity, config }) {
  const { data, loading, refresh } = useApi(config.endpoint);
  const [modal, setModal] = useState(null); // null | {mode:'create'} | {mode:'edit', row}
  useSSE(entity, refresh);

  const save = async (form) => {
    try {
      if (modal.mode === "edit") {
        await api.put(`${config.endpoint}/${modal.row.id}`, form);
        toast("Record updated", "success");
      } else {
        await api.post(config.endpoint, form);
        toast("Record added", "success");
      }
      setModal(null);
      refresh();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const remove = async (row) => {
    if (!confirm(`Delete ${row.id}?`)) return;
    try {
      await api.del(`${config.endpoint}/${row.id}`);
      toast("Record deleted", "success");
      refresh();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{config.title}</h1>
        <button onClick={() => setModal({ mode: "create" })}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700">
          + Add
        </button>
      </div>
      {loading ? (
        <div className="text-slate-400 text-sm py-12 text-center">Loading…</div>
      ) : (
        <DataTable columns={config.columns} rows={data} onEdit={(row) => setModal({ mode: "edit", row })} onDelete={remove} />
      )}
      {modal && (
        <RecordModal
          title={modal.mode === "edit" ? `Edit ${modal.row.id}` : `New ${config.title.slice(0, -1)}`}
          fields={config.fields}
          initial={modal.row}
          onSubmit={save}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
