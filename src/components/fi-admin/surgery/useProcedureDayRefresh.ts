"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ProcedureDayLiveBoardPayload } from "@/src/lib/procedureDay/procedureDayWorkflowTypes";

export type ProcedureDayRefreshState = {
  data: ProcedureDayLiveBoardPayload;
  isHydrating: boolean;
  hydrateError: string | null;
  hydrate: () => Promise<void>;
};

type UseProcedureDayRefreshOptions = {
  tenantId: string;
  initialData: ProcedureDayLiveBoardPayload;
  hydrateFullOnMount?: boolean;
};

export function useProcedureDayRefresh(
  opts: UseProcedureDayRefreshOptions
): ProcedureDayRefreshState {
  const {
    tenantId,
    initialData,
    hydrateFullOnMount = initialData.loadTier === "shell",
  } = opts;
  const [data, setData] = useState(initialData);
  const [isHydrating, setIsHydrating] = useState(false);
  const [hydrateError, setHydrateError] = useState<string | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const hydrate = useCallback(async () => {
    if (inFlight.current || !tenantId.trim()) return;
    inFlight.current = true;
    setIsHydrating(true);
    setHydrateError(null);
    try {
      const res = await fetch(
        `/api/tenants/${encodeURIComponent(tenantId.trim())}/procedure-day`,
        { cache: "no-store", credentials: "same-origin" }
      );
      if (!res.ok) throw new Error(`Hydrate failed (${res.status})`);
      const json = (await res.json()) as { data?: ProcedureDayLiveBoardPayload };
      if (!json.data) throw new Error("Invalid procedure day payload.");
      setData(json.data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Hydrate failed.";
      setHydrateError(message);
    } finally {
      inFlight.current = false;
      setIsHydrating(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (!hydrateFullOnMount || !tenantId.trim()) return;
    void hydrate();
  }, [hydrateFullOnMount, hydrate, tenantId]);

  return { data, isHydrating, hydrateError, hydrate };
}