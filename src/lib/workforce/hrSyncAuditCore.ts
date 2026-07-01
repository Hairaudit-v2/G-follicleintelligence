import type { HrSyncRunCounts, HrSyncRunStatus } from "@/src/lib/workforce/hrSyncAuditTypes";

export type { HrSyncRunCounts, HrSyncRunStatus } from "@/src/lib/workforce/hrSyncAuditTypes";

export function buildHrSyncRunCompletionPatch(input: {
  counts: HrSyncRunCounts;
  warnings?: string[];
  errors?: string[];
  status: HrSyncRunStatus;
  completedAt: string;
}): Record<string, unknown> {
  return {
    completed_at: input.completedAt,
    status: input.status,
    records_received: input.counts.recordsReceived,
    records_created: input.counts.recordsCreated,
    records_updated: input.counts.recordsUpdated,
    records_linked: input.counts.recordsLinked,
    duplicates_detected: input.counts.duplicatesDetected,
    records_skipped: input.counts.recordsSkipped,
    warnings: input.warnings ?? [],
    errors: input.errors ?? [],
    updated_at: input.completedAt,
  };
}