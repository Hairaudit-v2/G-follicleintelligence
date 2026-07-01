"use server";

import { revalidatePath } from "next/cache";

import { CrmAccessError } from "@/src/lib/crm/crmGate";
import {
  approveDuplicateMergeAction,
  mergeStaffRecordsAction,
} from "@/src/lib/actions/workforce-phase-1c-sprint-2-actions";
import { manuallyLinkStaffIdentity } from "@/src/lib/workforce/staffReconciliationPage.server";
import type { ReconciliationRecommendationType } from "@/src/lib/workforce/staffReconciliationRecommendationCore";
import { assertWorkforceHrManageAllowed } from "@/src/lib/workforce/workforceHrManageGate.server";
import {
  WORKFORCE_PHASE_1C_AUDIT_EVENTS,
  WORKFORCE_PHASE_1C_AUDIT_SOURCE,
} from "@/src/lib/workforce/workforcePhase1cAudit";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function errMsg(e: unknown): string {
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidateDecisionSurfaces(tenantId: string): void {
  const tid = tenantId.trim();
  for (const p of [
    `/fi-admin/${tid}/hr-os/staff-reconciliation`,
    `/fi-admin/${tid}/hr-os/duplicates`,
    `/fi-admin/${tid}/hr-os`,
    `/fi-admin/${tid}/staff`,
  ]) {
    revalidatePath(p);
  }
}

export async function requestManualReviewReconciliationAction(
  tenantId: string,
  staffMemberId: string,
  note?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { fiUserId } = await assertWorkforceHrManageAllowed(tenantId);
    const supabase = supabaseAdmin();
    await supabase.from("fi_staff_member_audit_events").insert({
      tenant_id: tenantId.trim(),
      staff_member_id: staffMemberId,
      event_type: WORKFORCE_PHASE_1C_AUDIT_EVENTS.MANUAL_REVIEW_REQUESTED,
      source: WORKFORCE_PHASE_1C_AUDIT_SOURCE,
      metadata: { note: note?.trim() || null, requested_by: fiUserId },
    });
    revalidateDecisionSurfaces(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function approveReconciliationRecommendationAction(
  tenantId: string,
  input: {
    staffMemberId: string;
    recommendation: ReconciliationRecommendationType;
    externalId?: string | null;
    sourceSystem?: string | null;
    targetStaffMemberId?: string | null;
    sourceStaffMemberId?: string | null;
    reasoning?: string[];
    confidence?: number;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { fiUserId } = await assertWorkforceHrManageAllowed(tenantId);
    const supabase = supabaseAdmin();

    if (input.recommendation === "MANUAL_REVIEW_REQUIRED") {
      return { ok: false, error: "Manual review items cannot be auto-approved." };
    }

    if (
      input.recommendation === "LINK_TO_IIOHR" ||
      input.recommendation === "KEEP_EXISTING_RECORD"
    ) {
      if (!input.externalId?.trim() || !input.sourceSystem?.trim()) {
        return { ok: false, error: "External identity required for linking." };
      }
      await manuallyLinkStaffIdentity({
        tenantId,
        staffMemberId: input.staffMemberId,
        sourceSystem: input.sourceSystem,
        externalId: input.externalId,
        linkedBy: fiUserId,
      });
    } else if (
      input.recommendation === "MERGE_INTO_EXISTING" ||
      input.recommendation === "MERGE_INTO_IIOHR_RECORD" ||
      input.recommendation === "ARCHIVE_EMPTY_RECORD"
    ) {
      const sourceId = input.sourceStaffMemberId?.trim();
      const targetId = input.targetStaffMemberId?.trim() ?? input.staffMemberId;
      if (!sourceId || sourceId === targetId) {
        if (input.recommendation === "ARCHIVE_EMPTY_RECORD" && input.externalId && input.sourceSystem) {
          await manuallyLinkStaffIdentity({
            tenantId,
            staffMemberId: targetId,
            sourceSystem: input.sourceSystem,
            externalId: input.externalId,
            linkedBy: fiUserId,
          });
        } else {
          return { ok: false, error: "Merge source and target are required." };
        }
      } else {
        const mergeResult = await mergeStaffRecordsAction(tenantId, sourceId, targetId);
        if (!mergeResult.ok) return mergeResult;
        if (input.externalId?.trim() && input.sourceSystem?.trim()) {
          await manuallyLinkStaffIdentity({
            tenantId,
            staffMemberId: targetId,
            sourceSystem: input.sourceSystem,
            externalId: input.externalId,
            linkedBy: fiUserId,
          });
        }
      }
    }

    await supabase.from("fi_staff_member_audit_events").insert({
      tenant_id: tenantId.trim(),
      staff_member_id: input.staffMemberId,
      event_type: WORKFORCE_PHASE_1C_AUDIT_EVENTS.RECONCILIATION_RECOMMENDATION_APPROVED,
      source: WORKFORCE_PHASE_1C_AUDIT_SOURCE,
      metadata: {
        recommendation: input.recommendation,
        confidence: input.confidence ?? null,
        reasoning: input.reasoning ?? [],
        approved_by: fiUserId,
        external_id: input.externalId ?? null,
        source_system: input.sourceSystem ?? null,
      },
    });

    revalidateDecisionSurfaces(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function approveDuplicateMergeRecommendationAction(
  tenantId: string,
  candidateId: string,
  keepStaffId: string,
  archiveStaffId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  return approveDuplicateMergeAction(tenantId, candidateId, archiveStaffId, keepStaffId);
}