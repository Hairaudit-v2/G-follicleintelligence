"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { createBrowserClient } from "@/lib/supabase/client";
import {
  TODAY_REALTIME_DEBOUNCE_MS,
  TODAY_REALTIME_SUBSCRIPTION_PLAN,
} from "@/src/lib/fiOs/todaySignal/todayRealtimePlan";

/**
 * FI-UX-REBUILD D6 — tenant-scoped Supabase Realtime → debounced router.refresh().
 * Falls back silently when the browser session cannot subscribe (polling remains active).
 */
export function useTodayFeedRealtime(opts: {
  tenantId: string;
  enabled?: boolean;
}): void {
  const { tenantId, enabled = true } = opts;
  const router = useRouter();
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !tenantId.trim()) return;

    let supabase: ReturnType<typeof createBrowserClient>;
    try {
      supabase = createBrowserClient();
    } catch {
      return;
    }

    const channel = supabase.channel(`fi-today-${tenantId.trim()}`);

    for (const spec of TODAY_REALTIME_SUBSCRIPTION_PLAN) {
      for (const event of spec.events) {
        channel.on(
          "postgres_changes",
          {
            event,
            schema: spec.schema,
            table: spec.table,
            filter: `${spec.tenantFilterColumn}=eq.${tenantId.trim()}`,
          },
          () => {
            if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
            debounceRef.current = window.setTimeout(() => {
              router.refresh();
            }, TODAY_REALTIME_DEBOUNCE_MS);
          }
        );
      }
    }

    channel.subscribe();

    return () => {
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
      void supabase.removeChannel(channel);
    };
  }, [enabled, tenantId, router]);
}
