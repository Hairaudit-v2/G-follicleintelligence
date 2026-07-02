"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { TODAY_REALTIME_REVISION_POLL_MS } from "@/src/lib/fiOs/todaySignal/todayRealtimePlan";

/**
 * Polls non-PHI revision fingerprint; refreshes only when operational state changed.
 */
export function useTodayFeedRevisionPoll(opts: {
  tenantId: string;
  enabled?: boolean;
  intervalMs?: number;
}): void {
  const { tenantId, enabled = true, intervalMs = TODAY_REALTIME_REVISION_POLL_MS } = opts;
  const router = useRouter();
  const revisionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !tenantId.trim()) return;

    let cancelled = false;

    async function tick() {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch(
          `/api/tenants/${encodeURIComponent(tenantId.trim())}/today-signal/revision`,
          { cache: "no-store", credentials: "same-origin" }
        );
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { revision?: string };
        const next = json.revision ?? null;
        if (revisionRef.current != null && next != null && next !== revisionRef.current) {
          router.refresh();
        }
        revisionRef.current = next;
      } catch {
        /* polling fallback — ignore transient errors */
      }
    }

    void tick();
    const id = window.setInterval(() => void tick(), intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, tenantId, intervalMs, router]);
}
