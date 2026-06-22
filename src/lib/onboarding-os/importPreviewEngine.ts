/**
 * OnboardingOS Phase F5 — staged import preview engine (pure; no server-only).
 * Deterministic HubSpot → FI mapping only — no AI, no write-back.
 */

import { mapLeadStatusToKey, mapStageOfJourneyToPipelineSlug } from "@/src/lib/crm/hubspotImport/hubspotImportMappings";
import { normalizeEmail, normalizeWhitespaceName } from "@/src/lib/fi/foundation/normalize";
import type { HubspotLeadType, HubspotStagingContact, HubspotStagingDeal } from "./hubspotConnectorTypes";

export const EXTERNAL_SOURCE_PROVIDERS = ["hubspot", "cliniko", "pabau", "salesforce", "google_calendar"] as const;
export type ExternalSourceProvider = (typeof EXTERNAL_SOURCE_PROVIDERS)[number];

export type FiLeadImportClassification = "patient" | "lead_only" | "mixed_patient_lead";

export type FiLeadImportPreview = {
  sourceProvider: ExternalSourceProvider;
  externalContactId: string;
  stagingRecordId: string;
  summary: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  leadSource: string | null;
  lifecycleStage: string | null;
  contactType: string | null;
  stageOfJourney: string | null;
  normalizedLeadType: HubspotLeadType;
  classification: FiLeadImportClassification;
  mappedPipelineSlug: string | null;
  mappedLeadStatusKey: string | null;
  journeyUnmapped: boolean;
  leadStatusUnmapped: boolean;
  personMetadata: Record<string, unknown>;
  leadMetadata: Record<string, unknown>;
  createPatient: boolean;
};

export type FiOpportunityImportPreview = {
  sourceProvider: ExternalSourceProvider;
  externalDealId: string;
  externalContactId: string | null;
  stagingRecordId: string;
  dealName: string | null;
  email: string | null;
  phone: string | null;
  pipelineName: string | null;
  dealStage: string | null;
  leadSource: string | null;
  normalizedLeadType: HubspotLeadType;
  mappedPipelineSlug: string | null;
  summary: string;
  leadMetadata: Record<string, unknown>;
  linkToContactId: string | null;
};

function lc(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function extractProperty(props: Record<string, string | null | undefined> | undefined, ...keys: string[]): string | null {
  if (!props) return null;
  for (const key of keys) {
    const val = props[key];
    if (val != null && String(val).trim()) return String(val).trim();
  }
  return null;
}

function hubspotLifecycleIsLeadPipeline(lifecycleStage: string | null | undefined): boolean {
  const t = lc(lifecycleStage);
  if (!t) return false;
  if (/\bcustomer\b/.test(t)) return false;
  if (/\bevangelist\b/.test(t)) return false;
  if (/\bpatient\b/.test(t) && !/\blead\b/.test(t)) return false;
  return /\blead\b|subscriber|\b(sql|mql)\b|marketing qualified|sales qualified|opportunity\b/.test(t);
}

function journeyIndicatesPatient(stageOfJourney: string | null | undefined): boolean {
  const j = lc(stageOfJourney);
  if (!j) return false;
  if (j.includes("surgery done")) return true;
  if (j.includes("surgery booked")) return true;
  if (/post[\s-]*op|postop|postoperative/.test(j)) return true;
  if (/follow[\s/-]*up/.test(j)) return true;
  if (j.includes("existing patient")) return true;
  if (/\bpatient\b/.test(j)) return true;
  return false;
}

function contactTypeIndicatesPatient(contactType: string | null | undefined): boolean {
  const t = lc(contactType);
  if (!t) return false;
  return t.includes("existing patient") || t.includes("patient");
}

function lifecycleIndicatesPatient(lifecycleStage: string | null | undefined): boolean {
  const t = lc(lifecycleStage);
  if (!t) return false;
  return /\bcustomer\b/.test(t) || /\bpatient\b/.test(t);
}

function classifyHubspotContactForImport(props: {
  contactType: string | null;
  lifecycleStage: string | null;
  stageOfJourney: string | null;
  leadStatus: string | null;
}): FiLeadImportClassification {
  const patientByJourney = journeyIndicatesPatient(props.stageOfJourney);
  const patientByType = contactTypeIndicatesPatient(props.contactType);
  const patientByLifecycle = lifecycleIndicatesPatient(props.lifecycleStage);
  const leadPipeline = hubspotLifecycleIsLeadPipeline(props.lifecycleStage);

  if (patientByJourney || patientByType || patientByLifecycle) {
    if (leadPipeline && !patientByJourney) return "mixed_patient_lead";
    return "patient";
  }
  return "lead_only";
}

function buildContactSummary(firstName: string | null, lastName: string | null, email: string | null, recordId: string): string {
  const display = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (display) return display.slice(0, 500);
  if (email) return email.slice(0, 500);
  return `HubSpot contact ${recordId}`.slice(0, 500);
}

/** Build FI lead import preview from an approved HubSpot contact staging row. */
export function buildHubspotContactImportPreview(staging: HubspotStagingContact): FiLeadImportPreview {
  const raw = staging.rawPayload as { properties?: Record<string, string | null | undefined> };
  const props = raw?.properties ?? {};
  const firstName = extractProperty(props, "firstname");
  const lastName = extractProperty(props, "lastname");
  const email = normalizeEmail(staging.email ?? extractProperty(props, "email"));
  const phone = staging.phone ?? extractProperty(props, "phone", "mobilephone");
  const lifecycleStage = extractProperty(props, "lifecyclestage");
  const contactType = extractProperty(props, "contact_type", "type");
  const stageOfJourney = extractProperty(props, "stage_of_journey", "hs_pipeline");
  const leadStatus = extractProperty(props, "hs_lead_status", "lead_status");

  const journeyMap = mapStageOfJourneyToPipelineSlug(stageOfJourney ?? staging.leadSource);
  const leadStatusMap = mapLeadStatusToKey(leadStatus ?? staging.leadSource);
  const classification = classifyHubspotContactForImport({
    contactType,
    lifecycleStage,
    stageOfJourney,
    leadStatus,
  });

  const display = [firstName, lastName].filter(Boolean).join(" ").trim();
  const normDisplay = normalizeWhitespaceName(display);

  const personMetadata: Record<string, unknown> = {
    onboarding_os: {
      phase: "f5_staged_import",
      source_provider: "hubspot",
      staging_record_id: staging.id,
    },
    hubspot: {
      record_id: staging.hubspotContactId,
      first_name: firstName,
      last_name: lastName,
      email: email,
      phone_number: phone,
      lead_status: leadStatus,
      lifecycle_stage: lifecycleStage,
      contact_type: contactType,
      stage_of_journey: stageOfJourney,
      lead_source: staging.leadSource,
      mapped_pipeline_slug: journeyMap.slug,
      mapped_lead_status_key: leadStatusMap.key,
      import_classification: classification,
      normalized_lead_type: staging.normalizedLeadType,
    },
  };
  if (email) personMetadata.email_normalized = email;
  if (normDisplay) personMetadata.normalised_display_name = normDisplay;
  if (display) personMetadata.display_name = display;
  if (phone?.trim()) personMetadata.phone = phone.trim();

  const leadMetadata: Record<string, unknown> = {
    onboarding_os: { phase: "f5_staged_import", source_provider: "hubspot" },
    hubspot: {
      lead_status: leadStatus,
      lifecycle_stage: lifecycleStage,
      stage_of_journey: stageOfJourney,
      lead_source: staging.leadSource,
      contact_type: contactType,
      mapped_pipeline_slug: journeyMap.slug,
      mapped_lead_status_key: leadStatusMap.key,
      import_classification: classification,
      normalized_lead_type: staging.normalizedLeadType,
    },
  };

  return {
    sourceProvider: "hubspot",
    externalContactId: staging.hubspotContactId,
    stagingRecordId: staging.id,
    summary: buildContactSummary(firstName, lastName, email, staging.hubspotContactId),
    email,
    phone: phone?.trim() ?? null,
    firstName,
    lastName,
    displayName: display || null,
    leadSource: staging.leadSource,
    lifecycleStage,
    contactType,
    stageOfJourney,
    normalizedLeadType: staging.normalizedLeadType,
    classification,
    mappedPipelineSlug: journeyMap.slug,
    mappedLeadStatusKey: leadStatusMap.key,
    journeyUnmapped: journeyMap.unmapped,
    leadStatusUnmapped: leadStatusMap.unmapped,
    personMetadata,
    leadMetadata,
    createPatient: classification === "patient" || classification === "mixed_patient_lead",
  };
}

/** Build FI opportunity (CRM lead) import preview from an approved HubSpot deal staging row. */
export function buildHubspotDealImportPreview(staging: HubspotStagingDeal): FiOpportunityImportPreview {
  const raw = staging.rawPayload as { properties?: Record<string, string | null | undefined> };
  const props = raw?.properties ?? {};
  const dealName = extractProperty(props, "dealname");
  const dealStage = staging.dealStage ?? extractProperty(props, "dealstage");
  const pipelineName = staging.pipelineName ?? extractProperty(props, "pipeline", "hs_pipeline");
  const email = normalizeEmail(staging.email ?? extractProperty(props, "email"));
  const phone = staging.phone ?? extractProperty(props, "phone");

  const journeyMap = mapStageOfJourneyToPipelineSlug(dealStage ?? pipelineName);
  const summary = (dealName ?? email ?? `HubSpot deal ${staging.hubspotDealId}`).slice(0, 500);

  const leadMetadata: Record<string, unknown> = {
    onboarding_os: {
      phase: "f5_staged_import",
      source_provider: "hubspot",
      entity_kind: "opportunity",
    },
    hubspot: {
      deal_id: staging.hubspotDealId,
      deal_name: dealName,
      deal_stage: dealStage,
      pipeline_name: pipelineName,
      lead_source: staging.leadSource,
      hubspot_contact_id: staging.hubspotContactId,
      mapped_pipeline_slug: journeyMap.slug,
      normalized_lead_type: staging.normalizedLeadType,
    },
  };

  return {
    sourceProvider: "hubspot",
    externalDealId: staging.hubspotDealId,
    externalContactId: staging.hubspotContactId,
    stagingRecordId: staging.id,
    dealName,
    email,
    phone: phone?.trim() ?? null,
    pipelineName,
    dealStage,
    leadSource: staging.leadSource,
    normalizedLeadType: staging.normalizedLeadType,
    mappedPipelineSlug: journeyMap.slug,
    summary,
    leadMetadata,
    linkToContactId: staging.hubspotContactId,
  };
}

/** Map approved HubSpot contact staging to FI CRM lead insert shape (preview only). */
export function mapHubspotContactToFiLead(staging: HubspotStagingContact): {
  preview: FiLeadImportPreview;
  proposedFiAction: "create_person_and_lead" | "create_person_patient_and_lead";
} {
  const preview = buildHubspotContactImportPreview(staging);
  return {
    preview,
    proposedFiAction: preview.createPatient ? "create_person_patient_and_lead" : "create_person_and_lead",
  };
}

/** Map approved HubSpot deal staging to FI opportunity (CRM lead) insert shape (preview only). */
export function mapHubspotDealToFiOpportunity(staging: HubspotStagingDeal): {
  preview: FiOpportunityImportPreview;
  proposedFiAction: "create_opportunity_lead" | "link_opportunity_to_contact";
} {
  const preview = buildHubspotDealImportPreview(staging);
  return {
    preview,
    proposedFiAction: preview.linkToContactId ? "link_opportunity_to_contact" : "create_opportunity_lead",
  };
}
