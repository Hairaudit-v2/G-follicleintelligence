import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { appendPatientTimelineEvent } from "./appendPatientTimelineEvent.server";
import { HUBSPOT_TIMELINE_SOURCE } from "./hubspotTimelineWebhookAudit.server";
import {
  resolveHubspotContactIdentity,
  type HubspotIdentityInput,
  type HubspotMatchStrategy,
} from "./resolveHubspotContactIdentity.server";
import { buildHubspotDealTimelineTitle, parseHubspotDealAmount } from "./hubspotDealStageMap";
import type {
  HubspotContactWebhookPayload,
  HubspotDealWebhookPayload,
  HubspotEmailEventWebhookPayload,
} from "./hubspotTimelineSchemas";
import { upsertRevenuePipelineFromHubspotDeal } from "./upsertRevenuePipelineFromHubspotDeal.server";

export type HubspotTimelineOutcome = {
  /** Whether the HubSpot identity resolved to an FI person/patient/lead. */
  matched: boolean;
  /** Whether a new timeline row was appended (false = duplicate/no-op). */
  inserted: boolean;
  timeline_id: string | null;
  patient_id: string | null;
  person_id: string | null;
  crm_lead_id: string | null;
  matched_by: HubspotMatchStrategy | null;
};

export type HubspotDealTimelineOutcome = HubspotTimelineOutcome & {
  revenue_pipeline_id: string | null;
  revenue_pipeline_created: boolean;
  mapped_stage: string | null;
};

export type HubspotTimelineProcessResult =
  | { ok: true; value: HubspotTimelineOutcome | HubspotDealTimelineOutcome }
  | { ok: false; status: number; message: string };

function toIsoTimestamp(raw: string | undefined | null): string {
  const v = raw?.trim();
  if (v) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

function hasAnyIdentity(input: HubspotIdentityInput): boolean {
  return Boolean(
    input.hubspotContactId?.trim() ||
    input.email?.trim() ||
    input.hubspotDealId?.trim() ||
    input.crmLeadId?.trim()
  );
}

async function runTimelineSync(
  supabase: SupabaseClient,
  tenantId: string,
  identityInput: HubspotIdentityInput,
  event: {
    eventType: string;
    eventTimestamp: string;
    title: string | null;
    description: string | null;
    dedupeKey: string;
    metadata: Record<string, unknown>;
  }
): Promise<HubspotTimelineProcessResult> {
  if (!hasAnyIdentity(identityInput)) {
    return {
      ok: false,
      status: 422,
      message:
        "No HubSpot identity provided (hubspot_contact_id, email, hubspot_deal_id, or crm_lead_id required).",
    };
  }

  const identity = await resolveHubspotContactIdentity(supabase, tenantId, identityInput);
  if (!identity) {
    // Known-shape payload but the contact isn't in FI yet — safe no-op (recorded in the audit log).
    return {
      ok: true,
      value: {
        matched: false,
        inserted: false,
        timeline_id: null,
        patient_id: null,
        person_id: null,
        crm_lead_id: null,
        matched_by: null,
      },
    };
  }

  const appended = await appendPatientTimelineEvent(supabase, {
    tenantId,
    patientId: identity.patient_id,
    personId: identity.person_id,
    crmLeadId: identity.crm_lead_id,
    source: HUBSPOT_TIMELINE_SOURCE,
    eventType: event.eventType,
    eventTimestamp: event.eventTimestamp,
    title: event.title,
    description: event.description,
    dedupeKey: event.dedupeKey,
    metadata: event.metadata,
  });

  return {
    ok: true,
    value: {
      matched: true,
      inserted: appended.inserted,
      timeline_id: appended.id,
      patient_id: identity.patient_id,
      person_id: identity.person_id,
      crm_lead_id: identity.crm_lead_id,
      matched_by: identity.matchedBy,
    },
  };
}

function identityFromPayload(p: {
  hubspot_contact_id?: string;
  contact_id?: string;
  email?: string;
  hubspot_deal_id?: string;
  crm_lead_id?: string;
}): HubspotIdentityInput {
  return {
    hubspotContactId: p.hubspot_contact_id ?? p.contact_id ?? null,
    email: p.email ?? null,
    hubspotDealId: p.hubspot_deal_id ?? null,
    crmLeadId: p.crm_lead_id ?? null,
  };
}

export async function processHubspotContactWebhook(
  tenantId: string,
  payload: HubspotContactWebhookPayload,
  client?: SupabaseClient
): Promise<HubspotTimelineProcessResult> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const eventType = payload.event_type?.trim() || "contact_activity";
  const eventTimestamp = toIsoTimestamp(payload.occurred_at);
  const anchor =
    payload.hubspot_contact_id?.trim() ||
    payload.email?.trim() ||
    payload.crm_lead_id?.trim() ||
    "unknown";

  return runTimelineSync(supabase, tid, identityFromPayload(payload), {
    eventType,
    eventTimestamp,
    title: payload.title?.trim() || `HubSpot contact ${eventType}`,
    description: payload.description?.trim() || null,
    dedupeKey: `contact:${anchor}:${eventType}:${eventTimestamp}`,
    metadata: { hubspot: payload },
  });
}

export async function processHubspotEmailEventWebhook(
  tenantId: string,
  payload: HubspotEmailEventWebhookPayload,
  client?: SupabaseClient
): Promise<HubspotTimelineProcessResult> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const eventType = payload.event_type?.trim() || "email_event";
  const eventTimestamp = toIsoTimestamp(payload.occurred_at);

  return runTimelineSync(supabase, tid, identityFromPayload(payload), {
    eventType,
    eventTimestamp,
    title: payload.title?.trim() || payload.subject?.trim() || `Email ${eventType}`,
    description: payload.description?.trim() || null,
    dedupeKey: `email_event:${payload.email_event_id.trim()}`,
    metadata: { hubspot: payload },
  });
}

export async function processHubspotDealWebhook(
  tenantId: string,
  payload: HubspotDealWebhookPayload,
  client?: SupabaseClient
): Promise<HubspotTimelineProcessResult> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const eventType = payload.event_type?.trim() || "deal_activity";
  const eventTimestamp = toIsoTimestamp(payload.occurred_at);
  const dealId = payload.hubspot_deal_id.trim();
  const stageRaw = payload.stage?.trim() || payload.deal_stage?.trim() || null;
  const expectedRevenue = parseHubspotDealAmount(payload.amount);

  if (!hasAnyIdentity(identityFromPayload(payload))) {
    return {
      ok: false,
      status: 422,
      message:
        "No HubSpot identity provided (hubspot_contact_id, email, hubspot_deal_id, or crm_lead_id required).",
    };
  }

  const identity = await resolveHubspotContactIdentity(supabase, tid, identityFromPayload(payload));

  const revenue = await upsertRevenuePipelineFromHubspotDeal(supabase, {
    tenantId: tid,
    hubspotDealId: dealId,
    patientId: identity?.patient_id ?? null,
    crmLeadId: identity?.crm_lead_id ?? null,
    stageRaw,
    amountRaw: payload.amount,
    depositAmountRaw: payload.deposit_amount,
    procedureType: payload.procedure_type,
    closeDateRaw: payload.close_date,
    hubspotPayload: payload as Record<string, unknown>,
  });

  const timelineTitle =
    payload.title?.trim() ||
    buildHubspotDealTimelineTitle(revenue.mapped_stage, expectedRevenue) ||
    payload.deal_name?.trim() ||
    `Deal ${eventType}`;

  if (!identity) {
    return {
      ok: true,
      value: {
        matched: false,
        inserted: false,
        timeline_id: null,
        patient_id: null,
        person_id: null,
        crm_lead_id: null,
        matched_by: null,
        revenue_pipeline_id: revenue.id,
        revenue_pipeline_created: revenue.created,
        mapped_stage: revenue.mapped_stage,
      },
    };
  }

  const appended = await appendPatientTimelineEvent(supabase, {
    tenantId: tid,
    patientId: identity.patient_id,
    personId: identity.person_id,
    crmLeadId: identity.crm_lead_id,
    source: HUBSPOT_TIMELINE_SOURCE,
    eventType,
    eventTimestamp,
    title: timelineTitle,
    description: payload.description?.trim() || null,
    dedupeKey: `deal:${dealId}:${eventType}:${stageRaw || ""}:${eventTimestamp}`,
    metadata: {
      hubspot: payload,
      revenue_pipeline_id: revenue.id,
      mapped_stage: revenue.mapped_stage,
    },
  });

  return {
    ok: true,
    value: {
      matched: true,
      inserted: appended.inserted,
      timeline_id: appended.id,
      patient_id: identity.patient_id,
      person_id: identity.person_id,
      crm_lead_id: identity.crm_lead_id,
      matched_by: identity.matchedBy,
      revenue_pipeline_id: revenue.id,
      revenue_pipeline_created: revenue.created,
      mapped_stage: revenue.mapped_stage,
    },
  };
}
