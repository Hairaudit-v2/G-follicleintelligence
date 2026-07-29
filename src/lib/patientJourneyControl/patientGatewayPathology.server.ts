/**
 * FI-PATIENT-APP-P1 — patient-safe pathology / blood tracker gateway.
 * NEVER returns abnormal flags or AI interpretations without approved patientSafeSummary.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { writePatientGatewayAudit } from "@/src/lib/patientPortal/patientGatewayAudit.server";
import { patientGatewayDeny } from "@/src/lib/patientPortal/patientGatewayGateCore";
import type { PatientGatewayContext, PatientGatewayDeny } from "@/src/lib/patientPortal/patientGatewayTypes";

import type { PatientPathologyStatus } from "./patientJourneyControlContracts";
import { handleJourneyControlEvent } from "./patientJourneyControlEvents.server";

export type PatientGatewayPathologyResponse = {
  ok: true;
  status: PatientPathologyStatus | string;
  testsRequested: string[];
  requestDate: string | null;
  recommendedCompletionDate: string | null;
  fastingInstructions: string | null;
  providerInstructions: string | null;
  clinicalReviewComplete: boolean;
  patientSafeSummary: string | null;
  canUploadExternalResults: boolean;
  requestId: string | null;
};

export type PatientGatewayPathologyOptions = {
  supabase?: SupabaseClient;
  nowIso?: string;
  writeAudit?: boolean;
};

const FORBIDDEN_PATHOLOGY_FRAGMENTS = [
  "abnormal",
  "aiInterpretation",
  "ai_interpretation",
  "flag",
  "critical",
  "clinical_summary",
  "clinicalSummary",
  "internalNote",
] as const;

export function pathologyPayloadExposesInternalFields(payload: unknown): boolean {
  const serialized = JSON.stringify(payload ?? null);
  if (!serialized) return false;
  // Allow the word only inside patientSafeSummary key name itself — check structural keys.
  if (typeof payload === "object" && payload && !Array.isArray(payload)) {
    const o = payload as Record<string, unknown>;
    for (const k of Object.keys(o)) {
      if (
        ["abnormalFlags", "aiInterpretation", "flags", "clinicalSummary", "internalNote"].includes(k)
      ) {
        return true;
      }
    }
  }
  return FORBIDDEN_PATHOLOGY_FRAGMENTS.filter((f) => f !== "flag").some((f) =>
    serialized.includes(`"${f}"`)
  );
}

function deriveStatus(input: {
  request: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
}): PatientPathologyStatus {
  const req = input.request;
  const res = input.result;
  if (!req) return "not_requested";
  const workflow = String(req.workflow_status ?? "").trim();
  const clearance = res?.clearance_status != null ? String(res.clearance_status) : "";
  if (clearance === "cleared") return "cleared";
  if (clearance === "follow_up_required" || res?.follow_up_required === true) return "follow_up_required";
  if (res?.patient_summary_approved_at) return "cleared";
  if (res) {
    if (res.patient_summary_approved_at) return "cleared";
    return "awaiting_clinical_review";
  }
  if (workflow === "results_received") return "results_received";
  if (workflow === "issued" || req.issued_at) return "issued";
  if (workflow === "prepared") return "prepared";
  if (req.issued_at) return "issued";
  return "prepared";
}

export async function loadPatientPathologyForGateway(
  ctx: PatientGatewayContext,
  options?: PatientGatewayPathologyOptions
): Promise<PatientGatewayPathologyResponse | PatientGatewayDeny> {
  const supabase = options?.supabase ?? supabaseAdmin();
  const writeAudit = options?.writeAudit !== false;

  const { data: request, error: re } = await supabase
    .from("fi_pathology_requests")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .eq("patient_id", ctx.patientId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (re) return patientGatewayDeny("misconfigured", 500, "Unable to load pathology.");

  let testsRequested: string[] = [];
  if (request?.id) {
    const { data: items } = await supabase
      .from("fi_pathology_request_items")
      .select("test_label")
      .eq("tenant_id", ctx.tenantId)
      .eq("request_id", String(request.id))
      .order("sort_order", { ascending: true });
    testsRequested = (items ?? [])
      .map((i) => String((i as { test_label?: string }).test_label ?? ""))
      .filter(Boolean);
  }

  const { data: result } = await supabase
    .from("fi_pathology_results")
    .select(
      "id, pathology_request_id, patient_safe_summary, patient_summary_approved_at, clearance_status, follow_up_required, status, created_at"
    )
    .eq("tenant_id", ctx.tenantId)
    .eq("patient_id", ctx.patientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const reqRow = (request as Record<string, unknown> | null) ?? null;
  const resRow = (result as Record<string, unknown> | null) ?? null;
  const approvedAt = resRow?.patient_summary_approved_at
    ? String(resRow.patient_summary_approved_at)
    : null;
  const patientSafeSummary =
    approvedAt && resRow?.patient_safe_summary != null
      ? String(resRow.patient_safe_summary)
      : null;

  const status = deriveStatus({ request: reqRow, result: resRow });
  const response: PatientGatewayPathologyResponse = {
    ok: true,
    status,
    testsRequested,
    requestDate: reqRow?.request_date != null ? String(reqRow.request_date) : null,
    recommendedCompletionDate:
      reqRow?.recommended_completion_date != null
        ? String(reqRow.recommended_completion_date)
        : null,
    fastingInstructions:
      reqRow?.fasting_instructions != null ? String(reqRow.fasting_instructions) : null,
    providerInstructions:
      reqRow?.provider_instructions != null ? String(reqRow.provider_instructions) : null,
    clinicalReviewComplete: Boolean(approvedAt) || status === "cleared",
    patientSafeSummary,
    canUploadExternalResults: Boolean(reqRow?.issued_at) && !approvedAt,
    requestId: reqRow?.id != null ? String(reqRow.id) : null,
  };

  if (pathologyPayloadExposesInternalFields(response)) {
    return patientGatewayDeny("misconfigured", 500, "Pathology projection failed safety check.");
  }

  if (writeAudit) {
    writePatientGatewayAudit({
      action: "pathology_read",
      outcome: "allow",
      authUserId: ctx.authUserId,
      patientId: ctx.patientId,
      tenantId: ctx.tenantId,
      resourceKind: "pathology",
      resourceId: response.requestId,
    });
  }

  return response;
}

export async function approvePathologyPatientSummary(
  args: {
    tenantId: string;
    patientId: string;
    resultId: string;
    patientSafeSummary: string;
    approvedByUserId: string;
    clearanceStatus?: "cleared" | "follow_up_required";
    surgeryImpact?: string | null;
    followUpRequired?: boolean;
  },
  options?: PatientGatewayPathologyOptions
): Promise<{ ok: true }> {
  const supabase = options?.supabase ?? supabaseAdmin();
  const now = options?.nowIso ?? new Date().toISOString();
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const pid = assertNonEmptyUuid(args.patientId, "patientId");
  const rid = assertNonEmptyUuid(args.resultId, "resultId");
  const summary = args.patientSafeSummary.trim();
  if (!summary) throw new Error("patientSafeSummary is required.");

  const { error } = await supabase
    .from("fi_pathology_results")
    .update({
      patient_safe_summary: summary,
      patient_summary_approved_at: now,
      patient_summary_approved_by: args.approvedByUserId,
      clearance_status: args.clearanceStatus ?? "cleared",
      surgery_impact: args.surgeryImpact ?? null,
      follow_up_required: args.followUpRequired ?? false,
      updated_at: now,
    })
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .eq("id", rid);
  if (error) throw new Error(error.message);

  await handleJourneyControlEvent(
    {
      event: "pathology_cleared",
      tenantId: tid,
      patientId: pid,
      resourceType: "pathology_result",
      resourceId: rid,
      authUserId: null,
    },
    { supabase, nowIso: now }
  );
  return { ok: true };
}

export async function issuePathologyRequestForPatient(
  args: {
    tenantId: string;
    patientId: string;
    requestId: string;
    fastingInstructions?: string | null;
    providerInstructions?: string | null;
    recommendedCompletionDate?: string | null;
    authUserId?: string | null;
  },
  options?: PatientGatewayPathologyOptions
): Promise<{ ok: true }> {
  const supabase = options?.supabase ?? supabaseAdmin();
  const now = options?.nowIso ?? new Date().toISOString();
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const pid = assertNonEmptyUuid(args.patientId, "patientId");
  const rid = assertNonEmptyUuid(args.requestId, "requestId");

  const { error } = await supabase
    .from("fi_pathology_requests")
    .update({
      issued_at: now,
      workflow_status: "issued",
      fasting_instructions: args.fastingInstructions ?? null,
      provider_instructions: args.providerInstructions ?? null,
      recommended_completion_date: args.recommendedCompletionDate ?? null,
      patient_id: pid,
      updated_at: now,
    })
    .eq("tenant_id", tid)
    .eq("id", rid);
  if (error) throw new Error(error.message);

  await handleJourneyControlEvent(
    {
      event: "blood_request_issued",
      tenantId: tid,
      patientId: pid,
      resourceType: "pathology_request",
      resourceId: rid,
      authUserId: args.authUserId ?? null,
    },
    { supabase, nowIso: now }
  );
  return { ok: true };
}

export async function markPathologyResultsReceivedForPatient(
  args: {
    tenantId: string;
    patientId: string;
    resultId: string;
    requestId?: string | null;
    authUserId?: string | null;
  },
  options?: PatientGatewayPathologyOptions
): Promise<{ ok: true }> {
  const supabase = options?.supabase ?? supabaseAdmin();
  const now = options?.nowIso ?? new Date().toISOString();
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const pid = assertNonEmptyUuid(args.patientId, "patientId");
  const resultId = assertNonEmptyUuid(args.resultId, "resultId");

  if (args.requestId) {
    await supabase
      .from("fi_pathology_requests")
      .update({ workflow_status: "results_received", updated_at: now })
      .eq("tenant_id", tid)
      .eq("id", assertNonEmptyUuid(args.requestId, "requestId"));
  }

  await handleJourneyControlEvent(
    {
      event: "pathology_results_received",
      tenantId: tid,
      patientId: pid,
      resourceType: "pathology_result",
      resourceId: resultId,
      authUserId: args.authUserId ?? null,
    },
    { supabase, nowIso: now }
  );
  return { ok: true };
}

/** Patient uploads external result metadata (binary storage handled by imaging/docs elsewhere). */
export async function recordPatientPathologyResultsUpload(
  ctx: PatientGatewayContext,
  input: { note?: string | null; fileName?: string | null },
  options?: PatientGatewayPathologyOptions
): Promise<{ ok: true; resultId: string } | PatientGatewayDeny> {
  const supabase = options?.supabase ?? supabaseAdmin();
  const now = options?.nowIso ?? new Date().toISOString();

  const current = await loadPatientPathologyForGateway(ctx, { ...options, supabase, writeAudit: false });
  if (!current.ok) return current;
  if (!current.canUploadExternalResults) {
    return patientGatewayDeny("ownership_denied", 403, "Results upload is not available.");
  }

  const { data, error } = await supabase
    .from("fi_pathology_results")
    .insert({
      tenant_id: ctx.tenantId,
      patient_id: ctx.patientId,
      pathology_request_id: current.requestId,
      result_date: now.slice(0, 10),
      source_type: "uploaded_pdf",
      status: "draft",
      metadata: {
        patient_upload: true,
        note: input.note?.trim() || null,
        file_name: input.fileName?.trim() || null,
      },
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();
  if (error) return patientGatewayDeny("misconfigured", 500, "Unable to record upload.");

  await markPathologyResultsReceivedForPatient(
    {
      tenantId: ctx.tenantId,
      patientId: ctx.patientId,
      resultId: String(data.id),
      requestId: current.requestId,
      authUserId: ctx.authUserId,
    },
    { supabase, nowIso: now }
  );

  return { ok: true, resultId: String(data.id) };
}