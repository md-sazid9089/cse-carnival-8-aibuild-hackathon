import { forwardRef } from "react";
import { cx } from "../lib/format.js";
import { Spinner } from "../lib/icons.jsx";

/* ---------------------------------------------------------------- buttons */

const VARIANTS = {
  primary: "bg-ink text-ink-invert hover:bg-ink/88 shadow-xs",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2 shadow-xs",
  ghost: "text-ink-2 hover:bg-surface-3 hover:text-ink",
  accent: "bg-accent text-white hover:bg-accent-hover shadow-xs",
  danger: "text-critical hover:bg-critical-soft",
  dangerSolid: "bg-critical text-white hover:opacity-90 shadow-xs",
};

const SIZES = {
  sm: "h-8 px-2.5 text-[13px] gap-1.5 rounded-md",
  md: "h-9 px-3.5 text-sm gap-2 rounded-lg",
  lg: "h-11 px-5 text-sm gap-2 rounded-xl",
};

export const Button = forwardRef(function Button(
  {
    variant = "secondary",
    size = "md",
    icon: Icon,
    loading = false,
    className = "",
    children,
    type = "button",
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center font-medium whitespace-nowrap select-none",
        "transition-[background-color,color,box-shadow,transform] duration-150 ease-out-soft",
        "active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed disabled:active:scale-100",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner size={15} /> : Icon ? <Icon size={size === "sm" ? 15 : 16} /> : null}
      {children}
    </button>
  );
});

/** Icon-only button. `label` is required — it becomes the accessible name. */
export function IconButton({ icon: Icon, label, variant = "ghost", size = 18, className = "", ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "inline-grid place-items-center size-9 rounded-lg transition-colors duration-150",
        "disabled:opacity-45 disabled:cursor-not-allowed",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      <Icon size={size} />
    </button>
  );
}

/* ------------------------------------------------------------------ cards */

export function Card({ as: Tag = "div", className = "", interactive = false, ...rest }) {
  return (
    <Tag
      className={cx(
        "rounded-xl border border-line bg-surface shadow-xs",
        interactive && "transition-shadow duration-200 hover:shadow-md",
        className,
      )}
      {...rest}
    />
  );
}

export function CardHeader({ title, subtitle, action, icon: Icon, className = "" }) {
  return (
    <div className={cx("flex items-start justify-between gap-3 px-4 pt-4 pb-3", className)}>
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold tracking-wide text-ink-2 uppercase">
          {Icon ? <Icon size={15} className="text-ink-3" /> : null}
          {title}
        </h2>
        {subtitle ? <p className="mt-1 text-[13px] text-ink-3">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

/* ----------------------------------------------------------------- badges */

const TONES = {
  neutral: "bg-surface-3 text-ink-2",
  accent: "bg-accent-soft text-accent-ink",
  positive: "bg-positive-soft text-positive",
  caution: "bg-caution-soft text-caution",
  critical: "bg-critical-soft text-critical",
};

/** Domain status/priority -> tone. Colour is never the only signal: the label
 *  itself always carries the meaning. */
export const toneOf = (value) =>
  ({
    high: "critical",
    medium: "caution",
    low: "neutral",
    pending: "caution",
    submitted: "positive",
    graded: "accent",
    late: "critical",
    upcoming: "accent",
    ongoing: "positive",
    completed: "neutral",
    cancelled: "critical",
    full: "caution",
    available: "positive",
    unavailable: "critical",
    classroom: "neutral",
    lab: "accent",
    seminar: "neutral",
  })[value] ?? "neutral";

export function Badge({ tone = "neutral", children, className = "", dot = false }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium capitalize",
        TONES[tone],
        className,
      )}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export const StatusBadge = ({ value, dot = false }) =>
  value ? (
    <Badge tone={toneOf(value)} dot={dot}>
      {value}
    </Badge>
  ) : null;

/* ------------------------------------------------------------- form parts */

const CONTROL =
  "w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink transition-colors duration-150 " +
  "hover:border-line-strong disabled:opacity-50 disabled:cursor-not-allowed";

export function Field({ label, hint, error, required = false, htmlFor, className = "", children }) {
  return (
    <div className={cx("min-w-0", className)}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-ink-2">
        {label}
        {required ? <span className="ml-0.5 text-critical">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-critical">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

export const TextInput = forwardRef(function TextInput({ className = "", invalid = false, ...rest }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cx(CONTROL, "h-9", invalid && "border-critical", className)}
      {...rest}
    />
  );
});

export const TextArea = forwardRef(function TextArea({ className = "", invalid = false, rows = 3, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cx(CONTROL, "resize-y py-2 leading-relaxed", invalid && "border-critical", className)}
      {...rest}
    />
  );
});

export const Select = forwardRef(function Select({ className = "", invalid = false, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cx(CONTROL, "h-9 appearance-none pr-8 capitalize", invalid && "border-critical", className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238a8a94' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 10px center",
      }}
      {...rest}
    >
      {children}
    </select>
  );
});

/* ------------------------------------------------------------ misc pieces */

export function Segmented({ options, value, onChange, label }) {
  return (
    <div role="group" aria-label={label} className="inline-flex gap-0.5 rounded-lg border border-line bg-surface-2 p-0.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            title={opt.label}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-[7px] px-2.5 h-7 text-[13px] font-medium transition-colors duration-150",
              active ? "bg-surface text-ink shadow-xs" : "text-ink-3 hover:text-ink-2",
            )}
          >
            {opt.icon ? <opt.icon size={14} /> : null}
            <span className={opt.iconOnly ? "sr-only" : undefined}>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export const Skeleton = ({ className = "" }) => <div className={cx("skeleton", className)} aria-hidden="true" />;

export function EmptyState({ icon: Icon, title, description, action, compact = false }) {
  return (
    <div className={cx("flex flex-col items-center text-center", compact ? "py-8 px-4" : "py-14 px-6")}>
      {Icon ? (
        <span className="mb-3 grid size-11 place-items-center rounded-xl bg-surface-3 text-ink-3">
          <Icon size={20} />
        </span>
      ) : null}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? <p className="mt-1 max-w-xs text-[13px] text-ink-3">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export const Kbd = ({ children }) => (
  <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-[11px] font-medium text-ink-3">
    {children}
  </kbd>
);

export function Meter({ value, max, tone }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const resolved = tone ?? (pct >= 100 ? "critical" : pct >= 80 ? "caution" : "positive");
  const bar = { positive: "bg-positive", caution: "bg-caution", critical: "bg-critical" }[resolved];
  return (
    <div className="min-w-24">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs text-ink-2 tabular">
        <span className="font-medium text-ink">
          {value}
          <span className="text-ink-3">/{max}</span>
        </span>
        <span className="text-ink-3">{pct}%</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-surface-3"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={`${value} of ${max} filled`}
      >
        <div className={cx("h-full rounded-full transition-[width] duration-500 ease-out-soft", bar)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
