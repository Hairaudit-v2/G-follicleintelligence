import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  generateDuplicateMergeRecommendation,
  type DuplicateMergeRecommendation,
} from "@/src/lib/workforce/duplicateMergeRecommendationCore";
import { loadStaffOperationalHistory } from "@/src/lib/workforce/staffOperationalHistory.server";
import type { StaffOperationalHistory } from "@/src/lib/workforce/staffOperationalHistoryCore";
import {
  WORKFORCE_PHASE_1C_AUDIT_EVENTS,
  WORKFORCE_PHASE_1C_AUDIT_SOURCE,
} from "@/src/lib/workforce/workforcePhase1cAudit";

export type DuplicateDecisionCard = {
  candidateId: string;
  staffA: StaffOperationalHistory;
  staffB: StaffOperationalHistory;
  matchEmail: boolean;
  matchName: boolean;
  similarityScore: number;
  recommendation: DuplicateMergeRecommendation;
  keepStaffName: string;
  archiveStaffName: string;
};

export async function generateDuplicateMergeRecommendationForPair(input: {
  tenantId: string;
  staffAId: string;
  staffBId: string;
  matchEmail: boolean;
  matchName: boolean;
  similarityScore: number;
  client?: SupabaseClient;
  audit?: boolean;
  candidateId?: string;
}): Promise<DuplicateMergeRecommendation> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const supabase = input.client ?? supabaseAdmin();

  const [recordA, recordB] = await Promise.all([
    loadStaffOperationalHistory(tid, input.staffAId, supabase),
    loadStaffOperationalHistory(tid, input.staffBId, supabase),
  ]);

  const recommendation = generateDuplicateMergeRecommendation({
    recordA,
    recordB,
    matchEmail: input.matchEmail,
    matchName: input.matchName,
    similarityScore: input.similarityScore,
  });

  if (input.audit) {
    await supabase.from("fi_staff_member_audit_events").insert({
      tenant_id: tid,
      staff_member_id: recommendation.keepStaffId,
      event_type: WORKFORCE_PHASE_1C_AUDIT_EVENTS.DUPLICATE_MERGE_RECOMMENDED,
      source: WORKFORCE_PHASE_1C_AUDIT_SOURCE,
      metadata: {
        candidate_id: input.candidateId ?? null,
        keep_staff_id: recommendation.keepStaffId,
        archive_staff_id: recommendation.archiveStaffId,
        confidence: recommendation.confidence,
        reasoning: recommendation.reasoning,
      },
    });
  }

  return recommendation;
}

export async function buildDuplicateDecisionCard(input: {
  tenantId: string;
  candidateId: string;
  staffAId: string;
  staffBId: string;
  matchEmail: boolean;
  matchName: boolean;
  similarityScore: number;
  client?: SupabaseClient;
}): Promise<DuplicateDecisionCard> {
  const recommendation = await generateDuplicateMergeRecommendationForPair({
    tenantId: input.tenantId,
    staffAId: input.staffAId,
    staffBId: input.staffBId,
    matchEmail: input.matchEmail,
    matchName: input.matchName,
    similarityScore: input.similarityScore,
    client: input.client,
    candidateId: input.candidateId,
    audit: true,
  });

  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const supabase = input.client ?? supabaseAdmin();
  const [staffA, staffB] = await Promise.all([
    loadStaffOperationalHistory(tid, input.staffAId, supabase),
    loadStaffOperationalHistory(tid, input.staffBId, supabase),
  ]);

  return {
    candidateId: input.candidateId,
    staffA,
    staffB,
    matchEmail: input.matchEmail,
    matchName: input.matchName,
    similarityScore: input.similarityScore,
    recommendation,
    keepStaffName:
      recommendation.keepStaffId === staffA.staffMemberId ? staffA.fullName : staffB.fullName,
    archiveStaffName:
      recommendation.archiveStaffId === staffA.staffMemberId ? staffA.fullName : staffB.fullName,
  };
}