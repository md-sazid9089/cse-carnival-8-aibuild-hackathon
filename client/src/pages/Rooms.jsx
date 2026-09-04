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

function FreeRoomFinder({ today, onBook, invalidateKey }) {
  const [open, setOpen] = useState(true);
  const [form, setForm] = useState({ date: today, start_time: "14:00", end_time: "16:00", min_capacity: "", equipment: "" });
  const [results, setResults] = useState(null);
  const [searched, setSearched] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // The campus clock arrives after first paint; adopt it rather than the browser's.
  useEffect(() => {
    setForm((current) => (current.touchedDate ? current : { ...current, date: today }));
  }, [today]);

  // Availability is only true for the instant it was computed. Any change to the
  // question, or to any room anywhere, retires the previous answer.
  useEffect(() => {
    setResults(null);
  }, [invalidateKey]);

  const set = (key, value) => {
    setResults(null);
    setError(null);
    setForm((current) => ({ ...current, [key]: value, ...(key === "date" ? { touchedDate: true } : null) }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (form.end_time <= form.start_time) {
      setError("End time must be after the start time");
      document.getElementById("finder-end")?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    const params = new URLSearchParams({ date: form.date, start_time: form.start_time, end_time: form.end_time });
    if (form.min_capacity) params.set("min_capacity", form.min_capacity);
    if (form.equipment.trim()) params.set("equipment", form.equipment.trim());
    try {
      setResults(await api.get(`/api/rooms/free?${params}`));
      setSearched({ ...form });
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
          <span className="block text-[13px] text-ink-3">
            Filter by time, size and equipment — checks bookings, classes and events.
          </span>
        </span>
        <ChevronDown size={16} className={cx("text-ink-3 transition-transform duration-200", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="border-t border-line px-4 py-4">
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Date" htmlFor="finder-date" required className="sm:col-span-2">
              <TextInput id="finder-date" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
            </Field>
            <Field label="From" htmlFor="finder-start" required>
              <TextInput id="finder-start" type="time" value={form.start_time} onChange={(e) => set("start_time", e.target.value)} />
            </Field>
            <Field label="To" htmlFor="finder-end" required error={error}>
              <TextInput id="finder-end" type="time" value={form.end_time} onChange={(e) => set("end_time", e.target.value)} invalid={Boolean(error)} />
            </Field>
            <Field label="Min seats" htmlFor="finder-cap">
              <TextInput
                id="finder-cap"
                type="number"
                min={1}
                inputMode="numeric"
                placeholder="Any"
                value={form.min_capacity}
                onChange={(e) => set("min_capacity", e.target.value)}
              />
            </Field>
            <Field label="Equipment" htmlFor="finder-equip">
              <TextInput
                id="finder-equip"
                placeholder="projector"
                value={form.equipment}
                onChange={(e) => set("equipment", e.target.value)}
              />
            </Field>
            <div className="sm:col-span-2 lg:col-span-4">
              <Button type="submit" variant="primary" loading={busy} icon={Search}>
                Search availability
              </Button>
            </div>
          </form>

          <p className="sr-only" aria-live="polite">
            {busy ? "Searching" : results ? `${results.length} rooms free` : ""}
          </p>

          {results ? (
            results.length ? (
              <div className="mt-4">
                <p className="mb-2 text-[13px] text-ink-2">
                  {results.length} room{results.length === 1 ? "" : "s"} free on {fmtDate(searched.date)},{" "}
                  {fmtTimeRange(searched.start_time, searched.end_time)}
                </p>
                <ul className="flex flex-wrap gap-2">
                  {results.map((room) => (
                    <li key={room.room_number}>
                      <button
                        type="button"
                        onClick={() => onBook(room.room_number, searched)}
                        className="flex items-center gap-2 rounded-lg border border-line-control bg-surface px-3 py-2 text-left transition-colors hover:border-accent hover:bg-accent-soft"
                      >
                        <span className="text-sm font-medium text-ink">Book {room.room_number}</span>
                        <span className="text-[12px] text-ink-2 tabular">{room.capacity} seats</span>
                        <ArrowRight size={14} className="text-ink-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-4 text-[13px] text-ink-2">
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

function RoomCard({ room, today, weekday, schedules, events, profileName, nowMinutes, onBook, onEdit, onDelete, onCancelBooking }) {
  const [open, setOpen] = useState(false);
  const busy = busyWindows({ room, date: today, weekday, schedules, events });
  const remaining = busy.filter((window) => minutesOf(window.end) > nowMinutes);
  const unavailable = room.status !== "available";

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
        <span className="inline-flex items-center gap-1.5">
          <Calendar size={14} className="text-ink-3" />
          {remaining.length ? `${remaining.length} busy slot${remaining.length === 1 ? "" : "s"} left today` : "Free for the rest of today"}
        </span>
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

      <div className="mt-auto flex flex-wrap items-center gap-1 px-3 pt-4 pb-3">
        <Button size="sm" variant="secondary" icon={Clock} onClick={() => onBook(room)} disabled={unavailable}>
          Book
        </Button>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13px] font-medium text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink"
        >
          Busy today
          <span className="tabular">({busy.length})</span>
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
        {unavailable ? <p className="w-full px-1 pt-1 text-[12px] text-ink-2">Marked unavailable — bookings are refused.</p> : null}
      </div>

      {open ? (
        <div className="border-t border-line px-4 py-3">
          {busy.length ? (
            <ul className="flex flex-col gap-2">
              {busy.map((window) => {
                const mine = window.kind === "booking" && window.by === profileName;
                return (
                  <li key={window.key} className="flex items-start justify-between gap-2 text-[13px]">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 font-medium text-ink tabular">
                        {fmtTimeRange(window.start, window.end)}
                        <span className={cx("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", BUSY_TONE[window.kind])}>
                          {window.kind}
                        </span>
                      </p>
                      <p className="truncate text-ink-2">
                        {window.label} — {mine ? "you" : window.by}
                      </p>
                    </div>
                    {window.kind === "booking" ? (
                      mine ? (
                        <Button size="sm" variant="danger" onClick={() => onCancelBooking(room, window.booking)}>
                          Cancel
                        </Button>
                      ) : (
                        <span className="pt-1 text-[11px] text-ink-3">Not yours</span>
                      )
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[13px] text-ink-2">Nothing scheduled here today.</p>
          )}

          {room.bookings.some((booking) => booking.date > today) ? (
            <p className="mt-3 border-t border-line pt-2 text-[12px] text-ink-3">
              Also booked later: {room.bookings.filter((b) => b.date > today).map((b) => relativeDay(b.date, today)).join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

/* -------------------------------------------------------------------- page */

export default function Rooms({ initialQuery = "" }) {
  const { data, error, staleError, loading, refreshing, refresh } = useApi("/api/rooms");
  const schedules = useApi("/api/schedules");
  const events = useApi("/api/events");
  const { today, weekday, nowTime, profile } = useCampus();
  const [view, setView] = useState("grid");
  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [booking, setBooking] = useState(null);
  const [changeCount, setChangeCount] = useState(0);
  const search = useDebounced(query);

  useSSE(["rooms", "schedules", "events"], (message) => {
    if (message.entity === "rooms") refresh();
    if (message.entity === "schedules") schedules.refresh();
    if (message.entity === "events") events.refresh();
    // Any of these can invalidate a previous availability answer.
    setChangeCount((value) => value + 1);
  });

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

  const { sorted, sort, toggle } = useSort(filtered, null, columns);

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

  // Throws on failure so the dialog can show the server's conflict reason inline.
  const submitBooking = async (form) => {
    await api.post(`/api/rooms/${booking.room.id}/bookings`, form);
    toast(`Room ${booking.room.room_number} booked`, "success");
    setBooking(null);
    refresh();
  };

  const openBookingFor = (room, prefill) => setBooking({ room, prefill });

  const openBookingByNumber = (roomNumber, prefill) => {
    const room = (data ?? []).find((r) => r.room_number === roomNumber);
    if (room) openBookingFor(room, prefill);
    else toast(`Room ${roomNumber} is no longer listed — refresh and try again.`, "error");
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Rooms"
        blurb="Every bookable space on campus, with the times each one is already taken."
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
          <FilterSelect label="Type" allLabel="Any type" options={TYPES} value={type} onChange={setType} />
          <FilterSelect label="Status" allLabel="Any status" options={STATUSES} value={status} onChange={setStatus} />
        </Toolbar>
      </PageHeader>

      <StaleNotice message={staleError} onRetry={refresh} />

      <FreeRoomFinder today={today} onBook={openBookingByNumber} invalidateKey={changeCount} />

      {error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : loading ? (
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
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
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              today={today}
              weekday={weekday}
              nowMinutes={minutesOf(nowTime)}
              schedules={schedules.data ?? []}
              events={events.data ?? []}
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
          label="Rooms"
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
          recordKey={`room-${crud.modal.mode}-${crud.modal.row?.id ?? "new"}`}
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
          recordKey={`booking-${booking.room.id}`}
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
