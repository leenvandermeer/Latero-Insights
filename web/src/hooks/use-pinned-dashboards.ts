"use client";

import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY_PREFIX = "insights-pinned-dashboards-v1";

function getKey(installationId?: string) {
  return `${STORAGE_KEY_PREFIX}:${installationId ?? "default"}`;
}

export function usePinnedDashboards(installationId?: string) {
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(getKey(installationId));
      setPinnedIds(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setPinnedIds([]);
    }
  }, [installationId]);

  const pin = useCallback(
    (id: string) => {
      setPinnedIds((prev) => {
        if (prev.includes(id)) return prev;
        const next = [...prev, id];
        try {
          window.localStorage.setItem(getKey(installationId), JSON.stringify(next));
        } catch { /* ignore */ }
        return next;
      });
    },
    [installationId],
  );

  const unpin = useCallback(
    (id: string) => {
      setPinnedIds((prev) => {
        const next = prev.filter((p) => p !== id);
        try {
          window.localStorage.setItem(getKey(installationId), JSON.stringify(next));
        } catch { /* ignore */ }
        return next;
      });
    },
    [installationId],
  );

  const toggle = useCallback(
    (id: string) => {
      setPinnedIds((prev) => {
        const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
        try {
          window.localStorage.setItem(getKey(installationId), JSON.stringify(next));
        } catch { /* ignore */ }
        return next;
      });
    },
    [installationId],
  );

  const isPinned = useCallback((id: string) => pinnedIds.includes(id), [pinnedIds]);

  return { pinnedIds, pin, unpin, toggle, isPinned };
}
