"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RECEPTION_OS_DEFAULT_REFRESH_MS } from "@/src/lib/receptionOs/receptionOsBoardModel";
import {
  parseReceptionOsCommandCentrePayload,
  type ReceptionOsCommandCentrePayload,
} from "@/src/lib/receptionOs/receptionOsBoardPayloadSchema";
import { trackReceptionRefreshFailed } from "@/src/components/fi-admin/reception-os/useReceptionOsUsageTracking";
import type { ReceptionOsOperatingMode } from "@/src/lib/receptionOs/receptionOperatingMode";

export type ReceptionOsRefreshState = {
  data: ReceptionOsCommandCentrePayload;
  lastRefreshedAt: Date | null;
  isRefreshing: boolean;
  refreshError: string | null;
  refresh: () => Promise<void>;
};

type UseReceptionOsRefreshOptions = {
  tenantId: string;
  initialData: ReceptionOsCommandCentrePayload;
  intervalMs?: number;
  enabled?: boolean;
  operatingMode?: ReceptionOsOperatingMode;
  demoModeActive?: boolean;
};

/**
 * ReceptionOS live refresh — SSR seeds initial payload; client polls tenant JSON API every 30s.
 */
export function useReceptionOsRefresh(opts: UseReceptionOsRefreshOptions): ReceptionOsRefreshState {
  const {
    tenantId,
    initialData,
    intervalMs = RECEPTION_OS_DEFAULT_REFRESH_MS,
    enabled = true,
    operatingMode = "live_clinic",
    demoModeActive = false,
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
      const demoQuery = demoModeActive ? "?demo=1" : "";
      const res = await fetch(
        `/api/tenants/${encodeURIComponent(tenantId.trim())}/reception-os${demoQuery}`,
        {
          cache: "no-store",
          credentials: "same-origin",
        }
      );
      if (!res.ok) {
        throw new Error(`Refresh failed (${res.status})`);
      }
      const json = (await res.json()) as { data?: unknown };
      const parsed = parseReceptionOsCommandCentrePayload(json.data);
      if (parsed.tenantId !== tenantId.trim()) {
        throw new Error("Refresh payload tenant mismatch.");
      }
      setData(parsed);
      setLastRefreshedAt(new Date());
    } catch (e) {
      const message = e instanceof Error ? e.message : "Refresh failed.";
      setRefreshError(message);
      trackReceptionRefreshFailed(tenantId, operatingMode, { status: "client_refresh" });
    } finally {
      inFlight.current = false;
      setIsRefreshing(false);
    }
  }, [tenantId, operatingMode, demoModeActive]);

  useEffect(() => {
    if (!enabled || !tenantId.trim()) return;
    const id = window.setInterval(() => {
      void refresh();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, tenantId, intervalMs, refresh]);

  return { data, lastRefreshedAt, isRefreshing, refreshError, refresh };
}
