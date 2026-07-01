import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  detectDuplicateCandidatesForMembers,
  type DuplicateCandidateScore,
} from "@/src/lib/workforce/staffDuplicateDetectionCore";
import { loadStaffMembersForReconciliation } from "@/src/lib/workforce/identityReconciliation.server";

export async function detectDuplicateStaffForTenant(
  tenantId: string,
  client?: SupabaseClient
): Promise<DuplicateCandidateScore[]> {
  const members = await loadStaffMembersForReconciliation(tenantId, client);
  return detectDuplicateCandidatesForMembers(members);
}

export async function detectDuplicateCandidatesForStaff(
  tenantId: string,
  staffId: string,
  client?: SupabaseClient
): Promise<DuplicateCandidateScore[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const sid = assertNonEmptyUuid(staffId, "staffId");
  const all = await detectDuplicateStaffForTenant(tid, client);
  return all.filter((c) => c.staffAId === sid || c.staffBId === sid);
}

export async function upsertDuplicateCandidate(
  tenantId: string,
  scored: DuplicateCandidateScore,
  client?: SupabaseClient
): Promise<void> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("fi_staff_duplicate_candidates")
    .select("id, status")
    .eq("tenant_id", tid)
    .eq("staff_a_id", scored.staffAId)
    .eq("staff_b_id", scored.staffBId)
    .maybeSingle();

  if (existing && (existing as { status: string }).status !== "open") return;

  const row = {
    tenant_id: tid,
    staff_a_id: scored.staffAId,
    staff_b_id: scored.staffBId,
    match_email: scored.signals.matchEmail,
    match_name: scored.signals.matchName,
    match_phone: scored.signals.matchPhone,
    role_similarity: scored.signals.roleSimilarity,
    similarity_score: scored.similarityScore,
    status: "open",
    detected_at: now,
    updated_at: now,
  };

  const { error } = await supabase
    .from("fi_staff_duplicate_candidates")
    .upsert(row, { onConflict: "tenant_id,staff_a_id,staff_b_id" });
  if (error) throw new Error(error.message);
}

export async function persistDuplicateCandidatesForTenant(
  tenantId: string,
  client?: SupabaseClient
): Promise<number> {
  const candidates = await detectDuplicateStaffForTenant(tenantId, client);
  for (const c of candidates) {
    await upsertDuplicateCandidate(tenantId, c, client);
  }
  return candidates.length;
}