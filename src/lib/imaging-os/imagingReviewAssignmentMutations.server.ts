import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildReviewAssignmentRecord,
  mergeImagingReviewAssignmentMetadata,
  type ImagingReviewAssignmentRecord,
} from "./imagingReviewAssignmentCore";

export type ImagingReviewAssignmentResult = {
  imageId: string;
  assignment: ImagingReviewAssignmentRecord;
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

async function persistAssignmentUpdate(input: {
  supabase: SupabaseClient;
  tenantId: string;
  patientImageId: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await input.supabase
    .from("fi_patient_images")
    .update({ metadata: input.metadata, updated_at: now })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.patientImageId);
  if (error) throw new Error(error.message);
}

export async function assignImagingReviewToStaff(input: {
  tenantId: string;
  patientId: string;
  patientImageId: string;
  assignedToUserId: string;
  assignedByUserId: string | null;
  client?: SupabaseClient;
}): Promise<ImagingReviewAssignmentResult> {
  const supabase = input.client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const pid = input.patientId.trim();
  const iid = input.patientImageId.trim();
  const assignee = input.assignedToUserId.trim();
  if (!assignee) throw new Error("assigned_to user id is required.");

  const row = await loadTenantPatientImage(supabase, tid, pid, iid);
  const metadata =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : {};

  const record = buildReviewAssignmentRecord({
    assignedTo: assignee,
    assignedBy: input.assignedByUserId,
    status: "assigned",
  });
  const merged = mergeImagingReviewAssignmentMetadata(metadata, record);

  await persistAssignmentUpdate({ supabase, tenantId: tid, patientImageId: iid, metadata: merged });
  return { imageId: iid, assignment: record, metadata: merged };
}

export async function unassignImagingReview(input: {
  tenantId: string;
  patientId: string;
  patientImageId: string;
  assignedByUserId: string | null;
  client?: SupabaseClient;
}): Promise<ImagingReviewAssignmentResult> {
  const supabase = input.client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const pid = input.patientId.trim();
  const iid = input.patientImageId.trim();

  const row = await loadTenantPatientImage(supabase, tid, pid, iid);
  const metadata =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : {};

  const record = buildReviewAssignmentRecord({
    assignedTo: null,
    assignedBy: input.assignedByUserId,
    status: "unassigned",
  });
  const merged = mergeImagingReviewAssignmentMetadata(metadata, record);

  await persistAssignmentUpdate({ supabase, tenantId: tid, patientImageId: iid, metadata: merged });
  return { imageId: iid, assignment: record, metadata: merged };
}