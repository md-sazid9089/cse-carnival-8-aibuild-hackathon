export default function DataTable({ columns, rows, onEdit, onDelete, renderExtra }) {
  if (!rows?.length)
    return <div className="text-slate-400 text-sm py-12 text-center">No records yet — add one above.</div>;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-slate-500">
            {columns.map((c) => (
              <th key={c.key} className="px-3 py-2.5 font-medium whitespace-nowrap">{c.label}</th>
            ))}
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/60">
              {columns.map((c) => (
                <td key={c.key} className="px-3 py-2.5 whitespace-nowrap">
                  {c.render ? c.render(row) : String(row[c.key] ?? "")}
                </td>
              ))}
              <td className="px-3 py-2.5 text-right whitespace-nowrap space-x-2">
                {renderExtra && renderExtra(row)}
                <button onClick={() => onEdit(row)} className="text-indigo-600 hover:underline">Edit</button>
                <button onClick={() => onDelete(row)} className="text-rose-600 hover:underline">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Badge({ value, map }) {
  const cls = map[value] || "bg-slate-100 text-slate-600";
  return <span className={`${cls} text-xs font-medium px-2 py-0.5 rounded-full`}>{value}</span>;
}
