"use client";

import { useLayoutEffect } from "react";

import type { OperationalCalendarGridPatch } from "@/src/lib/calendar/operationalCalendarTypes";

import { useOperationalCalendarStream } from "./operationalCalendarStreamContext";

export function OperationalCalendarGridPatchBridge({ patch }: { patch: OperationalCalendarGridPatch }) {
  const stream = useOperationalCalendarStream();
  useLayoutEffect(() => {
    stream?.applyGridPatch(patch);
  }, [patch, stream]);
  return null;
}
