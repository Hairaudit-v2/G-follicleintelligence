import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readImagingClinicalAiMetadata } from "./clinicalImageAnalysisCore";
import {
  buildStaffReviewRecord,
  mapCanonicalViewTypeToFiAiCategory,
  mergeImagingStaffReviewMetadata,
  validateAssignedViewType,
} from "./imagingStaffReviewCore";

export type ImagingStaffReviewMutationResult = {
  imageId: string;
  staffReviewStatus: string;
  metadata: Record<string, unknown>;
};

async function loadTenantPatientImage(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string,
  patientImageId: string
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from("fi_patient_images")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("patient_id", patientId)
    .eq("id", patientImageId)
    .eq("image_status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Image not found for tenant.");
  return data as Record<string, unknown>;
}

function resolvePreviousViewType(row: Record<string, unknown>, metadata: Record<string, unknown>): string {
  const clinical = readImagingClinicalAiMetadata(metadata);
  if (clinical?.view_type) return clinical.view_type;
  if (row.ai_image_category != null) return String(row.ai_image_category);
  if (row.image_category != null) return String(row.image_category);
  return "other";
}

async function persistStaffReviewUpdate(input: {
  supabase: SupabaseClient;
  tenantId: string;
  patientImageId: string;
  metadata: Record<string, unknown>;
  aiImageCategory?: string | null;
  aiImageReviewStatus?: string | null;
}): Promise<void> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    metadata: input.metadata,
    updated_at: now,
  };
  if (input.aiImageCategory != null) {
    patch.ai_image_category = input.aiImageCategory;
  }
  if (input.aiImageReviewStatus != null) {
    patch.ai_image_review_status = input.aiImageReviewStatus;
  }
  const { error } = await input.supabase
    .from("fi_patient_images")
    .update(patch)
    .eq("tenant_id", input.tenantId)
    .eq("id", input.patientImageId);
  if (error) throw new Error(error.message);
}

export async function markImagingImageReviewed(input: {
  tenantId: string;
  patientId: string;
  patientImageId: string;
  reviewedByUserId: string | null;
  staffNote?: string | null;
  client?: SupabaseClient;
}): Promise<ImagingStaffReviewMutationResult> {
  const supabase = input.client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const pid = input.patientId.trim();
  const iid = input.patientImageId.trim();

  const row = await loadTenantPatientImage(supabase, tid, pid, iid);
  const metadata =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : {};

  const record = buildStaffReviewRecord({
    status: "reviewed",
    reviewedByUserId: input.reviewedByUserId,
    previousViewType: resolvePreviousViewType(row, metadata),
    staffNote: input.staffNote,
  });
  const merged = mergeImagingStaffReviewMetadata(metadata, record);

  await persistStaffReviewUpdate({
    supabase,
    tenantId: tid,
    patientImageId: iid,
    metadata: merged,
    aiImageReviewStatus: "accepted",
  });

  return { imageId: iid, staffReviewStatus: record.status, metadata: merged };
}

export async function flagImagingImageRetakeRequired(input: {
  tenantId: string;
  patientId: string;
  patientImageId: string;
  reviewedByUserId: string | null;
  staffNote?: string | null;
  client?: SupabaseClient;
}): Promise<ImagingStaffReviewMutationResult> {
  const supabase = input.client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const pid = input.patientId.trim();
  const iid = input.patientImageId.trim();

  const row = await loadTenantPatientImage(supabase, tid, pid, iid);
  const metadata =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : {};

  const record = buildStaffReviewRecord({
    status: "retake_required",
    reviewedByUserId: input.reviewedByUserId,
    previousViewType: resolvePreviousViewType(row, metadata),
    staffNote: input.staffNote,
  });
  const merged = mergeImagingStaffReviewMetadata(metadata, record);

  await persistStaffReviewUpdate({
    supabase,
    tenantId: tid,
    patientImageId: iid,
    metadata: merged,
    aiImageReviewStatus: "pending",
  });

  return { imageId: iid, staffReviewStatus: record.status, metadata: merged };
}

export async function reassignImagingImageViewType(input: {
  tenantId: string;
  patientId: string;
  patientImageId: string;
  assignedViewType: string;
  reviewedByUserId: string | null;
  staffNote?: string | null;
  client?: SupabaseClient;
}): Promise<ImagingStaffReviewMutationResult> {
  const canonical = validateAssignedViewType(input.assignedViewType);
  if (!canonical) {
    throw new Error(
      `Invalid view type. Allowed: ${["donor", "recipient", "front", "top", "crown", "microscopic", "other"].join(", ")}…`
    );
  }

  const supabase = input.client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const pid = input.patientId.trim();
  const iid = input.patientImageId.trim();

  const row = await loadTenantPatientImage(supabase, tid, pid, iid);
  const metadata =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : {};

  const previousViewType = resolvePreviousViewType(row, metadata);
  const record = buildStaffReviewRecord({
    status: "view_reassigned",
    reviewedByUserId: input.reviewedByUserId,
    previousViewType,
    assignedViewType: canonical,
    staffNote: input.staffNote,
  });
  const merged = mergeImagingStaffReviewMetadata(metadata, record);
  const fiAiCategory = mapCanonicalViewTypeToFiAiCategory(canonical);

  await persistStaffReviewUpdate({
    supabase,
    tenantId: tid,
    patientImageId: iid,
    metadata: merged,
    aiImageCategory: fiAiCategory,
    aiImageReviewStatus: "corrected",
  });

  return { imageId: iid, staffReviewStatus: record.status, metadata: merged };
}