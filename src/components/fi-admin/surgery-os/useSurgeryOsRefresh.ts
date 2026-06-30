"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { SURGERY_OS_DEFAULT_REFRESH_MS } from "@/src/lib/surgeryOs/surgeryOsBoardModel";
import {
  parseSurgeryOsCommandCentrePayload,
  type SurgeryOsCommandCentrePayload,
} from "@/src/lib/surgeryOs/surgeryOsBoardPayloadSchema";

export type SurgeryOsRefreshState = {
  data: SurgeryOsCommandCentrePayload;
  lastRefreshedAt: Date | null;
  isRefreshing: boolean;
  refreshError: string | null;
  refresh: () => Promise<void>;
};

type UseSurgeryOsRefreshOptions = {
  tenantId: string;
  initialData: SurgeryOsCommandCentrePayload;
  intervalMs?: number;
  enabled?: boolean;
};

/**
 * SurgeryOS live refresh — SSR seeds initial payload; client polls tenant JSON API every 30s.
 */
export function useSurgeryOsRefresh(opts: UseSurgeryOsRefreshOptions): SurgeryOsRefreshState {
  const {
    tenantId,
    initialData,
    intervalMs = SURGERY_OS_DEFAULT_REFRESH_MS,
    enabled = true,
  } = opts;
  const [data, setData] = useState(initialData);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const refresh = useCallback(async () => {
    if (inFlight.current || !tenantId.trim()) return;
    inFlight.current = true;
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(tenantId.trim())}/surgery-os`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!res.ok) {
        throw new Error(`Refresh failed (${res.status})`);
      }
      const json = (await res.json()) as { data?: unknown };
      const parsed = parseSurgeryOsCommandCentrePayload(json.data);
      if (parsed.tenantId !== tenantId.trim()) {
        throw new Error("Refresh payload tenant mismatch.");
      }
      setData(parsed);
      setLastRefreshedAt(new Date());
    } catch (e) {
      const message = e instanceof Error ? e.message : "Refresh failed.";
      setRefreshError(message);
    } finally {
      inFlight.current = false;
      setIsRefreshing(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (!enabled || !tenantId.trim()) return;
    const id = window.setInterval(() => {
      void refresh();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, tenantId, intervalMs, refresh]);

  return { data, lastRefreshedAt, isRefreshing, refreshError, refresh };
}
