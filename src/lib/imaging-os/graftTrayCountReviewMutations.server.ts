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
import {
  buildGraftTrayEstimateReviewMetadata,
  buildGraftTrayImageMetadataReviewPatch,
  resolveCorrectedCountForReviewAction,
  resolveGraftTrayLinkStatusAfterReview,
} from "./graftTrayCountReviewMutationsCore";
import { graftTrayReviewStatusHasFinalCount } from "./graftTrayIntelligenceSummaryCore";
import { tryPublishSurgeryCaseIntelligenceFactsForSurgery } from "@/src/lib/outcomeIntelligence/surgeryCaseFactsPublisher.server";

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
): Promise<{ row: GraftTrayAiEstimateRow; metadata: Record<string, unknown> }> {
  const { data, error } = await client
    .from("fi_imaging_graft_tray_ai_estimates")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("patient_id", patientId)
    .eq("image_id", imageId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No graft tray AI estimate found for this image.");
  const raw = data as Record<string, unknown>;
  const metadata =
    raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
      ? (raw.metadata as Record<string, unknown>)
      : {};
  return { row: parseGraftTrayAiEstimateRow(data), metadata };
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

  const { row: estimate, metadata: existingEstimateMeta } = await loadEstimateForImage(
    client,
    tid,
    pid,
    iid
  );
  const reviewStatus = mapReviewActionToStatus(input.action);
  const correctedCount = resolveCorrectedCountForReviewAction({
    action: input.action,
    correctedCount: input.correctedCount,
  });

  const { data: updated, error: updErr } = await client
    .from("fi_imaging_graft_tray_ai_estimates")
    .update({
      review_status: reviewStatus,
      reviewer_decision: input.action,
      reviewed_by_fi_user_id: input.reviewedByUserId,
      reviewed_at: now,
      corrected_graft_count: correctedCount,
      updated_at: now,
      metadata: buildGraftTrayEstimateReviewMetadata({
        estimate,
        action: input.action,
        reviewedByUserId: input.reviewedByUserId,
        reviewedAt: now,
        correctedCount,
        staffNote: input.staffNote,
        existingMetadata: existingEstimateMeta,
      }),
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

  const staffReview = buildStaffReviewRecord({
    status: input.action === "request_retake" ? "retake_required" : "reviewed",
    reviewedByUserId: input.reviewedByUserId,
    staffNote: input.staffNote,
    reviewedAt: now,
  });

  const mergedMeta = mergeImagingStaffReviewMetadata(metadata, staffReview);
  const patch = buildGraftTrayImageMetadataReviewPatch({
    estimate: updatedRow,
    action: input.action,
    reviewedByUserId: input.reviewedByUserId,
    reviewedAt: now,
    correctedCount,
    staffNote: input.staffNote,
    existingMetadata: metadata,
    staffReviewMetadata: mergedMeta,
  });

  await client
    .from("fi_patient_images")
    .update({
      metadata: patch,
      ai_image_review_status: input.action === "request_retake" ? "pending" : "reviewed",
      updated_at: now,
    })
    .eq("tenant_id", tid)
    .eq("id", iid);

  let surgeryIdForPublish = updatedRow.surgery_id?.trim() || null;
  if (estimate.graft_tray_link_id) {
    const linkStatus = resolveGraftTrayLinkStatusAfterReview({
      action: input.action,
      mismatchBand: updatedRow.mismatch_band,
    });
    await client
      .from("fi_imaging_graft_tray_links")
      .update({
        status: linkStatus.status,
        review_required: linkStatus.reviewRequired,
        updated_at: now,
      })
      .eq("tenant_id", tid)
      .eq("id", estimate.graft_tray_link_id);

    if (!surgeryIdForPublish) {
      const { data: linkRow } = await client
        .from("fi_imaging_graft_tray_links")
        .select("surgery_id")
        .eq("tenant_id", tid)
        .eq("id", estimate.graft_tray_link_id)
        .maybeSingle();
      surgeryIdForPublish =
        linkRow && typeof linkRow.surgery_id === "string" ? linkRow.surgery_id.trim() : null;
    }
  }

  if (graftTrayReviewStatusHasFinalCount(reviewStatus) && surgeryIdForPublish) {
    void tryPublishSurgeryCaseIntelligenceFactsForSurgery({
      tenantId: tid,
      surgeryId: surgeryIdForPublish,
      client,
    });
  }

  return {
    estimateId: updatedRow.id,
    imageId: iid,
    reviewStatus,
    reviewerDecision: input.action,
    correctedCount,
  };
}

export { mapEstimateRowToSummary };