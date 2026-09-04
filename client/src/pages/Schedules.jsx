import { useMemo, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import { ErrorState, FilterSelect, LiveDot, PageHeader, ResultCount, SearchInput, StaleNotice, Toolbar } from "../components/page.jsx";
import RecordModal from "../components/RecordModal.jsx";
import { Button, EmptyState, Segmented, Skeleton } from "../components/ui.jsx";
import { DAYS, entities } from "../entities.jsx";
import { useApi, useDebounced, useSort, useSSE } from "../hooks.js";
import { useCampus } from "../lib/campus.jsx";
import { useCrud } from "../lib/crud.js";
import { cx, fmtTimeRange, minutesOf } from "../lib/format.js";
import { Calendar, Pin, Plus, Rows, Search, Trash, User } from "../lib/icons.jsx";

const config = entities.schedules;

function ClassCard({ row, isNow, onEdit, onDelete }) {
  return (
    <div
      className={cx(
        "group relative rounded-lg border bg-surface p-3 transition-[border-color,box-shadow] duration-200 hover:shadow-sm",
        isNow ? "border-accent/50 ring-1 ring-accent/25" : "border-line",
      )}
    >
      <button
        type="button"
        onClick={() => onEdit(row)}
        className="block w-full text-left"
        aria-label={`Edit ${row.course} ${row.title}`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-ink">{row.course}</span>
          <span className="text-[11px] font-medium text-ink-3">{row.section}</span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-ink-2">{row.title}</p>
        <dl className="mt-2 space-y-1 text-xs text-ink-3">
          <div className="flex items-center gap-1.5 tabular">
            <dt className="sr-only">Time</dt>
            <dd>{fmtTimeRange(row.start_time, row.end_time)}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Pin size={12} />
            <dt className="sr-only">Room</dt>
            <dd>{row.room}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <User size={12} />
            <dt className="sr-only">Instructor</dt>
            <dd className="truncate">{row.instructor}</dd>
          </div>
        </dl>
      </button>
      <button
        type="button"
        onClick={() => onDelete(row)}
        aria-label={`Delete ${row.course} on ${row.day}`}
        className="absolute top-2 right-2 grid size-8 place-items-center rounded-md text-ink-3 transition-opacity hover:bg-critical-soft hover:text-critical focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
      >
        <Trash size={14} />
      </button>
      {isNow ? (
        <span className="absolute -top-2 left-3 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-ink-invert">
          In progress
        </span>
      ) : null}
    </div>
  );
}

function Timetable({ rows, loading, today, nowTime, onEdit, onDelete, onAdd }) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {DAYS.map((day) => (
          <div key={day} className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ))}
      </div>
    );
  }

  const minutes = minutesOf(nowTime);
  // A class can be created on any weekday through the API — never hide one.
  const extraDays = [...new Set(rows.map((row) => row.day))].filter((day) => !DAYS.includes(day));
  const columns = [...DAYS, ...extraDays];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
      {columns.map((day) => {
        const classes = rows
          .filter((row) => row.day === day)
          .sort((a, b) => minutesOf(a.start_time) - minutesOf(b.start_time));
        const isToday = day === today;
        return (
          <section
            key={day}
            aria-label={day}
            className={cx(
              "flex min-w-0 flex-col rounded-xl border p-2.5",
              isToday ? "border-accent/40 bg-accent-soft/40" : "border-line bg-surface-2/60",
            )}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className={cx("text-[13px] font-semibold", isToday ? "text-accent-ink" : "text-ink-2")}>
                {day}
                {isToday ? <span className="ml-1.5 text-[11px] font-medium text-accent">Today</span> : null}
              </h2>
              <span className="text-[11px] text-ink-3 tabular">{classes.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {classes.length ? (
                classes.map((row) => (
                  <ClassCard
                    key={row.id}
                    row={row}
                    isNow={isToday && minutes >= minutesOf(row.start_time) && minutes < minutesOf(row.end_time)}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))
              ) : (
                <button
                  type="button"
                  onClick={onAdd}
                  className="rounded-lg border border-dashed border-line px-3 py-6 text-[13px] text-ink-3 transition-colors hover:border-line-strong hover:text-ink-2"
                >
                  No classes — add one
                </button>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default function Schedules({ initialQuery = "" }) {
  const { data, error, staleError, loading, refreshing, refresh } = useApi(config.endpoint);
  const { today, weekday, nowTime, profile, isTeacher } = useCampus();
  const [view, setView] = useState(initialQuery ? "table" : "timetable");
  const [query, setQuery] = useState(initialQuery);
  const [day, setDay] = useState("");
  const [mine, setMine] = useState(isTeacher);
  const search = useDebounced(query);

  useSSE(config.entity, refresh);

  const crud = useCrud({
    endpoint: config.endpoint,
    singular: config.singular,
    refresh,
    labelFor: (row) => `${row.course} · ${row.day} ${row.start_time}`,
  });

  const filtered = useMemo(() => {
    const rows = data ?? [];
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (mine && isTeacher && row.instructor !== profile.name) return false;
      if (day && row.day !== day) return false;
      if (!needle) return true;
      return config.searchKeys.some((key) => String(row[key] ?? "").toLowerCase().includes(needle));
    });
  }, [data, day, search, mine, isTeacher, profile.name]);

  const { sorted, sort, toggle } = useSort(filtered, { key: "day", direction: "asc" }, config.columns);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Class Schedules"
        blurb={config.blurb}
        actions={
          <Button variant="primary" icon={Plus} onClick={crud.openCreate}>
            <span className="hidden sm:inline">Add class</span>
            <span className="sm:hidden">Add</span>
          </Button>
        }
      >
        <Toolbar
          right={
            <>
              <ResultCount shown={filtered.length} total={data?.length ?? 0} noun="classes" />
              <LiveDot active={refreshing} />
              <Segmented
                label="Schedule view"
                value={view}
                onChange={setView}
                options={[
                  { value: "timetable", label: "Timetable", icon: Calendar, iconOnly: true },
                  { value: "table", label: "Table", icon: Rows, iconOnly: true },
                ]}
              />
            </>
          }
        >
          <SearchInput value={query} onChange={setQuery} placeholder="Search course, room, instructor" id="search-schedules" />
          <FilterSelect label="Day" allLabel="Any day" options={DAYS} value={day} onChange={setDay} />
          {isTeacher ? (
            <Segmented
              label="Scope"
              value={mine ? "mine" : "all"}
              onChange={(value) => setMine(value === "mine")}
              options={[
                { value: "mine", label: "My classes" },
                { value: "all", label: "All classes" },
              ]}
            />
          ) : null}
        </Toolbar>
      </PageHeader>

      <StaleNotice message={staleError} onRetry={refresh} />

      {error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : view === "timetable" ? (
        <Timetable
          rows={filtered}
          loading={loading}
          today={weekday}
          nowTime={nowTime}
          onEdit={crud.openEdit}
          onDelete={crud.remove}
          onAdd={crud.openCreate}
        />
      ) : (
        <DataTable
          columns={config.columns}
          rows={sorted}
          label="Class schedules"
          loading={loading}
          sort={sort}
          onSort={toggle}
          onEdit={crud.openEdit}
          onDelete={crud.remove}
          labelFor={(row) => `${row.course} on ${row.day}`}
          empty={
            <EmptyState
              icon={Search}
              title={data?.length ? "No matching classes" : "No classes yet"}
              description={data?.length ? "Try another search term or day." : "Add the first class to build the timetable."}
              action={
                <Button variant="primary" icon={Plus} onClick={crud.openCreate}>
                  Add class
                </Button>
              }
            />
          }
        />
      )}

      {crud.modal ? (
        <RecordModal
          title={crud.modal.mode === "edit" ? "Edit class" : "New class"}
          recordKey={`class-${crud.modal.mode}-${crud.modal.row?.id ?? "new"}`}
          description={`The university week runs Sunday to Thursday. Today is ${weekday}, ${today}.`}
          fields={config.fields}
          initial={crud.modal.row}
          submitLabel={crud.modal.mode === "edit" ? "Save changes" : "Add class"}
          onSubmit={crud.save}
          onClose={crud.close}
        />
      ) : null}
    </div>
  );
}
