"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchPilotActivity,
  fetchPilotAdoption,
  fetchPilotBlockers,
  fetchPilotExport,
  fetchPilotHealth,
  fetchPilotOverview,
  fetchPilotPatientDetail,
  fetchPilotPatients,
  fetchPilotProgrammes,
  PilotControlClientError,
} from "@/src/lib/pilotControl/ui/pilotControlClient";
import type {
  PilotAdoptionResponse,
  PilotBlockerListItem,
  PilotControlActivityItem,
  PilotControlExportFormat,
  PilotControlExportType,
  PilotControlHealthResponse,
  PilotControlOverview,
  PilotControlPagination,
  PilotControlResponseMetadata,
  PilotPatientControlDetail,
  PilotPatientRegisterRow,
  PilotProgrammeSummary,
} from "@/src/lib/pilotControl/api/pilotControlApiTypes";
import { PILOT_CONTROL_REFRESH_MS } from "@/src/lib/pilotControl/ui/pilotControlUiConstants";

function useDocumentVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState === "visible");
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
  return visible;
}

type AsyncState<T> = {
  data: T | null;
  meta: PilotControlResponseMetadata | null;
  error: PilotControlClientError | Error | null;
  loading: boolean;
  refreshing: boolean;
  lastRefreshedAt: Date | null;
  refresh: (opts?: { automatic?: boolean }) => Promise<void>;
};

function useIntervalRefresh(
  refresh: (opts?: { automatic?: boolean }) => Promise<void>,
  intervalMs: number,
  enabled: boolean
) {
  const visible = useDocumentVisible();
  useEffect(() => {
    if (!enabled || !visible) return;
    const id = window.setInterval(() => void refresh({ automatic: true }), intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, visible, intervalMs, refresh]);
}

export function usePilotProgrammes(opts: {
  tenantId?: string;
  enabled?: boolean;
}): AsyncState<PilotProgrammeSummary[]> {
  const [data, setData] = useState<PilotProgrammeSummary[] | null>(null);
  const [meta, setMeta] = useState<PilotControlResponseMetadata | null>(null);
  const [error, setError] = useState<PilotControlClientError | Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(
    async (o?: { automatic?: boolean }) => {
      if (inFlight.current) return;
      inFlight.current = true;
      if (data) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await fetchPilotProgrammes({
          tenantId: opts.tenantId,
          automaticRefresh: o?.automatic,
        });
        setData(res.data);
        setMeta(res.meta);
        setLastRefreshedAt(new Date());
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        inFlight.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [opts.tenantId, data]
  );

  useEffect(() => {
    if (opts.enabled === false) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount / tenant change
  }, [opts.tenantId, opts.enabled]);

  return { data, meta, error, loading, refreshing, lastRefreshedAt, refresh };
}

export function usePilotOverview(opts: {
  programmeId: string | null;
  tenantId?: string;
  autoRefresh?: boolean;
}): AsyncState<PilotControlOverview> {
  const [data, setData] = useState<PilotControlOverview | null>(null);
  const [meta, setMeta] = useState<PilotControlResponseMetadata | null>(null);
  const [error, setError] = useState<PilotControlClientError | Error | null>(null);
  const [loading, setLoading] = useState(Boolean(opts.programmeId));
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(
    async (o?: { automatic?: boolean }) => {
      if (!opts.programmeId || inFlight.current) return;
      inFlight.current = true;
      if (data) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await fetchPilotOverview(opts.programmeId, {
          tenantId: opts.tenantId,
          automaticRefresh: o?.automatic,
        });
        setData(res.data);
        setMeta(res.meta);
        setLastRefreshedAt(new Date());
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        inFlight.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [opts.programmeId, opts.tenantId, data]
  );

  useEffect(() => {
    if (!opts.programmeId) {
      setData(null);
      setLoading(false);
      return;
    }
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.programmeId]);

  useIntervalRefresh(refresh, PILOT_CONTROL_REFRESH_MS.overview, Boolean(opts.autoRefresh && opts.programmeId));

  return { data, meta, error, loading, refreshing, lastRefreshedAt, refresh };
}

export function usePilotHealth(opts: {
  programmeId: string | null;
  tenantId?: string;
  autoRefresh?: boolean;
}): AsyncState<PilotControlHealthResponse> {
  const [data, setData] = useState<PilotControlHealthResponse | null>(null);
  const [meta, setMeta] = useState<PilotControlResponseMetadata | null>(null);
  const [error, setError] = useState<PilotControlClientError | Error | null>(null);
  const [loading, setLoading] = useState(Boolean(opts.programmeId));
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(
    async (o?: { automatic?: boolean }) => {
      if (!opts.programmeId || inFlight.current) return;
      inFlight.current = true;
      if (data) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await fetchPilotHealth(opts.programmeId, {
          tenantId: opts.tenantId,
          automaticRefresh: o?.automatic,
        });
        setData(res.data);
        setMeta(res.meta);
        setLastRefreshedAt(new Date());
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        inFlight.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [opts.programmeId, opts.tenantId, data]
  );

  useEffect(() => {
    if (!opts.programmeId) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.programmeId]);

  useIntervalRefresh(refresh, PILOT_CONTROL_REFRESH_MS.health, Boolean(opts.autoRefresh && opts.programmeId));

  return { data, meta, error, loading, refreshing, lastRefreshedAt, refresh };
}

export function usePilotPatients(opts: {
  query: Record<string, string> | null;
  autoRefresh?: boolean;
}): AsyncState<PilotPatientRegisterRow[]> & { pagination: PilotControlPagination | null } {
  const [data, setData] = useState<PilotPatientRegisterRow[] | null>(null);
  const [pagination, setPagination] = useState<PilotControlPagination | null>(null);
  const [meta, setMeta] = useState<PilotControlResponseMetadata | null>(null);
  const [error, setError] = useState<PilotControlClientError | Error | null>(null);
  const [loading, setLoading] = useState(Boolean(opts.query));
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const inFlight = useRef(false);
  const queryKey = opts.query ? JSON.stringify(opts.query) : "";

  const refresh = useCallback(
    async (o?: { automatic?: boolean }) => {
      if (!opts.query || inFlight.current) return;
      inFlight.current = true;
      if (data) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await fetchPilotPatients(opts.query, { automaticRefresh: o?.automatic });
        setData(res.data);
        setPagination(res.pagination);
        setMeta(res.meta);
        setLastRefreshedAt(new Date());
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        inFlight.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [opts.query, data]
  );

  useEffect(() => {
    if (!opts.query) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  useIntervalRefresh(refresh, PILOT_CONTROL_REFRESH_MS.patients, Boolean(opts.autoRefresh && opts.query));

  return { data, pagination, meta, error, loading, refreshing, lastRefreshedAt, refresh };
}

export function usePilotPatientDetail(opts: {
  patientId: string | null;
  programmeId: string | null;
  tenantId?: string;
}): AsyncState<PilotPatientControlDetail> {
  const [data, setData] = useState<PilotPatientControlDetail | null>(null);
  const [meta, setMeta] = useState<PilotControlResponseMetadata | null>(null);
  const [error, setError] = useState<PilotControlClientError | Error | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (!opts.patientId || !opts.programmeId || inFlight.current) return;
    inFlight.current = true;
    if (data) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetchPilotPatientDetail(opts.patientId, opts.programmeId, {
        tenantId: opts.tenantId,
      });
      setData(res.data);
      setMeta(res.meta);
      setLastRefreshedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      inFlight.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [opts.patientId, opts.programmeId, opts.tenantId, data]);

  useEffect(() => {
    setData(null);
    if (!opts.patientId || !opts.programmeId) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.patientId, opts.programmeId]);

  return { data, meta, error, loading, refreshing, lastRefreshedAt, refresh };
}

export function usePilotBlockers(opts: {
  query: Record<string, string> | null;
  autoRefresh?: boolean;
}): AsyncState<PilotBlockerListItem[]> & { pagination: PilotControlPagination | null } {
  const [data, setData] = useState<PilotBlockerListItem[] | null>(null);
  const [pagination, setPagination] = useState<PilotControlPagination | null>(null);
  const [meta, setMeta] = useState<PilotControlResponseMetadata | null>(null);
  const [error, setError] = useState<PilotControlClientError | Error | null>(null);
  const [loading, setLoading] = useState(Boolean(opts.query));
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const inFlight = useRef(false);
  const queryKey = opts.query ? JSON.stringify(opts.query) : "";

  const refresh = useCallback(
    async (o?: { automatic?: boolean }) => {
      if (!opts.query || inFlight.current) return;
      inFlight.current = true;
      if (data) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await fetchPilotBlockers(opts.query, { automaticRefresh: o?.automatic });
        setData(res.data);
        setPagination(res.pagination);
        setMeta(res.meta);
        setLastRefreshedAt(new Date());
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        inFlight.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [opts.query, data]
  );

  useEffect(() => {
    if (!opts.query) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  useIntervalRefresh(refresh, PILOT_CONTROL_REFRESH_MS.blockers, Boolean(opts.autoRefresh && opts.query));

  return { data, pagination, meta, error, loading, refreshing, lastRefreshedAt, refresh };
}

export function usePilotActivity(opts: {
  query: Record<string, string> | null;
  autoRefresh?: boolean;
}): AsyncState<PilotControlActivityItem[]> & { pagination: PilotControlPagination | null } {
  const [data, setData] = useState<PilotControlActivityItem[] | null>(null);
  const [pagination, setPagination] = useState<PilotControlPagination | null>(null);
  const [meta, setMeta] = useState<PilotControlResponseMetadata | null>(null);
  const [error, setError] = useState<PilotControlClientError | Error | null>(null);
  const [loading, setLoading] = useState(Boolean(opts.query));
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const inFlight = useRef(false);
  const queryKey = opts.query ? JSON.stringify(opts.query) : "";

  const refresh = useCallback(
    async (o?: { automatic?: boolean }) => {
      if (!opts.query || inFlight.current) return;
      inFlight.current = true;
      if (data) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await fetchPilotActivity(opts.query, { automaticRefresh: o?.automatic });
        setData(res.data);
        setPagination(res.pagination);
        setMeta(res.meta);
        setLastRefreshedAt(new Date());
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        inFlight.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [opts.query, data]
  );

  useEffect(() => {
    if (!opts.query) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  useIntervalRefresh(refresh, PILOT_CONTROL_REFRESH_MS.activity, Boolean(opts.autoRefresh && opts.query));

  return { data, pagination, meta, error, loading, refreshing, lastRefreshedAt, refresh };
}

export function usePilotExport() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<PilotControlClientError | Error | null>(null);

  const runExport = useCallback(
    async (args: {
      programmeId: string;
      type: PilotControlExportType;
      format: PilotControlExportFormat;
      from?: string;
      to?: string;
      tenantId?: string;
    }) => {
      setBusy(true);
      setError(null);
      try {
        const { blob, filename } = await fetchPilotExport(args);
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(href);
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
        throw e;
      } finally {
        setBusy(false);
      }
    },
    []
  );

  return { busy, error, runExport };
}

export function usePilotAdoption(opts: {
  programmeId: string | null;
  tenantId?: string;
  from?: string;
  to?: string;
  autoRefresh?: boolean;
}): AsyncState<PilotAdoptionResponse> {
  const [data, setData] = useState<PilotAdoptionResponse | null>(null);
  const [meta, setMeta] = useState<PilotControlResponseMetadata | null>(null);
  const [error, setError] = useState<PilotControlClientError | Error | null>(null);
  const [loading, setLoading] = useState(Boolean(opts.programmeId));
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(
    async (o?: { automatic?: boolean }) => {
      if (!opts.programmeId || inFlight.current) return;
      inFlight.current = true;
      if (data) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await fetchPilotAdoption(opts.programmeId, {
          tenantId: opts.tenantId,
          from: opts.from,
          to: opts.to,
          automaticRefresh: o?.automatic,
        });
        setData(res.data);
        setMeta(res.meta);
        setLastRefreshedAt(new Date());
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        inFlight.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [opts.programmeId, opts.tenantId, opts.from, opts.to, data]
  );

  useEffect(() => {
    if (!opts.programmeId) {
      setData(null);
      setLoading(false);
      return;
    }
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.programmeId, opts.from, opts.to]);

  useIntervalRefresh(refresh, PILOT_CONTROL_REFRESH_MS.health, Boolean(opts.autoRefresh && opts.programmeId));

  return { data, meta, error, loading, refreshing, lastRefreshedAt, refresh };
}
