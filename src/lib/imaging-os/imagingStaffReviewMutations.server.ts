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

export type BulkImagingStaffReviewResult = {
  succeeded: ImagingStaffReviewMutationResult[];
  failed: Array<{ imageId: string; error: string }>;
};

export type BulkImagingReviewItem = {
  patientId: string;
  patientImageId: string;
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

async function runBulkStaffReview<T>(
  imageIds: string[],
  runOne: (imageId: string) => Promise<T>
): Promise<{ succeeded: T[]; failed: Array<{ imageId: string; error: string }> }> {
  const succeeded: T[] = [];
  const failed: Array<{ imageId: string; error: string }> = [];
  const uniqueIds = [...new Set(imageIds.map((id) => id.trim()).filter(Boolean))];

  for (const imageId of uniqueIds) {
    try {
      succeeded.push(await runOne(imageId));
    } catch (e: unknown) {
      failed.push({
        imageId,
        error: e instanceof Error ? e.message : "Request failed.",
      });
    }
  }

  return { succeeded, failed };
}

async function runBulkReviewItems<T>(
  items: BulkImagingReviewItem[],
  runOne: (item: BulkImagingReviewItem) => Promise<T>
): Promise<{ succeeded: T[]; failed: Array<{ imageId: string; error: string }> }> {
  const succeeded: T[] = [];
  const failed: Array<{ imageId: string; error: string }> = [];
  const seen = new Set<string>();

  for (const item of items) {
    const imageId = item.patientImageId.trim();
    const patientId = item.patientId.trim();
    if (!imageId || !patientId) continue;
    const key = `${patientId}:${imageId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      succeeded.push(await runOne({ patientId, patientImageId: imageId }));
    } catch (e: unknown) {
      failed.push({
        imageId,
        error: e instanceof Error ? e.message : "Request failed.",
      });
    }
  }

  return { succeeded, failed };
}

export async function bulkMarkImagingImagesReviewed(input: {
  tenantId: string;
  patientId: string;
  patientImageIds: string[];
  reviewedByUserId: string | null;
  staffNote?: string | null;
  client?: SupabaseClient;
}): Promise<BulkImagingStaffReviewResult> {
  return runBulkStaffReview(input.patientImageIds, (imageId) =>
    markImagingImageReviewed({
      tenantId: input.tenantId,
      patientId: input.patientId,
      patientImageId: imageId,
      reviewedByUserId: input.reviewedByUserId,
      staffNote: input.staffNote,
      client: input.client,
    })
  );
}

export async function bulkFlagImagingImagesRetakeRequired(input: {
  tenantId: string;
  patientId: string;
  patientImageIds: string[];
  reviewedByUserId: string | null;
  staffNote?: string | null;
  client?: SupabaseClient;
}): Promise<BulkImagingStaffReviewResult> {
  return runBulkStaffReview(input.patientImageIds, (imageId) =>
    flagImagingImageRetakeRequired({
      tenantId: input.tenantId,
      patientId: input.patientId,
      patientImageId: imageId,
      reviewedByUserId: input.reviewedByUserId,
      staffNote: input.staffNote,
      client: input.client,
    })
  );
}

export async function bulkAssignImagingStaffNote(input: {
  tenantId: string;
  patientId: string;
  patientImageIds: string[];
  reviewedByUserId: string | null;
  staffNote: string;
  client?: SupabaseClient;
}): Promise<BulkImagingStaffReviewResult> {
  const note = input.staffNote.trim();
  if (!note) throw new Error("Staff note is required for bulk assign.");
  return runBulkStaffReview(input.patientImageIds, (imageId) =>
    markImagingImageReviewed({
      tenantId: input.tenantId,
      patientId: input.patientId,
      patientImageId: imageId,
      reviewedByUserId: input.reviewedByUserId,
      staffNote: note,
      client: input.client,
    })
  );
}

export async function bulkMarkImagingReviewItemsReviewed(input: {
  tenantId: string;
  items: BulkImagingReviewItem[];
  reviewedByUserId: string | null;
  staffNote?: string | null;
  client?: SupabaseClient;
}): Promise<BulkImagingStaffReviewResult> {
  return runBulkReviewItems(input.items, (item) =>
    markImagingImageReviewed({
      tenantId: input.tenantId,
      patientId: item.patientId,
      patientImageId: item.patientImageId,
      reviewedByUserId: input.reviewedByUserId,
      staffNote: input.staffNote,
      client: input.client,
    })
  );
}

export async function bulkFlagImagingReviewItemsRetakeRequired(input: {
  tenantId: string;
  items: BulkImagingReviewItem[];
  reviewedByUserId: string | null;
  staffNote?: string | null;
  client?: SupabaseClient;
}): Promise<BulkImagingStaffReviewResult> {
  return runBulkReviewItems(input.items, (item) =>
    flagImagingImageRetakeRequired({
      tenantId: input.tenantId,
      patientId: item.patientId,
      patientImageId: item.patientImageId,
      reviewedByUserId: input.reviewedByUserId,
      staffNote: input.staffNote,
      client: input.client,
    })
  );
}

export async function bulkAssignImagingReviewItemsStaffNote(input: {
  tenantId: string;
  items: BulkImagingReviewItem[];
  reviewedByUserId: string | null;
  staffNote: string;
  client?: SupabaseClient;
}): Promise<BulkImagingStaffReviewResult> {
  const note = input.staffNote.trim();
  if (!note) throw new Error("Staff note is required for bulk assign.");
  return runBulkReviewItems(input.items, (item) =>
    markImagingImageReviewed({
      tenantId: input.tenantId,
      patientId: item.patientId,
      patientImageId: item.patientImageId,
      reviewedByUserId: input.reviewedByUserId,
      staffNote: note,
      client: input.client,
    })
  );
}