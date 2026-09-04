import { useEffect, useState } from "react";

export default function Toast() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    const handler = (e) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, ...e.detail }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
    };
    window.addEventListener("toast", handler);
    return () => window.removeEventListener("toast", handler);
  }, []);
  const colors = {
    info: "bg-slate-800",
    success: "bg-emerald-600",
    error: "bg-rose-600",
  };
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 space-y-2">
      {toasts.map((t) => (
        <div key={t.id} className={`${colors[t.kind] || colors.info} text-white text-sm px-4 py-2 rounded-lg shadow-lg`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
