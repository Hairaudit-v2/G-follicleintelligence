import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { normalizeEmail } from "@/src/lib/workforce/identityReconciliationCore";
import {
  generateStaffReconciliationRecommendation,
  type ReconciliationRecommendationType,
  type StaffReconciliationRecommendation,
} from "@/src/lib/workforce/staffReconciliationRecommendationCore";
import {
  buildIiohrShadowOperationalHistory,
  loadStaffOperationalHistory,
} from "@/src/lib/workforce/staffOperationalHistory.server";
import type { StaffOperationalHistory } from "@/src/lib/workforce/staffOperationalHistoryCore";
import {
  WORKFORCE_PHASE_1C_AUDIT_EVENTS,
  WORKFORCE_PHASE_1C_AUDIT_SOURCE,
} from "@/src/lib/workforce/workforcePhase1cAudit";

export type { ReconciliationRecommendationType, StaffReconciliationRecommendation };

export type StaffReconciliationDecisionCard = {
  staffMemberId: string;
  fiRecord: StaffOperationalHistory;
  iiohrRecord: {
    externalId: string;
    sourceSystem: string;
    externalEmail: string | null;
    externalName: string | null;
    employmentStatus: string | null;
    roleCode: string | null;
    linked: boolean;
    operationalHistory: StaffOperationalHistory | null;
  } | null;
  recommendation: StaffReconciliationRecommendation;
  recommendationLabel: string;
};

const RECOMMENDATION_LABELS: Record<ReconciliationRecommendationType, string> = {
  LINK_TO_IIOHR: "Link to IIOHR",
  KEEP_EXISTING_RECORD: "Keep Existing Record",
  MERGE_INTO_EXISTING: "Merge Into Existing",
  MERGE_INTO_IIOHR_RECORD: "Merge Into IIOHR Record",
  ARCHIVE_EMPTY_RECORD: "Archive Empty Record",
  MANUAL_REVIEW_REQUIRED: "Manual Review",
};

export function formatRecommendationLabel(type: ReconciliationRecommendationType): string {
  return RECOMMENDATION_LABELS[type] ?? type;
}

async function insertRecommendationAudit(
  supabase: SupabaseClient,
  tenantId: string,
  staffMemberId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await supabase.from("fi_staff_member_audit_events").insert({
    tenant_id: tenantId,
    staff_member_id: staffMemberId,
    event_type: WORKFORCE_PHASE_1C_AUDIT_EVENTS.MERGE_RECOMMENDATION_GENERATED,
    source: WORKFORCE_PHASE_1C_AUDIT_SOURCE,
    metadata,
  });
}

export async function generateStaffReconciliationRecommendationForMember(input: {
  tenantId: string;
  staffMemberId: string;
  externalId: string;
  sourceSystem: string;
  externalEmail: string | null;
  externalName: string | null;
  matchScore: number;
  emailMatch: boolean;
  nameMatch: boolean;
  linkedStaffMemberId?: string | null;
  hasConflicts?: boolean;
  client?: SupabaseClient;
  audit?: boolean;
}): Promise<StaffReconciliationRecommendation> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const supabase = input.client ?? supabaseAdmin();

  const fiRecord = await loadStaffOperationalHistory(tid, input.staffMemberId, supabase);
  const iiohrHistory = await buildIiohrShadowOperationalHistory({
    tenantId: tid,
    externalId: input.externalId,
    externalEmail: input.externalEmail,
    externalName: input.externalName,
    linkedStaffMemberId: input.linkedStaffMemberId,
    client: supabase,
  });

  const recommendation = generateStaffReconciliationRecommendation({
    fiRecord,
    iiohrMatch: {
      externalId: input.externalId,
      externalEmail: input.externalEmail,
      externalName: input.externalName,
      linkedStaffMemberId: input.linkedStaffMemberId,
      operationalHistory: iiohrHistory,
    },
    match: {
      emailExactMatch: input.emailMatch,
      nameMatch: input.nameMatch,
      matchScore: input.matchScore,
      hasConflicts: input.hasConflicts ?? false,
    },
  });

  if (input.audit) {
    await insertRecommendationAudit(supabase, tid, input.staffMemberId, {
      recommendation: recommendation.recommendation,
      confidence: recommendation.confidence,
      reasoning: recommendation.reasoning,
      external_id: input.externalId,
      source_system: input.sourceSystem,
    });
  }

  return recommendation;
}

export async function buildReconciliationDecisionCard(input: {
  tenantId: string;
  staffMemberId: string;
  externalId: string;
  sourceSystem: string;
  externalEmail: string | null;
  externalName: string | null;
  matchScore: number;
  emailMatch: boolean;
  nameMatch: boolean;
  client?: SupabaseClient;
}): Promise<StaffReconciliationDecisionCard> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const supabase = input.client ?? supabaseAdmin();

  const fiRecord = await loadStaffOperationalHistory(tid, input.staffMemberId, supabase);

  const { data: existingLink } = await supabase
    .from("fi_staff_identity_links")
    .select("staff_member_id")
    .eq("tenant_id", tid)
    .eq("source_system", input.sourceSystem)
    .eq("external_id", input.externalId)
    .maybeSingle();

  const linkedStaffMemberId =
    existingLink != null ? String((existingLink as { staff_member_id: string }).staff_member_id) : null;

  const iiohrHistory = await buildIiohrShadowOperationalHistory({
    tenantId: tid,
    externalId: input.externalId,
    externalEmail: input.externalEmail,
    externalName: input.externalName,
    linkedStaffMemberId,
    client: supabase,
  });

  const recommendation = generateStaffReconciliationRecommendation({
    fiRecord,
    iiohrMatch: {
      externalId: input.externalId,
      externalEmail: input.externalEmail,
      externalName: input.externalName,
      linkedStaffMemberId,
      operationalHistory: iiohrHistory,
    },
    match: {
      emailExactMatch:
        input.emailMatch ||
        normalizeEmail(fiRecord.email) === normalizeEmail(input.externalEmail),
      nameMatch: input.nameMatch,
      matchScore: input.matchScore,
      hasConflicts: Boolean(
        linkedStaffMemberId && linkedStaffMemberId !== input.staffMemberId
      ),
    },
  });

  return {
    staffMemberId: input.staffMemberId,
    fiRecord,
    iiohrRecord: {
      externalId: input.externalId,
      sourceSystem: input.sourceSystem,
      externalEmail: input.externalEmail,
      externalName: input.externalName,
      employmentStatus: "active",
      roleCode: null,
      linked: Boolean(linkedStaffMemberId),
      operationalHistory: iiohrHistory,
    },
    recommendation,
    recommendationLabel: formatRecommendationLabel(recommendation.recommendation),
  };
}