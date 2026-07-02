"use client";

import { useTodayFeedRefresh } from "@/src/components/fi-os/today/useTodayFeedRefresh";

/** Invisible mount point so `FiOsTodaySurface` itself can stay a server component. */
export function TodayFeedRefreshMount(props: {
  tenantId: string;
  intervalMs?: number;
  realtimeEnabled?: boolean;
  revisionPollEnabled?: boolean;
}) {
  useTodayFeedRefresh(props);
  return null;
}
