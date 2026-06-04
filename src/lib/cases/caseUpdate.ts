import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { shallowMergeMetadata } from "@/src/lib/fi/foundation/internal";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import type { CaseProfilePatchBody } from "@/src/lib/cases/caseTypes";

export type UpdateCaseProfileParams = {
  tenantId: string;
  caseId: string;
  patch: CaseProfilePatchBody;
};

/**
 * Updates Stage 5A case profile fields only (no graft planning, audit, or procedure-day columns).
 */
export async function updateCaseProfile(params: UpdateCaseProfileParams, client?: SupabaseClient): Promise<void> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(params.tenantId, "tenantId");
  const cid = assertNonEmptyUuid(params.caseId, "caseId");
  const p = params.patch;

  const { data: existing, error: re } = await supabase
    .from("fi_cases")
    .select("id, metadata")
    .eq("tenant_id", tid)
    .eq("id", cid)
    .maybeSingle();
  if (re) throw new Error(re.message);
  if (!existing) throw new Error("Case not found.");

  const meta = (existing as { metadata: unknown }).metadata;
  const baseMeta =
    meta && typeof meta === "object" && !Array.isArray(meta) ? (meta as Record<string, unknown>) : {};

  const updateRow: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (p.status !== undefined) {
    updateRow.status = p.status;
  }
  if (p.treatment_type !== undefined) {
    updateRow.treatment_type = p.treatment_type?.trim() ? p.treatment_type.trim() : null;
  }
  if (p.planning_notes !== undefined) {
    updateRow.planning_notes = p.planning_notes?.trim() ? p.planning_notes.trim() : null;
  }

  if (p.case_type !== undefined) {
    const nextType = p.case_type?.trim() ? p.case_type.trim() : null;
    const merged = shallowMergeMetadata(baseMeta, {});
    if (nextType != null) {
      merged.case_type = nextType;
    } else {
      delete merged.case_type;
    }
    updateRow.metadata = merged;
  }

  if (Object.keys(updateRow).length <= 1) {
    return;
  }

  const { error: ue } = await supabase.from("fi_cases").update(updateRow).eq("tenant_id", tid).eq("id", cid);
  if (ue) throw new Error(ue.message);
}
