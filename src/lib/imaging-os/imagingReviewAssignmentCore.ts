/**
 * ImagingOS Phase 6 — review queue assignment metadata (pure logic).
 * Stored separately from AI and staff review audit metadata.
 */

export const IMAGINGOS_REVIEW_ASSIGNMENT_VERSION = "imagingos_review_assignment_v1" as const;

export type ImagingReviewAssignmentStatus = "assigned" | "unassigned";

export type ImagingReviewAssignmentRecord = {
  assigned_to: string | null;
  assigned_by: string | null;
  assigned_at: string;
  assignment_status: ImagingReviewAssignmentStatus;
  assignment_version: typeof IMAGINGOS_REVIEW_ASSIGNMENT_VERSION;
};

export function readImagingReviewAssignmentRecord(
  metadata: Record<string, unknown> | null | undefined
): ImagingReviewAssignmentRecord | null {
  const raw = metadata?.imaging_review_assignment;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const status =
    r.assignment_status === "assigned" || r.assignment_status === "unassigned"
      ? r.assignment_status
      : null;
  if (!status) return null;
  return {
    assigned_to: r.assigned_to != null ? String(r.assigned_to) : null,
    assigned_by: r.assigned_by != null ? String(r.assigned_by) : null,
    assigned_at: typeof r.assigned_at === "string" ? r.assigned_at : new Date().toISOString(),
    assignment_status: status,
    assignment_version: IMAGINGOS_REVIEW_ASSIGNMENT_VERSION,
  };
}

export function buildReviewAssignmentRecord(input: {
  assignedTo: string | null;
  assignedBy: string | null;
  status: ImagingReviewAssignmentStatus;
  assignedAt?: string;
}): ImagingReviewAssignmentRecord {
  return {
    assigned_to: input.assignedTo?.trim() || null,
    assigned_by: input.assignedBy?.trim() || null,
    assigned_at: input.assignedAt ?? new Date().toISOString(),
    assignment_status: input.status,
    assignment_version: IMAGINGOS_REVIEW_ASSIGNMENT_VERSION,
  };
}

export function mergeImagingReviewAssignmentMetadata(
  existingMetadata: Record<string, unknown> | null | undefined,
  record: ImagingReviewAssignmentRecord
): Record<string, unknown> {
  const base =
    existingMetadata && typeof existingMetadata === "object" && !Array.isArray(existingMetadata)
      ? { ...existingMetadata }
      : {};
  return { ...base, imaging_review_assignment: record };
}