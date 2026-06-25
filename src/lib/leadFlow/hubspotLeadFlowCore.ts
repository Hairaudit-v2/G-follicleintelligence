/**
 * LeadFlowOS Phase LF-2 — pure HubSpot → fi_leads mapping (no DB I/O).
 */

import { sha256HexUtf8, stableStringifyForWebhookHash } from "@/src/lib/integrations/timely/timelyWebhookEvents.server";
import {
  buildLeadStageChangedActivityMetadata,
  normalizeLeadEmail,
  normalizeLeadPhoneDigits,
  type FiLeadCurrentStage,
} from "@/src/lib/leadFlow/leadFlowFoundationCore";

export type HubSpotLeadFlowWebhookKind = "contact" | "deal" | "unknown";

export type NormalizedHubSpotLeadInput = {
  hubspotContactId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  leadSource: string | null;
  procedureInterest: string | null;
  country: string | null;
  budgetRange: string | null;
  currentStage: FiLeadCurrentStage;
};

export type HubSpotLeadFieldPatch = Partial<
  Pick<
    NormalizedHubSpotLeadInput,
    | "hubspotContactId"
    | "firstName"
    | "lastName"
    | "email"
    | "phone"
    | "leadSource"
    | "procedureInterest"
    | "country"
    | "budgetRange"
    | "currentStage"
  >
>;

export type HubSpotLeadUpsertPlan = {
  patch: HubSpotLeadFieldPatch;
  stageChanged: boolean;
  meaningfulChange: boolean;
  previousStage: string | null;
  nextStage: FiLeadCurrentStage;
};

const HUBSPOT_STAGE_PATTERNS: ReadonlyArray<{ re: RegExp; stage: FiLeadCurrentStage }> = [
  { re: /appointment.*sched|consultation.*book|consult.*book/i, stage: "consultation_booked" },
  { re: /consult.*complete|post[-\s]?consult/i, stage: "consultation_completed" },
  { re: /quote.*sent|proposal|treatment.*plan/i, stage: "proposal_sent" },
  { re: /won|closed\s*won|customer|surgery\s*done|existing\s*patient/i, stage: "won" },
  { re: /lost|closed\s*lost|disqual/i, stage: "lost" },
  { re: /nurture|subscriber|other/i, stage: "nurture" },
  { re: /qualified|mql|sql|sales\s*qualified|opportunity/i, stage: "qualified" },
  { re: /contacted|attempt|in\s*progress/i, stage: "contacted" },
  { re: /\blead\b|new|subscriber/i, stage: "new" },
];

function extractProperty(props: Record<string, unknown> | undefined, ...keys: string[]): string | null {
  if (!props) return null;
  for (const key of keys) {
    const val = props[key];
    if (val != null && String(val).trim()) return String(val).trim();
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

export function mapHubSpotStageToLeadStage(
  lifecycleStage: string | null | undefined,
  dealStage?: string | null
): FiLeadCurrentStage {
  const candidates = [dealStage, lifecycleStage].filter(Boolean) as string[];
  for (const raw of candidates) {
    const normalized = raw.trim().toLowerCase().replace(/\s+/g, "_");
    for (const { re, stage } of HUBSPOT_STAGE_PATTERNS) {
      if (re.test(raw) || re.test(normalized)) return stage;
    }
    if (normalized === "consultation_booked") return "consultation_booked";
    if (normalized === "consultation_completed") return "consultation_completed";
    if (normalized === "proposal_sent") return "proposal_sent";
    if (normalized === "qualified") return "qualified";
    if (normalized === "contacted") return "contacted";
    if (normalized === "won") return "won";
    if (normalized === "lost") return "lost";
    if (normalized === "nurture") return "nurture";
    if (normalized === "new") return "new";
  }
  return "new";
}

export function inferHubSpotLeadFlowWebhookKind(payload: Record<string, unknown>): HubSpotLeadFlowWebhookKind {
  if (readString(payload.hubspot_deal_id) || readString(payload.dealId) || readString(payload.objectType) === "DEAL") {
    return "deal";
  }
  if (
    readString(payload.hubspot_contact_id) ||
    readString(payload.contact_id) ||
    readString(payload.objectId) ||
    readString(payload.hs_object_id) ||
    payload.properties
  ) {
    return "contact";
  }
  return "unknown";
}

export function resolveHubSpotContactObjectId(payload: Record<string, unknown>): string | null {
  const props = asRecord(payload.properties);
  return (
    readString(payload.hubspot_contact_id) ??
    readString(payload.contact_id) ??
    readString(payload.objectId) ??
    extractProperty(props, "hs_object_id") ??
    readString(payload.hs_object_id)
  );
}

export function resolveHubSpotDealObjectId(payload: Record<string, unknown>): string | null {
  return readString(payload.hubspot_deal_id) ?? readString(payload.dealId) ?? readString(payload.objectId);
}

export function computeHubSpotLeadFlowProviderEventId(
  tenantId: string,
  payload: Record<string, unknown>,
  eventType: string
): string {
  const explicit =
    readString(payload.eventId) ??
    readString(payload.event_id) ??
    readString(payload.email_event_id) ??
    readString(payload.hubspot_event_id);
  if (explicit) return `${tenantId.trim()}::hubspot::${explicit}`;

  const fingerprint = sha256HexUtf8(
    stableStringifyForWebhookHash({
      tenant_id: tenantId.trim(),
      provider: "hubspot",
      event_type: eventType,
      body: payload,
    })
  );
  return `${tenantId.trim()}::hubspot::fp::${fingerprint}`;
}

export function resolveHubSpotLeadFlowEventType(payload: Record<string, unknown>): string {
  const explicit =
    readString(payload.event_type) ??
    readString(payload.eventType) ??
    readString(payload.subscriptionType);
  if (explicit) return explicit;

  const kind = inferHubSpotLeadFlowWebhookKind(payload);
  if (kind === "deal") return "hubspot.deal.updated";
  if (kind === "contact") return "hubspot.contact.updated";
  return "hubspot.unknown";
}

export function flattenHubSpotLeadFlowWebhookBody(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) {
    return body.filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item));
  }
  if (!body || typeof body !== "object") return [];
  const record = body as Record<string, unknown>;
  if (Array.isArray(record.events)) {
    return record.events.filter(
      (item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item)
    );
  }
  return [record];
}

export function normalizeHubSpotContactToLead(payload: Record<string, unknown>): NormalizedHubSpotLeadInput | null {
  const props = asRecord(payload.properties) ?? {};
  const hubspotContactId = resolveHubSpotContactObjectId(payload);
  if (!hubspotContactId) return null;

  const lifecycleStage = extractProperty(props, "lifecyclestage");
  const dealStage =
    readString(payload.deal_stage) ??
    readString(payload.stage) ??
    extractProperty(props, "dealstage", "hs_pipeline_stage");

  const email = normalizeLeadEmail(extractProperty(props, "email") ?? readString(payload.email));
  const rawPhone =
    extractProperty(props, "phone", "mobilephone", "phone_number", "hs_whatsapp_phone_number") ??
    readString(payload.phone);
  const phone = normalizeLeadPhoneDigits(rawPhone) ?? rawPhone?.trim() ?? null;

  return {
    hubspotContactId,
    firstName: extractProperty(props, "firstname") ?? readString(payload.firstname),
    lastName: extractProperty(props, "lastname") ?? readString(payload.lastname),
    email,
    phone,
    leadSource:
      extractProperty(props, "source", "hs_analytics_source", "hs_lead_status", "lead_source") ??
      readString(payload.lead_source),
    procedureInterest:
      extractProperty(
        props,
        "procedure_interest",
        "procedure_type",
        "procedure",
        "non_surgical",
        "non_surgical_treatment",
        "treatment_interest"
      ) ?? readString(payload.procedure_type) ?? readString(payload.procedure_interest),
    country: extractProperty(props, "country", "country_of_residence") ?? readString(payload.country),
    budgetRange:
      extractProperty(props, "budget_range", "budget", "estimated_budget", "deal_budget") ??
      readString(payload.budget_range) ??
      readString(payload.amount),
    currentStage: mapHubSpotStageToLeadStage(lifecycleStage, dealStage),
  };
}

export function normalizeHubSpotDealToLeadPatch(payload: Record<string, unknown>): HubSpotLeadFieldPatch | null {
  const props = asRecord(payload.properties) ?? {};
  const hubspotContactId =
    readString(payload.hubspot_contact_id) ??
    readString(payload.contact_id) ??
    extractProperty(props, "associated_contact_id", "hubspot_contact_id");
  if (!hubspotContactId) return null;

  const dealStage =
    readString(payload.deal_stage) ??
    readString(payload.stage) ??
    extractProperty(props, "dealstage", "hs_pipeline_stage");

  const patch: HubSpotLeadFieldPatch = {
    hubspotContactId,
    currentStage: mapHubSpotStageToLeadStage(null, dealStage),
    leadSource: extractProperty(props, "hs_analytics_source", "lead_source", "source") ?? readString(payload.lead_source),
    procedureInterest:
      readString(payload.procedure_type) ??
      extractProperty(props, "procedure_type", "procedure_interest", "dealname"),
    budgetRange:
      extractProperty(props, "budget_range", "budget", "amount") ??
      readString(payload.budget_range) ??
      readString(payload.amount),
  };

  const email = normalizeLeadEmail(extractProperty(props, "email") ?? readString(payload.email));
  if (email) patch.email = email;

  const rawPhone = extractProperty(props, "phone", "mobilephone") ?? readString(payload.phone);
  if (rawPhone) patch.phone = normalizeLeadPhoneDigits(rawPhone) ?? rawPhone.trim();

  return patch;
}

export function buildLeadUpsertPlan(
  existing: {
    hubspot_contact_id: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    lead_source: string | null;
    procedure_interest: string | null;
    country: string | null;
    budget_range: string | null;
    current_stage: string;
  } | null,
  incoming: NormalizedHubSpotLeadInput | HubSpotLeadFieldPatch
): HubSpotLeadUpsertPlan {
  const previousStage = existing?.current_stage ?? null;
  const nextStage = incoming.currentStage ?? mapHubSpotStageToLeadStage(null, null);

  const patch: HubSpotLeadFieldPatch = {};
  const assign = <K extends keyof HubSpotLeadFieldPatch>(key: K, value: HubSpotLeadFieldPatch[K]) => {
    if (value == null || value === "") return;
    patch[key] = value;
  };

  assign("hubspotContactId", incoming.hubspotContactId ?? undefined);
  assign("firstName", incoming.firstName ?? undefined);
  assign("lastName", incoming.lastName ?? undefined);
  assign("email", incoming.email ?? undefined);
  assign("phone", incoming.phone ?? undefined);
  assign("leadSource", incoming.leadSource ?? undefined);
  assign("procedureInterest", incoming.procedureInterest ?? undefined);
  assign("country", incoming.country ?? undefined);
  assign("budgetRange", incoming.budgetRange ?? undefined);
  if (nextStage) patch.currentStage = nextStage;

  if (patch.hubspotContactId != null) {
    const incomingId = patch.hubspotContactId;
    const existingId = existing?.hubspot_contact_id?.trim() || null;
    if (!existingId || existingId === incomingId) {
      patch.hubspotContactId = incomingId;
    } else {
      delete patch.hubspotContactId;
    }
  }

  const stageChanged = !!existing && previousStage !== nextStage;
  const meaningfulChange =
    !existing ||
    stageChanged ||
    (patch.firstName != null && patch.firstName !== existing.first_name) ||
    (patch.lastName != null && patch.lastName !== existing.last_name) ||
    (patch.email != null && patch.email !== existing.email) ||
    (patch.phone != null && patch.phone !== existing.phone) ||
    (patch.leadSource != null && patch.leadSource !== existing.lead_source) ||
    (patch.procedureInterest != null && patch.procedureInterest !== existing.procedure_interest) ||
    (patch.country != null && patch.country !== existing.country) ||
    (patch.budgetRange != null && patch.budgetRange !== existing.budget_range) ||
    (patch.hubspotContactId != null && patch.hubspotContactId !== existing.hubspot_contact_id);

  return {
    patch,
    stageChanged,
    meaningfulChange,
    previousStage,
    nextStage,
  };
}

export function buildStageChangedActivityMetadataFromPlan(plan: HubSpotLeadUpsertPlan): Record<string, unknown> {
  return buildLeadStageChangedActivityMetadata({
    fromStage: plan.previousStage ?? "new",
    toStage: plan.nextStage,
    source: "hubspot",
  });
}

export function leadRowFromNormalizedInput(
  tenantId: string,
  input: NormalizedHubSpotLeadInput
): Record<string, unknown> {
  return {
    tenant_id: tenantId,
    hubspot_contact_id: input.hubspotContactId,
    first_name: input.firstName,
    last_name: input.lastName,
    email: input.email,
    phone: input.phone,
    lead_source: input.leadSource,
    procedure_interest: input.procedureInterest,
    country: input.country,
    budget_range: input.budgetRange,
    current_stage: input.currentStage,
  };
}

export function leadUpdateRowFromPatch(patch: HubSpotLeadFieldPatch): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.hubspotContactId != null) row.hubspot_contact_id = patch.hubspotContactId;
  if (patch.firstName != null) row.first_name = patch.firstName;
  if (patch.lastName != null) row.last_name = patch.lastName;
  if (patch.email != null) row.email = patch.email;
  if (patch.phone != null) row.phone = patch.phone;
  if (patch.leadSource != null) row.lead_source = patch.leadSource;
  if (patch.procedureInterest != null) row.procedure_interest = patch.procedureInterest;
  if (patch.country != null) row.country = patch.country;
  if (patch.budgetRange != null) row.budget_range = patch.budgetRange;
  if (patch.currentStage != null) row.current_stage = patch.currentStage;
  return row;
}
