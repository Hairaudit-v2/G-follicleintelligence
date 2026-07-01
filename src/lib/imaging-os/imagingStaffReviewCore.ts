/**
 * ImagingOS Phase 4 — staff review metadata (pure logic).
 * Stored separately from AI metadata; preserves imaging_clinical_ai audit trail.
 */

import {
  CANONICAL_HAIR_IMAGE_CATEGORIES,
  isCanonicalHairImageCategory,
  type CanonicalHairImageCategory,
} from "./categories";
import type { FiAiImageCategory } from "@/src/lib/hair-intelligence/imageClassification/types";

export const IMAGINGOS_STAFF_REVIEW_VERSION = "imagingos_staff_review_v1" as const;

export type ImagingStaffReviewStatus = "reviewed" | "retake_required" | "view_reassigned";

export type ImagingStaffReviewRecord = {
  status: ImagingStaffReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string;
  previous_view_type?: string;
  assigned_view_type?: string;
  staff_note?: string;
  review_version: typeof IMAGINGOS_STAFF_REVIEW_VERSION;
};

const CANONICAL_TO_FI_AI: Record<CanonicalHairImageCategory, FiAiImageCategory> = {
  front: "front",
  top: "top",
  crown: "crown",
  left: "left_profile",
  right: "right_profile",
  donor: "donor",
  recipient: "front",
  hairline: "front",
  temporal: "left_profile",
  vertex: "top",
  graft_tray: "graft_tray",
  immediate_post_op: "immediate_post_op",
  follow_up: "follow_up",
  microscopic: "microscopic",
  other: "unknown",
};

export function validateAssignedViewType(raw: string): CanonicalHairImageCategory | null {
  const key = raw.trim().toLowerCase();
  return isCanonicalHairImageCategory(key) ? key : null;
}

export function mapCanonicalViewTypeToFiAiCategory(
  viewType: CanonicalHairImageCategory
): FiAiImageCategory {
  return CANONICAL_TO_FI_AI[viewType] ?? "unknown";
}

export function readImagingStaffReviewRecord(
  metadata: Record<string, unknown> | null | undefined
): ImagingStaffReviewRecord | null {
  const raw = metadata?.imaging_staff_review;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const m = raw as Record<string, unknown>;
  const status = m.status;
  if (status !== "reviewed" && status !== "retake_required" && status !== "view_reassigned") {
    return null;
  }
  return {
    status,
    reviewed_by: typeof m.reviewed_by === "string" ? m.reviewed_by : null,
    reviewed_at: typeof m.reviewed_at === "string" ? m.reviewed_at : new Date().toISOString(),
    ...(typeof m.previous_view_type === "string" ? { previous_view_type: m.previous_view_type } : {}),
    ...(typeof m.assigned_view_type === "string" ? { assigned_view_type: m.assigned_view_type } : {}),
    ...(typeof m.staff_note === "string" && m.staff_note.trim()
      ? { staff_note: m.staff_note.trim().slice(0, 2000) }
      : {}),
    review_version: IMAGINGOS_STAFF_REVIEW_VERSION,
  };
}

export function mergeImagingStaffReviewMetadata(
  existingMetadata: Record<string, unknown> | null | undefined,
  record: ImagingStaffReviewRecord
): Record<string, unknown> {
  const base =
    existingMetadata && typeof existingMetadata === "object" && !Array.isArray(existingMetadata)
      ? { ...existingMetadata }
      : {};
  const clinicalAi = base.imaging_clinical_ai;
  return {
    ...base,
    imaging_staff_review: record,
    ...(clinicalAi !== undefined ? { imaging_clinical_ai: clinicalAi } : {}),
  };
}

export function staffReviewClearsQueue(record: ImagingStaffReviewRecord | null): boolean {
  if (!record) return false;
  return record.status === "reviewed" || record.status === "view_reassigned";
}

export function buildStaffReviewRecord(input: {
  status: ImagingStaffReviewStatus;
  reviewedByUserId: string | null;
  reviewedAt?: string;
  previousViewType?: string | null;
  assignedViewType?: string | null;
  staffNote?: string | null;
}): ImagingStaffReviewRecord {
  return {
    status: input.status,
    reviewed_by: input.reviewedByUserId,
    reviewed_at: input.reviewedAt ?? new Date().toISOString(),
    ...(input.previousViewType?.trim() ? { previous_view_type: input.previousViewType.trim() } : {}),
    ...(input.assignedViewType?.trim() ? { assigned_view_type: input.assignedViewType.trim() } : {}),
    ...(input.staffNote?.trim() ? { staff_note: input.staffNote.trim().slice(0, 2000) } : {}),
    review_version: IMAGINGOS_STAFF_REVIEW_VERSION,
  };
}

export const ALLOWED_STAFF_REASSIGN_VIEW_TYPES = [...CANONICAL_HAIR_IMAGE_CATEGORIES] as const;