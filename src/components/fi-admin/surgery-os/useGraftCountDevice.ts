"use client";

import { useCallback, useMemo, useRef, useState } from "react";

const DEVICE_STORAGE_KEY = "fi-graft-count-device-id";

export type GraftSaveState = "idle" | "saving" | "saved";

function readDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(DEVICE_STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_STORAGE_KEY, id);
  }
  return id;
}

export function useGraftCountDevice() {
  const deviceId = useMemo(() => readDeviceId(), []);
  const inFlightRef = useRef(false);
  const [saveState, setSaveState] = useState<GraftSaveState>("idle");

  const runGuarded = useCallback(
    async (
      action: (ctx: {
        deviceId: string;
        clientSubmissionId: string;
      }) => Promise<{ ok: boolean; error?: string }>,
      onSuccess?: () => void
    ) => {
      if (inFlightRef.current) return { ok: false as const, error: "Save already in progress." };
      inFlightRef.current = true;
      setSaveState("saving");
      const clientSubmissionId = crypto.randomUUID();
      try {
        const result = await action({ deviceId, clientSubmissionId });
        if (!result.ok) {
          setSaveState("idle");
          return result;
        }
        setSaveState("saved");
        onSuccess?.();
        window.setTimeout(() => setSaveState("idle"), 1800);
        return result;
      } finally {
        inFlightRef.current = false;
      }
    },
    [deviceId]
  );

  return { deviceId, saveState, runGuarded, isSubmitting: saveState === "saving" };
}
