import { cx } from "../lib/format.js";
import { ChevronDown, Pencil, Trash } from "../lib/icons.jsx";
import { EmptyState, IconButton, Skeleton } from "./ui.jsx";

function SortHeader({ column, sort, onSort }) {
  const active = sort?.key === column.key;
  const direction = active ? sort.direction : null;

  if (!column.sortable || !onSort) {
    return (
      <th
        scope="col"
        className={cx(
          "px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-ink-3 uppercase whitespace-nowrap",
          column.align === "right" && "text-right",
        )}
      >
        {column.label}
      </th>
    );
  }

  return (
    <th
      scope="col"
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className={cx("px-1 py-1.5 text-left whitespace-nowrap", column.align === "right" && "text-right")}
    >
      <button
        type="button"
        onClick={() => onSort(column.key)}
        className={cx(
          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold tracking-wide uppercase transition-colors",
          active ? "text-ink" : "text-ink-3 hover:text-ink-2",
        )}
      >
        {column.label}
        <ChevronDown
          size={13}
          className={cx(
            "transition-[transform,opacity] duration-200",
            active ? "opacity-100" : "opacity-0",
            direction === "asc" && "rotate-180",
          )}
        />
      </button>
    </th>
  );
}

/**
 * Data table that becomes a card list below `md` — a wide table must never
 * force horizontal scrolling on a phone.
 */
export default function DataTable({
  columns,
  rows,
  label,
  loading = false,
  onEdit,
  onDelete,
  rowActions,
  getRowKey = (row) => row.id,
  labelFor = (row) => row.id,
  empty,
  sort,
  onSort,
}) {
  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="border-b border-line px-3 py-3">
          <Skeleton className="h-3.5 w-28" />
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line px-3 py-3.5 last:border-0">
            <Skeleton className="h-3.5 w-1/5" />
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3.5 w-1/6" />
            <Skeleton className="ml-auto h-3.5 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (!rows?.length) {
    return (
      <div className="rounded-xl border border-line bg-surface">{empty ?? <EmptyState title="Nothing here yet" />}</div>
    );
  }

  const actionsFor = (row) => (
    <div className="flex items-center justify-end gap-0.5">
      {rowActions?.(row)}
      {onEdit ? <IconButton icon={Pencil} label={`Edit ${labelFor(row)}`} size={15} onClick={() => onEdit(row)} /> : null}
      {onDelete ? (
        <IconButton
          icon={Trash}
          label={`Delete ${labelFor(row)}`}
          size={15}
          variant="danger"
          onClick={() => onDelete(row)}
        />
      ) : null}
    </div>
  );

  const primary = columns.find((c) => c.primary) ?? columns[0];
  const secondary = columns.filter((c) => c !== primary && !c.hideOnCard);

  return (
    <>
      {/* Phones: one card per record. */}
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((row) => (
          <li key={getRowKey(row)} className="rounded-xl border border-line bg-surface p-3.5 shadow-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 text-sm font-medium text-ink">
                {primary.render ? primary.render(row) : String(row[primary.key] ?? "—")}
              </div>
              {actionsFor(row)}
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
              {secondary.map((column) => (
                <div key={column.key} className={cx("min-w-0", column.wrap && "col-span-2")}>
                  <dt className="text-[11px] font-medium tracking-wide text-ink-3 uppercase">{column.label}</dt>
                  <dd className={cx("text-[13px] text-ink-2 tabular", column.wrap ? "wrap-break-word" : "truncate")}>
                    {column.render ? column.render(row) : String(row[column.key] ?? "—")}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>

      {/* Tablet and up: full table. */}
      <div className="hidden overflow-hidden rounded-xl border border-line bg-surface shadow-xs md:block">
        <div
          className="max-h-[calc(100vh-16rem)] overflow-auto"
          tabIndex={0}
          role="region"
          aria-label={label ? `${label} table` : "Data table"}
        >
          <table className="w-full border-collapse text-sm">
            {label ? <caption className="sr-only">{label}</caption> : null}
            <thead className="sticky top-0 z-10 bg-surface-2/95 backdrop-blur">
              <tr className="border-b border-line">
                {columns.map((column) => (
                  <SortHeader key={column.key} column={column} sort={sort} onSort={onSort} />
                ))}
                <th scope="col" className="px-3 py-2.5 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={getRowKey(row)}
                  className="border-b border-line transition-colors duration-100 last:border-0 hover:bg-surface-3"
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cx(
                        "px-3 py-2.5 align-middle text-ink-2 tabular",
                        column.wrap ? "min-w-52 max-w-80" : "whitespace-nowrap",
                        column.align === "right" && "text-right",
                        column === primary && "font-medium text-ink",
                      )}
                    >
                      {column.render ? column.render(row) : String(row[column.key] ?? "—")}
                    </td>
                  ))}
                  <td className="px-2 py-1.5">{actionsFor(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
