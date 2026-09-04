import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../api.js";
import { useDebounced } from "../hooks.js";
import { useFocusTrap } from "../lib/focus.js";
import { cx } from "../lib/format.js";
import { Calendar, Clipboard, Door, Megaphone, Search, Ticket, Today } from "../lib/icons.jsx";
import { Badge, Kbd } from "./ui.jsx";

const PAGES = [
  { tab: "overview", label: "Today", hint: "Your next class, deadlines and notices", icon: Today },
  { tab: "schedules", label: "Class Schedules", hint: "Weekly timetable", icon: Calendar },
  { tab: "rooms", label: "Rooms", hint: "Availability and bookings", icon: Door },
  { tab: "events", label: "Events", hint: "Register or manage events", icon: Ticket },
  { tab: "announcements", label: "Announcements", hint: "Campus notices", icon: Megaphone },
  { tab: "assignments", label: "Assignments", hint: "Deadlines and status", icon: Clipboard },
];

const RECORD_TABS = {
  announcement: { tab: "announcements", typeLabel: "Notice", icon: Megaphone },
  event: { tab: "events", typeLabel: "Event", icon: Ticket },
  assignment: { tab: "assignments", typeLabel: "Assignment", icon: Clipboard },
};

/**
 * The search index stores one display string per record. Pull the record's own
 * title back out of it so the term we navigate with actually matches a field the
 * destination page filters on.
 *   announcement / event -> "Title. Body (meta)"
 *   assignment           -> "COURSE Course title: Title. Body (meta)"
 */
function parseIndexed(entityType, content) {
  const text = String(content ?? "").trim();
  const body = entityType === "assignment" && text.includes(":") ? text.slice(text.indexOf(":") + 1) : text;
  const dot = body.indexOf(".");
  return {
    title: (dot >= 0 ? body.slice(0, dot) : body).trim(),
    rest: (dot >= 0 ? body.slice(dot + 1) : "").trim(),
  };
}

/** Ctrl/⌘K launcher: jumps between sections and searches live records. */
export default function CommandPalette({ open, onClose, onNavigate }) {
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState([]);
  const [active, setActive] = useState(0);
  const [searching, setSearching] = useState(false);
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();
  const debounced = useDebounced(query, 200);

  useFocusTrap({ active: open, containerRef: panelRef, onClose, initialFocusRef: inputRef });

  useEffect(() => {
    if (!open) {
      setQuery("");
      setRecords([]);
      setActive(0);
      setSearching(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const term = debounced.trim();
    if (term.length < 2) {
      setRecords([]);
      setSearching(false);
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
        const meta = RECORD_TABS[record.entity_type] ?? {
          tab: "overview",
          typeLabel: record.entity_type,
          icon: Search,
        };
        // The index stores one display string per record; recover the title from it.
        const { title, rest } = parseIndexed(record.entity_type, record.content);
        return {
          kind: "record",
          key: `${record.entity_type}-${record.entity_id}`,
          tab: meta.tab,
          icon: meta.icon,
          typeLabel: meta.typeLabel,
          // Navigate with the record's own title so the destination page's
          // substring filter always matches what was picked.
          term: title.slice(0, 40),
          label: title.slice(0, 90),
          hint: rest.slice(0, 110) || "Open in its section",
        };
      }),
    ],
    [pageMatches, records],
  );

  const itemsKey = items.map((item) => item.key).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setActive(0), [itemsKey]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((index) => (items.length ? (index + 1) % items.length : 0));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((index) => (items.length ? (index - 1 + items.length) % items.length : 0));
      } else if (event.key === "Enter") {
        event.preventDefault();
        const item = items[active];
        if (item) {
          onNavigate(item.tab, item.kind === "record" ? item.term : "");
          onClose();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, items, active, onNavigate, onClose]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  const activeId = items[active] ? `${listId}-${items[active].key}` : undefined;

  return createPortal(
    <div className="fixed inset-0 z-70 flex items-start justify-center px-4 pt-[10dvh]">
      <div className="absolute inset-0 bg-overlay animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search CampusOS"
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-lg animate-sheet"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search size={17} className="text-ink-3" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages, notices, events, assignments…"
            aria-label="Search CampusOS"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            autoComplete="off"
            className="h-12 flex-1 bg-transparent text-sm outline-none"
          />
          <Kbd>Esc</Kbd>
        </div>

        <p className="sr-only" aria-live="polite">
          {searching ? "Searching" : `${items.length} result${items.length === 1 ? "" : "s"}`}
        </p>

        <div ref={listRef} className="max-h-[45dvh] overflow-y-auto py-2">
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-ink-3">
              {searching ? "Searching…" : `Nothing matches “${query}”. Try a course code, room number or keyword.`}
            </p>
          ) : (
            <ul id={listId} role="listbox" aria-label="Search results">
              {items.map((item, index) => {
                const Icon = item.icon;
                const first = index === 0 || items[index - 1].kind !== item.kind;
                return (
                  <li key={item.key} role="presentation">
                    {first ? (
                      <p className="px-4 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
                        {item.kind === "page" ? "Go to" : "Records"}
                      </p>
                    ) : null}
                    <div
                      id={`${listId}-${item.key}`}
                      role="option"
                      aria-selected={index === active}
                      data-active={index === active}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => {
                        onNavigate(item.tab, item.kind === "record" ? item.term : "");
                        onClose();
                      }}
                      className={cx(
                        "flex cursor-pointer items-center gap-3 px-4 py-2 transition-colors",
                        index === active ? "bg-surface-3" : "hover:bg-surface-2",
                      )}
                    >
                      <Icon size={16} className="shrink-0 text-ink-3" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-ink">{item.label}</span>
                        <span className="block truncate text-[12px] text-ink-3">{item.hint}</span>
                      </span>
                      {item.kind === "record" ? <Badge>{item.typeLabel}</Badge> : null}
                    </div>
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
        </footer>
      </div>
    </div>,
    document.body,
  );
}
