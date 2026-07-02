"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import type { WorkspaceRef } from "@/src/lib/fiOs/workspaceShell/types";
import { TODAY_REALTIME_REVISION_POLL_MS } from "@/src/lib/fiOs/todaySignal/todayRealtimePlan";
import type { WorkspaceSignalPayload } from "@/src/lib/fiOs/workspaceSignal/workspaceSignalRegistry";
import {
  WORKSPACE_SIGNAL_DEBOUNCE_MS,
  collectAffectedWorkspaceUpdates,
  shouldSkipDuplicateRevisionTick,
} from "@/src/lib/fiOs/workspaceSignal/workspaceSignalSyncCore";

export type WorkspaceRevalidationQueueState = {
  pendingKeys: Set<string>;
  revision: string | null;
};

export type WorkspaceSignalSyncHandlers = {
  applyWorkspaceSignalUpdates: (
    updates: Record<string, { reason: string; at: string }>
  ) => void;
};

export function useWorkspaceRevalidationQueue(): {
  enqueue: (keys: readonly string[]) => void;
  flush: () => string[];
  clear: () => void;
} {
  const pendingRef = useRef<Set<string>>(new Set());

  const enqueue = useCallback((keys: readonly string[]) => {
    for (const key of keys) pendingRef.current.add(key);
  }, []);

  const flush = useCallback(() => {
    const keys = [...pendingRef.current];
    pendingRef.current.clear();
    return keys;
  }, []);

  const clear = useCallback(() => {
    pendingRef.current.clear();
  }, []);

  return { enqueue, flush, clear };
}

type RevisionResponse = {
  revision?: string;
  workspaceSignals?: WorkspaceSignalPayload[];
};

/**
 * FI-UX-REBUILD D6D — subscribe to Today revision changes and revalidate open workspaces.
 * Reuses D6A revision polling; does not open separate Realtime subscriptions.
 */
export function useWorkspaceSignalSync(opts: {
  tenantId: string;
  openWorkspaces: readonly WorkspaceRef[];
  enabled?: boolean;
  revisionPollEnabled?: boolean;
  intervalMs?: number;
  applyWorkspaceSignalUpdates: WorkspaceSignalSyncHandlers["applyWorkspaceSignalUpdates"];
  /** When true, also triggers a debounced router.refresh() fallback per revision tick. */
  routerRefreshFallback?: boolean;
}): void {
  const {
    tenantId,
    openWorkspaces,
    enabled = true,
    revisionPollEnabled = true,
    intervalMs = TODAY_REALTIME_REVISION_POLL_MS,
    applyWorkspaceSignalUpdates,
    routerRefreshFallback = true,
  } = opts;
  const router = useRouter();
  const revisionRef = useRef<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const pendingUpdatesRef = useRef<Record<string, { reason: string; at: string }>>({});
  const { enqueue, flush } = useWorkspaceRevalidationQueue();

  const processRevisionTick = useCallback(
    (payload: RevisionResponse) => {
      const nextRevision = payload.revision ?? null;
      if (shouldSkipDuplicateRevisionTick(revisionRef.current, nextRevision)) return;

      revisionRef.current = nextRevision;
      const signals = payload.workspaceSignals ?? [];
      const at = new Date().toISOString();
      const updates =
        openWorkspaces.length > 0 && signals.length > 0
          ? collectAffectedWorkspaceUpdates(openWorkspaces, signals, at)
          : {};

      if (Object.keys(updates).length > 0) {
        pendingUpdatesRef.current = { ...pendingUpdatesRef.current, ...updates };
        enqueue(Object.keys(updates));
      }

      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        const flushedKeys = flush();
        if (flushedKeys.length > 0) {
          const batched: Record<string, { reason: string; at: string }> = {};
          for (const key of flushedKeys) {
            const update = pendingUpdatesRef.current[key];
            if (update) batched[key] = update;
          }
          if (Object.keys(batched).length > 0) {
            applyWorkspaceSignalUpdates(batched);
          }
          for (const key of flushedKeys) {
            delete pendingUpdatesRef.current[key];
          }
        }

        if (routerRefreshFallback) {
          router.refresh();
        }
      }, WORKSPACE_SIGNAL_DEBOUNCE_MS);
    },
    [applyWorkspaceSignalUpdates, enqueue, flush, openWorkspaces, router, routerRefreshFallback]
  );

  useEffect(() => {
    if (!enabled || !revisionPollEnabled || !tenantId.trim()) return;

    let cancelled = false;

    async function tick() {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch(
          `/api/tenants/${encodeURIComponent(tenantId.trim())}/today-signal/revision`,
          { cache: "no-store", credentials: "same-origin" }
        );
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as RevisionResponse;
        processRevisionTick(json);
      } catch {
        /* polling fallback — ignore transient errors */
      }
    }

    void tick();
    const id = window.setInterval(() => void tick(), intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    };
  }, [enabled, revisionPollEnabled, tenantId, intervalMs, processRevisionTick]);
}
