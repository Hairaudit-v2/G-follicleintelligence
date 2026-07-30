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

export function parseStoredSchedulingPrep(
  metadata: Record<string, unknown> | null | undefined
): StoredSchedulingPrep | null {
  if (!metadata || typeof metadata !== "object") return null;
  const raw = metadata[SCHEDULING_PREP_METADATA_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (Number(o.version) !== 1) return null;
  const itemsRaw = Array.isArray(o.items) ? o.items : [];
  const items: StoredSchedulingPrepItem[] = [];
  for (const row of itemsRaw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const code = String(r.code ?? "").trim();
    const label = String(r.label ?? "").trim();
    if (!code || !label) continue;
    items.push({
      code,
      label,
      detail: String(r.detail ?? "").trim(),
      severity: r.severity === "attention" ? "attention" : "info",
      leadMinutes: Math.max(0, Math.floor(Number(r.leadMinutes) || 0)),
      completed: r.completed === true,
    });
  }
  if (items.length === 0) return null;
  return {
    version: 1,
    generatedAtIso: o.generatedAtIso != null ? String(o.generatedAtIso) : "",
    bufferMinutes: Math.max(0, Math.floor(Number(o.bufferMinutes) || 0)),
    bookingType: String(o.bookingType ?? "").trim() || "consultation",
    items,
  };
}

export function openSchedulingPrepItems(
  prep: StoredSchedulingPrep | null
): StoredSchedulingPrepItem[] {
  if (!prep) return [];
  return prep.items.filter((i) => !i.completed);
}

/**
 * Day-board risk rows from booking metadata.scheduling_prep.
 * Warm operational copy — not clinical.
 */
export type SchedulingPrepRiskRow = {
  bookingId: string;
  patientName: string;
  patientId: string | null;
  startAtIso: string;
  openCount: number;
  attentionCount: number;
  topLabels: string[];
  /** Highest open severity. */
  severity: "info" | "attention";
  summary: string;
  href: string | null;
};

export function buildSchedulingPrepRiskRow(input: {
  bookingId: string;
  patientName: string;
  patientId?: string | null;
  startAtIso: string;
  metadata: Record<string, unknown> | null | undefined;
  appointmentHref?: string | null;
}): SchedulingPrepRiskRow | null {
  const open = openSchedulingPrepItems(parseStoredSchedulingPrep(input.metadata));
  if (open.length === 0) return null;
  const attentionCount = open.filter((i) => i.severity === "attention").length;
  const topLabels = open.slice(0, 3).map((i) => i.label);
  const more = open.length > 3 ? open.length - 3 : 0;
  const name = input.patientName.trim() || "Patient";
  const labelList = more > 0 ? `${topLabels.join(", ")} (+${more} more)` : topLabels.join(", ");
  return {
    bookingId: input.bookingId,
    patientName: name,
    patientId: input.patientId ?? null,
    startAtIso: input.startAtIso,
    openCount: open.length,
    attentionCount,
    topLabels,
    severity: attentionCount > 0 ? "attention" : "info",
    summary: `${name}: ${labelList}`,
    href: input.appointmentHref ?? null,
  };
}
