import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  isHairlineDesignStatus,
  parseHairlineGeometry,
  type HairlineDesignRow,
  type HairlineDesignStatus,
} from "./hairlineDomain";

function mapRow(r: Record<string, unknown>): HairlineDesignRow {
  const statusRaw = String(r.status ?? "draft");
  const status: HairlineDesignStatus = isHairlineDesignStatus(statusRaw) ? statusRaw : "draft";
  return {
    id: String(r.id),
    tenantId: String(r.tenant_id),
    caseId: String(r.case_id),
    surgicalPlanId: String(r.surgical_plan_id),
    designVersion: Number(r.design_version ?? 1),
    status,
    sourceImageId: r.source_image_id != null ? String(r.source_image_id) : null,
    sourceImageRef: String(r.source_image_ref ?? ""),
    sourceImageChecksum: String(r.source_image_checksum ?? ""),
    sourceView: String(r.source_view ?? "frontal"),
    imageWidthPx: r.image_width_px != null ? Number(r.image_width_px) : null,
    imageHeightPx: r.image_height_px != null ? Number(r.image_height_px) : null,
    orientationDegrees: Number(r.orientation_degrees ?? 0),
    geometry: parseHairlineGeometry(r.geometry),
    authorUserId: r.author_user_id != null ? String(r.author_user_id) : null,
    approvedBy: r.approved_by != null ? String(r.approved_by) : null,
    approvedAt: r.approved_at != null ? String(r.approved_at) : null,
    rejectedBy: r.rejected_by != null ? String(r.rejected_by) : null,
    rejectedAt: r.rejected_at != null ? String(r.rejected_at) : null,
    rejectionReason: r.rejection_reason != null ? String(r.rejection_reason) : null,
    supersedesDesignId: r.supersedes_design_id != null ? String(r.supersedes_design_id) : null,
    supersededByDesignId:
      r.superseded_by_design_id != null ? String(r.superseded_by_design_id) : null,
    renderStorageRef: r.render_storage_ref != null ? String(r.render_storage_ref) : null,
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
  };
}

export async function loadHairlineDesignsForCase(
  tenantId: string,
  caseId: string,
  client?: SupabaseClient
): Promise<HairlineDesignRow[]> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const cid = assertNonEmptyUuid(caseId, "caseId");

  const { data, error } = await supabase
    .from("fi_case_hairline_designs")
    .select("*")
    .eq("tenant_id", tid)
    .eq("case_id", cid)
    .order("design_version", { ascending: false });

  if (error) {
    // Table may not exist until migration is applied — degrade gracefully in UI.
    if (/does not exist|relation/i.test(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function loadCurrentApprovedHairlineForCase(
  tenantId: string,
  caseId: string,
  client?: SupabaseClient
): Promise<HairlineDesignRow | null> {
  const designs = await loadHairlineDesignsForCase(tenantId, caseId, client);
  return designs.find((d) => d.status === "approved") ?? null;
}

export async function loadLatestHairlineDraftOrReview(
  tenantId: string,
  caseId: string,
  client?: SupabaseClient
): Promise<HairlineDesignRow | null> {
  const designs = await loadHairlineDesignsForCase(tenantId, caseId, client);
  return (
    designs.find((d) => d.status === "draft" || d.status === "awaiting_review") ??
    designs[0] ??
    null
  );
}
