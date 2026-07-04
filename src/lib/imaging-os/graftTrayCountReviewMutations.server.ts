import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildStaffReviewRecord, mergeImagingStaffReviewMetadata } from "./imagingStaffReviewCore";
import { mapReviewActionToStatus } from "./graftTrayCountProviderCore";
import type { GraftTrayAiReviewAction } from "./graftTrayCountTypes";
import {
  mapEstimateRowToSummary,
  parseGraftTrayAiEstimateRow,
} from "./graftTrayAiEstimateRowParser";
import type { GraftTrayAiEstimateRow } from "./graftTrayCountTypes";

export type GraftTrayAiReviewResult = {
  estimateId: string;
  imageId: string;
  reviewStatus: string;
  reviewerDecision: GraftTrayAiReviewAction;
  correctedCount: number | null;
};

async function loadEstimateForImage(
  client: SupabaseClient,
  tenantId: string,
  patientId: string,
  imageId: string
): Promise<GraftTrayAiEstimateRow> {
  const { data, error } = await client
    .from("fi_imaging_graft_tray_ai_estimates")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("patient_id", patientId)
    .eq("image_id", imageId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No graft tray AI estimate found for this image.");
  return parseGraftTrayAiEstimateRow(data);
}

/**
 * Staff review of AI graft tray estimate. Never overwrites SurgeryOS manual counts
 * unless action is correct_count (stores corrected value on estimate record only).
 */
export async function reviewGraftTrayAiEstimate(input: {
  tenantId: string;
  patientId: string;
  patientImageId: string;
  action: GraftTrayAiReviewAction;
  reviewedByUserId: string | null;
  correctedCount?: number | null;
  staffNote?: string | null;
  client?: SupabaseClient;
}): Promise<GraftTrayAiReviewResult> {
  const client = input.client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const pid = input.patientId.trim();
  const iid = input.patientImageId.trim();
  const now = new Date().toISOString();

  const estimate = await loadEstimateForImage(client, tid, pid, iid);
  const reviewStatus = mapReviewActionToStatus(input.action);

  let correctedCount: number | null = null;
  if (input.action === "correct_count") {
    if (input.correctedCount == null || !Number.isFinite(input.correctedCount) || input.correctedCount < 0) {
      throw new Error("A non-negative corrected count is required.");
    }
    correctedCount = Math.round(input.correctedCount);
  }

  const { data: updated, error: updErr } = await client
    .from("fi_imaging_graft_tray_ai_estimates")
    .update({
      review_status: reviewStatus,
      reviewer_decision: input.action,
      reviewed_by_fi_user_id: input.reviewedByUserId,
      reviewed_at: now,
      corrected_graft_count: correctedCount,
      updated_at: now,
      metadata: {
        staff_note: input.staffNote?.trim() || null,
        original_ai_estimate: estimate.estimated_graft_count,
      },
    })
    .eq("tenant_id", tid)
    .eq("id", estimate.id)
    .select("*")
    .single();
  if (updErr) throw new Error(updErr.message);

  const updatedRow = parseGraftTrayAiEstimateRow(updated);

  const { data: imageRow, error: imgErr } = await client
    .from("fi_patient_images")
    .select("metadata")
    .eq("tenant_id", tid)
    .eq("id", iid)
    .maybeSingle();
  if (imgErr) throw new Error(imgErr.message);

  const metadata =
    imageRow?.metadata && typeof imageRow.metadata === "object"
      ? (imageRow.metadata as Record<string, unknown>)
      : {};

  const graftTrayReviewReasons =
    input.action === "request_retake"
      ? ["graft_tray_ai_quality_insufficient", "retake_required"]
      : [];

  const staffReview = buildStaffReviewRecord({
    status: input.action === "request_retake" ? "retake_required" : "reviewed",
    reviewedByUserId: input.reviewedByUserId,
    staffNote: input.staffNote,
    reviewedAt: now,
  });

  const mergedMeta = mergeImagingStaffReviewMetadata(metadata, staffReview);
  const patch = {
    ...mergedMeta,
    graft_tray_ai_estimate: mapEstimateRowToSummary(updatedRow),
    graft_tray_review_reasons: graftTrayReviewReasons.length
      ? graftTrayReviewReasons
      : (metadata.graft_tray_review_reasons ?? []),
  };

  await client
    .from("fi_patient_images")
    .update({
      metadata: patch,
      ai_image_review_status: input.action === "request_retake" ? "pending" : "reviewed",
      updated_at: now,
    })
    .eq("tenant_id", tid)
    .eq("id", iid);

  if (estimate.graft_tray_link_id) {
    const linkStatus =
      input.action === "reject_ai_estimate" || input.action === "request_retake"
        ? "review_required"
        : input.action === "accept_ai_estimate" && updatedRow.mismatch_band === "material_mismatch"
          ? "mismatch_flagged"
          : "linked";
    await client
      .from("fi_imaging_graft_tray_links")
      .update({
        status: linkStatus,
        review_required: input.action !== "accept_manual_count" && input.action !== "accept_ai_estimate",
        updated_at: now,
      })
      .eq("tenant_id", tid)
      .eq("id", estimate.graft_tray_link_id);
  }

  return {
    estimateId: updatedRow.id,
    imageId: iid,
    reviewStatus,
    reviewerDecision: input.action,
    correctedCount,
  };
}