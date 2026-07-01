import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadStaffMembersForReconciliation } from "@/src/lib/workforce/identityReconciliation.server";
import {
  WORKFORCE_PHASE_1C_AUDIT_EVENTS,
  WORKFORCE_PHASE_1C_AUDIT_SOURCE,
} from "@/src/lib/workforce/workforcePhase1cAudit";

export type DuplicateCandidateStatus =
  | "open"
  | "dismissed"
  | "approved_for_merge"
  | "resolved"
  | "merged"
  | "manual_linked";

export type DuplicateCandidateRow = {
  id: string;
  staffAId: string;
  staffBId: string;
  staffAName: string;
  staffBName: string;
  staffAEmail: string | null;
  staffBEmail: string | null;
  similarityScore: number;
  matchEmail: boolean;
  matchName: boolean;
  matchPhone: boolean;
  roleSimilarity: boolean;
  status: DuplicateCandidateStatus;
  detectedAt: string;
};

async function insertWorkforceAudit(
  supabase: SupabaseClient,
  row: {
    tenant_id: string;
    staff_member_id: string;
    event_type: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await supabase.from("fi_staff_member_audit_events").insert({
    tenant_id: row.tenant_id,
    staff_member_id: row.staff_member_id,
    event_type: row.event_type,
    source: WORKFORCE_PHASE_1C_AUDIT_SOURCE,
    metadata: row.metadata ?? {},
  });
  if (error) throw new Error(error.message);
}

export type { DuplicateDecisionCard } from "@/src/lib/workforce/duplicateMergeRecommendation.server";

export async function loadDuplicateDecisionCards(
  tenantId: string,
  client?: SupabaseClient
): Promise<import("@/src/lib/workforce/duplicateMergeRecommendation.server").DuplicateDecisionCard[]> {
  const candidates = await loadDuplicateCandidates(tenantId, client);
  const { buildDuplicateDecisionCard } =
    await import("@/src/lib/workforce/duplicateMergeRecommendation.server");
  const cards = [];
  for (const c of candidates) {
    cards.push(
      await buildDuplicateDecisionCard({
        tenantId,
        candidateId: c.id,
        staffAId: c.staffAId,
        staffBId: c.staffBId,
        matchEmail: c.matchEmail,
        matchName: c.matchName,
        similarityScore: c.similarityScore,
        client,
      })
    );
  }
  return cards;
}

export async function loadDuplicateCandidates(
  tenantId: string,
  client?: SupabaseClient
): Promise<DuplicateCandidateRow[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();

  const [members, dupRes] = await Promise.all([
    loadStaffMembersForReconciliation(tid, supabase),
    supabase
      .from("fi_staff_duplicate_candidates")
      .select(
        "id, staff_a_id, staff_b_id, similarity_score, match_email, match_name, match_phone, role_similarity, status, detected_at"
      )
      .eq("tenant_id", tid)
      .eq("status", "open")
      .order("similarity_score", { ascending: false }),
  ]);

  if (dupRes.error) throw new Error(dupRes.error.message);

  const memberById = new Map(members.map((m) => [m.id, m]));

  return ((dupRes.data ?? []) as Record<string, unknown>[]).map((r) => {
    const staffAId = String(r.staff_a_id);
    const staffBId = String(r.staff_b_id);
    const a = memberById.get(staffAId);
    const b = memberById.get(staffBId);
    return {
      id: String(r.id),
      staffAId,
      staffBId,
      staffAName: a?.fullName ?? "Staff A",
      staffBName: b?.fullName ?? "Staff B",
      staffAEmail: a?.email ?? null,
      staffBEmail: b?.email ?? null,
      similarityScore: Number(r.similarity_score ?? 0),
      matchEmail: Boolean(r.match_email),
      matchName: Boolean(r.match_name),
      matchPhone: Boolean(r.match_phone),
      roleSimilarity: Boolean(r.role_similarity),
      status: String(r.status) as DuplicateCandidateStatus,
      detectedAt: String(r.detected_at),
    };
  });
}

async function loadDuplicateCandidateById(
  candidateId: string,
  client: SupabaseClient
): Promise<{
  id: string;
  tenant_id: string;
  staff_a_id: string;
  staff_b_id: string;
  status: string;
}> {
  const id = assertNonEmptyUuid(candidateId, "candidateId");
  const { data, error } = await client
    .from("fi_staff_duplicate_candidates")
    .select("id, tenant_id, staff_a_id, staff_b_id, status")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Duplicate candidate not found.");
  return data as {
    id: string;
    tenant_id: string;
    staff_a_id: string;
    staff_b_id: string;
    status: string;
  };
}

export async function dismissDuplicateCandidate(
  candidateId: string,
  dismissedBy?: string | null,
  client?: SupabaseClient
): Promise<void> {
  const supabase = client ?? supabaseAdmin();
  const row = await loadDuplicateCandidateById(candidateId, supabase);
  if (row.status !== "open") return;

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("fi_staff_duplicate_candidates")
    .update({
      status: "dismissed",
      resolved_at: now,
      resolved_by: dismissedBy ?? null,
      updated_at: now,
    })
    .eq("id", row.id);
  if (error) throw new Error(error.message);

  await insertWorkforceAudit(supabase, {
    tenant_id: row.tenant_id,
    staff_member_id: row.staff_a_id,
    event_type: WORKFORCE_PHASE_1C_AUDIT_EVENTS.DUPLICATE_DISMISSED,
    metadata: {
      candidate_id: row.id,
      staff_b_id: row.staff_b_id,
      dismissed_by: dismissedBy ?? null,
    },
  });
}

/** Keep separate — same as dismiss for Sprint 2 (no merge, no link). */
export async function keepDuplicateCandidatesSeparate(
  candidateId: string,
  resolvedBy?: string | null,
  client?: SupabaseClient
): Promise<void> {
  await dismissDuplicateCandidate(candidateId, resolvedBy, client);
}

export async function approveDuplicateCandidateForMerge(
  candidateId: string,
  approvedBy?: string | null,
  client?: SupabaseClient
): Promise<{ staffAId: string; staffBId: string }> {
  const supabase = client ?? supabaseAdmin();
  const row = await loadDuplicateCandidateById(candidateId, supabase);
  if (row.status !== "open") {
    throw new Error("Only open duplicate candidates can be approved for merge.");
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("fi_staff_duplicate_candidates")
    .update({
      status: "approved_for_merge",
      resolved_by: approvedBy ?? null,
      updated_at: now,
    })
    .eq("id", row.id);
  if (error) throw new Error(error.message);

  await insertWorkforceAudit(supabase, {
    tenant_id: row.tenant_id,
    staff_member_id: row.staff_a_id,
    event_type: WORKFORCE_PHASE_1C_AUDIT_EVENTS.DUPLICATE_APPROVED_FOR_MERGE,
    metadata: {
      candidate_id: row.id,
      staff_b_id: row.staff_b_id,
      approved_by: approvedBy ?? null,
    },
  });

  return { staffAId: row.staff_a_id, staffBId: row.staff_b_id };
}

export async function markDuplicateCandidateResolved(
  candidateId: string,
  resolvedBy?: string | null,
  client?: SupabaseClient
): Promise<void> {
  const supabase = client ?? supabaseAdmin();
  const row = await loadDuplicateCandidateById(candidateId, supabase);
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("fi_staff_duplicate_candidates")
    .update({
      status: "resolved",
      resolved_at: now,
      resolved_by: resolvedBy ?? null,
      updated_at: now,
    })
    .eq("id", row.id);
  if (error) throw new Error(error.message);
}