import type { PushStaffSyncToFiResult } from "@/src/lib/hr/iiohrFiStaffSyncClient";

/** Normalised FI `staff-sync` JSON response for admin UI and cron (no secrets). */
export type FiOutboundStaffSyncDisplay = {
  rowsSent: number;
  runId: string | null;
  fiOk: boolean;
  created: number | null;
  updated: number | null;
  linked: number | null;
  skipped: number | null;
  warnings: string[];
};

export function parseFiOutboundStaffSyncDisplay(fi: PushStaffSyncToFiResult): FiOutboundStaffSyncDisplay {
  const summary = fi.raw.summary;
  const counts =
    summary && typeof summary === "object" && !Array.isArray(summary) && "counts" in summary
      ? (summary as { counts?: unknown }).counts
      : undefined;
  const roll =
    counts && typeof counts === "object" && !Array.isArray(counts)
      ? (counts as { createdCount?: unknown; updatedCount?: unknown; linkedCount?: unknown })
      : undefined;
  const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const skippedRaw =
    summary && typeof summary === "object" && !Array.isArray(summary) && "skippedRowCount" in summary
      ? (summary as { skippedRowCount?: unknown }).skippedRowCount
      : null;
  const warningsRaw =
    summary && typeof summary === "object" && !Array.isArray(summary) && "warnings" in summary
      ? (summary as { warnings?: unknown }).warnings
      : null;
  const warnings = Array.isArray(warningsRaw) ? warningsRaw.filter((w): w is string => typeof w === "string") : [];

  return {
    rowsSent: fi.rowsSent,
    runId: fi.runId,
    fiOk: fi.ok,
    created: num(roll?.createdCount),
    updated: num(roll?.updatedCount),
    linked: num(roll?.linkedCount),
    skipped: num(skippedRaw),
    warnings,
  };
}
