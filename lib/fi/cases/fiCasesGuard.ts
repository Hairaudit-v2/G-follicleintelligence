/**
 * fiCasesGuard: application-layer guard for fi_cases mutations.
 *
 * CRITICAL — cascade safety
 * -------------------------
 * Deleting a fi_cases row cascades destructively to:
 *   fi_intakes, fi_uploads, fi_signals (blood + image), fi_model_runs,
 *   fi_scorecards, fi_reports, fi_audits, fi_timeline_events
 *
 * There is no undo. Use softDeleteFiCase() instead of any direct .delete()
 * call against fi_cases. assertNeverHardDeleteFiCase() must be called from
 * any code path that would otherwise issue a hard delete.
 *
 * The migration 20260902120001_fi_cases_soft_delete_guard.sql added
 * deleted_at / deleted_by / delete_reason to fi_cases.
 */
import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNeverHardDeleteFiCase } from "./fiCasesDeletePolicy";

export { assertNeverHardDeleteFiCase };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SoftDeleteCaseOptions = {
  /** Tenant that owns the case. */
  tenantId: string;
  /** fi_cases.id to archive. */
  caseId: string;
  /**
   * fi_users.id of the operator triggering the delete.
   * Pass null if the action originates from an automated process with no
   * associated user (e.g. test cleanup scripts — but even those should
   * prefer soft-delete over hard-delete in production).
   */
  deletedByUserId: string | null;
  /** Short human-readable reason stored for audit purposes. */
  reason: string;
};

export type SoftDeleteCaseResult = { ok: true; archivedAt: string } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// softDeleteFiCase
// ---------------------------------------------------------------------------

/**
 * Soft-deletes a fi_cases row by setting deleted_at, deleted_by, and
 * delete_reason. The clinical audit trail (child rows) is preserved.
 *
 * Idempotent: if the case is already soft-deleted, this is a no-op and
 * returns ok: true with the original archivedAt timestamp.
 */
export async function softDeleteFiCase(opts: SoftDeleteCaseOptions): Promise<SoftDeleteCaseResult> {
  const { tenantId, caseId, deletedByUserId, reason } = opts;

  if (!tenantId?.trim() || !caseId?.trim()) {
    return { ok: false, error: "tenantId and caseId are required." };
  }

  const supabase = supabaseAdmin();

  // Check whether the case is already soft-deleted
  const { data: existing, error: fetchErr } = await supabase
    .from("fi_cases")
    .select("id, deleted_at")
    .eq("id", caseId.trim())
    .eq("tenant_id", tenantId.trim())
    .single();

  if (fetchErr || !existing) {
    return {
      ok: false,
      error: fetchErr?.message ?? `Case ${caseId} not found in tenant ${tenantId}.`,
    };
  }

  const row = existing as { id: string; deleted_at: string | null };

  if (row.deleted_at) {
    // Already archived — idempotent success
    return { ok: true, archivedAt: row.deleted_at };
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from("fi_cases")
    .update({
      deleted_at: now,
      deleted_by: deletedByUserId ?? null,
      delete_reason: reason.trim() || "No reason provided.",
      updated_at: now,
    })
    .eq("id", caseId.trim())
    .eq("tenant_id", tenantId.trim())
    .is("deleted_at", null); // Guard against concurrent soft-delete race

  if (updateErr) {
    return {
      ok: false,
      error: `Failed to soft-delete case ${caseId}: ${updateErr.message}`,
    };
  }

  return { ok: true, archivedAt: now };
}
