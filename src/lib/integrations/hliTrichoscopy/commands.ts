import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireTenantModuleCapability } from "@/src/lib/entitlements/requireTenantModuleCapability";
import { recordTrichoscopyUsage } from "@/src/lib/platform/entitlements/trichoscopyEntitlementLifecycle.server";
import { hliTrichoscopyFetchJson } from "./client";
import { loadHliTrichoscopyConfig } from "./config";
import {
  HliTrichoscopyConflictError,
  HliTrichoscopyUnavailableError,
  HliTrichoscopyValidationError,
} from "./errors";
import { buildTrichoscopyRequestIdempotencyKey } from "./mappers";
import { emitTrichoscopyTelemetry } from "./telemetry";
import type {
  FiosTrichoscopyRequest,
  HliEntitlementContext,
  HliTrichoscopyRequestResponse,
} from "./types";

function stubHliResponse(req: FiosTrichoscopyRequest, idempotencyKey: string): HliTrichoscopyRequestResponse {
  const episodeId = `stub-ep-${idempotencyKey.slice(0, 24)}`;
  return {
    requestId: `stub-req-${randomUUID()}`,
    hliPatientReference: `hli-pt-${req.fiosPatientId}`,
    hliIntakeId: `hli-intake-${req.fiosPatientId}`,
    episodeId,
    purpose: req.purpose,
    requiredSites: req.requestedSites?.length ? req.requestedSites : ["vertex", "frontal", "left_temporal", "right_temporal"],
    captureProtocolVersion: "hli-trichoscopy-capture-v1",
    captureUrl: undefined,
    status: "requested",
    createdAt: new Date().toISOString(),
  };
}

function parseHliResponse(body: unknown): HliTrichoscopyRequestResponse {
  const b = body as Record<string, unknown>;
  if (!b || typeof b !== "object") {
    throw new HliTrichoscopyValidationError("Invalid HLI request response.");
  }
  const requestId = String(b.requestId ?? b.request_id ?? "").trim();
  const episodeId = String(b.episodeId ?? b.episode_id ?? "").trim();
  const hliPatientReference = String(b.hliPatientReference ?? b.patient_reference ?? "").trim();
  if (!requestId || !episodeId || !hliPatientReference) {
    throw new HliTrichoscopyValidationError("HLI response missing requestId/episodeId/patient reference.");
  }
  return {
    requestId,
    hliPatientReference,
    hliIntakeId: b.hliIntakeId ? String(b.hliIntakeId) : b.intake_id ? String(b.intake_id) : undefined,
    episodeId,
    purpose: String(b.purpose ?? ""),
    requiredSites: Array.isArray(b.requiredSites)
      ? (b.requiredSites as string[])
      : Array.isArray(b.required_sites)
        ? (b.required_sites as string[])
        : [],
    optionalSites: Array.isArray(b.optionalSites)
      ? (b.optionalSites as string[])
      : undefined,
    captureProtocolVersion: String(b.captureProtocolVersion ?? b.capture_protocol_version ?? "unknown"),
    captureUrl: b.captureUrl ? String(b.captureUrl) : b.capture_url ? String(b.capture_url) : undefined,
    status: String(b.status ?? "requested"),
    createdAt: String(b.createdAt ?? b.created_at ?? new Date().toISOString()),
  };
}

/**
 * Create a trichoscopy request in HLI and persist the FiOS link/request before success.
 */
export async function requestTrichoscopy(opts: {
  request: FiosTrichoscopyRequest;
  entitlementContext: HliEntitlementContext;
  workflowReference?: string | null;
  supabaseClientForTests?: SupabaseClient;
  env?: NodeJS.ProcessEnv;
}): Promise<{
  requestRowId: string;
  linkId: string;
  hli: HliTrichoscopyRequestResponse;
}> {
  const req = opts.request;
  const tenantId = req.tenantId.trim();

  const access = await requireTenantModuleCapability({
    tenantId,
    userId: req.requestedByUserId,
    capability: "trichoscopy.request",
    patientId: req.fiosPatientId,
    caseId: req.fiosCaseId,
    concealModule: true,
    supabaseClientForTests: opts.supabaseClientForTests,
    env: opts.env,
  });
  if (!access.ok) {
    throw new HliTrichoscopyUnavailableError(access.access.denialReason ?? "not_entitled");
  }

  const idempotencyKey = buildTrichoscopyRequestIdempotencyKey({
    tenantId,
    patientId: req.fiosPatientId,
    caseId: req.fiosCaseId,
    purpose: req.purpose,
    workflowReference: opts.workflowReference,
  });

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();

  const { data: existing } = await supabase
    .from("fi_hli_trichoscopy_requests")
    .select("id, link_id, hli_response, status")
    .eq("tenant_id", tenantId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existing && (existing as { hli_response?: unknown }).hli_response) {
    const prior = (existing as { hli_response: HliTrichoscopyRequestResponse }).hli_response;
    return {
      requestRowId: String((existing as { id: string }).id),
      linkId: String((existing as { link_id: string }).link_id),
      hli: prior,
    };
  }

  const config = loadHliTrichoscopyConfig(opts.env);
  let hli: HliTrichoscopyRequestResponse;

  if (config.useStub) {
    hli = stubHliResponse(req, idempotencyKey);
  } else {
    const http = await hliTrichoscopyFetchJson({
      path: "/v1/trichoscopy/requests",
      method: "POST",
      tenantId,
      idempotencyKey,
      config,
      body: {
        ...req,
        idempotencyKey,
        entitlementContext: opts.entitlementContext,
      },
    });
    if (!http.ok) {
      throw new HliTrichoscopyConflictError(`HLI request failed with status ${http.status}`);
    }
    hli = parseHliResponse(http.body);
  }

  const now = new Date().toISOString();
  const { data: link, error: linkError } = await supabase
    .from("fi_hli_trichoscopy_links")
    .insert({
      tenant_id: tenantId,
      fios_patient_id: req.fiosPatientId,
      fios_case_id: req.fiosCaseId ?? null,
      fios_consultation_id: req.consultationId ?? null,
      fios_treatment_plan_id: req.treatmentPlanId ?? null,
      fios_surgery_case_id: req.surgeryCaseId ?? null,
      hli_tenant_reference: tenantId,
      hli_patient_reference: hli.hliPatientReference,
      hli_intake_id: hli.hliIntakeId ?? null,
      hli_episode_id: hli.episodeId,
      purpose: req.purpose,
      status: "requested",
      requested_by_user_id: req.requestedByUserId,
      requested_at: now,
      linked_at: now,
      last_synced_at: now,
    })
    .select("id")
    .single();

  if (linkError || !link) {
    // Unique active link race — load existing
    if (linkError?.code === "23505") {
      const { data: existingLink } = await supabase
        .from("fi_hli_trichoscopy_links")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("fios_patient_id", req.fiosPatientId)
        .eq("purpose", req.purpose)
        .is("cancelled_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!existingLink) throw new HliTrichoscopyConflictError(linkError.message);
      const linkId = String((existingLink as { id: string }).id);
      const { data: requestRow, error: reqError } = await supabase
        .from("fi_hli_trichoscopy_requests")
        .upsert(
          {
            tenant_id: tenantId,
            link_id: linkId,
            fios_patient_id: req.fiosPatientId,
            fios_case_id: req.fiosCaseId ?? null,
            consultation_id: req.consultationId ?? null,
            treatment_plan_id: req.treatmentPlanId ?? null,
            surgery_case_id: req.surgeryCaseId ?? null,
            purpose: req.purpose,
            requested_sites: req.requestedSites ?? [],
            clinical_question: req.clinicalQuestion ?? null,
            target_date: req.targetDate ?? null,
            urgency: req.urgency ?? "routine",
            requested_by_user_id: req.requestedByUserId,
            idempotency_key: idempotencyKey,
            hli_request_id: hli.requestId,
            hli_patient_reference: hli.hliPatientReference,
            hli_intake_id: hli.hliIntakeId ?? null,
            hli_episode_id: hli.episodeId,
            capture_protocol_version: hli.captureProtocolVersion,
            capture_url: hli.captureUrl ?? null,
            status: "accepted",
            hli_response: hli,
            entitlement_context: opts.entitlementContext,
          },
          { onConflict: "tenant_id,idempotency_key" }
        )
        .select("id")
        .single();
      if (reqError || !requestRow) throw new HliTrichoscopyConflictError(reqError?.message ?? "request upsert failed");
      return { requestRowId: String((requestRow as { id: string }).id), linkId, hli };
    }
    throw new HliTrichoscopyConflictError(linkError?.message ?? "link insert failed");
  }

  const linkId = String((link as { id: string }).id);
  const { data: requestRow, error: reqError } = await supabase
    .from("fi_hli_trichoscopy_requests")
    .insert({
      tenant_id: tenantId,
      link_id: linkId,
      fios_patient_id: req.fiosPatientId,
      fios_case_id: req.fiosCaseId ?? null,
      consultation_id: req.consultationId ?? null,
      treatment_plan_id: req.treatmentPlanId ?? null,
      surgery_case_id: req.surgeryCaseId ?? null,
      purpose: req.purpose,
      requested_sites: req.requestedSites ?? [],
      clinical_question: req.clinicalQuestion ?? null,
      target_date: req.targetDate ?? null,
      urgency: req.urgency ?? "routine",
      requested_by_user_id: req.requestedByUserId,
      idempotency_key: idempotencyKey,
      hli_request_id: hli.requestId,
      hli_patient_reference: hli.hliPatientReference,
      hli_intake_id: hli.hliIntakeId ?? null,
      hli_episode_id: hli.episodeId,
      capture_protocol_version: hli.captureProtocolVersion,
      capture_url: hli.captureUrl ?? null,
      status: "accepted",
      hli_response: hli,
      entitlement_context: opts.entitlementContext,
    })
    .select("id")
    .single();

  if (reqError || !requestRow) {
    throw new HliTrichoscopyConflictError(reqError?.message ?? "request insert failed");
  }

  await recordTrichoscopyUsage({
    tenantId,
    capability: "trichoscopy.request",
    usageType: "trichoscopy_request_created",
    sourceReference: hli.episodeId,
    idempotencyKey: `usage:${idempotencyKey}`,
    supabaseClientForTests: opts.supabaseClientForTests,
  });

  emitTrichoscopyTelemetry("request_created", {
    tenant_id: tenantId,
    episode_id: hli.episodeId,
    stub: config.useStub,
  });

  return {
    requestRowId: String((requestRow as { id: string }).id),
    linkId,
    hli,
  };
}
