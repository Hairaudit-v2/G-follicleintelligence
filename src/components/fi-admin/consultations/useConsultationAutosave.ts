"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { updateConsultationDraftAction } from "@/lib/actions/fi-consultation-actions";
import { consultationUpsertBodySchema } from "@/src/lib/consultations/consultationTypes";

const DEFAULT_DEBOUNCE_MS = 2000;

/** Stable JSON for comparing draft payloads (MVP). */
export function stableConsultationPayloadSignature(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((x) => stableConsultationPayloadSignature(x)).join(",")}]`;
  }
  const o = value as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableConsultationPayloadSignature(o[k])}`).join(",")}}`;
}

export type ConsultationPersistStatus = "saved" | "unsaved" | "saving" | "failed";

export type UseConsultationAutosaveResult = {
  /** Call before starting a manual save: clears debounced autosave and invalidates in-flight autosaves. */
  beginManualSave: () => void;
  /** After a successful manual save: sync last-saved signature. */
  markManualSaveSucceeded: () => void;
  /** Flush pending debounce and save immediately (e.g. container blur). */
  flushOnBlur: () => void;
  autosaveSaving: boolean;
  persistStatus: ConsultationPersistStatus;
  /** Cleared on successful save or when the user edits after an autosave failure. */
  autosaveWarning: string | null;
};

/**
 * Debounced autosave for consultation edit mode only.
 * Uses {@link updateConsultationDraftAction}; skips invalid payloads (Zod) without calling the server.
 */
export function useConsultationAutosave(args: {
  enabled: boolean;
  tenantId: string;
  consultationId: string;
  getPayload: () => Record<string, unknown>;
  withAdmin: <T extends Record<string, unknown>>(body: T) => T & { adminKey?: string };
  /** When true, debounced autosave scheduling is paused (e.g. during manual save). */
  blockAutoschedule: boolean;
  /** Signature of {@link getPayload} output; must use {@link stableConsultationPayloadSignature}. */
  payloadWatch: string;
  debounceMs?: number;
}): UseConsultationAutosaveResult {
  const {
    enabled,
    tenantId,
    consultationId,
    getPayload,
    withAdmin,
    blockAutoschedule,
    payloadWatch,
    debounceMs = DEFAULT_DEBOUNCE_MS,
  } = args;

  const getPayloadRef = useRef(getPayload);
  getPayloadRef.current = getPayload;

  const lastSavedSig = useRef("");
  const opGeneration = useRef(0);
  const persistDepthRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [autosaveSaving, setAutosaveSaving] = useState(false);
  const [persistStatus, setPersistStatus] = useState<ConsultationPersistStatus>("saved");
  const [autosaveWarning, setAutosaveWarning] = useState<string | null>(null);

  const cancelPendingDebounce = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const invalidateInFlight = useCallback(() => {
    opGeneration.current += 1;
  }, []);

  useLayoutEffect(() => {
    if (!enabled) {
      cancelPendingDebounce();
      return;
    }
    lastSavedSig.current = stableConsultationPayloadSignature(getPayloadRef.current());
    setPersistStatus("saved");
    setAutosaveWarning(null);
    invalidateInFlight();
  }, [enabled, consultationId, cancelPendingDebounce, invalidateInFlight]);

  const runPersist = useCallback(async () => {
    if (!enabled) return;
    const opId = ++opGeneration.current;

    const body = withAdmin({ ...getPayloadRef.current() });
    const parsed = consultationUpsertBodySchema.safeParse(body);
    if (!parsed.success) {
      if (opId === opGeneration.current) {
        setPersistStatus("unsaved");
      }
      return;
    }

    const sig = stableConsultationPayloadSignature(getPayloadRef.current());
    if (sig === lastSavedSig.current) {
      if (opId === opGeneration.current) {
        setPersistStatus("saved");
        setAutosaveWarning(null);
      }
      return;
    }

    persistDepthRef.current += 1;
    setAutosaveSaving(true);
    if (opId === opGeneration.current) {
      setPersistStatus("saving");
    }

    try {
      const res = await updateConsultationDraftAction(tenantId, consultationId.trim(), body);
      if (opId !== opGeneration.current) return;
      if (!res.ok) {
        setPersistStatus("failed");
        setAutosaveWarning(res.error);
        return;
      }
      lastSavedSig.current = stableConsultationPayloadSignature(getPayloadRef.current());
      setPersistStatus("saved");
      setAutosaveWarning(null);
    } catch (e) {
      if (opId !== opGeneration.current) return;
      const msg = e instanceof Error ? e.message : "Autosave failed.";
      setPersistStatus("failed");
      setAutosaveWarning(msg);
    } finally {
      persistDepthRef.current -= 1;
      if (persistDepthRef.current <= 0) {
        persistDepthRef.current = 0;
        setAutosaveSaving(false);
      }
    }
  }, [enabled, tenantId, consultationId, withAdmin]);

  useEffect(() => {
    if (!enabled || blockAutoschedule) {
      cancelPendingDebounce();
      return;
    }

    if (payloadWatch === lastSavedSig.current) {
      setPersistStatus("saved");
      setAutosaveWarning(null);
      return;
    }

    setPersistStatus("unsaved");
    setAutosaveWarning(null);

    cancelPendingDebounce();
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      void runPersist();
    }, debounceMs);

    return () => {
      cancelPendingDebounce();
    };
  }, [enabled, blockAutoschedule, debounceMs, payloadWatch, runPersist, cancelPendingDebounce]);

  const beginManualSave = useCallback(() => {
    cancelPendingDebounce();
    invalidateInFlight();
    setAutosaveSaving(false);
  }, [cancelPendingDebounce, invalidateInFlight]);

  const markManualSaveSucceeded = useCallback(() => {
    lastSavedSig.current = stableConsultationPayloadSignature(getPayloadRef.current());
    setPersistStatus("saved");
    setAutosaveWarning(null);
  }, []);

  const flushOnBlur = useCallback(() => {
    if (!enabled || blockAutoschedule) return;
    cancelPendingDebounce();
    const sig = stableConsultationPayloadSignature(getPayloadRef.current());
    if (sig === lastSavedSig.current) return;
    void runPersist();
  }, [enabled, blockAutoschedule, cancelPendingDebounce, runPersist]);

  return {
    beginManualSave,
    markManualSaveSucceeded,
    flushOnBlur,
    autosaveSaving,
    persistStatus,
    autosaveWarning,
  };
}
