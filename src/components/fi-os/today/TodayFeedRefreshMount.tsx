"use client";

import { useTodayFeedRefresh } from "@/src/components/fi-os/today/useTodayFeedRefresh";

/** Invisible mount point so `FiOsTodaySurface` itself can stay a server component. */
export function TodayFeedRefreshMount({ intervalMs }: { intervalMs?: number }) {
  useTodayFeedRefresh({ intervalMs });
  return null;
}
