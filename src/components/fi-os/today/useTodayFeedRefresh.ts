"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_TODAY_FEED_REFRESH_MS = 30_000;

/**
 * P0 "live" Today surface: periodically triggers a Next.js server refresh so
 * `buildTodayFeed` recomputes from fresh data on the next render. Reuses the
 * `router.refresh()` pattern already used elsewhere in FI OS rather than
 * standing up a new JSON polling endpoint (matching `useReceptionBoardRefresh`
 * in spirit, not in transport) — swap for a dedicated endpoint, or push
 * updates via Supabase Realtime, in the D4 signal-engine phase.
 */
export function useTodayFeedRefresh(opts: { intervalMs?: number; enabled?: boolean } = {}): void {
  const { intervalMs = DEFAULT_TODAY_FEED_REFRESH_MS, enabled = true } = opts;
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => router.refresh(), intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, intervalMs, router]);
}
