/** Small formatting helpers. All date math is calendar-based (no Date parsing of
 *  bare ISO dates, which browsers treat as UTC and can shift by a day). */

export const cx = (...parts) => parts.filter(Boolean).join(" ");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "2026-09-04" -> local Date at midnight (never UTC-shifted). */
export function parseDate(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export const toIso = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function addDays(iso, days) {
  const d = parseDate(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + days);
  return toIso(d);
}

export function daysBetween(fromIso, toIsoStr) {
  const a = parseDate(fromIso);
  const b = parseDate(toIsoStr);
  if (!a || !b) return null;
  return Math.round((b - a) / 86400000);
}

/** "14:00:00" -> "2:00 PM" */
export function fmtTime(value) {
  if (!value) return "";
  const [h, m] = String(value).split(":").map(Number);
  if (Number.isNaN(h)) return String(value);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m || 0).padStart(2, "0")} ${suffix}`;
}

export const fmtTimeRange = (start, end) => `${fmtTime(start)} – ${fmtTime(end)}`;

/** Minutes since midnight — used to place items on the day timeline. */
export function minutesOf(value) {
  if (!value) return 0;
  const [h, m] = String(value).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** "2026-09-04" -> "Thu, 4 Sep" */
export function fmtDate(iso, { withYear = false } = {}) {
  const d = parseDate(iso);
  if (!d) return iso ?? "";
  const base = `${WEEKDAYS[d.getDay()].slice(0, 3)}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return withYear ? `${base} ${d.getFullYear()}` : base;
}

export function fmtLongDate(iso) {
  const d = parseDate(iso);
  if (!d) return iso ?? "";
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Human relative day, anchored to the server's "today" so judges in other
 *  timezones still see the campus day. */
export function relativeDay(iso, todayIso) {
  const diff = daysBetween(todayIso, iso);
  if (diff === null) return iso ?? "";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return WEEKDAYS[parseDate(iso).getDay()];
  if (diff < -1 && diff > -7) return `${Math.abs(diff)} days ago`;
  return fmtDate(iso);
}

export function dueLabel(iso, todayIso) {
  const diff = daysBetween(todayIso, iso);
  if (diff === null) return { text: iso ?? "", tone: "neutral" };
  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, tone: "critical" };
  if (diff === 0) return { text: "Due today", tone: "critical" };
  if (diff === 1) return { text: "Due tomorrow", tone: "caution" };
  if (diff <= 7) return { text: `In ${diff} days`, tone: "caution" };
  return { text: fmtDate(iso), tone: "neutral" };
}

export function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export const titleCase = (value = "") => String(value).charAt(0).toUpperCase() + String(value).slice(1);

export { MONTHS, WEEKDAYS };
