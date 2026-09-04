import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE, api } from "./api.js";

export function useApi(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(() => {
    api
      .get(path)
      .then(setData)
      .finally(() => setLoading(false));
  }, [path]);
  useEffect(refresh, [refresh]);
  return { data, loading, refresh };
}

// Live refresh: one shared EventSource; callers filter by entity.
export function useSSE(entity, onChange) {
  const cbRef = useRef(onChange);
  cbRef.current = onChange;
  useEffect(() => {
    const es = new EventSource(API_BASE + "/api/stream");
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (!entity || msg.entity === entity) cbRef.current(msg);
      } catch {}
    };
    return () => es.close();
  }, [entity]);
}
