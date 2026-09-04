import { useMemo, useState } from "react";
import { api } from "../api.js";
import DataTable from "../components/DataTable.jsx";
import { ErrorState, FilterSelect, LiveDot, PageHeader, ResultCount, SearchInput, StaleNotice, Toolbar } from "../components/page.jsx";
import RecordModal from "../components/RecordModal.jsx";
import { Badge, Button, Card, EmptyState, IconButton, Segmented, Skeleton, StatusBadge } from "../components/ui.jsx";
import { entities } from "../entities.jsx";
import { useApi, useDebounced, useSort, useSSE } from "../hooks.js";
import { useCampus } from "../lib/campus.jsx";
import { runAction, useCrud } from "../lib/crud.js";
import { cx, daysBetween, fmtDate } from "../lib/format.js";
import { Check, Clipboard, Grid, Pencil, Plus, Rows, Search, Trash } from "../lib/icons.jsx";

const config = entities.assignments;

const GROUPS = [
  { id: "overdue", label: "Overdue", tone: "text-critical" },
  { id: "today", label: "Due today", tone: "text-critical" },
  { id: "week", label: "Next 7 days", tone: "text-caution" },
  { id: "later", label: "Later", tone: "text-ink-2" },
  { id: "done", label: "Submitted & graded", tone: "text-positive" },
];

function groupOf(assignment, today) {
  if (assignment.status === "submitted" || assignment.status === "graded") return "done";
  const diff = daysBetween(today, assignment.deadline);
  if (diff === null) return "later";
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= 7) return "week";
  return "later";
}

function AssignmentRow({ assignment, today, onEdit, onDelete, onSubmit, busy }) {
  const diff = daysBetween(today, assignment.deadline);
  const open = assignment.status === "pending" || assignment.status === "late";
  const urgency =
    !open || diff === null ? "neutral" : diff < 0 ? "critical" : diff === 0 ? "critical" : diff <= 7 ? "caution" : "neutral";

  return (
    <li className="flex flex-col gap-3 border-b border-line px-4 py-3.5 last:border-0 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">{assignment.course}</Badge>
          <h2 className="text-sm font-medium text-ink">{assignment.title}</h2>
          <StatusBadge value={assignment.status} />
        </div>
        <p className="mt-1 line-clamp-1 text-[13px] text-ink-3">{assignment.description}</p>
      </div>

      <div className="flex items-center gap-4 sm:justify-end">
        <div className="text-right">
          <p
            className={cx(
              "text-[13px] font-medium tabular",
              urgency === "critical" ? "text-critical" : urgency === "caution" ? "text-caution" : "text-ink-2",
            )}
          >
            {fmtDate(assignment.deadline)}
          </p>
          <p className="text-[11px] text-ink-3">{assignment.submission_platform}</p>
        </div>

        <div className="flex items-center gap-0.5">
          {open ? (
            <Button size="sm" icon={Check} onClick={() => onSubmit(assignment)} loading={busy}>
              <span className="hidden md:inline">Mark submitted</span>
              <span className="md:hidden">Submit</span>
            </Button>
          ) : null}
          <IconButton icon={Pencil} label={`Edit ${assignment.title}`} size={15} onClick={() => onEdit(assignment)} />
          <IconButton
            icon={Trash}
            label={`Delete ${assignment.title}`}
            size={15}
            variant="danger"
            onClick={() => onDelete(assignment)}
          />
        </div>
      </div>
    </li>
  );
}

export default function Assignments({ initialQuery = "" }) {
  const { data, error, staleError, loading, refreshing, refresh } = useApi(config.endpoint);
  const { today } = useCampus();
  const [view, setView] = useState("board");
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(null);
  const search = useDebounced(query);

  useSSE("assignments", refresh);

  const crud = useCrud({ endpoint: config.endpoint, singular: "assignment", refresh, labelFor: (row) => row.title });

  const filtered = useMemo(() => {
    const rows = data ?? [];
    const needle = search.trim().toLowerCase();
    return rows
      .filter((row) => {
        if (status && row.status !== status) return false;
        if (!needle) return true;
        return config.searchKeys.some((key) => String(row[key] ?? "").toLowerCase().includes(needle));
      })
      .sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)));
  }, [data, search, status]);

  const grouped = useMemo(() => {
    const buckets = Object.fromEntries(GROUPS.map((group) => [group.id, []]));
    filtered.forEach((assignment) => buckets[groupOf(assignment, today)].push(assignment));
    return buckets;
  }, [filtered, today]);

  const markSubmitted = async (assignment) => {
    setPending(assignment.id);
    await runAction(api.put(`${config.endpoint}/${assignment.id}`, { status: "submitted" }), {
      success: `“${assignment.title}” marked submitted`,
      refresh,
    });
    setPending(null);
  };

  const { sorted, sort, toggle } = useSort(filtered, null, config.columns);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Assignments"
        blurb={config.blurb}
        actions={
          <Button variant="primary" icon={Plus} onClick={crud.openCreate}>
            <span className="hidden sm:inline">Add assignment</span>
            <span className="sm:hidden">Add</span>
          </Button>
        }
      >
        <Toolbar
          right={
            <>
              <ResultCount shown={filtered.length} total={data?.length ?? 0} noun="assignments" />
              <LiveDot active={refreshing} />
              <Segmented
                label="Assignment view"
                value={view}
                onChange={setView}
                options={[
                  { value: "board", label: "Grouped", icon: Grid, iconOnly: true },
                  { value: "table", label: "Table", icon: Rows, iconOnly: true },
                ]}
              />
            </>
          }
        >
          <SearchInput value={query} onChange={setQuery} placeholder="Search assignments" id="search-assignments" />
          <FilterSelect
            label="Status"
            allLabel="Any status"
            options={["pending", "submitted", "graded", "late"]}
            value={status}
            onChange={setStatus}
          />
        </Toolbar>
      </PageHeader>

      <StaleNotice message={staleError} onRetry={refresh} />

      {error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={data?.length ? Search : Clipboard}
            title={data?.length ? "No assignments match" : "No assignments yet"}
            description={data?.length ? "Try another search term or status." : "Add the first deadline to track it here."}
            action={
              <Button variant="primary" icon={Plus} onClick={crud.openCreate}>
                Add assignment
              </Button>
            }
          />
        </Card>
      ) : view === "board" ? (
        <div className="flex flex-col gap-4">
          {GROUPS.map((group) => {
            const rows = grouped[group.id];
            if (!rows.length) return null;
            return (
              <section key={group.id} aria-label={group.label}>
                <h2 className={cx("mb-2 flex items-center gap-2 text-[13px] font-semibold", group.tone)}>
                  {group.label}
                  <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[11px] font-medium text-ink-3 tabular">
                    {rows.length}
                  </span>
                </h2>
                <Card className="overflow-hidden">
                  <ul>
                    {rows.map((assignment) => (
                      <AssignmentRow
                        key={assignment.id}
                        assignment={assignment}
                        today={today}
                        busy={pending === assignment.id}
                        onEdit={crud.openEdit}
                        onDelete={crud.remove}
                        onSubmit={markSubmitted}
                      />
                    ))}
                  </ul>
                </Card>
              </section>
            );
          })}
        </div>
      ) : (
        <DataTable
          columns={config.columns}
          rows={sorted}
          label="Assignments"
          sort={sort}
          onSort={toggle}
          onEdit={crud.openEdit}
          onDelete={crud.remove}
          labelFor={(row) => row.title}
        />
      )}

      {crud.modal ? (
        <RecordModal
          title={crud.modal.mode === "edit" ? "Edit assignment" : "New assignment"}
          recordKey={`assignment-${crud.modal.mode}-${crud.modal.row?.id ?? "new"}`}
          description={crud.modal.row ? `${crud.modal.row.course} · due ${fmtDate(crud.modal.row.deadline)}` : undefined}
          fields={config.fields}
          initial={crud.modal.row ?? { assigned_date: today }}
          submitLabel={crud.modal.mode === "edit" ? "Save changes" : "Add assignment"}
          onSubmit={crud.save}
          onClose={crud.close}
        />
      ) : null}
    </div>
  );
}
