import { useMemo, useState } from "react";
import { api } from "../api.js";
import { confirmAction } from "../components/ConfirmDialog.jsx";
import DataTable from "../components/DataTable.jsx";
import { ErrorState, FilterSelect, LiveDot, PageHeader, ResultCount, SearchInput, Toolbar } from "../components/page.jsx";
import RecordModal from "../components/RecordModal.jsx";
import { Button, Card, EmptyState, IconButton, Meter, Segmented, Skeleton, StatusBadge } from "../components/ui.jsx";
import { eventFields } from "../entities.jsx";
import { useApi, useDebounced, useSort, useSSE } from "../hooks.js";
import { useCampus } from "../lib/campus.jsx";
import { runAction, useCrud } from "../lib/crud.js";
import { cx, fmtDate, fmtTimeRange, parseDate, relativeDay } from "../lib/format.js";
import { Check, Grid, Pencil, Pin, Plus, Rows, Search, Ticket, Trash, User, Users } from "../lib/icons.jsx";

const STATUSES = ["upcoming", "ongoing", "completed", "cancelled", "full"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function DateBlock({ iso, dimmed }) {
  const date = parseDate(iso);
  if (!date) return null;
  return (
    <div
      className={cx(
        "flex size-12 shrink-0 flex-col items-center justify-center rounded-lg border text-center",
        dimmed ? "border-line bg-surface-2 text-ink-3" : "border-accent/30 bg-accent-soft text-accent-ink",
      )}
    >
      <span className="text-[10px] font-semibold tracking-wide uppercase">{MONTHS[date.getMonth()]}</span>
      <span className="text-base leading-none font-semibold tabular">{date.getDate()}</span>
    </div>
  );
}

function EventCard({ event, today, registered, onRegister, onUnregister, onEdit, onDelete, busy }) {
  const closed = event.status === "cancelled" || event.status === "completed";
  const isFull = event.registered >= event.capacity;
  const blocked = closed || (isFull && !registered);
  const reason = closed ? `This event is ${event.status}` : isFull ? "This event is full" : undefined;

  return (
    <Card interactive className={cx("flex flex-col", closed && "opacity-75")}>
      <div className="flex items-start gap-3 px-4 pt-4">
        <DateBlock iso={event.date} dimmed={closed} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[15px] leading-snug font-semibold text-ink">{event.name}</h3>
            <StatusBadge value={event.status} />
          </div>
          <p className="mt-1 text-[13px] text-ink-3 tabular">
            {relativeDay(event.date, today)}
            {event.end_date && event.end_date !== event.date ? ` – ${fmtDate(event.end_date)}` : ""} ·{" "}
            {fmtTimeRange(event.start_time, event.end_time)}
          </p>
        </div>
      </div>

      <p className="line-clamp-2 px-4 pt-3 text-[13px] leading-relaxed text-ink-2">{event.description}</p>

      <dl className="flex flex-wrap gap-x-4 gap-y-1.5 px-4 pt-3 text-[13px] text-ink-3">
        <div className="flex items-center gap-1.5">
          <Pin size={14} />
          <dt className="sr-only">Venue</dt>
          <dd>{event.venue}</dd>
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <User size={14} />
          <dt className="sr-only">Organizer</dt>
          <dd className="truncate">{event.organizer}</dd>
        </div>
      </dl>

      <div className="px-4 pt-3">
        <Meter value={event.registered} max={event.capacity} />
      </div>

      <div className="mt-auto flex items-center gap-1 px-3 pt-4 pb-3">
        {registered ? (
          <Button size="sm" variant="danger" onClick={() => onUnregister(event)} loading={busy}>
            Cancel registration
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            icon={Ticket}
            onClick={() => onRegister(event)}
            disabled={blocked}
            loading={busy}
            title={reason}
          >
            Register
          </Button>
        )}
        {registered ? (
          <span className="inline-flex items-center gap-1 text-[13px] font-medium text-positive">
            <Check size={14} /> You're in
          </span>
        ) : reason ? (
          <span className="text-[13px] text-ink-3">{reason}</span>
        ) : null}
        <span className="ml-auto flex items-center gap-0.5">
          <IconButton icon={Pencil} label={`Edit ${event.name}`} size={15} onClick={() => onEdit(event)} />
          <IconButton icon={Trash} label={`Delete ${event.name}`} size={15} variant="danger" onClick={() => onDelete(event)} />
        </span>
      </div>
    </Card>
  );
}

export default function Events({ initialQuery = "" }) {
  const { data, error, loading, refreshing, refresh } = useApi("/api/events");
  const { today, profile } = useCampus();
  const [view, setView] = useState("grid");
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(null);
  const search = useDebounced(query);

  useSSE("events", refresh);

  const crud = useCrud({ endpoint: "/api/events", singular: "event", refresh, labelFor: (row) => row.name });

  const isRegistered = (event) => event.registrations?.some((r) => r.student_id === profile.student_id);

  const filtered = useMemo(() => {
    const rows = data ?? [];
    const needle = search.trim().toLowerCase();
    return rows
      .filter((event) => {
        if (status && event.status !== status) return false;
        if (!needle) return true;
        return [event.name, event.description, event.venue, event.organizer].some((value) =>
          String(value ?? "").toLowerCase().includes(needle),
        );
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
  }, [data, search, status]);

  const register = async (event) => {
    setPending(event.id);
    await runAction(api.post(`/api/events/${event.id}/registrations`, {}), {
      success: `Registered for “${event.name}”`,
      refresh,
    });
    setPending(null);
  };

  const unregister = async (event) => {
    const confirmed = await confirmAction({
      title: "Cancel your registration?",
      message: `Your seat for “${event.name}” will be released to someone else.`,
      confirmLabel: "Cancel registration",
    });
    if (!confirmed) return;
    setPending(event.id);
    await runAction(api.del(`/api/events/${event.id}/registrations/${profile.student_id}`), {
      success: "Registration cancelled",
      refresh,
    });
    setPending(null);
  };

  const columns = [
    { key: "name", label: "Event", primary: true, wrap: true, sortable: true },
    { key: "date", label: "Date", sortable: true, render: (r) => fmtDate(r.date) },
    { key: "start_time", label: "Time", render: (r) => fmtTimeRange(r.start_time, r.end_time) },
    { key: "venue", label: "Venue", sortable: true },
    { key: "organizer", label: "Organizer" },
    { key: "registered", label: "Seats", sortable: true, render: (r) => <Meter value={r.registered} max={r.capacity} /> },
    { key: "status", label: "Status", sortable: true, render: (r) => <StatusBadge value={r.status} /> },
  ];

  const { sorted, sort, toggle } = useSort(filtered);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Events"
        blurb="Workshops, seminars and campus activities. Registering here updates the same counts the assistant reads."
        actions={
          <Button variant="primary" icon={Plus} onClick={crud.openCreate}>
            <span className="hidden sm:inline">Add event</span>
            <span className="sm:hidden">Add</span>
          </Button>
        }
      >
        <Toolbar
          right={
            <>
              <ResultCount shown={filtered.length} total={data?.length ?? 0} noun="events" />
              <LiveDot active={refreshing} />
              <Segmented
                label="Event view"
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
          <SearchInput value={query} onChange={setQuery} placeholder="Search events" id="search-events" />
          <FilterSelect label="Status" options={STATUSES} value={status} onChange={setStatus} />
        </Toolbar>
      </PageHeader>

      {error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Search}
            title={data?.length ? "No events match" : "No events yet"}
            description={data?.length ? "Try a different search or status." : "Create the first event for the campus calendar."}
            action={
              <Button variant="primary" icon={Plus} onClick={crud.openCreate}>
                Add event
              </Button>
            }
          />
        </Card>
      ) : view === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              today={today}
              registered={isRegistered(event)}
              busy={pending === event.id}
              onRegister={register}
              onUnregister={unregister}
              onEdit={crud.openEdit}
              onDelete={crud.remove}
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
          labelFor={(row) => row.name}
          rowActions={(row) =>
            isRegistered(row) ? (
              <IconButton
                icon={Users}
                label={`Cancel registration for ${row.name}`}
                size={15}
                variant="danger"
                onClick={() => unregister(row)}
              />
            ) : (
              <IconButton
                icon={Ticket}
                label={`Register for ${row.name}`}
                size={15}
                onClick={() => register(row)}
                disabled={row.registered >= row.capacity || row.status === "cancelled" || row.status === "completed"}
              />
            )
          }
        />
      )}

      {crud.modal ? (
        <RecordModal
          title={crud.modal.mode === "edit" ? "Edit event" : "New event"}
          description={crud.modal.mode === "edit" ? crud.modal.row.id : undefined}
          fields={eventFields}
          initial={crud.modal.row ?? { date: today }}
          submitLabel={crud.modal.mode === "edit" ? "Save changes" : "Add event"}
          onSubmit={crud.save}
          onClose={crud.close}
        />
      ) : null}
    </div>
  );
}
