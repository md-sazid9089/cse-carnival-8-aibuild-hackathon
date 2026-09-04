import { useStreamStatus } from "../hooks.js";
import { cx, titleCase } from "../lib/format.js";
import { Alert, Refresh, Search, X } from "../lib/icons.jsx";
import { Button, Select } from "./ui.jsx";

export function PageHeader({ title, blurb, actions, children }) {
  return (
    <header className="mb-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink sm:text-[28px]">{title}</h1>
          {blurb ? <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink-3">{blurb}</p> : null}
        </div>
        {actions ? <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </header>
  );
}

export function SearchInput({ value, onChange, placeholder = "Search…", id = "page-search" }) {
  return (
    <div className="relative min-w-0 basis-full sm:max-w-72 sm:basis-auto sm:flex-1">
      <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 w-full rounded-lg border border-line-control bg-surface pr-8 pl-9 text-sm transition-colors hover:border-ink-3"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-ink-3 hover:bg-surface-3 hover:text-ink"
        >
          <X size={13} />
        </button>
      ) : null}
    </div>
  );
}

export function FilterSelect({ label, allLabel, value, options, onChange }) {
  const id = `filter-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="sr-only">
        Filter by {label}
      </label>
      <Select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-auto min-w-30"
      >
        <option value="">{allLabel ?? `All ${label.toLowerCase()}`}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {titleCase(option)}
          </option>
        ))}
      </Select>
    </div>
  );
}

/** Toolbar under a page title: search, filters, then live status on the right. */
export function Toolbar({ children, right }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {children}
      {right ? <div className="ml-auto flex items-center gap-2">{right}</div> : null}
    </div>
  );
}

export function ResultCount({ shown, total, noun }) {
  const filtered = shown !== total;
  return (
    <p className="text-[13px] text-ink-2 tabular" aria-live="polite">
      {filtered ? `${shown} of ${total}` : total}
      <span className="hidden sm:inline"> {noun}</span>
    </p>
  );
}

/** Freshness badge driven by the real EventSource state — a status light that
 *  cannot be wrong is not a status light. */
export function LiveDot({ active = false, className = "" }) {
  const status = useStreamStatus();
  const tone = {
    live: { dot: "bg-positive", label: "Live", title: "Connected — updates arrive as they happen" },
    connecting: { dot: "bg-caution", label: "Connecting", title: "Reconnecting to the campus server" },
    offline: { dot: "bg-critical", label: "Offline", title: "Not connected — this view may be out of date" },
  }[status];

  return (
    <span className={cx("inline-flex items-center gap-1.5 text-[13px] text-ink-2", className)} title={tone.title}>
      <span className="relative flex size-2">
        {active && status === "live" ? (
          <span className={cx("absolute inline-flex size-2 animate-ping rounded-full opacity-70", tone.dot)} />
        ) : null}
        <span className={cx("relative inline-flex size-2 rounded-full", tone.dot)} />
      </span>
      {tone.label}
    </span>
  );
}

/** A background refresh failed but the page still has data — say so without
 *  replacing what the user is reading. */
export function StaleNotice({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="mb-3 flex items-center gap-2 rounded-lg border border-caution/30 bg-caution-soft px-3 py-2 text-[13px] text-ink-2">
      <Alert size={15} className="shrink-0 text-caution" />
      <span className="min-w-0 flex-1">Couldn’t refresh just now — showing the last data received.</span>
      <Button size="sm" variant="ghost" icon={Refresh} onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-xl border border-critical/30 bg-critical-soft px-4 py-4 sm:flex-row sm:items-center"
    >
      <Alert size={18} className="text-critical" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">This didn’t load</p>
        <p className="mt-0.5 text-[13px] text-ink-2">{message}</p>
      </div>
      {onRetry ? (
        <Button icon={Refresh} onClick={onRetry} size="sm">
          Try again
        </Button>
      ) : null}
    </div>
  );
}
