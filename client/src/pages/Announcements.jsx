import { useMemo, useState } from "react";
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
import { Badge, Button, Card, EmptyState, IconButton, Segmented, Skeleton, StatusBadge } from "../components/ui.jsx";
import { entities } from "../entities.jsx";
import { useApi, useDebounced, useSort, useSSE } from "../hooks.js";
import { useCampus } from "../lib/campus.jsx";
import { useCrud } from "../lib/crud.js";
import { cx, fmtDate, relativeDay } from "../lib/format.js";
import { isExpired } from "../lib/rules.js";
import { Grid, Megaphone, Pencil, Plus, Rows, Search, Trash } from "../lib/icons.jsx";

const config = entities.announcements;
const RANK = { high: 0, medium: 1, low: 2 };
const ACCENT = { high: "bg-critical", medium: "bg-caution", low: "bg-line-strong" };

function NoticeCard({ notice, today, expired, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="flex overflow-hidden">
      <span className={cx("w-1 shrink-0", expired ? "bg-line-strong" : ACCENT[notice.priority])} aria-hidden="true" />
      <div className="min-w-0 flex-1 p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className={cx("text-[15px] leading-snug font-semibold", expired ? "text-ink-2" : "text-ink")}>
            {notice.title}
          </h2>
          <div className="flex shrink-0 items-center gap-1.5">
            <StatusBadge value={notice.priority} dot />
            {expired ? <Badge>Expired</Badge> : null}
          </div>
        </div>

        <p className={cx("mt-2 text-[13px] leading-relaxed text-ink-2", !expanded && "line-clamp-3")}>{notice.body}</p>
        {notice.body.length > 110 ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="mt-1 text-[13px] font-medium text-accent hover:text-accent-hover"
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        ) : null}

        <div className="mt-3 flex items-end justify-between gap-2">
          <p className="text-xs text-ink-3">
            {notice.posted_by} · posted {relativeDay(notice.date, today)} · expires {fmtDate(notice.expires)}
          </p>
          <span className="flex items-center gap-0.5">
            <IconButton icon={Pencil} label={`Edit ${notice.title}`} size={15} onClick={() => onEdit(notice)} />
            <IconButton icon={Trash} label={`Delete ${notice.title}`} size={15} variant="danger" onClick={() => onDelete(notice)} />
          </span>
        </div>
      </div>
    </Card>
  );
}

export default function Announcements({ initialQuery = "" }) {
  const { data, error, staleError, loading, refreshing, refresh } = useApi("/api/announcements");
  const { today } = useCampus();
  const [view, setView] = useState("board");
  const [query, setQuery] = useState(initialQuery);
  const [priority, setPriority] = useState("");
  const [showExpired, setShowExpired] = useState(false);
  const search = useDebounced(query);

  useSSE("announcements", refresh);

  const crud = useCrud({ endpoint: config.endpoint, singular: "announcement", refresh, labelFor: (row) => row.title });

  const filtered = useMemo(() => {
    const rows = data ?? [];
    const needle = search.trim().toLowerCase();
    return rows
      .filter((notice) => {
        if (priority && notice.priority !== priority) return false;
        if (!showExpired && isExpired(notice, today)) return false;
        if (!needle) return true;
        return config.searchKeys.some((key) => String(notice[key] ?? "").toLowerCase().includes(needle));
      })
      // Active notices always outrank expired ones, whatever their priority.
      .sort(
        (a, b) =>
          Number(isExpired(a, today)) - Number(isExpired(b, today)) ||
          RANK[a.priority] - RANK[b.priority] ||
          String(b.date).localeCompare(String(a.date)),
      );
  }, [data, search, priority, showExpired, today]);

  const { sorted, sort, toggle } = useSort(filtered, null, config.columns);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Announcements"
        blurb={config.blurb}
        actions={
          <Button variant="primary" icon={Plus} onClick={crud.openCreate}>
            <span className="hidden sm:inline">Post announcement</span>
            <span className="sm:hidden">Post</span>
          </Button>
        }
      >
        <Toolbar
          right={
            <>
              <ResultCount shown={filtered.length} total={data?.length ?? 0} noun="notices" />
              <LiveDot active={refreshing} />
              <Segmented
                label="Announcement view"
                value={view}
                onChange={setView}
                options={[
                  { value: "board", label: "Board", icon: Grid, iconOnly: true },
                  { value: "table", label: "Table", icon: Rows, iconOnly: true },
                ]}
              />
            </>
          }
        >
          <SearchInput value={query} onChange={setQuery} placeholder="Search notices" id="search-announcements" />
          <FilterSelect
            label="Priority"
            allLabel="Any priority"
            options={["high", "medium", "low"]}
            value={priority}
            onChange={setPriority}
          />
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-line-control bg-surface px-3 text-[13px] text-ink-2 transition-colors hover:border-ink-3">
            <input
              type="checkbox"
              checked={showExpired}
              onChange={(event) => setShowExpired(event.target.checked)}
              className="size-3.5 accent-accent"
            />
            Include expired
          </label>
        </Toolbar>
      </PageHeader>

      <StaleNotice message={staleError} onRetry={refresh} />

      {error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={data?.length ? Search : Megaphone}
            title={data?.length ? "No notices match" : "No announcements yet"}
            description={
              data?.length ? "Try another search term or priority." : "Post the first notice — students and the assistant see it instantly."
            }
            action={
              <Button variant="primary" icon={Plus} onClick={crud.openCreate}>
                Post announcement
              </Button>
            }
          />
        </Card>
      ) : view === "board" ? (
        <div className="grid items-start gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((notice) => (
            <NoticeCard
              key={notice.id}
              notice={notice}
              today={today}
              expired={isExpired(notice, today)}
              onEdit={crud.openEdit}
              onDelete={crud.remove}
            />
          ))}
        </div>
      ) : (
        <DataTable
          columns={config.columns}
          rows={sorted}
          label="Announcements"
          sort={sort}
          onSort={toggle}
          onEdit={crud.openEdit}
          onDelete={crud.remove}
          labelFor={(row) => row.title}
        />
      )}

      {crud.modal ? (
        <RecordModal
          title={crud.modal.mode === "edit" ? "Edit announcement" : "New announcement"}
          recordKey={`notice-${crud.modal.mode}-${crud.modal.row?.id ?? "new"}`}
          description="High-priority notices are surfaced on Today and can change the timetable."
          fields={config.fields}
          initial={crud.modal.row ?? { date: today, expires: today }}
          submitLabel={crud.modal.mode === "edit" ? "Save changes" : "Post announcement"}
          onSubmit={crud.save}
          onClose={crud.close}
        />
      ) : null}
    </div>
  );
}
