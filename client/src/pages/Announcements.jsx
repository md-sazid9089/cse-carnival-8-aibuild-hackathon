import { useMemo, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import { ErrorState, FilterSelect, LiveDot, PageHeader, ResultCount, SearchInput, Toolbar } from "../components/page.jsx";
import RecordModal from "../components/RecordModal.jsx";
import { Badge, Button, Card, EmptyState, IconButton, Segmented, Skeleton, StatusBadge } from "../components/ui.jsx";
import { entities } from "../entities.jsx";
import { useApi, useDebounced, useSort, useSSE } from "../hooks.js";
import { useCampus } from "../lib/campus.jsx";
import { useCrud } from "../lib/crud.js";
import { cx, fmtDate, relativeDay } from "../lib/format.js";
import { Grid, Megaphone, Pencil, Plus, Rows, Search, Trash } from "../lib/icons.jsx";

const config = entities.announcements;
const RANK = { high: 0, medium: 1, low: 2 };
const ACCENT = { high: "bg-critical", medium: "bg-caution", low: "bg-line-strong" };

function NoticeCard({ notice, today, expired, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className={cx("flex overflow-hidden", expired && "opacity-70")}>
      <span className={cx("w-1 shrink-0", ACCENT[notice.priority])} aria-hidden="true" />
      <div className="min-w-0 flex-1 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[15px] leading-snug font-semibold text-ink">{notice.title}</h3>
          <div className="flex shrink-0 items-center gap-1.5">
            <StatusBadge value={notice.priority} dot />
            {expired ? <Badge>Expired</Badge> : null}
          </div>
        </div>

        <p className={cx("mt-2 text-[13px] leading-relaxed text-ink-2", !expanded && "line-clamp-3")}>{notice.body}</p>
        {notice.body.length > 160 ? (
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
  const { data, error, loading, refreshing, refresh } = useApi("/api/announcements");
  const { today } = useCampus();
  const [view, setView] = useState("board");
  const [query, setQuery] = useState(initialQuery);
  const [priority, setPriority] = useState("");
  const [showExpired, setShowExpired] = useState(true);
  const search = useDebounced(query);

  useSSE("announcements", refresh);

  const crud = useCrud({ endpoint: config.endpoint, singular: "announcement", refresh, labelFor: (row) => row.title });

  const isExpired = (notice) => notice.expires < today;

  const filtered = useMemo(() => {
    const rows = data ?? [];
    const needle = search.trim().toLowerCase();
    return rows
      .filter((notice) => {
        if (priority && notice.priority !== priority) return false;
        if (!showExpired && notice.expires < today) return false;
        if (!needle) return true;
        return config.searchKeys.some((key) => String(notice[key] ?? "").toLowerCase().includes(needle));
      })
      .sort((a, b) => RANK[a.priority] - RANK[b.priority] || b.date.localeCompare(a.date));
  }, [data, search, priority, showExpired, today]);

  const { sorted, sort, toggle } = useSort(filtered);

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
          <FilterSelect label="Priority" options={["high", "medium", "low"]} value={priority} onChange={setPriority} />
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 text-[13px] text-ink-2 transition-colors hover:border-line-strong">
            <input
              type="checkbox"
              checked={showExpired}
              onChange={(event) => setShowExpired(event.target.checked)}
              className="size-3.5 accent-accent"
            />
            Show expired
          </label>
        </Toolbar>
      </PageHeader>

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
        <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((notice) => (
            <NoticeCard
              key={notice.id}
              notice={notice}
              today={today}
              expired={isExpired(notice)}
              onEdit={crud.openEdit}
              onDelete={crud.remove}
            />
          ))}
        </div>
      ) : (
        <DataTable
          columns={config.columns}
          rows={sorted}
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
          description="High-priority notices can override the timetable — the assistant checks them before answering."
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
