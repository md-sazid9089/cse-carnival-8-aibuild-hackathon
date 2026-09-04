import { useState } from "react";
import { api, toast } from "../api.js";
import DataTable from "../components/DataTable.jsx";
import RecordModal from "../components/RecordModal.jsx";
import { badge, eventFields } from "../entities.jsx";
import { useApi, useSSE } from "../hooks.js";

export default function Events({ user, profile }) {
  const { data, loading, refresh } = useApi("/api/events");
  const [modal, setModal] = useState(null);
  useSSE("events", refresh);

  const activeUser = user || profile;
  const isAuthority = activeUser?.role_id === "authority" || activeUser?.role === "authority";

  const columns = [
    { key: "name", label: "Event", wrap: true },
    { key: "date", label: "Date" },
    { key: "start_time", label: "Start" },
    { key: "venue", label: "Venue" },
    { key: "organizer", label: "Organizer" },
    {
      key: "registered", label: "Capacity",
      render: (r) => (
        <div className="w-28">
          <div className="text-xs text-slate-500 mb-0.5">{r.registered}/{r.capacity}</div>
          <div className="h-1.5 bg-slate-200 rounded-full">
            <div className={`h-1.5 rounded-full ${r.registered >= r.capacity ? "bg-rose-500" : "bg-emerald-500"}`}
                 style={{ width: `${Math.min(100, (r.registered / r.capacity) * 100)}%` }} />
          </div>
        </div>
      ),
    },
    { key: "status", label: "Status", render: badge("status") },
  ];

  const save = async (form) => {
    try {
      if (modal.mode === "edit") await api.put(`/api/events/${modal.row.id}`, form);
      else await api.post("/api/events", form);
      toast("Saved", "success"); setModal(null); refresh();
    } catch (e) { toast(e.message, "error"); }
  };

  const remove = async (row) => {
    if (!confirm(`Delete event "${row.name}"?`)) return;
    try { await api.del(`/api/events/${row.id}`); toast("Event deleted", "success"); refresh(); }
    catch (e) { toast(e.message, "error"); }
  };

  const isRegistered = (row) => row.registrations?.some((r) => r.student_id === activeUser?.student_id);

  const register = async (row) => {
    try {
      await api.post(`/api/events/${row.id}/registrations`, {});
      toast(`Registered for "${row.name}"`, "success"); refresh();
    } catch (e) { toast(e.message, "error"); }
  };

  const unregister = async (row) => {
    try {
      await api.del(`/api/events/${row.id}/registrations/${activeUser?.student_id}`);
      toast("Registration cancelled", "success"); refresh();
    } catch (e) { toast(e.message, "error"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">Events</h1>
          {isAuthority && (
            <span className="text-xs bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-full font-medium">
               Authority Access
            </span>
          )}
        </div>
        <button onClick={() => setModal({ mode: "create" })}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700">+ Add Event</button>
      </div>
      {loading ? <div className="text-slate-400 text-sm py-12 text-center">Loading…</div> : (
        <DataTable
          columns={columns} rows={data}
          onEdit={(row) => setModal({ mode: "edit", row })} onDelete={remove}
          renderExtra={(row) =>
            isRegistered(row) ? (
              <button onClick={() => unregister(row)} className="text-amber-600 hover:underline">Unregister</button>
            ) : (
              <button onClick={() => register(row)} className="text-emerald-600 hover:underline">Register</button>
            )
          }
        />
      )}
      {modal && (
        <RecordModal title={modal.mode === "edit" ? `Edit ${modal.row.id}` : "New Event"}
                     fields={eventFields} initial={modal.row} onSubmit={save} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

