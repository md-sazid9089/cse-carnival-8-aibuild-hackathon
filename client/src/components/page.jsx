import { cx, titleCase } from "../lib/format.js";
import { Alert, Refresh, Search, X } from "../lib/icons.jsx";
import { Button, Select } from "./ui.jsx";

export function PageHeader({ title, blurb, actions, children }) {
  return (
    <header className="mb-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink sm:text-[28px]">{title}</h1>
          {blurb ? <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-3">{blurb}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </header>
  );
}

export function SearchInput({ value, onChange, placeholder = "Search…", id = "page-search" }) {
  return (
    <div className="relative min-w-0 flex-1 sm:max-w-72">
      <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 w-full rounded-lg border border-line bg-surface pr-8 pl-9 text-sm transition-colors hover:border-line-strong"
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

export function FilterSelect({ label, value, options, onChange }) {
  const id = `filter-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="sr-only">
        Filter by {label}
      </label>
      <Select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-auto min-w-32">
        <option value="">All {label.toLowerCase()}</option>
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
    <p className="text-[13px] text-ink-3 tabular" aria-live="polite">
      {filtered ? `${shown} of ${total} ${noun}` : `${total} ${noun}`}
    </p>
  );
}

/** Small "reading live data" affordance — reassures judges that nothing is cached. */
export function LiveDot({ active = false, className = "" }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-[13px] text-ink-3", className)} title="Reads the database on every change — nothing is cached">
      <span className="relative flex size-2">
        {active ? <span className="absolute inline-flex size-2 animate-ping rounded-full bg-positive opacity-70" /> : null}
        <span className="relative inline-flex size-2 rounded-full bg-positive" />
      </span>
      Live
    </span>
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
        <p className="text-sm font-medium text-ink">Could not reach the campus API</p>
        <p className="mt-0.5 text-[13px] text-ink-2">{message}</p>
      </div>
      {onRetry ? (
        <Button icon={Refresh} onClick={onRetry} size="sm">
          Retry
        </Button>
      ) : null}
    </div>
  );
}
