import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isHliTrichoscopyPlatformEnabled } from "@/src/lib/platform/entitlements/resolveFiosTrichoscopyAccess.server";
import { importConfirmedEvidencePack } from "./evidencePacks";
import {
  HDR_REQUEST_ID,
  HDR_SIGNATURE,
  HDR_SIG_VERSION,
  HDR_TENANT,
  HDR_TIMESTAMP,
  HLI_TRICHOSCOPY_SIGNATURE_VERSION,
  verifyHliTrichoscopySignature,
  verifyHliTrichoscopyTimestamp,
} from "./eventVerifier";
import { loadHliTrichoscopyConfig } from "./config";
import { mapEventTypeToFiosStatus } from "./mappers";
import { emitTrichoscopyTelemetry } from "./telemetry";
import type { FiosTrichoscopyStatus, HliTrichoscopyEventEnvelope } from "./types";
import { SUPPORTED_HLI_TRICHOSCOPY_EVENTS } from "./types";

const REPLAY_NONCES = new Map<string, number>();
const REPLAY_TTL_MS = 10 * 60 * 1000;

function pruneNonces(now = Date.now()): void {
  for (const [k, exp] of REPLAY_NONCES) {
    if (exp < now) REPLAY_NONCES.delete(k);
  }
}

function reserveNonce(key: string): boolean {
  pruneNonces();
  if (REPLAY_NONCES.has(key)) return false;
  REPLAY_NONCES.set(key, Date.now() + REPLAY_TTL_MS);
  return true;
}

export type ProcessTrichoscopyEventResult =
  | { ok: true; duplicate?: boolean; ignored?: boolean; receiptId: string }
  | { ok: false; httpStatus: number; reason: string; message: string };

function parseEnvelope(body: unknown): HliTrichoscopyEventEnvelope | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const eventId = String(b.eventId ?? b.event_id ?? "").trim();
  const eventType = String(b.eventType ?? b.event_type ?? "").trim();
  const eventVersion = String(b.eventVersion ?? b.event_version ?? "").trim();
  const occurredAt = String(b.occurredAt ?? b.occurred_at ?? "").trim();
  const tenantReference = String(b.tenantReference ?? b.tenant_reference ?? "").trim();
  const patientReference = String(b.patientReference ?? b.patient_reference ?? "").trim();
  const idempotencyKey = String(b.idempotencyKey ?? b.idempotency_key ?? "").trim();
  if (!eventId || !eventType || !eventVersion || !occurredAt || !tenantReference || !patientReference || !idempotencyKey) {
    return null;
  }
  return {
    eventId,
    eventType,
    eventVersion,
    occurredAt,
    tenantReference,
    patientReference,
    episodeId: b.episodeId ? String(b.episodeId) : b.episode_id ? String(b.episode_id) : undefined,
    sessionId: b.sessionId ? String(b.sessionId) : b.session_id ? String(b.session_id) : undefined,
    assessmentId: b.assessmentId ? String(b.assessmentId) : b.assessment_id ? String(b.assessment_id) : undefined,
    evidencePackId: b.evidencePackId
      ? String(b.evidencePackId)
      : b.evidence_pack_id
        ? String(b.evidence_pack_id)
        : undefined,
    status: b.status ? String(b.status) : undefined,
    limitationCodes: Array.isArray(b.limitationCodes)
      ? (b.limitationCodes as string[])
      : undefined,
    idempotencyKey,
    safetyAssertions: (b.safetyAssertions as HliTrichoscopyEventEnvelope["safetyAssertions"]) ?? undefined,
  };
}

async function upsertCaseAction(opts: {
  supabase: SupabaseClient;
  tenantId: string;
  linkId: string;
  patientId: string;
  actionType: string;
  title: string;
  description?: string;
  assigneeRole?: string;
  idempotencyKey: string;
}): Promise<void> {
  await opts.supabase.from("fi_hli_trichoscopy_case_actions").upsert(
    {
      tenant_id: opts.tenantId,
      link_id: opts.linkId,
      fios_patient_id: opts.patientId,
      action_type: opts.actionType,
      status: "open",
      title: opts.title,
      description: opts.description ?? null,
      assignee_role: opts.assigneeRole ?? null,
      idempotency_key: opts.idempotencyKey,
    },
    { onConflict: "tenant_id,idempotency_key", ignoreDuplicates: true }
  );
}

async function closeActionsOfTypes(opts: {
  supabase: SupabaseClient;
  tenantId: string;
  linkId: string;
  actionTypes: string[];
  reason: string;
}): Promise<void> {
  await opts.supabase
    .from("fi_hli_trichoscopy_case_actions")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      closed_reason: opts.reason,
    })
    .eq("tenant_id", opts.tenantId)
    .eq("link_id", opts.linkId)
    .eq("status", "open")
    .in("action_type", opts.actionTypes);
}

async function appendTimeline(opts: {
  supabase: SupabaseClient;
  tenantId: string;
  patientId: string;
  eventType: string;
  title: string;
  description?: string;
  dedupeKey: string;
}): Promise<void> {
  await opts.supabase.from("fi_patient_timeline").insert({
    tenant_id: opts.tenantId,
    patient_id: opts.patientId,
    source: "hli_trichoscopy",
    event_type: opts.eventType,
    event_timestamp: new Date().toISOString(),
    title: opts.title,
    description: opts.description ?? null,
    metadata: { dedupe_key: opts.dedupeKey },
  });
}

/**
 * Authenticate and process an inbound HLI trichoscopy event.
 * Signature verification happens before any service-role clinical mutation beyond receipt insert
 * after auth — callers must verify headers first via this function which validates before DB writes
 * that require tenant mapping. Platform flag is checked first.
 *
 * Inbound lifecycle events are processed even when entitlement is inactive (clinical consistency).
 */
export async function processHliTrichoscopyEvent(opts: {
  headers: Headers | Record<string, string | null | undefined>;
  rawBody: string;
  parsedBody?: unknown;
  supabaseClientForTests?: SupabaseClient;
  env?: NodeJS.ProcessEnv;
}): Promise<ProcessTrichoscopyEventResult> {
  const env = opts.env ?? process.env;
  if (!isHliTrichoscopyPlatformEnabled(env)) {
    return {
      ok: false,
      httpStatus: 503,
      reason: "platform_disabled",
      message: "Trichoscopy integration is disabled.",
    };
  }

  const config = loadHliTrichoscopyConfig(env);
  const getHeader = (name: string): string => {
    if (opts.headers instanceof Headers) return opts.headers.get(name)?.trim() ?? "";
    const key = Object.keys(opts.headers).find((k) => k.toLowerCase() === name.toLowerCase());
    return String(key ? opts.headers[key] : "").trim();
  };

  const tenantHeader = getHeader(HDR_TENANT);
  const requestId = getHeader(HDR_REQUEST_ID);
  const timestamp = getHeader(HDR_TIMESTAMP);
  const sigVersion = getHeader(HDR_SIG_VERSION);
  const signature = getHeader(HDR_SIGNATURE);

  if (!tenantHeader || !requestId || !timestamp || !signature) {
    return {
      ok: false,
      httpStatus: 401,
      reason: "missing_headers",
      message: "Missing signing headers.",
    };
  }
  if (sigVersion && sigVersion !== HLI_TRICHOSCOPY_SIGNATURE_VERSION) {
    return {
      ok: false,
      httpStatus: 401,
      reason: "bad_signature_version",
      message: "Unsupported signature version.",
    };
  }
  if (!verifyHliTrichoscopyTimestamp(timestamp)) {
    return {
      ok: false,
      httpStatus: 401,
      reason: "timestamp_skew",
      message: "Request timestamp outside allowed skew.",
    };
  }

  const secret = config.webhookSecret ?? config.signingSecret;
  if (!secret && !config.useStub) {
    return {
      ok: false,
      httpStatus: 503,
      reason: "misconfigured",
      message: "Webhook secret not configured.",
    };
  }

  if (secret) {
    const valid = verifyHliTrichoscopySignature({
      secret,
      timestamp,
      requestId,
      tenantId: tenantHeader,
      body: opts.rawBody,
      signature,
    });
    if (!valid) {
      emitTrichoscopyTelemetry("event_signature_failed", { tenant_id: tenantHeader });
      return {
        ok: false,
        httpStatus: 401,
        reason: "signature_invalid",
        message: "Invalid signature.",
      };
    }
  }

  const replayKey = `${tenantHeader}:${requestId}:${timestamp}`;
  if (!reserveNonce(replayKey)) {
    return {
      ok: false,
      httpStatus: 409,
      reason: "replay",
      message: "Replay detected.",
    };
  }

  let parsed = opts.parsedBody;
  if (parsed === undefined) {
    try {
      parsed = JSON.parse(opts.rawBody);
    } catch {
      return { ok: false, httpStatus: 400, reason: "invalid_json", message: "Invalid JSON body." };
    }
  }

  const envelope = parseEnvelope(parsed);
  if (!envelope) {
    return {
      ok: false,
      httpStatus: 400,
      reason: "invalid_envelope",
      message: "Event envelope missing required fields.",
    };
  }

  if (envelope.tenantReference !== tenantHeader) {
    return {
      ok: false,
      httpStatus: 403,
      reason: "tenant_mismatch",
      message: "Tenant header does not match event tenant reference.",
    };
  }

  // Auth complete — service-role client may be created
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();

  const { data: existingReceipt } = await supabase
    .from("fi_hli_trichoscopy_event_receipts")
    .select("id")
    .eq("tenant_id", tenantHeader)
    .eq("event_id", envelope.eventId)
    .maybeSingle();

  if (existingReceipt) {
    return {
      ok: true,
      duplicate: true,
      receiptId: String((existingReceipt as { id: string }).id),
    };
  }

  const supported = (SUPPORTED_HLI_TRICHOSCOPY_EVENTS as readonly string[]).includes(envelope.eventType);
  const { data: receipt, error: receiptError } = await supabase
    .from("fi_hli_trichoscopy_event_receipts")
    .insert({
      tenant_id: tenantHeader,
      event_id: envelope.eventId,
      event_type: envelope.eventType,
      event_version: envelope.eventVersion,
      occurred_at: envelope.occurredAt,
      idempotency_key: envelope.idempotencyKey,
      hli_episode_id: envelope.episodeId ?? null,
      hli_session_id: envelope.sessionId ?? null,
      hli_assessment_id: envelope.assessmentId ?? null,
      hli_evidence_pack_id: envelope.evidencePackId ?? null,
      payload: envelope,
      processing_status: supported ? "accepted" : "ignored",
    })
    .select("id")
    .single();

  if (receiptError) {
    if (receiptError.code === "23505") {
      return { ok: true, duplicate: true, receiptId: "duplicate" };
    }
    return {
      ok: false,
      httpStatus: 500,
      reason: "receipt_persist_failed",
      message: receiptError.message,
    };
  }

  const receiptId = String((receipt as { id: string }).id);

  if (!supported) {
    emitTrichoscopyTelemetry("event_ignored_unknown_type", {
      tenant_id: tenantHeader,
      event_type: envelope.eventType,
    });
    return { ok: true, ignored: true, receiptId };
  }

  let linkQuery = supabase
    .from("fi_hli_trichoscopy_links")
    .select("id, fios_patient_id, status")
    .eq("tenant_id", tenantHeader);

  if (envelope.episodeId) {
    linkQuery = linkQuery.eq("hli_episode_id", envelope.episodeId);
  } else {
    linkQuery = linkQuery.eq("hli_patient_reference", envelope.patientReference);
  }

  const { data: link } = await linkQuery.order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (!link) {
    await supabase
      .from("fi_hli_trichoscopy_event_receipts")
      .update({ processing_status: "processed", processed_at: new Date().toISOString() })
      .eq("id", receiptId);
    return { ok: true, receiptId };
  }

  const linkId = String((link as { id: string }).id);
  const patientId = String((link as { fios_patient_id: string }).fios_patient_id);
  const previousStatus = String((link as { status: string }).status);
  const mapped =
    mapEventTypeToFiosStatus(envelope.eventType) ??
    (envelope.status as FiosTrichoscopyStatus | undefined) ??
    null;

  if (mapped) {
    await supabase
      .from("fi_hli_trichoscopy_links")
      .update({
        status: mapped,
        latest_session_id: envelope.sessionId ?? undefined,
        latest_assessment_id: envelope.assessmentId ?? undefined,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", linkId)
      .eq("tenant_id", tenantHeader);

    await supabase.from("fi_hli_trichoscopy_status_history").insert({
      tenant_id: tenantHeader,
      link_id: linkId,
      previous_status: previousStatus,
      new_status: mapped,
      source: "hli_event",
      event_receipt_id: receiptId,
      metadata: { event_type: envelope.eventType },
    });
  }

  await supabase
    .from("fi_hli_trichoscopy_event_receipts")
    .update({ link_id: linkId, processing_status: "processed", processed_at: new Date().toISOString() })
    .eq("id", receiptId);

  const timelineType = envelope.eventType.replace(/\./g, "_");
  await appendTimeline({
    supabase,
    tenantId: tenantHeader,
    patientId,
    eventType: timelineType,
    title: `Trichoscopy: ${envelope.eventType}`,
    dedupeKey: envelope.eventId,
  });

  if (envelope.eventType === "trichoscopy.session_created" || envelope.eventType === "trichoscopy.session_captured") {
    await upsertCaseAction({
      supabase,
      tenantId: tenantHeader,
      linkId,
      patientId,
      actionType: "complete_trichoscopy_capture",
      title: "Complete trichoscopy capture",
      idempotencyKey: `capture:${linkId}`,
    });
  }

  if (envelope.eventType === "trichoscopy.analysis_ready") {
    await closeActionsOfTypes({
      supabase,
      tenantId: tenantHeader,
      linkId,
      actionTypes: ["complete_trichoscopy_capture"],
      reason: "analysis_ready",
    });
    await upsertCaseAction({
      supabase,
      tenantId: tenantHeader,
      linkId,
      patientId,
      actionType: "review_trichoscopy_evidence",
      title: "Review trichoscopy evidence",
      assigneeRole: "doctor",
      idempotencyKey: `review:${linkId}:${envelope.assessmentId ?? envelope.eventId}`,
    });
  }

  if (
    envelope.eventType === "trichoscopy.observation_confirmed" ||
    envelope.eventType === "trichoscopy.metric_confirmed" ||
    envelope.eventType === "trichoscopy.surgical_evidence_ready"
  ) {
    await closeActionsOfTypes({
      supabase,
      tenantId: tenantHeader,
      linkId,
      actionTypes: ["review_trichoscopy_evidence"],
      reason: "evidence_confirmed",
    });
    if (envelope.evidencePackId) {
      await importConfirmedEvidencePack({
        tenantId: tenantHeader,
        linkId,
        evidencePackId: envelope.evidencePackId,
        allowWithoutEntitlement: true,
        supabaseClientForTests: opts.supabaseClientForTests,
        env,
      });
    }
  }

  if (envelope.eventType === "trichoscopy.repeat_capture_requested") {
    await closeActionsOfTypes({
      supabase,
      tenantId: tenantHeader,
      linkId,
      actionTypes: ["review_trichoscopy_evidence"],
      reason: "repeat_capture_requested",
    });
    await upsertCaseAction({
      supabase,
      tenantId: tenantHeader,
      linkId,
      patientId,
      actionType: "repeat_trichoscopy_capture",
      title: "Repeat trichoscopy capture",
      idempotencyKey: `repeat:${linkId}:${envelope.eventId}`,
    });
  }

  if (envelope.eventType === "trichoscopy.medical_review_requested") {
    await upsertCaseAction({
      supabase,
      tenantId: tenantHeader,
      linkId,
      patientId,
      actionType: "review_trichoscopy_medical_flag",
      title: "Medical review required for trichoscopy",
      assigneeRole: "doctor",
      idempotencyKey: `medreview:${linkId}:${envelope.eventId}`,
    });
  }

  emitTrichoscopyTelemetry("event_processed", {
    tenant_id: tenantHeader,
    event_type: envelope.eventType,
    receipt_id: receiptId,
  });

  return { ok: true, receiptId };
}
