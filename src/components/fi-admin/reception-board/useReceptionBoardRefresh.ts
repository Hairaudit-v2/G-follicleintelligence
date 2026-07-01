"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RECEPTION_OS_DEFAULT_REFRESH_MS } from "@/src/lib/receptionOs/receptionOsBoardModel";
import { assertReceptionBoardTenantScope } from "@/src/lib/receptionBoard/receptionBoardCore";
import { parseReceptionBoardCommandCenterPayload } from "@/src/lib/receptionBoard/receptionBoardPayloadSchema";
import type { ReceptionBoardCommandCenterPayload } from "@/src/lib/receptionBoard/receptionBoardTypes";

export type ReceptionBoardRefreshState = {
  data: ReceptionBoardCommandCenterPayload;
  lastRefreshedAt: Date | null;
  isRefreshing: boolean;
  refreshError: string | null;
  refresh: () => Promise<void>;
};

type UseReceptionBoardRefreshOptions = {
  tenantId: string;
  initialData: ReceptionBoardCommandCenterPayload;
  intervalMs?: number;
  enabled?: boolean;
};

/**
 * Reception Board live refresh — SSR seeds payload; client polls tenant JSON API every 30s.
 */
export function useReceptionBoardRefresh(
  opts: UseReceptionBoardRefreshOptions
): ReceptionBoardRefreshState {
  const { tenantId, initialData, intervalMs = RECEPTION_OS_DEFAULT_REFRESH_MS, enabled = true } =
    opts;
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
      const res = await fetch(
        `/api/tenants/${encodeURIComponent(tenantId.trim())}/reception-board`,
        { cache: "no-store", credentials: "same-origin" }
      );
      if (!res.ok) throw new Error(`Refresh failed (${res.status})`);
      const json = (await res.json()) as { data?: unknown };
      const parsed = parseReceptionBoardCommandCenterPayload(json.data);
      assertReceptionBoardTenantScope(tenantId.trim(), parsed.tenantId);
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
    const id = window.setInterval(() => void refresh(), intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, tenantId, intervalMs, refresh]);

  return { data, lastRefreshedAt, isRefreshing, refreshError, refresh };
}