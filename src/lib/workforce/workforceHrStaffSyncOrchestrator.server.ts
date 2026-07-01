import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { IIOHR_HR_SOURCE_SYSTEM } from "@/src/lib/staffImport/iiohrHrStaffImportPlan";
import type { IiohrHrStaffImportRow } from "@/src/lib/staffImport/iiohrHrStaffImportTypes";
import {
  completeHrSyncRun,
  runPostSyncDuplicateDetection,
  startHrSyncRun,
} from "@/src/lib/workforce/hrSyncAudit.server";
import type { HrSyncRunCounts } from "@/src/lib/workforce/hrSyncAuditTypes";
import { reconcileInboundStaffIdentityApply } from "@/src/lib/workforce/identityReconciliation.server";

export type WorkforceHrReconciliationSummary = {
  hrSyncRunId: string | null;
  hrSyncRunUuid: string | null;
  recordsReceived: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsLinked: number;
  recordsSkipped: number;
  duplicatesDetected: number;
  warnings: string[];
  errors: string[];
};

export async function runWorkforceReconciliationForInboundRows(input: {
  tenantId: string;
  rows: IiohrHrStaffImportRow[];
  sourceSystem?: string;
  syncedAt?: string;
  hrSyncRunId?: string | null;
  client?: SupabaseClient;
}): Promise<WorkforceHrReconciliationSummary> {
  const sourceSystem = input.sourceSystem ?? IIOHR_HR_SOURCE_SYSTEM;
  const syncedAt = input.syncedAt ?? new Date().toISOString();
  const warnings: string[] = [];
  const errors: string[] = [];

  let recordsCreated = 0;
  let recordsUpdated = 0;
  let recordsLinked = 0;
  let recordsSkipped = 0;

  for (const row of input.rows) {
    try {
      const result = await reconcileInboundStaffIdentityApply({
        tenantId: input.tenantId,
        inbound: {
          sourceSystem,
          externalId: row.external_staff_id,
          email: row.email,
          fullName: row.full_name,
          roleCode: row.staff_role,
        },
        syncedAt,
        client: input.client,
      });

      if (result.requiresManualReview) {
        recordsSkipped += 1;
        if (result.warning) {
          warnings.push(`${row.full_name}: ${result.warning}`);
        }
        continue;
      }

      if (result.linked) recordsLinked += 1;
      else if (result.created) recordsCreated += 1;
      else if (result.updated) recordsUpdated += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Reconciliation failed.";
      errors.push(`${row.external_staff_id}: ${msg}`);
      recordsSkipped += 1;
    }
  }

  const duplicatesDetected = await runPostSyncDuplicateDetection(
    input.tenantId,
    input.client
  );

  const counts: HrSyncRunCounts = {
    recordsReceived: input.rows.length,
    recordsCreated,
    recordsUpdated,
    recordsLinked,
    duplicatesDetected,
    recordsSkipped,
  };

  if (input.hrSyncRunId) {
    await completeHrSyncRun({
      runId: input.hrSyncRunId,
      counts,
      warnings,
      errors,
      status: errors.length > 0 ? (recordsLinked > 0 ? "partial" : "failed") : "success",
      client: input.client,
    });
  }

  return {
    hrSyncRunId: input.hrSyncRunId ?? null,
    hrSyncRunUuid: null,
    ...counts,
    warnings,
    errors,
  };
}

export async function beginWorkforceHrSyncRun(input: {
  tenantId: string;
  sourceSystem?: string;
  runId?: string;
  client?: SupabaseClient;
}): Promise<{ hrSyncRunId: string; hrSyncRunUuid: string }> {
  const started = await startHrSyncRun({
    tenantId: input.tenantId,
    sourceSystem: input.sourceSystem ?? IIOHR_HR_SOURCE_SYSTEM,
    runId: input.runId,
    client: input.client,
  });
  return { hrSyncRunId: started.runId, hrSyncRunUuid: started.id };
}