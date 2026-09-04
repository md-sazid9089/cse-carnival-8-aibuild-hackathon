import { useEffect, useMemo, useState } from "react";
import { api, toast } from "../api.js";
import { confirmAction } from "../components/ConfirmDialog.jsx";
import DataTable from "../components/DataTable.jsx";
import {
  ErrorState,
  FilterSelect,
  LiveDot,
  PageHeader,
  ResultCount,
  SearchInput,
  StaleNotice,
  Toolbar,
} from "../components/page.jsx";
import RecordModal from "../components/RecordModal.jsx";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Segmented,
  Skeleton,
  StatusBadge,
  TextInput,
} from "../components/ui.jsx";
import { bookingFields, roomFields } from "../entities.jsx";
import { useApi, useDebounced, useSort, useSSE } from "../hooks.js";
import { useCampus } from "../lib/campus.jsx";
import { runAction, useCrud } from "../lib/crud.js";
import { cx, fmtDate, fmtTimeRange, minutesOf, relativeDay } from "../lib/format.js";
import { busyWindows } from "../lib/rules.js";
import { ArrowRight, Calendar, ChevronDown, Clock, Grid, Pencil, Plus, Rows, Search, Tool, Trash, Users } from "../lib/icons.jsx";

const TYPES = ["classroom", "lab", "seminar"];
const STATUSES = ["available", "unavailable"];
const BUSY_TONE = {
  booking: "bg-accent-soft text-accent-ink",
  class: "bg-surface-3 text-ink-2",
  event: "bg-caution-soft text-caution",
};

const Chip = ({ children }) => (
  <span className="inline-flex items-center rounded-md bg-surface-3 px-1.5 py-0.5 text-[11px] font-medium text-ink-2">
    {children}
  </span>
);

/* ------------------------------------------------------- availability finder */

function FreeRoomFinder({ today, onBook }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date: today, start_time: "14:00", end_time: "16:00", min_capacity: "", equipment: "" });
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    if (form.end_time <= form.start_time) {
      setError("End time must be after the start time");
      return;
    }
    setBusy(true);
    setError(null);
    const params = new URLSearchParams({ date: form.date, start_time: form.start_time, end_time: form.end_time });
    if (form.min_capacity) params.set("min_capacity", form.min_capacity);
    if (form.equipment.trim()) params.set("equipment", form.equipment.trim());
    try {
      setResults(await api.get(`/api/rooms/free?${params}`));
    } catch (err) {
      setError(err.message);
      setResults(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-4 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
      >
        <span className="grid size-8 place-items-center rounded-lg bg-accent-soft text-accent-ink">
          <Search size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-ink">Find a free room</span>
          <span className="block text-[13px] text-ink-3">Filter by time, size and equipment — checks bookings, classes and events.</span>
        </span>
        <ChevronDown size={16} className={cx("text-ink-3 transition-transform duration-200", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="border-t border-line px-4 py-4">
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <label className="text-[13px] font-medium text-ink-2 lg:col-span-2">
              Date
              <input
                type="date"
                value={form.date}
                onChange={(event) => set("date", event.target.value)}
                className="mt-1.5 h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm"
              />
            </label>
            <label className="text-[13px] font-medium text-ink-2">
              From
              <input
                type="time"
                value={form.start_time}
                onChange={(event) => set("start_time", event.target.value)}
                className="mt-1.5 h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm"
              />
            </label>
            <label className="text-[13px] font-medium text-ink-2">
              To
              <input
                type="time"
                value={form.end_time}
                onChange={(event) => set("end_time", event.target.value)}
                className="mt-1.5 h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm"
              />
            </label>
            <label className="text-[13px] font-medium text-ink-2">
              Min seats
              <input
                type="number"
                min={1}
                inputMode="numeric"
                placeholder="Any"
                value={form.min_capacity}
                onChange={(event) => set("min_capacity", event.target.value)}
                className="mt-1.5 h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm"
              />
            </label>
            <label className="text-[13px] font-medium text-ink-2">
              Equipment
              <input
                type="text"
                placeholder="projector"
                value={form.equipment}
                onChange={(event) => set("equipment", event.target.value)}
                className="mt-1.5 h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm"
              />
            </label>
            <div className="sm:col-span-2 lg:col-span-6">
              <Button type="submit" variant="primary" loading={busy} icon={Search}>
                Search availability
              </Button>
            </div>
          </form>

          {error ? (
            <p role="alert" className="mt-3 text-[13px] font-medium text-critical">
              {error}
            </p>
          ) : null}

          {results ? (
            results.length ? (
              <div className="mt-4">
                <p className="mb-2 text-[13px] text-ink-3" aria-live="polite">
                  {results.length} room{results.length === 1 ? "" : "s"} free on {fmtDate(form.date)},{" "}
                  {fmtTimeRange(form.start_time, form.end_time)}
                </p>
                <ul className="flex flex-wrap gap-2">
                  {results.map((room) => (
                    <li key={room.room_number}>
                      <button
                        type="button"
                        onClick={() => onBook(room.room_number, form)}
                        className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-left transition-colors hover:border-accent/50 hover:bg-accent-soft"
                      >
                        <span className="text-sm font-semibold text-ink">{room.room_number}</span>
                        <span className="text-[12px] text-ink-3 tabular">{room.capacity} seats</span>
                        <Check size={14} className="text-positive" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-4 text-[13px] text-ink-3" aria-live="polite">
                No room matches that window. Try a wider time range or fewer requirements.
              </p>
            )
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

/* --------------------------------------------------------------- room card */

function RoomCard({ room, today, profileName, onBook, onEdit, onDelete, onCancelBooking }) {
  const [open, setOpen] = useState(false);
  const upcoming = room.bookings.filter((b) => b.date >= today);

  return (
    <Card interactive className="flex flex-col">
      <div className="flex items-start justify-between gap-2 px-4 pt-4">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold tracking-tight text-ink">{room.room_number}</h3>
          <p className="mt-0.5 text-[13px] text-ink-3 capitalize">
            {room.type} · Floor {room.floor}
          </p>
        </div>
        <StatusBadge value={room.status} dot />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 pt-3 text-[13px] text-ink-2">
        <span className="inline-flex items-center gap-1.5 tabular">
          <Users size={14} className="text-ink-3" />
          {room.capacity} seats
        </span>
        {upcoming.length ? (
          <span className="inline-flex items-center gap-1.5">
            <Calendar size={14} className="text-ink-3" />
            {upcoming.length} upcoming
          </span>
        ) : null}
      </div>

      {room.equipment.length ? (
        <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3">
          <Tool size={13} className="text-ink-3" />
          {room.equipment.slice(0, 4).map((item) => (
            <Chip key={item}>{item}</Chip>
          ))}
          {room.equipment.length > 4 ? <Chip>+{room.equipment.length - 4}</Chip> : null}
        </div>
      ) : null}

      <div className="mt-auto flex items-center gap-1 px-3 pt-4 pb-3">
        <Button
          size="sm"
          variant="secondary"
          icon={Clock}
          onClick={() => onBook(room)}
          disabled={room.status !== "available"}
          title={room.status !== "available" ? "This room is marked unavailable" : undefined}
        >
          Book
        </Button>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13px] font-medium text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
        >
          Bookings
          <span className="tabular">({room.bookings.length})</span>
          <ChevronDown size={13} className={cx("transition-transform duration-200", open && "rotate-180")} />
        </button>
        <span className="ml-auto flex items-center gap-0.5">
          <IconButton icon={Pencil} label={`Edit room ${room.room_number}`} size={15} onClick={() => onEdit(room)} />
          <IconButton
            icon={Trash}
            label={`Delete room ${room.room_number}`}
            size={15}
            variant="danger"
            onClick={() => onDelete(room)}
          />
        </span>
      </div>

      {open ? (
        <div className="border-t border-line px-4 py-3">
          {room.bookings.length ? (
            <ul className="flex flex-col gap-2">
              {room.bookings.map((booking) => {
                const mine = booking.booked_by === profileName;
                return (
                  <li key={booking.booking_id} className="flex items-start justify-between gap-2 text-[13px]">
                    <div className="min-w-0">
                      <p className="font-medium text-ink tabular">
                        {relativeDay(booking.date, today)} · {fmtTimeRange(booking.start_time, booking.end_time)}
                      </p>
                      <p className="truncate text-ink-3">
                        {booking.purpose} — {mine ? "you" : booking.booked_by}
                      </p>
                    </div>
                    {mine ? (
                      <Button size="sm" variant="danger" onClick={() => onCancelBooking(room, booking)}>
                        Cancel
                      </Button>
                    ) : (
                      <span className="pt-1 text-[11px] text-ink-3">Not yours</span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[13px] text-ink-3">No bookings yet.</p>
          )}
        </div>
      ) : null}
    </Card>
  );
}

/* -------------------------------------------------------------------- page */

export default function Rooms({ initialQuery = "" }) {
  const { data, error, loading, refreshing, refresh } = useApi("/api/rooms");
  const { today, profile } = useCampus();
  const [view, setView] = useState("grid");
  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [booking, setBooking] = useState(null);
  const search = useDebounced(query);

  useSSE("rooms", refresh);

  const crud = useCrud({
    endpoint: "/api/rooms",
    singular: "room",
    refresh,
    labelFor: (row) => `Room ${row.room_number}`,
  });

  const filtered = useMemo(() => {
    const rows = data ?? [];
    const needle = search.trim().toLowerCase();
    return rows.filter((room) => {
      if (type && room.type !== type) return false;
      if (status && room.status !== status) return false;
      if (!needle) return true;
      return (
        room.room_number.toLowerCase().includes(needle) ||
        room.type.toLowerCase().includes(needle) ||
        room.equipment.some((item) => item.toLowerCase().includes(needle))
      );
    });
  }, [data, search, type, status]);

  const columns = [
    { key: "room_number", label: "Room", primary: true, sortable: true },
    { key: "type", label: "Type", sortable: true, render: (r) => <Badge>{r.type}</Badge> },
    { key: "capacity", label: "Seats", sortable: true, align: "right" },
    { key: "floor", label: "Floor", sortable: true, align: "right" },
    { key: "equipment", label: "Equipment", wrap: true, render: (r) => r.equipment.join(", ") || "—" },
    { key: "status", label: "Status", sortable: true, render: (r) => <StatusBadge value={r.status} dot /> },
    { key: "bookings", label: "Bookings", align: "right", render: (r) => r.bookings.length },
  ];

  const { sorted, sort, toggle } = useSort(filtered);

  const cancelBooking = async (room, bookingRecord) => {
    const confirmed = await confirmAction({
      title: "Cancel this booking?",
      message: `Room ${room.room_number} on ${fmtDate(bookingRecord.date)}, ${fmtTimeRange(bookingRecord.start_time, bookingRecord.end_time)} will be released.`,
      confirmLabel: "Cancel booking",
    });
    if (!confirmed) return;
    await runAction(api.del(`/api/rooms/${room.id}/bookings/${bookingRecord.booking_id}`), {
      success: "Booking cancelled",
      refresh,
    });
  };

  const submitBooking = async (form) => {
    const result = await runAction(api.post(`/api/rooms/${booking.room.id}/bookings`, form), {
      success: `Room ${booking.room.room_number} booked`,
      refresh,
    });
    if (result) setBooking(null);
  };

  const openBookingFor = (room, prefill) => setBooking({ room, prefill });

  const openBookingByNumber = (roomNumber, prefill) => {
    const room = (data ?? []).find((r) => r.room_number === roomNumber);
    if (room) openBookingFor(room, prefill);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Rooms"
        blurb="Every bookable space on campus. Bookings are checked against existing bookings, the class timetable and scheduled events."
        actions={
          <Button variant="primary" icon={Plus} onClick={crud.openCreate}>
            <span className="hidden sm:inline">Add room</span>
            <span className="sm:hidden">Add</span>
          </Button>
        }
      >
        <Toolbar
          right={
            <>
              <ResultCount shown={filtered.length} total={data?.length ?? 0} noun="rooms" />
              <LiveDot active={refreshing} />
              <Segmented
                label="Room view"
                value={view}
                onChange={setView}
                options={[
                  { value: "grid", label: "Cards", icon: Grid, iconOnly: true },
                  { value: "table", label: "Table", icon: Rows, iconOnly: true },
                ]}
              />
            </>
          }
        >
          <SearchInput value={query} onChange={setQuery} placeholder="Search room or equipment" id="search-rooms" />
          <FilterSelect label="Type" options={TYPES} value={type} onChange={setType} />
          <FilterSelect label="Status" options={STATUSES} value={status} onChange={setStatus} />
        </Toolbar>
      </PageHeader>

      <FreeRoomFinder today={today} onBook={openBookingByNumber} />

      {error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-52 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Search}
            title={data?.length ? "No rooms match" : "No rooms yet"}
            description={data?.length ? "Adjust the filters or clear the search." : "Add the first room so it can be booked."}
            action={
              data?.length ? (
                <Button
                  onClick={() => {
                    setQuery("");
                    setType("");
                    setStatus("");
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button variant="primary" icon={Plus} onClick={crud.openCreate}>
                  Add room
                </Button>
              )
            }
          />
        </Card>
      ) : view === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              today={today}
              profileName={profile.name}
              onBook={openBookingFor}
              onEdit={crud.openEdit}
              onDelete={crud.remove}
              onCancelBooking={cancelBooking}
            />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={sorted}
          sort={sort}
          onSort={toggle}
          onEdit={crud.openEdit}
          onDelete={crud.remove}
          labelFor={(row) => `room ${row.room_number}`}
          rowActions={(row) => (
            <IconButton
              icon={Clock}
              label={`Book room ${row.room_number}`}
              size={15}
              onClick={() => openBookingFor(row)}
              disabled={row.status !== "available"}
            />
          )}
        />
      )}

      {crud.modal ? (
        <RecordModal
          title={crud.modal.mode === "edit" ? `Edit room ${crud.modal.row.room_number}` : "New room"}
          fields={roomFields}
          initial={crud.modal.row}
          submitLabel={crud.modal.mode === "edit" ? "Save changes" : "Add room"}
          onSubmit={crud.save}
          onClose={crud.close}
        />
      ) : null}

      {booking ? (
        <RecordModal
          title={`Book room ${booking.room.room_number}`}
          description={`${booking.room.capacity} seats · ${booking.room.equipment.join(", ") || "no listed equipment"}`}
          fields={bookingFields}
          initial={booking.prefill ?? { date: today }}
          submitLabel="Confirm booking"
          onSubmit={submitBooking}
          onClose={() => setBooking(null)}
          validate={(form) => (form.date < today ? { date: "Pick today or a future date" } : {})}
        />
      ) : null}
    </div>
  );
}
