import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildExternalEventProcessedActivityMetadata,
  buildPredictedProcedureChangedActivityMetadata,
  buildPriorityBandChangedActivityMetadata,
  type FiLeadActivityType,
} from "@/src/lib/leadFlow/leadFlowFoundationCore";
import { mergeLeadFlowEventMeta, readLeadFlowEventMeta } from "@/src/lib/leadFlow/leadFlowEventMeta";
import type { FiExternalEventRow, FiLeadRow } from "@/src/lib/leadFlow/leadFlowFoundationTypes";
import {
  buildLeadUpsertPlan,
  buildStageChangedActivityMetadataFromPlan,
  inferHubSpotLeadFlowWebhookKind,
  leadRowFromNormalizedInput,
  leadUpdateRowFromPatch,
  normalizeHubSpotContactToLead,
  normalizeHubSpotDealToLeadPatch,
  type HubSpotLeadFieldPatch,
  type NormalizedHubSpotLeadInput,
} from "@/src/lib/leadFlow/hubspotLeadFlowCore";
import {
  buildLeadScoringActivityPlan,
  leadScoringInputFromLeadRow,
  leadScoringRowFromResult,
  mergeLeadRowForScoring,
  scoreLead,
} from "@/src/lib/leadFlow/leadScoringEngine";

const HUBSPOT_PROVIDER = "hubspot";
export const LEADFLOW_HUBSPOT_PROCESS_DEFAULT_BATCH = 50;
export const LEADFLOW_HUBSPOT_PROCESS_MAX_BATCH = 100;
/** Reclaim processing rows stuck longer than this back to pending. */
export const LEADFLOW_HUBSPOT_STALE_PROCESSING_MS = 15 * 60 * 1000;

export type HubSpotExternalEventProcessResult = {
  eventId: string;
  tenantId: string;
  ok: boolean;
  message?: string;
};

async function appendLeadActivity(
  supabase: SupabaseClient,
  input: {
    leadId: string;
    activityType: FiLeadActivityType | string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await supabase.from("fi_lead_activity").insert({
    lead_id: input.leadId.trim(),
    activity_type: input.activityType,
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
  });
  if (error) console.error("[appendLeadActivity]", error.message);
}

async function appendLeadScoringActivities(
  supabase: SupabaseClient,
  leadId: string,
  previous: {
    priority_band?: string | null;
    predicted_procedure?: string | null;
  } | null,
  scoring: ReturnType<typeof scoreLead>,
  source: string
): Promise<void> {
  const plan = buildLeadScoringActivityPlan(previous, scoring);
  if (plan.priorityBandChanged && plan.previousPriorityBand) {
    await appendLeadActivity(supabase, {
      leadId,
      activityType: "priority_band_changed",
      metadata: buildPriorityBandChangedActivityMetadata({
        fromBand: plan.previousPriorityBand,
        toBand: plan.nextPriorityBand,
        leadScore: scoring.lead_score,
        source,
      }),
    });
  }
  if (plan.predictedProcedureChanged && plan.previousPredictedProcedure) {
    await appendLeadActivity(supabase, {
      leadId,
      activityType: "predicted_procedure_changed",
      metadata: buildPredictedProcedureChangedActivityMetadata({
        fromProcedure: plan.previousPredictedProcedure,
        toProcedure: plan.nextPredictedProcedure,
        source,
      }),
    });
  }
}

function scoringFieldsForNormalizedInput(input: NormalizedHubSpotLeadInput): Record<string, unknown> {
  const scoring = scoreLead(
    leadScoringInputFromLeadRow({
      procedure_interest: input.procedureInterest,
      lead_source: input.leadSource,
      country: input.country,
      budget_range: input.budgetRange,
      current_stage: input.currentStage,
      email: input.email,
      phone: input.phone,
      first_name: input.firstName,
      last_name: input.lastName,
    })
  );
  return leadScoringRowFromResult(scoring);
}

function scoringFieldsForLeadUpdate(
  existing: FiLeadRow,
  patch: HubSpotLeadFieldPatch
): { fields: Record<string, unknown>; scoring: ReturnType<typeof scoreLead> } {
  const scoringInput = mergeLeadRowForScoring(existing, patch);
  const scoring = scoreLead(scoringInput);
  return { fields: leadScoringRowFromResult(scoring), scoring };
}

function normalizeProcessBatchLimit(limit?: number): number {
  return Math.min(Math.max(limit ?? LEADFLOW_HUBSPOT_PROCESS_DEFAULT_BATCH, 1), LEADFLOW_HUBSPOT_PROCESS_MAX_BATCH);
}

export async function loadPendingExternalEvents(opts?: {
  tenantId?: string;
  limit?: number;
  supabase?: SupabaseClient;
}): Promise<FiExternalEventRow[]> {
  const supabase = opts?.supabase ?? supabaseAdmin();
  const limit = normalizeProcessBatchLimit(opts?.limit);

  let query = supabase
    .from("fi_external_events")
    .select("*")
    .eq("provider", HUBSPOT_PROVIDER)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (opts?.tenantId?.trim()) {
    query = query.eq("tenant_id", opts.tenantId.trim());
  }

  const { data, error } = await query;
  if (error) {
    console.error("[loadPendingExternalEvents]", error.message);
    return [];
  }
  return (data ?? []) as FiExternalEventRow[];
}

export async function listTenantIdsWithPendingHubSpotEvents(opts?: {
  supabase?: SupabaseClient;
}): Promise<string[]> {
  const supabase = opts?.supabase ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_external_events")
    .select("tenant_id")
    .eq("provider", HUBSPOT_PROVIDER)
    .eq("status", "pending");

  if (error) {
    console.error("[listTenantIdsWithPendingHubSpotEvents]", error.message);
    return [];
  }

  const ids = new Set<string>();
  for (const row of data ?? []) {
    const tid = String((row as { tenant_id?: string }).tenant_id ?? "").trim();
    if (tid) ids.add(tid);
  }
  return [...ids].sort();
}

export async function claimHubSpotExternalEventForProcessing(
  eventId: string,
  tenantId: string,
  supabase?: SupabaseClient
): Promise<FiExternalEventRow | null> {
  const client = supabase ?? supabaseAdmin();
  const nowIso = new Date().toISOString();

  const { data: pending, error: loadError } = await client
    .from("fi_external_events")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .eq("id", eventId.trim())
    .eq("provider", HUBSPOT_PROVIDER)
    .eq("status", "pending")
    .maybeSingle();

  if (loadError) {
    console.error("[claimHubSpotExternalEventForProcessing]", loadError.message);
    return null;
  }
  if (!pending) return null;

  const row = pending as FiExternalEventRow;
  const payload =
    row.payload_json && typeof row.payload_json === "object" && !Array.isArray(row.payload_json)
      ? row.payload_json
      : {};
  const nextPayload = mergeLeadFlowEventMeta(payload, { processing_started_at: nowIso });

  const { data: claimed, error: claimError } = await client
    .from("fi_external_events")
    .update({ status: "processing", payload_json: nextPayload })
    .eq("tenant_id", tenantId.trim())
    .eq("id", eventId.trim())
    .eq("provider", HUBSPOT_PROVIDER)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (claimError) {
    console.error("[claimHubSpotExternalEventForProcessing]", claimError.message);
    return null;
  }
  return (claimed as FiExternalEventRow | null) ?? null;
}

export async function reclaimStaleProcessingHubSpotExternalEvents(opts?: {
  tenantId?: string;
  staleAfterMs?: number;
  supabase?: SupabaseClient;
}): Promise<number> {
  const client = opts?.supabase ?? supabaseAdmin();
  const staleAfterMs = opts?.staleAfterMs ?? LEADFLOW_HUBSPOT_STALE_PROCESSING_MS;
  const cutoff = Date.now() - staleAfterMs;

  let query = client
    .from("fi_external_events")
    .select("*")
    .eq("provider", HUBSPOT_PROVIDER)
    .eq("status", "processing");

  if (opts?.tenantId?.trim()) {
    query = query.eq("tenant_id", opts.tenantId.trim());
  }

  const { data, error } = await query;
  if (error) {
    console.error("[reclaimStaleProcessingHubSpotExternalEvents]", error.message);
    return 0;
  }

  let reclaimed = 0;
  for (const raw of data ?? []) {
    const row = raw as FiExternalEventRow;
    const payload =
      row.payload_json && typeof row.payload_json === "object" && !Array.isArray(row.payload_json)
        ? row.payload_json
        : {};
    const startedAt = readLeadFlowEventMeta(payload).processing_started_at ?? row.created_at;
    const startedMs = Date.parse(startedAt);
    if (!Number.isFinite(startedMs) || startedMs > cutoff) continue;

    const { error: updateError } = await client
      .from("fi_external_events")
      .update({ status: "pending" })
      .eq("tenant_id", row.tenant_id)
      .eq("id", row.id)
      .eq("status", "processing");

    if (!updateError) reclaimed += 1;
  }
  return reclaimed;
}

export async function markExternalEventProcessed(
  tenantId: string,
  eventId: string,
  supabase?: SupabaseClient
): Promise<boolean> {
  const client = supabase ?? supabaseAdmin();
  const { error } = await client
    .from("fi_external_events")
    .update({ status: "processed", processed_at: new Date().toISOString() })
    .eq("tenant_id", tenantId.trim())
    .eq("id", eventId.trim());
  if (error) {
    console.error("[markExternalEventProcessed]", error.message);
    return false;
  }
  return true;
}

export async function markExternalEventFailed(
  tenantId: string,
  eventId: string,
  message?: string,
  supabase?: SupabaseClient
): Promise<boolean> {
  const client = supabase ?? supabaseAdmin();
  const nowIso = new Date().toISOString();

  const { data: existing, error: loadError } = await client
    .from("fi_external_events")
    .select("payload_json, status")
    .eq("tenant_id", tenantId.trim())
    .eq("id", eventId.trim())
    .maybeSingle();

  if (loadError) {
    console.error("[markExternalEventFailed]", loadError.message);
    return false;
  }

  const fromStatus = String((existing as { status?: string } | null)?.status ?? "pending");
  const payload =
    existing &&
    typeof (existing as { payload_json?: unknown }).payload_json === "object" &&
    !Array.isArray((existing as { payload_json?: unknown }).payload_json)
      ? ((existing as { payload_json: Record<string, unknown> }).payload_json ?? {})
      : {};

  const nextPayload = mergeLeadFlowEventMeta(payload, {
    processing_error: message?.trim() || "Processing failed.",
    failed_at: nowIso,
    failed_from_status: fromStatus,
  });

  const { error } = await client
    .from("fi_external_events")
    .update({ status: "failed", processed_at: nowIso, payload_json: nextPayload })
    .eq("tenant_id", tenantId.trim())
    .eq("id", eventId.trim())
    .in("status", ["pending", "processing"]);
  if (error) {
    console.error("[markExternalEventFailed]", error.message);
    return false;
  }
  return true;
}

async function findExistingLead(
  supabase: SupabaseClient,
  tenantId: string,
  input: Pick<NormalizedHubSpotLeadInput, "hubspotContactId" | "email" | "phone">
): Promise<FiLeadRow | null> {
  if (input.hubspotContactId?.trim()) {
    const { data } = await supabase
      .from("fi_leads")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("hubspot_contact_id", input.hubspotContactId.trim())
      .maybeSingle();
    if (data) return data as FiLeadRow;
  }

  if (input.email?.trim()) {
    const { data } = await supabase
      .from("fi_leads")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("email", input.email.trim())
      .maybeSingle();
    if (data) return data as FiLeadRow;
  }

  if (input.phone?.trim()) {
    const { data } = await supabase
      .from("fi_leads")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("phone", input.phone.trim())
      .maybeSingle();
    if (data) return data as FiLeadRow;
  }

  return null;
}

export async function upsertLeadFromHubSpotContact(
  tenantId: string,
  input: NormalizedHubSpotLeadInput,
  opts?: { externalEventId?: string; supabase?: SupabaseClient }
): Promise<{ ok: true; lead: FiLeadRow; created: boolean } | { ok: false; message: string }> {
  const supabase = opts?.supabase ?? supabaseAdmin();
  const existing = await findExistingLead(supabase, tenantId, input);
  const plan = buildLeadUpsertPlan(existing, input);

  if (!existing) {
    const { data, error } = await supabase
      .from("fi_leads")
      .insert({
        ...leadRowFromNormalizedInput(tenantId, input),
        ...scoringFieldsForNormalizedInput(input),
      })
      .select("*")
      .single();
    if (error) {
      return { ok: false, message: error.message };
    }
    const lead = data as FiLeadRow;
    await appendLeadActivity(supabase, {
      leadId: lead.id,
      activityType: "lead_created",
      metadata: {
        source: "hubspot",
        hubspot_contact_id: input.hubspotContactId,
        ...(opts?.externalEventId ? { external_event_id: opts.externalEventId } : {}),
      },
    });
    if (opts?.externalEventId) {
      await appendLeadActivity(supabase, {
        leadId: lead.id,
        activityType: "external_event_processed",
        metadata: buildExternalEventProcessedActivityMetadata({
          externalEventId: opts.externalEventId,
          provider: HUBSPOT_PROVIDER,
          eventType: "hubspot.contact",
          externalId: input.hubspotContactId,
        }),
      });
    }
    return { ok: true, lead, created: true };
  }

  if (!plan.meaningfulChange) {
    return { ok: true, lead: existing, created: false };
  }

  const { fields: scoringFields, scoring } = scoringFieldsForLeadUpdate(existing, plan.patch);
  const previousScoringState = {
    priority_band: existing.priority_band,
    predicted_procedure: existing.predicted_procedure,
  };
  const updateRow = { ...leadUpdateRowFromPatch(plan.patch), ...scoringFields };
  const { data, error } = await supabase
    .from("fi_leads")
    .update(updateRow)
    .eq("tenant_id", tenantId)
    .eq("id", existing.id)
    .select("*")
    .single();
  if (error) {
    return { ok: false, message: error.message };
  }
  const lead = data as FiLeadRow;

  await appendLeadScoringActivities(supabase, lead.id, previousScoringState, scoring, "hubspot");

  if (plan.stageChanged) {
    await appendLeadActivity(supabase, {
      leadId: lead.id,
      activityType: "stage_changed",
      metadata: buildStageChangedActivityMetadataFromPlan(plan),
    });
  } else {
    await appendLeadActivity(supabase, {
      leadId: lead.id,
      activityType: "lead_updated",
      metadata: {
        source: "hubspot",
        changed_fields: Object.keys(plan.patch),
        ...(opts?.externalEventId ? { external_event_id: opts.externalEventId } : {}),
      },
    });
  }

  if (opts?.externalEventId) {
    await appendLeadActivity(supabase, {
      leadId: lead.id,
      activityType: "external_event_processed",
      metadata: buildExternalEventProcessedActivityMetadata({
        externalEventId: opts.externalEventId,
        provider: HUBSPOT_PROVIDER,
        eventType: "hubspot.contact",
        externalId: input.hubspotContactId,
      }),
    });
  }

  return { ok: true, lead, created: false };
}

export async function processHubSpotContactEvent(
  event: FiExternalEventRow,
  supabase?: SupabaseClient
): Promise<{ ok: true } | { ok: false; message: string }> {
  const client = supabase ?? supabaseAdmin();
  const payload = event.payload_json;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, message: "Invalid payload_json." };
  }

  const kind = inferHubSpotLeadFlowWebhookKind(payload);
  if (kind === "deal") {
    const dealPatch = normalizeHubSpotDealToLeadPatch(payload);
    if (!dealPatch?.hubspotContactId) {
      return { ok: false, message: "Deal event missing associated HubSpot contact id." };
    }
    const normalized: NormalizedHubSpotLeadInput = {
      hubspotContactId: dealPatch.hubspotContactId,
      firstName: null,
      lastName: null,
      email: dealPatch.email ?? null,
      phone: dealPatch.phone ?? null,
      leadSource: dealPatch.leadSource ?? null,
      procedureInterest: dealPatch.procedureInterest ?? null,
      country: dealPatch.country ?? null,
      budgetRange: dealPatch.budgetRange ?? null,
      currentStage: dealPatch.currentStage ?? "new",
    };
    const upsert = await upsertLeadFromHubSpotContact(event.tenant_id, normalized, {
      externalEventId: event.id,
      supabase: client,
    });
    if (!upsert.ok) return upsert;
    await markExternalEventProcessed(event.tenant_id, event.id, client);
    return { ok: true };
  }

  const normalized = normalizeHubSpotContactToLead(payload);
  if (!normalized) {
    return { ok: false, message: "Unable to normalize HubSpot contact payload." };
  }

  const upsert = await upsertLeadFromHubSpotContact(event.tenant_id, normalized, {
    externalEventId: event.id,
    supabase: client,
  });
  if (!upsert.ok) return upsert;

  await markExternalEventProcessed(event.tenant_id, event.id, client);
  return { ok: true };
}

export async function processPendingHubSpotExternalEvents(opts: {
  tenantId: string;
  limit?: number;
  supabase?: SupabaseClient;
}): Promise<HubSpotExternalEventProcessResult[]> {
  const supabase = opts.supabase ?? supabaseAdmin();
  const tenantId = opts.tenantId.trim();
  const limit = normalizeProcessBatchLimit(opts.limit);
  const pending = await loadPendingExternalEvents({ tenantId, limit, supabase });
  const results: HubSpotExternalEventProcessResult[] = [];

  for (const event of pending) {
    const claimed = await claimHubSpotExternalEventForProcessing(event.id, tenantId, supabase);
    if (!claimed) continue;

    const result = await processHubSpotContactEvent(claimed, supabase);
    if (!result.ok) {
      await markExternalEventFailed(tenantId, claimed.id, result.message, supabase);
      results.push({ eventId: claimed.id, tenantId, ok: false, message: result.message });
      continue;
    }
    results.push({ eventId: claimed.id, tenantId, ok: true });
  }

  return results;
}

export async function processAllTenantsPendingHubSpotExternalEvents(opts?: {
  limit?: number;
  supabase?: SupabaseClient;
}): Promise<{ tenantsTouched: number; results: HubSpotExternalEventProcessResult[] }> {
  const supabase = opts?.supabase ?? supabaseAdmin();
  const totalLimit = normalizeProcessBatchLimit(opts?.limit);
  const tenantIds = await listTenantIdsWithPendingHubSpotEvents({ supabase });
  if (tenantIds.length === 0) {
    return { tenantsTouched: 0, results: [] };
  }

  const perTenantLimit = Math.max(1, Math.floor(totalLimit / tenantIds.length));
  const results: HubSpotExternalEventProcessResult[] = [];
  let tenantsTouched = 0;

  for (const tenantId of tenantIds) {
    const batch = await processPendingHubSpotExternalEvents({
      tenantId,
      limit: perTenantLimit,
      supabase,
    });
    if (batch.length > 0) tenantsTouched += 1;
    results.push(...batch);
    if (results.length >= totalLimit) break;
  }

  return { tenantsTouched, results: results.slice(0, totalLimit) };
}
