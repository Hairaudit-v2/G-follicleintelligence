"use client";

/**
 * FI-PATIENT-APP-2F.3 — poll Front Desk patient-message queue (30s, Reception Board pattern).
 * Realtime on gateway tables is not safely reusable yet — bounded polling is the documented fallback.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  FRONT_DESK_PATIENT_MESSAGE_POLL_MS,
  type FrontDeskPatientMessageQueueFilter,
  type FrontDeskPatientMessageQueuePayload,
} from "@/src/lib/fiOs/frontDesk/frontDeskPatientMessagesCore";

export type FrontDeskPatientMessagesRefreshState = {
  data: FrontDeskPatientMessageQueuePayload;
  lastRefreshedAt: Date | null;
  isRefreshing: boolean;
  refreshError: string | null;
  refresh: () => Promise<void>;
  setFilter: (filter: FrontDeskPatientMessageQueueFilter) => void;
};

type Options = {
  tenantId: string;
  initialData: FrontDeskPatientMessageQueuePayload;
  intervalMs?: number;
  enabled?: boolean;
  onNewIncoming?: (item: FrontDeskPatientMessageQueuePayload["items"][number]) => void;
};

export function useFrontDeskPatientMessagesRefresh(
  opts: Options
): FrontDeskPatientMessagesRefreshState {
  const {
    tenantId,
    initialData,
    intervalMs = FRONT_DESK_PATIENT_MESSAGE_POLL_MS,
    enabled = true,
    onNewIncoming,
  } = opts;

  const [data, setData] = useState(initialData);
  const [filter, setFilterState] = useState<FrontDeskPatientMessageQueueFilter>(
    initialData.filter
  );
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const knownThreadKeys = useRef<Set<string>>(new Set());
  const seeded = useRef(false);
  const onNewIncomingRef = useRef(onNewIncoming);
  onNewIncomingRef.current = onNewIncoming;

  useEffect(() => {
    setData(initialData);
    setFilterState(initialData.filter);
  }, [initialData]);

  useEffect(() => {
    if (seeded.current) return;
    for (const item of initialData.items) {
      knownThreadKeys.current.add(`${item.threadId}:${item.lastMessageAt ?? ""}`);
    }
    seeded.current = true;
  }, [initialData]);

  const refresh = useCallback(async () => {
    if (inFlight.current || !tenantId.trim()) return;
    inFlight.current = true;
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      const res = await fetch(
        `/api/tenants/${encodeURIComponent(tenantId.trim())}/front-desk/patient-messages?filter=${encodeURIComponent(filter)}`,
        { cache: "no-store", credentials: "same-origin" }
      );
      if (!res.ok) throw new Error(`Refresh failed (${res.status})`);
      const json = (await res.json()) as { data?: FrontDeskPatientMessageQueuePayload };
      if (!json.data || json.data.tenantId !== tenantId.trim()) {
        throw new Error("Invalid queue payload.");
      }
      const next = json.data;

      if (seeded.current) {
        for (const item of next.items) {
          const key = `${item.threadId}:${item.lastMessageAt ?? ""}`;
          if (!knownThreadKeys.current.has(key) && item.unreadCount > 0) {
            onNewIncomingRef.current?.(item);
          }
          knownThreadKeys.current.add(key);
        }
      }

      setData(next);
      setLastRefreshedAt(new Date());
    } catch (e) {
      setRefreshError(e instanceof Error ? e.message : "Refresh failed.");
    } finally {
      inFlight.current = false;
      setIsRefreshing(false);
    }
  }, [tenantId, filter]);

  const setFilter = useCallback((next: FrontDeskPatientMessageQueueFilter) => {
    setFilterState(next);
  }, []);

  useEffect(() => {
    if (!enabled || !tenantId.trim()) return;
    void refresh();
    const id = window.setInterval(() => void refresh(), intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, tenantId, intervalMs, refresh]);

  return {
    data: { ...data, filter },
    lastRefreshedAt,
    isRefreshing,
    refreshError,
    refresh,
    setFilter,
  };
}
