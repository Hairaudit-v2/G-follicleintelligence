"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  requestSharedIllustrativeGeneration,
  setProductLocalReview,
  type PilotPreflightRecord,
} from "@/src/lib/imaging-os/sharedProjection/generationService.server";
import {
  resolveSharedProjectionProviderConfig,
  SHARED_PROJECTION_PROVIDER_ID,
} from "@/src/lib/imaging-os/sharedProjection/providerConfig";
import {
  actorHasSurgeryProjectionCapability,
  SURGERY_PROJECTION_CAPABILITIES,
} from "@/src/lib/cases/surgeryProjection/capabilities";
import { loadHairlineDesignsForCase } from "@/src/lib/cases/surgeryProjection/hairlineLoaders.server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function casePath(tenantId: string, caseId: string): string {
  return `/fi-admin/${tenantId}/cases/${caseId}`;
}

export async function fiRequestProjectedOutcomePreflightAction(input: {
  tenantId: string;
  caseId: string;
  actorUserId: string | null;
  actorRole: string | null;
}): Promise<
  | { ok: true; preflight: PilotPreflightRecord; status: "READY FOR CONTROLLED PILOT" }
  | { ok: false; error: string }
> {
  if (
    !actorHasSurgeryProjectionCapability(
      { role: input.actorRole, userId: input.actorUserId },
      SURGERY_PROJECTION_CAPABILITIES.requestGeneration
    )
  ) {
    return { ok: false, error: "capability_denied" };
  }

  const prepared = await prepareCaseProjectionRequest(input);
  if (!prepared.ok) return prepared;

  const result = await requestSharedIllustrativeGeneration({
    ...prepared.request,
    confirmPaidGeneration: false,
  });

  if (!result.ok) {
    return { ok: false, error: result.code };
  }

  return {
    ok: true,
    preflight: result.preflight,
    status: "READY FOR CONTROLLED PILOT",
  };
}

export async function fiConfirmProjectedOutcomeGenerationAction(input: {
  tenantId: string;
  caseId: string;
  actorUserId: string;
  actorRole: string | null;
  costAcknowledged: boolean;
}): Promise<
  | {
      ok: true;
      sharedGenerationId: string;
      lifecycleStatus: string;
      providerInvocationCount: number;
    }
  | { ok: false; error: string }
> {
  if (!input.costAcknowledged) {
    return { ok: false, error: "cost_confirmation_required" };
  }
  if (
    !actorHasSurgeryProjectionCapability(
      { role: input.actorRole, userId: input.actorUserId },
      SURGERY_PROJECTION_CAPABILITIES.requestGeneration
    )
  ) {
    return { ok: false, error: "capability_denied" };
  }

  const prepared = await prepareCaseProjectionRequest({
    tenantId: input.tenantId,
    caseId: input.caseId,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
  });
  if (!prepared.ok) return prepared;

  const result = await requestSharedIllustrativeGeneration({
    ...prepared.request,
    confirmPaidGeneration: true,
  });

  if (!result.ok) {
    return { ok: false, error: result.code };
  }
  if (result.kind === "ready_for_controlled_pilot" || !result.generation) {
    return { ok: false, error: "generation_not_started" };
  }

  revalidatePath(casePath(input.tenantId, input.caseId));
  return {
    ok: true,
    sharedGenerationId: result.generation.id,
    lifecycleStatus: result.generation.lifecycleStatus,
    providerInvocationCount: result.providerInvocationCount,
  };
}

export async function fiSetProjectedOutcomeReviewAction(input: {
  tenantId: string;
  caseId: string;
  sharedGenerationId: string;
  actorUserId: string;
  actorRole: string | null;
  decision:
    | "clinically_accepted"
    | "clinically_rejected"
    | "correction_requested"
    | "accepted_for_review";
  note?: string | null;
  correctionRequest?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (
    !actorHasSurgeryProjectionCapability(
      { role: input.actorRole, userId: input.actorUserId },
      SURGERY_PROJECTION_CAPABILITIES.inspectGeneratedImages
    )
  ) {
    return { ok: false, error: "capability_denied" };
  }

  await setProductLocalReview({
    sharedGenerationId: input.sharedGenerationId,
    product: "fios",
    localCaseId: input.caseId,
    localReviewStatus: input.decision,
    localReviewerId: input.actorUserId,
    note: input.note,
    correctionRequest: input.correctionRequest,
  });

  revalidatePath(casePath(input.tenantId, input.caseId));
  return { ok: true };
}

async function prepareCaseProjectionRequest(input: {
  tenantId: string;
  caseId: string;
  actorUserId: string | null;
  actorRole: string | null;
}): Promise<
  | {
      ok: true;
      request: Parameters<typeof requestSharedIllustrativeGeneration>[0];
    }
  | { ok: false; error: string }
> {
  const config = resolveSharedProjectionProviderConfig();
  const db = supabaseAdmin();

  const { data: plan } = await db
    .from("fi_case_surgery_plans")
    .select("id, planning_status, planned_zones, estimated_grafts_min, estimated_grafts_max, updated_at")
    .eq("tenant_id", input.tenantId)
    .eq("case_id", input.caseId)
    .maybeSingle();

  if (!plan || plan.planning_status !== "approved") {
    return { ok: false, error: "awaiting_plan_approval" };
  }

  const designs = await loadHairlineDesignsForCase(input.tenantId, input.caseId);
  const approved = designs.find((d) => d.status === "approved");
  if (!approved) {
    return { ok: false, error: "awaiting_hairline_approval" };
  }

  const { data: caseRow } = await db
    .from("fi_cases")
    .select("id, foundation_patient_id")
    .eq("id", input.caseId)
    .maybeSingle();

  const patientSubjectRef =
    (caseRow?.foundation_patient_id as string | null) ?? `fios-case:${input.caseId}`;

  const zones = Array.isArray(plan.planned_zones) ? plan.planned_zones : [];
  const planVersion = 1;

  return {
    ok: true,
    request: {
      tenantId: input.tenantId,
      patientSubjectRef,
      fiosCaseId: input.caseId,
      hairauditCaseRef: null,
      surgicalPlanId: String(plan.id),
      surgicalPlanVersion: planVersion,
      currentApprovedPlanVersion: planVersion,
      hairlineDesignId: approved.id,
      hairlineDesignVersion: approved.designVersion,
      currentApprovedHairlineVersion: approved.designVersion,
      sourceImageRef: approved.sourceImageRef,
      sourceImageChecksum: approved.sourceImageChecksum,
      sourceView: "frontal",
      treatmentMaskChecksum: approved.sourceImageChecksum,
      projectionMode: "planned",
      providerId: SHARED_PROJECTION_PROVIDER_ID,
      modelVersion: config.model,
      promptTemplateVersion: config.promptTemplateVersion,
      requestingProduct: "fios",
      requestingUserId: input.actorUserId,
      requestingCapability: SURGERY_PROJECTION_CAPABILITIES.requestGeneration,
      correlationId: randomUUID(),
      planApproved: true,
      hairlineApproved: true,
      zones: zones.map((z: {
        key?: string;
        grafts?: number | null;
        deferred?: boolean | null;
        polygonNorm?: Array<{ x: number; y: number }> | null;
      }) => ({
        key: String(z.key ?? "zone"),
        grafts: z.grafts,
        deferred: z.deferred,
        polygonNorm: z.polygonNorm,
      })),
      hairlineCurveNorm: approved.geometry?.polylineNorm ?? null,
      graftAllocationsByZone: zones.map((z: {
        key?: string;
        grafts?: number | null;
        deferred?: boolean | null;
        targetDensityPerCm2?: number | null;
      }) => ({
        zoneKey: String(z.key ?? "zone"),
        grafts: typeof z.grafts === "number" ? z.grafts : 0,
        targetDensityPerCm2: z.targetDensityPerCm2 ?? null,
        deferred: Boolean(z.deferred),
        unassessed: false,
        priority: null,
      })),
    },
  };
}
