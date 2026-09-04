import { useEffect, useState } from "react";

export default function RecordModal({ title, fields, initial, onSubmit, onClose }) {
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const base = {};
    fields.forEach((f) => {
      base[f.key] = initial?.[f.key] ?? f.default ?? "";
      if (f.type === "tags" && Array.isArray(base[f.key])) base[f.key] = base[f.key].join(", ");
    });
    setForm(base);
  }, [fields, initial]);

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    const out = { ...form };
    fields.forEach((f) => {
      if (f.type === "tags") out[f.key] = String(out[f.key]).split(",").map((s) => s.trim()).filter(Boolean);
      if (f.type === "number") out[f.key] = Number(out[f.key]);
      if (f.optional && out[f.key] === "") delete out[f.key];
    });
    setBusy(true);
    try {
      await onSubmit(out);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {fields.map((f) => (
            <label key={f.key} className={`text-sm ${f.wide ? "sm:col-span-2" : ""}`}>
              <span className="text-slate-500">{f.label}</span>
              {f.type === "select" ? (
                <select value={form[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} required={!f.optional}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
                  <option value="" disabled>Select…</option>
                  {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === "textarea" ? (
                <textarea value={form[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} required={!f.optional} rows={3}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              ) : (
                <input
                  type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "time" ? "time" : "text"}
                  value={form[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} required={!f.optional}
                  min={f.type === "number" ? 0 : undefined}
                  placeholder={f.placeholder}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              )}
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100">Cancel</button>
          <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
