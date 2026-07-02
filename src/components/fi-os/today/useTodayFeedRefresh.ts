"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { useTodayFeedRealtime } from "@/src/components/fi-os/today/useTodayFeedRealtime";
import { useTodayFeedRevisionPoll } from "@/src/components/fi-os/today/useTodayFeedRevisionPoll";
import {
  TODAY_REALTIME_DEFAULT_POLL_MS,
  TODAY_REALTIME_VISIBLE_POLL_MS,
} from "@/src/lib/fiOs/todaySignal/todayRealtimePlan";

/**
 * FI-UX-REBUILD D6 — living Today surface refresh.
 * - 30s polling fallback (15s when tab visible)
 * - Optional Supabase Realtime (tenant opt-in via server prop)
 * - Optional revision fingerprint polling (env opt-in)
 * - Refresh on tab focus
 */
export function useTodayFeedRefresh(opts: {
  tenantId: string;
  intervalMs?: number;
  enabled?: boolean;
  realtimeEnabled?: boolean;
  revisionPollEnabled?: boolean;
}): void {
  const {
    tenantId,
    intervalMs = TODAY_REALTIME_DEFAULT_POLL_MS,
    enabled = true,
    realtimeEnabled = false,
    revisionPollEnabled = false,
  } = opts;
  const router = useRouter();
  const visiblePollMs = Math.min(intervalMs, TODAY_REALTIME_VISIBLE_POLL_MS);

  useTodayFeedRealtime({ tenantId, enabled: enabled && realtimeEnabled });
  useTodayFeedRevisionPoll({ tenantId, enabled: enabled && revisionPollEnabled });

  useEffect(() => {
    if (!enabled) return;

    function pollInterval(): number {
      return document.visibilityState === "visible" ? visiblePollMs : intervalMs;
    }

    let timer: number | null = null;

    function schedule() {
      if (timer != null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        router.refresh();
        schedule();
      }, pollInterval());
    }

    schedule();

    function onVisibility() {
      if (document.visibilityState === "visible") router.refresh();
      schedule();
    }

    function onFocus() {
      router.refresh();
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);

    return () => {
      if (timer != null) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, intervalMs, visiblePollMs, router]);
}
