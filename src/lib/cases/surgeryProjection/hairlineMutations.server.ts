import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  defaultHairlineGeometry,
  hairlineGeometrySchema,
  mergeHairlineControls,
  type HairlineGeometry,
} from "./hairlineDomain";
import { loadHairlineDesignsForCase } from "./hairlineLoaders.server";

async function appendEvent(input: {
  tenantId: string;
  caseId: string;
  eventKind: string;
  actorUserId?: string | null;
  hairlineDesignId?: string | null;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const db = supabaseAdmin();
  await db.from("fi_case_surgery_projection_events").insert({
    tenant_id: input.tenantId,
    case_id: input.caseId,
    event_kind: input.eventKind,
    actor_user_id: input.actorUserId ?? null,
    hairline_design_id: input.hairlineDesignId ?? null,
    payload: input.payload ?? {},
  });
}

export type CreateHairlineDesignInput = {
  tenantId: string;
  caseId: string;
  surgicalPlanId: string;
  sourceImageRef: string;
  sourceImageChecksum: string;
  sourceImageId?: string | null;
  sourceView?: string;
  imageWidthPx?: number | null;
  imageHeightPx?: number | null;
  orientationDegrees?: number;
  geometry?: HairlineGeometry;
  authorUserId?: string | null;
};

export async function createHairlineDesignVersion(
  input: CreateHairlineDesignInput
): Promise<{ ok: true; id: string; designVersion: number } | { ok: false; code: string }> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const cid = assertNonEmptyUuid(input.caseId, "caseId");
  const planId = assertNonEmptyUuid(input.surgicalPlanId, "surgicalPlanId");
  if (!input.sourceImageRef.trim() || !input.sourceImageChecksum.trim()) {
    return { ok: false, code: "source_image_required" };
  }

  const existing = await loadHairlineDesignsForCase(tid, cid);
  const nextVersion =
    existing.reduce((max, d) => Math.max(max, d.designVersion), 0) + 1;

  const geometry =
    input.geometry ??
    (existing[0] ? existing[0].geometry : defaultHairlineGeometry());

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("fi_case_hairline_designs")
    .insert({
      tenant_id: tid,
      case_id: cid,
      surgical_plan_id: planId,
      design_version: nextVersion,
      status: "draft",
      source_image_id: input.sourceImageId ?? null,
      source_image_ref: input.sourceImageRef.trim(),
      source_image_checksum: input.sourceImageChecksum.trim().toLowerCase(),
      source_view: input.sourceView ?? "frontal",
      image_width_px: input.imageWidthPx ?? null,
      image_height_px: input.imageHeightPx ?? null,
      orientation_degrees: input.orientationDegrees ?? 0,
      geometry,
      author_user_id: input.authorUserId ?? null,
      supersedes_design_id: existing[0]?.id ?? null,
    })
    .select("id, design_version")
    .single();

  if (error) return { ok: false, code: error.message };

  // Supersede prior editable drafts only — approved designs remain until the new version is approved.
  if (existing[0]) {
    await db
      .from("fi_case_hairline_designs")
      .update({
        status: "superseded",
        superseded_by_design_id: data.id,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tid)
      .eq("case_id", cid)
      .in("status", ["draft", "awaiting_review"])
      .neq("id", data.id);
  }

  await appendEvent({
    tenantId: tid,
    caseId: cid,
    eventKind: "hairline_design_created",
    actorUserId: input.authorUserId,
    hairlineDesignId: String(data.id),
    payload: { designVersion: nextVersion },
  });

  return { ok: true, id: String(data.id), designVersion: nextVersion };
}

export async function updateHairlineDesignGeometry(input: {
  tenantId: string;
  caseId: string;
  designId: string;
  patch: Partial<Omit<HairlineGeometry, "polylineNorm">>;
  actorUserId?: string | null;
}): Promise<{ ok: true } | { ok: false; code: string }> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const cid = assertNonEmptyUuid(input.caseId, "caseId");
  const designs = await loadHairlineDesignsForCase(tid, cid);
  const design = designs.find((d) => d.id === input.designId);
  if (!design) return { ok: false, code: "not_found" };
  if (design.status !== "draft" && design.status !== "awaiting_review") {
    return { ok: false, code: "not_editable" };
  }

  const geometry = mergeHairlineControls(design.geometry, input.patch);
  const parsed = hairlineGeometrySchema.safeParse(geometry);
  if (!parsed.success) return { ok: false, code: "invalid_geometry" };

  const db = supabaseAdmin();
  const { error } = await db
    .from("fi_case_hairline_designs")
    .update({ geometry: parsed.data, updated_at: new Date().toISOString() })
    .eq("id", design.id)
    .eq("tenant_id", tid)
    .eq("case_id", cid);

  if (error) return { ok: false, code: error.message };

  await appendEvent({
    tenantId: tid,
    caseId: cid,
    eventKind: "hairline_geometry_updated",
    actorUserId: input.actorUserId,
    hairlineDesignId: design.id,
  });

  return { ok: true };
}

export async function submitHairlineForReview(input: {
  tenantId: string;
  caseId: string;
  designId: string;
  actorUserId?: string | null;
}): Promise<{ ok: true } | { ok: false; code: string }> {
  return setHairlineStatus({ ...input, status: "awaiting_review", eventKind: "hairline_submitted" });
}

export async function approveHairlineDesign(input: {
  tenantId: string;
  caseId: string;
  designId: string;
  actorUserId: string;
}): Promise<{ ok: true } | { ok: false; code: string }> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const cid = assertNonEmptyUuid(input.caseId, "caseId");
  const designs = await loadHairlineDesignsForCase(tid, cid);
  const design = designs.find((d) => d.id === input.designId);
  if (!design) return { ok: false, code: "not_found" };
  if (design.status !== "awaiting_review" && design.status !== "draft") {
    return { ok: false, code: "not_awaiting_review" };
  }
  if (design.geometry.polylineNorm.length < 2) {
    return { ok: false, code: "polyline_required" };
  }
  if (!design.sourceImageChecksum) return { ok: false, code: "source_checksum_required" };

  const db = supabaseAdmin();
  const now = new Date().toISOString();

  // Supersede any other approved designs for this case.
  await db
    .from("fi_case_hairline_designs")
    .update({
      status: "superseded",
      superseded_by_design_id: design.id,
      updated_at: now,
    })
    .eq("tenant_id", tid)
    .eq("case_id", cid)
    .eq("status", "approved")
    .neq("id", design.id);

  const { error } = await db
    .from("fi_case_hairline_designs")
    .update({
      status: "approved",
      approved_by: input.actorUserId,
      approved_at: now,
      rejected_by: null,
      rejected_at: null,
      rejection_reason: null,
      updated_at: now,
    })
    .eq("id", design.id)
    .eq("tenant_id", tid);

  if (error) return { ok: false, code: error.message };

  await appendEvent({
    tenantId: tid,
    caseId: cid,
    eventKind: "hairline_approved",
    actorUserId: input.actorUserId,
    hairlineDesignId: design.id,
    payload: { designVersion: design.designVersion },
  });

  return { ok: true };
}

export async function rejectHairlineDesign(input: {
  tenantId: string;
  caseId: string;
  designId: string;
  actorUserId: string;
  reason: string;
}): Promise<{ ok: true } | { ok: false; code: string }> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const cid = assertNonEmptyUuid(input.caseId, "caseId");
  const db = supabaseAdmin();
  const now = new Date().toISOString();

  const { error } = await db
    .from("fi_case_hairline_designs")
    .update({
      status: "rejected",
      rejected_by: input.actorUserId,
      rejected_at: now,
      rejection_reason: input.reason.slice(0, 2000),
      updated_at: now,
    })
    .eq("id", input.designId)
    .eq("tenant_id", tid)
    .eq("case_id", cid);

  if (error) return { ok: false, code: error.message };

  await appendEvent({
    tenantId: tid,
    caseId: cid,
    eventKind: "hairline_rejected",
    actorUserId: input.actorUserId,
    hairlineDesignId: input.designId,
    payload: { reason: input.reason.slice(0, 500) },
  });

  // Explicit: hairline rejection does not touch fi_case_surgery_plans.
  return { ok: true };
}

async function setHairlineStatus(input: {
  tenantId: string;
  caseId: string;
  designId: string;
  status: "awaiting_review";
  eventKind: string;
  actorUserId?: string | null;
}): Promise<{ ok: true } | { ok: false; code: string }> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const cid = assertNonEmptyUuid(input.caseId, "caseId");
  const db = supabaseAdmin();
  const { error } = await db
    .from("fi_case_hairline_designs")
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .eq("id", input.designId)
    .eq("tenant_id", tid)
    .eq("case_id", cid);

  if (error) return { ok: false, code: error.message };

  await appendEvent({
    tenantId: tid,
    caseId: cid,
    eventKind: input.eventKind,
    actorUserId: input.actorUserId,
    hairlineDesignId: input.designId,
  });
  return { ok: true };
}
