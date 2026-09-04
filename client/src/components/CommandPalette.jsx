import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../api.js";
import { useDebounced } from "../hooks.js";
import { cx } from "../lib/format.js";
import { Calendar, Clipboard, Door, Megaphone, Search, Ticket, Today } from "../lib/icons.jsx";
import { Kbd } from "./ui.jsx";

const PAGES = [
  { tab: "overview", label: "Today", hint: "Overview of your day", icon: Today },
  { tab: "schedules", label: "Class Schedules", hint: "Weekly timetable", icon: Calendar },
  { tab: "rooms", label: "Rooms", hint: "Availability and bookings", icon: Door },
  { tab: "events", label: "Events", hint: "Register or manage events", icon: Ticket },
  { tab: "announcements", label: "Announcements", hint: "Campus notices", icon: Megaphone },
  { tab: "assignments", label: "Assignments", hint: "Deadlines and status", icon: Clipboard },
];

const RECORD_TABS = {
  announcement: { tab: "announcements", label: "Announcement", icon: Megaphone },
  event: { tab: "events", label: "Event", icon: Ticket },
  assignment: { tab: "assignments", label: "Assignment", icon: Clipboard },
  schedule: { tab: "schedules", label: "Class", icon: Calendar },
  room: { tab: "rooms", label: "Room", icon: Door },
};

/** ⌘K launcher: jumps between sections and runs hybrid search over live records. */
export default function CommandPalette({ open, onClose, onNavigate }) {
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState([]);
  const [active, setActive] = useState(0);
  const [searching, setSearching] = useState(false);
  const listRef = useRef(null);
  const debounced = useDebounced(query, 200);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setRecords([]);
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const term = debounced.trim();
    if (term.length < 2) {
      setRecords([]);
      return undefined;
    }
    let cancelled = false;
    setSearching(true);
    api
      .get(`/api/search?q=${encodeURIComponent(term)}`)
      .then((results) => {
        if (!cancelled) setRecords(results.slice(0, 6));
      })
      .catch(() => {
        if (!cancelled) setRecords([]);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, open]);

  const pageMatches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return PAGES;
    return PAGES.filter((page) => page.label.toLowerCase().includes(term) || page.hint.toLowerCase().includes(term));
  }, [query]);

  const items = useMemo(
    () => [
      ...pageMatches.map((page) => ({ kind: "page", key: `page-${page.tab}`, ...page })),
      ...records.map((record) => {
        const meta = RECORD_TABS[record.entity_type] ?? { tab: "overview", label: record.entity_type, icon: Search };
        return {
          kind: "record",
          key: `${record.entity_type}-${record.entity_id}`,
          label: record.content.split(" — ")[0].slice(0, 80),
          hint: record.content.slice(0, 120),
          ...meta,
        };
      }),
    ],
    [pageMatches, records],
  );

  useEffect(() => setActive(0), [items.length]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((index) => (items.length ? (index + 1) % items.length : 0));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((index) => (items.length ? (index - 1 + items.length) % items.length : 0));
      } else if (event.key === "Enter") {
        event.preventDefault();
        const item = items[active];
        if (item) {
          onNavigate(item.tab, item.kind === "record" ? query.trim() : "");
          onClose();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, items, active, onNavigate, onClose, query]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-70 flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 bg-overlay animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search CampusOS"
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-lg animate-sheet"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search size={17} className="text-ink-3" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages, notices, events, assignments…"
            aria-label="Search CampusOS"
            className="h-12 flex-1 bg-transparent text-sm outline-none"
          />
          {searching ? <span className="text-[11px] text-ink-3">searching…</span> : null}
          <Kbd>Esc</Kbd>
        </div>

        <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-ink-3">
              Nothing matches “{query}”. Try a course code, room number or keyword.
            </p>
          ) : (
            <ul>
              {items.map((item, index) => {
                const Icon = item.icon;
                const first = index === 0 || items[index - 1].kind !== item.kind;
                return (
                  <li key={item.key}>
                    {first ? (
                      <p className="px-4 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
                        {item.kind === "page" ? "Go to" : "Records"}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      data-active={index === active}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => {
                        onNavigate(item.tab, item.kind === "record" ? query.trim() : "");
                        onClose();
                      }}
                      className={cx(
                        "flex w-full items-center gap-3 px-4 py-2 text-left transition-colors",
                        index === active ? "bg-surface-3" : "hover:bg-surface-2",
                      )}
                    >
                      <Icon size={16} className="shrink-0 text-ink-3" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-ink">{item.label}</span>
                        <span className="block truncate text-[12px] text-ink-3">{item.hint}</span>
                      </span>
                      {item.kind === "record" ? (
                        <span className="shrink-0 text-[11px] text-ink-3 capitalize">{item.label ? item.tab : ""}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="flex items-center gap-3 border-t border-line bg-surface-2 px-4 py-2 text-[11px] text-ink-3">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd> open
          </span>
          <span className="ml-auto">Searches live records — never a cached copy</span>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
