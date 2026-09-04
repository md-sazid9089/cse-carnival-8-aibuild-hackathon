import { useState } from "react";
import { api, toast } from "../api.js";
import DataTable from "../components/DataTable.jsx";
import RecordModal from "../components/RecordModal.jsx";
import { badge, bookingFields, roomFields } from "../entities.jsx";
import { useApi, useSSE } from "../hooks.js";

const columns = [
  { key: "room_number", label: "Room" },
  { key: "type", label: "Type" },
  { key: "capacity", label: "Capacity" },
  { key: "equipment", label: "Equipment", wrap: true, render: (r) => r.equipment.join(", ") },
  { key: "status", label: "Status", render: badge("status") },
  { key: "bookings", label: "Bookings", render: (r) => `${r.bookings.length}` },
];

export default function Rooms({ profile }) {
  const { data, loading, refresh } = useApi("/api/rooms");
  const [modal, setModal] = useState(null);
  const [bookingRoom, setBookingRoom] = useState(null);
  const [expanded, setExpanded] = useState(null);
  useSSE("rooms", refresh);

  const save = async (form) => {
    try {
      if (modal.mode === "edit") await api.put(`/api/rooms/${modal.row.id}`, form);
      else await api.post("/api/rooms", form);
      toast("Saved", "success"); setModal(null); refresh();
    } catch (e) { toast(e.message, "error"); }
  };

  const remove = async (row) => {
    if (!confirm(`Delete room ${row.room_number}?`)) return;
    try { await api.del(`/api/rooms/${row.id}`); toast("Room deleted", "success"); refresh(); }
    catch (e) { toast(e.message, "error"); }
  };

  const book = async (form) => {
    try {
      await api.post(`/api/rooms/${bookingRoom.id}/bookings`, form);
      toast(`Room ${bookingRoom.room_number} booked`, "success"); setBookingRoom(null); refresh();
    } catch (e) { toast(e.message, "error"); }
  };

  const cancelBooking = async (room, b) => {
    if (!confirm(`Cancel booking ${b.booking_id}?`)) return;
    try {
      await api.del(`/api/rooms/${room.id}/bookings/${b.booking_id}`);
      toast("Booking cancelled", "success"); refresh();
    } catch (e) { toast(e.message, "error"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Rooms</h1>
        <button onClick={() => setModal({ mode: "create" })}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700">+ Add Room</button>
      </div>
      {loading ? <div className="text-slate-400 text-sm py-12 text-center">Loading…</div> : (
        <DataTable
          columns={columns} rows={data}
          onEdit={(row) => setModal({ mode: "edit", row })} onDelete={remove}
          renderExtra={(row) => (
            <>
              <button onClick={() => setBookingRoom(row)} className="text-emerald-600 hover:underline">Book</button>
              <button onClick={() => setExpanded(expanded === row.id ? null : row.id)} className="text-slate-500 hover:underline">
                {expanded === row.id ? "Hide" : "View"}
              </button>
            </>
          )}
        />
      )}
      {expanded && data && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
          <h3 className="font-medium mb-2">Bookings — {data.find((r) => r.id === expanded)?.room_number}</h3>
          {data.find((r) => r.id === expanded)?.bookings.length ? (
            data.find((r) => r.id === expanded).bookings.map((b) => (
              <div key={b.booking_id} className="flex items-center justify-between border-t border-slate-100 py-2">
                <span>{b.date} · {b.start_time}–{b.end_time} · {b.purpose} <span className="text-slate-400">({b.booked_by})</span></span>
                <button onClick={() => cancelBooking(data.find((r) => r.id === expanded), b)}
                        className="text-rose-600 hover:underline">Cancel</button>
              </div>
            ))
          ) : <div className="text-slate-400">No bookings.</div>}
        </div>
      )}
      {modal && (
        <RecordModal title={modal.mode === "edit" ? `Edit ${modal.row.room_number}` : "New Room"}
                     fields={roomFields} initial={modal.row} onSubmit={save} onClose={() => setModal(null)} />
      )}
      {bookingRoom && (
        <RecordModal title={`Book ${bookingRoom.room_number}`} fields={bookingFields}
                     onSubmit={book} onClose={() => setBookingRoom(null)} />
      )}
    </div>
  );
}
