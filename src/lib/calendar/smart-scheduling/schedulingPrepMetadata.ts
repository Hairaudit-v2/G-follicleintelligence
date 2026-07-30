/**
 * Persist operational prep reminders on booking.metadata (lightweight, no new tables).
 */

import {
  buildPrepReminders,
  prepBufferMinutesForBookingType,
} from "./smartSchedulingCore";

export const SCHEDULING_PREP_METADATA_KEY = "scheduling_prep";

export type StoredSchedulingPrepItem = {
  code: string;
  label: string;
  detail: string;
  severity: "info" | "attention";
  leadMinutes: number;
  completed: boolean;
};

export type StoredSchedulingPrep = {
  version: 1;
  generatedAtIso: string;
  bufferMinutes: number;
  bookingType: string;
  items: StoredSchedulingPrepItem[];
};

/** Build metadata fragment to merge into create/update booking payloads. */
export function buildSchedulingPrepMetadataFragment(input: {
  bookingType: string | null | undefined;
  hasPatient?: boolean;
  now?: Date;
}): Record<string, unknown> {
  const bookingType = String(input.bookingType ?? "consultation").trim() || "consultation";
  const now = input.now ?? new Date();
  const items = buildPrepReminders({
    bookingType,
    hasPatient: input.hasPatient !== false,
  }).map(
    (r): StoredSchedulingPrepItem => ({
      code: r.code,
      label: r.label,
      detail: r.detail,
      severity: r.severity,
      leadMinutes: r.leadMinutes,
      completed: false,
    })
  );

  const pack: StoredSchedulingPrep = {
    version: 1,
    generatedAtIso: now.toISOString(),
    bufferMinutes: prepBufferMinutesForBookingType(bookingType),
    bookingType,
    items,
  };

  return { [SCHEDULING_PREP_METADATA_KEY]: pack };
}

/** Merge prep into existing metadata without wiping other keys. */
export function mergeBookingMetadataWithSchedulingPrep(
  existing: Record<string, unknown> | null | undefined,
  input: { bookingType: string | null | undefined; hasPatient?: boolean }
): Record<string, unknown> {
  return {
    ...(existing && typeof existing === "object" ? existing : {}),
    ...buildSchedulingPrepMetadataFragment(input),
  };
}
