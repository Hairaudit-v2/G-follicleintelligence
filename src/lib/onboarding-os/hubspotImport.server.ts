import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { appendCrmActivityEvent } from "@/src/lib/crm/activity";
import { ensureDefaultPipelineStages, getEntryPipelineStage, loadPipelineStages } from "@/src/lib/crm/pipeline";
import { appendCrmLeadStageHistory } from "@/src/lib/crm/stageHistory";
import { mapFiCrmLeadRow } from "@/src/lib/crm/leadRow";
import type { CrmPipelineScope } from "@/src/lib/crm/types";
import { DEFAULT_CRM_PIPELINE_KEY } from "@/src/lib/crm/types";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { normalizeEmail } from "@/src/lib/fi/foundation/normalize";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsRoleAllowedForPlatformTenantProvisioning } from "@/src/lib/fiOs/platformTenantProvisionGate";
import { loadActiveTenantAdminProfileForSession } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";
import { syncLeadCreatedReminderJobs } from "@/src/lib/reminders/reminderEnqueue.server";
import { logStructured } from "@/src/lib/server/structuredLog";

import {
  buildHubspotContactImportPreview,
  buildHubspotDealImportPreview,
  type FiLeadImportPreview,
  type FiOpportunityImportPreview,
} from "./importPreviewEngine";
import {
  caseRowToDuplicateCandidate,
  personRowToDuplicateCandidate,
  runDuplicateDetection,
  type DuplicateCheckResult,
  type DuplicateCheckCandidateIndex,
} from "./duplicateDetectionEngine";
import type { HubspotStagingContact, HubspotStagingDeal } from "./hubspotConnectorTypes";
import { isHubspotImportStatus } from "./hubspotConnectorTypes";
import { coerceHubspotLeadType } from "./hubspotConnectorCore";

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
  actorAuthUserId?: string | null;
  skipAuthCheck?: boolean;
  allowTenantMemberRead?: boolean;
};

const HUBSPOT_PERSON_SOURCE = "hubspot";
const HUBSPOT_DEAL_SOURCE = "hubspot_deal";
const SOURCE_PROVIDER = "hubspot";

export type ImportReviewItem = {
  kind: "contact" | "deal";
  staging: HubspotStagingContact | HubspotStagingDeal;
  preview: FiLeadImportPreview | FiOpportunityImportPreview;
  duplicateCheck: DuplicateCheckResult;
  proposedAction: string;
};

export type ApprovedStagedRecords = {
  contacts: HubspotStagingContact[];
  deals: HubspotStagingDeal[];
};

export type HubspotImportActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

type ContactStagingRow = {
  id: string;
  integration_id: string;
  tenant_id: string;
  sync_run_id: string | null;
  hubspot_contact_id: string;
  email: string | null;
  phone: string | null;
  lead_source: string | null;
  duplicate_risk: boolean;
  normalized_lead_type: string;
  raw_payload: Record<string, unknown>;
  import_status: string;
  imported_at: string | null;
  created_at: string;
  updated_at: string;
};

type DealStagingRow = {
  id: string;
  integration_id: string;
  tenant_id: string;
  sync_run_id: string | null;
  hubspot_deal_id: string;
  hubspot_contact_id: string | null;
  email: string | null;
  phone: string | null;
  lead_source: string | null;
  pipeline_name: string | null;
  deal_stage: string | null;
  duplicate_risk: boolean;
  normalized_lead_type: string;
  raw_payload: Record<string, unknown>;
  import_status: string;
  imported_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapContactStagingRow(row: ContactStagingRow): HubspotStagingContact {
  const importStatus = isHubspotImportStatus(row.import_status) ? row.import_status : "staged";
  return {
    id: row.id,
    integrationId: row.integration_id,
    tenantId: row.tenant_id,
    syncRunId: row.sync_run_id,
    hubspotContactId: row.hubspot_contact_id,
    email: row.email,
    phone: row.phone,
    leadSource: row.lead_source,
    duplicateRisk: Boolean(row.duplicate_risk),
    normalizedLeadType: coerceHubspotLeadType(row.normalized_lead_type),
    rawPayload: row.raw_payload ?? {},
    importStatus,
    importedAt: row.imported_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDealStagingRow(row: DealStagingRow): HubspotStagingDeal {
  const importStatus = isHubspotImportStatus(row.import_status) ? row.import_status : "staged";
  return {
    id: row.id,
    integrationId: row.integration_id,
    tenantId: row.tenant_id,
    syncRunId: row.sync_run_id,
    hubspotDealId: row.hubspot_deal_id,
    hubspotContactId: row.hubspot_contact_id,
    email: row.email,
    phone: row.phone,
    leadSource: row.lead_source,
    pipelineName: row.pipeline_name,
    dealStage: row.deal_stage,
    duplicateRisk: Boolean(row.duplicate_risk),
    normalizedLeadType: coerceHubspotLeadType(row.normalized_lead_type),
    rawPayload: row.raw_payload ?? {},
    importStatus,
    importedAt: row.imported_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function resolvePlatformAdminAuth(opts: ServerOpts): Promise<
  | { ok: true; actorAuthUserId: string }
  | { ok: false; error: string }
> {
  const authId = opts.actorAuthUserId ?? (await resolveAuthUserId(null));
  if (!authId) return { ok: false, error: "Authentication required." };
  if (opts.skipAuthCheck && opts.actorAuthUserId) {
    return { ok: true, actorAuthUserId: authId };
  }
  const os = await loadFiOsIdentity(authId);
  if (!isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole)) {
    return { ok: false, error: "Platform administrator access is required." };
  }
  return { ok: true, actorAuthUserId: authId };
}

async function resolveTenantAdminAuth(
  tenantId: string,
  opts: ServerOpts
): Promise<
  | { ok: true; actorAuthUserId: string; fiUserId: string; actorLabel: string }
  | { ok: false; error: string }
> {
  const authId = opts.actorAuthUserId ?? (await resolveAuthUserId(null));
  if (!authId) return { ok: false, error: "Authentication required." };

  const os = await loadFiOsIdentity(authId);
  if (isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole)) {
    if (opts.skipAuthCheck) {
      return { ok: true, actorAuthUserId: authId, fiUserId: "", actorLabel: "Platform admin" };
    }
  }

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_users")
    .select("id, email")
    .eq("tenant_id", tenantId.trim())
    .eq("auth_user_id", authId)
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Tenant membership required." };

  const adminProf = await loadActiveTenantAdminProfileForSession(tenantId, authId);
  if (adminProf?.adminRole !== "clinic_admin" && adminProf?.adminRole !== "operations_admin") {
    if (!opts.skipAuthCheck) {
      const platform = await resolvePlatformAdminAuth(opts);
      if (!platform.ok) return { ok: false, error: "Tenant admin access is required." };
      return { ok: true, actorAuthUserId: authId, fiUserId: "", actorLabel: "Platform admin" };
    }
    return { ok: false, error: "Tenant admin access is required." };
  }

  const row = data as { id: string; email: string | null };
  return {
    ok: true,
    actorAuthUserId: authId,
    fiUserId: String(row.id),
    actorLabel: row.email ?? "Tenant admin",
  };
}

async function resolveWriteAuth(
  tenantId: string,
  opts: ServerOpts
): Promise<
  | { ok: true; actorAuthUserId: string; fiUserId: string | null; actorLabel: string }
  | { ok: false; error: string }
> {
  const platform = await resolvePlatformAdminAuth({ ...opts, skipAuthCheck: false });
  if (platform.ok) {
    return { ok: true, actorAuthUserId: platform.actorAuthUserId, fiUserId: null, actorLabel: "Platform admin" };
  }
  const tenant = await resolveTenantAdminAuth(tenantId, opts);
  if (!tenant.ok) return tenant;
  return {
    ok: true,
    actorAuthUserId: tenant.actorAuthUserId,
    fiUserId: tenant.fiUserId || null,
    actorLabel: tenant.actorLabel,
  };
}

async function resolveReadAuth(tenantId: string, opts: ServerOpts): Promise<{ ok: true } | { ok: false; error: string }> {
  const platform = await resolvePlatformAdminAuth({ ...opts, skipAuthCheck: false });
  if (platform.ok) return { ok: true };

  if (opts.allowTenantMemberRead) {
    const authId = opts.actorAuthUserId ?? (await resolveAuthUserId(null));
    if (!authId) return { ok: false, error: "Authentication required." };
    const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
    const { data: member } = await supabase
      .from("fi_users")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("auth_user_id", authId)
      .maybeSingle();
    if (member) return { ok: true };
  }

  const tenant = await resolveTenantAdminAuth(tenantId, { ...opts, skipAuthCheck: true });
  if (tenant.ok) return { ok: true };
  return { ok: false, error: "Access denied." };
}

async function loadDuplicateCheckIndex(
  supabase: SupabaseClient,
  tenantId: string,
  integrationId: string
): Promise<DuplicateCheckCandidateIndex> {
  const tid = tenantId.trim();

  const [personsRes, leadsRes, patientsRes, casesRes, mappingsRes, personSourceRes] = await Promise.all([
    supabase.from("fi_persons").select("id, metadata").eq("tenant_id", tid),
    supabase.from("fi_crm_leads").select("id, person_id, summary, metadata").eq("tenant_id", tid),
    supabase.from("fi_patients").select("id, person_id, metadata").eq("tenant_id", tid),
    supabase.from("fi_cases").select("id, email, full_name").eq("tenant_id", tid),
    supabase
      .from("fi_external_record_mappings")
      .select("external_id, source_entity_type, fi_entity_type, fi_entity_id")
      .eq("tenant_id", tid)
      .eq("integration_id", integrationId),
    supabase
      .from("fi_person_source_ids")
      .select("source_person_id, person_id")
      .eq("tenant_id", tid)
      .eq("source_system", HUBSPOT_PERSON_SOURCE),
  ]);

  if (personsRes.error) throw new Error(personsRes.error.message);
  if (leadsRes.error) throw new Error(leadsRes.error.message);
  if (patientsRes.error) throw new Error(patientsRes.error.message);
  if (casesRes.error) throw new Error(casesRes.error.message);

  const personCandidates = (personsRes.data ?? []).map((r) =>
    personRowToDuplicateCandidate(r as { id: string; metadata: unknown })
  );
  const personEmailById = new Map(personCandidates.map((p) => [p.id, p.emailNormalized]));

  const leads = (leadsRes.data ?? []).map((r) => {
    const row = r as { id: string; person_id: string; summary: string | null; metadata: unknown };
    const m = row.metadata as Record<string, unknown> | null;
    const hub = m?.hubspot as Record<string, unknown> | undefined;
    const hubEmail = typeof hub?.email === "string" ? normalizeEmail(hub.email) : null;
    return {
      id: row.id,
      personId: row.person_id,
      summary: row.summary,
      emailNormalized: hubEmail ?? personEmailById.get(row.person_id) ?? null,
    };
  });

  const patients = (patientsRes.data ?? []).map((r) => {
    const row = r as { id: string; person_id: string; metadata: unknown };
    return {
      id: row.id,
      personId: row.person_id,
      emailNormalized: personEmailById.get(row.person_id) ?? null,
    };
  });

  const cases = (casesRes.data ?? []).map((r) =>
    caseRowToDuplicateCandidate(r as { id: string; email: string | null; full_name: string | null })
  );

  const externalMappings: Array<DuplicateCheckCandidateIndex["externalMappings"][number]> = [];

  if (!mappingsRes.error) {
    for (const row of mappingsRes.data ?? []) {
      const r = row as {
        external_id: string;
        source_entity_type: string;
        fi_entity_type: string;
        fi_entity_id: string;
      };
      externalMappings.push({
        externalId: r.external_id,
        sourceEntityType: r.source_entity_type,
        fiEntityType: r.fi_entity_type,
        fiEntityId: r.fi_entity_id,
      });
    }
  }

  if (!personSourceRes.error) {
    for (const row of personSourceRes.data ?? []) {
      const r = row as { source_person_id: string; person_id: string };
      externalMappings.push({
        externalId: r.source_person_id,
        sourceEntityType: "contact",
        fiEntityType: "person",
        fiEntityId: r.person_id,
      });
    }
  }

  return {
    persons: personCandidates,
    leads,
    patients,
    cases,
    externalMappings,
  };
}

function resolveProposedAction(
  kind: "contact" | "deal",
  duplicateCheck: DuplicateCheckResult,
  preview: FiLeadImportPreview | FiOpportunityImportPreview
): string {
  if (duplicateCheck.hasBlockingMatch) {
    const top = duplicateCheck.matches[0];
    if (top?.rule === "external_mapping") return "blocked";
    if (top?.entityType === "person" || top?.entityType === "lead") return "merge_person";
    return "blocked";
  }
  if (kind === "contact") {
    const p = preview as FiLeadImportPreview;
    return p.createPatient ? "create_person_patient_and_lead" : "create_person_and_lead";
  }
  return "create_opportunity";
}

/** Load approved HubSpot staging contacts and deals ready for import review. */
export async function loadApprovedStagedRecords(
  integrationId: string,
  tenantId: string,
  opts?: ServerOpts
): Promise<HubspotImportActionResult<ApprovedStagedRecords>> {
  const auth = await resolveReadAuth(tenantId, { ...opts, allowTenantMemberRead: true });
  if (!auth.ok) return auth;

  const supabase = opts?.supabaseClientForTests ?? supabaseAdmin();
  const iid = integrationId.trim();
  const tid = tenantId.trim();

  const [contactsRes, dealsRes] = await Promise.all([
    supabase
      .from("fi_external_hubspot_contact_staging")
      .select("*")
      .eq("integration_id", iid)
      .eq("tenant_id", tid)
      .eq("import_status", "approved")
      .order("created_at", { ascending: true }),
    supabase
      .from("fi_external_hubspot_deal_staging")
      .select("*")
      .eq("integration_id", iid)
      .eq("tenant_id", tid)
      .eq("import_status", "approved")
      .order("created_at", { ascending: true }),
  ]);

  if (contactsRes.error) return { ok: false, error: contactsRes.error.message };
  if (dealsRes.error) return { ok: false, error: dealsRes.error.message };

  return {
    ok: true,
    data: {
      contacts: (contactsRes.data ?? []).map((r) => mapContactStagingRow(r as ContactStagingRow)),
      deals: (dealsRes.data ?? []).map((r) => mapDealStagingRow(r as DealStagingRow)),
    },
  };
}

/** Run duplicate check for a staging contact or deal. */
export async function runDuplicateCheck(
  integrationId: string,
  tenantId: string,
  input: {
    kind: "contact" | "deal";
    stagingId: string;
    email?: string | null;
    phone?: string | null;
    displayName?: string | null;
    externalId: string;
  },
  opts?: ServerOpts
): Promise<HubspotImportActionResult<DuplicateCheckResult>> {
  const auth = await resolveReadAuth(tenantId, { ...opts, allowTenantMemberRead: true });
  if (!auth.ok) return auth;

  const supabase = opts?.supabaseClientForTests ?? supabaseAdmin();
  const index = await loadDuplicateCheckIndex(supabase, tenantId, integrationId);

  const result = runDuplicateDetection(
    {
      email: input.email,
      phone: input.phone,
      displayName: input.displayName,
      externalId: input.externalId,
      externalEntityType: input.kind === "contact" ? "contact" : "deal",
    },
    index
  );

  await logImportAuditEvent({
    tenantId,
    integrationId,
    stagingRecordType: input.kind === "contact" ? "hubspot_contact" : "hubspot_deal",
    stagingRecordId: input.stagingId,
    eventKind: "duplicate_check",
    actorAuthUserId: opts?.actorAuthUserId ?? null,
    actorFiUserId: null,
    actorLabel: null,
    detail: { duplicateCheck: result },
    supabase,
  });

  return { ok: true, data: result };
}

/** Build full import review queue with previews and duplicate checks. */
export async function loadImportReviewQueue(
  integrationId: string,
  tenantId: string,
  opts?: ServerOpts
): Promise<HubspotImportActionResult<{ items: ImportReviewItem[] }>> {
  const staged = await loadApprovedStagedRecords(integrationId, tenantId, opts);
  if (!staged.ok) return staged;

  const supabase = opts?.supabaseClientForTests ?? supabaseAdmin();
  const index = await loadDuplicateCheckIndex(supabase, tenantId, integrationId);
  const items: ImportReviewItem[] = [];

  for (const contact of staged.data!.contacts) {
    const preview = buildHubspotContactImportPreview(contact);
    const duplicateCheck = runDuplicateDetection(
      {
        email: preview.email,
        phone: preview.phone,
        displayName: preview.displayName,
        externalId: contact.hubspotContactId,
        externalEntityType: "contact",
      },
      index
    );
    items.push({
      kind: "contact",
      staging: contact,
      preview,
      duplicateCheck,
      proposedAction: resolveProposedAction("contact", duplicateCheck, preview),
    });
  }

  for (const deal of staged.data!.deals) {
    const preview = buildHubspotDealImportPreview(deal);
    const duplicateCheck = runDuplicateDetection(
      {
        email: preview.email,
        phone: preview.phone,
        displayName: preview.dealName,
        externalId: deal.hubspotDealId,
        externalEntityType: "deal",
      },
      index
    );
    items.push({
      kind: "deal",
      staging: deal,
      preview,
      duplicateCheck,
      proposedAction: resolveProposedAction("deal", duplicateCheck, preview),
    });
  }

  return { ok: true, data: { items } };
}

async function resolvePipelineStageId(
  tenantId: string,
  mappedSlug: string | null,
  supabase: SupabaseClient
): Promise<string> {
  const scope: CrmPipelineScope = {
    tenantId,
    organisationId: null,
    clinicId: null,
    pipelineKey: DEFAULT_CRM_PIPELINE_KEY,
  };
  await ensureDefaultPipelineStages(scope, supabase);
  const stages = await loadPipelineStages(scope, supabase);
  const entry = await getEntryPipelineStage(scope, supabase);
  if (!entry) throw new Error("CRM pipeline has no entry stage.");
  if (mappedSlug) {
    const stage = stages.find((s) => s.slug === mappedSlug);
    if (stage) return stage.id;
  }
  return entry.id;
}

/** Create FI CRM lead (+ person, optional patient) from approved HubSpot contact. Never writes to HubSpot. */
export async function createFiLeadFromHubspotContact(
  stagingContactId: string,
  integrationId: string,
  tenantId: string,
  opts?: ServerOpts & { mergePersonId?: string | null }
): Promise<HubspotImportActionResult<{ personId: string; leadId: string; patientId: string | null }>> {
  const auth = await resolveWriteAuth(tenantId, opts ?? {});
  if (!auth.ok) return auth;

  const supabase = opts?.supabaseClientForTests ?? supabaseAdmin();
  const tid = tenantId.trim();
  const iid = integrationId.trim();
  const sid = stagingContactId.trim();

  const { data: row, error: fetchErr } = await supabase
    .from("fi_external_hubspot_contact_staging")
    .select("*")
    .eq("id", sid)
    .eq("integration_id", iid)
    .eq("tenant_id", tid)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!row) return { ok: false, error: "Staging contact not found." };

  const staging = mapContactStagingRow(row as ContactStagingRow);
  if (staging.importStatus !== "approved") {
    return { ok: false, error: "Only approved staging contacts can be imported." };
  }

  const preview = buildHubspotContactImportPreview(staging);
  const index = await loadDuplicateCheckIndex(supabase, tid, iid);
  const duplicateCheck = runDuplicateDetection(
    {
      email: preview.email,
      phone: preview.phone,
      displayName: preview.displayName,
      externalId: staging.hubspotContactId,
      externalEntityType: "contact",
    },
    index
  );

  if (duplicateCheck.hasBlockingMatch && !opts?.mergePersonId) {
    return { ok: false, error: duplicateCheck.summary };
  }

  const existingMapping = index.externalMappings.find(
    (m) => m.externalId === staging.hubspotContactId && m.sourceEntityType === "contact"
  );
  if (existingMapping && !opts?.mergePersonId) {
    return { ok: false, error: "HubSpot contact already mapped to an FI record." };
  }

  let personId = opts?.mergePersonId?.trim() ?? null;
  let patientId: string | null = null;

  if (!personId) {
    const { data: pIns, error: pErr } = await supabase
      .from("fi_persons")
      .insert({ tenant_id: tid, metadata: preview.personMetadata })
      .select("id")
      .single();
    if (pErr) return { ok: false, error: pErr.message };
    personId = String((pIns as { id: string }).id);

    const { error: psErr } = await supabase.from("fi_person_source_ids").insert({
      tenant_id: tid,
      person_id: personId,
      source_system: HUBSPOT_PERSON_SOURCE,
      source_person_id: staging.hubspotContactId,
    });
    if (psErr?.code === "23505") {
      return { ok: false, error: "HubSpot contact ID already exists in fi_person_source_ids." };
    }
    if (psErr) return { ok: false, error: psErr.message };
  }

  if (preview.createPatient) {
    const { data: existingPat } = await supabase
      .from("fi_patients")
      .select("id")
      .eq("tenant_id", tid)
      .eq("person_id", personId)
      .maybeSingle();
    if (existingPat) {
      patientId = String((existingPat as { id: string }).id);
    } else {
      const patientMeta = {
        onboarding_os: { phase: "f5_staged_import", source_provider: SOURCE_PROVIDER },
        hubspot: preview.personMetadata.hubspot,
      };
      const { data: patIns, error: patErr } = await supabase
        .from("fi_patients")
        .insert({ tenant_id: tid, person_id: personId, metadata: patientMeta })
        .select("id")
        .single();
      if (patErr) return { ok: false, error: patErr.message };
      patientId = String((patIns as { id: string }).id);
    }
  }

  const stageId = await resolvePipelineStageId(tid, preview.mappedPipelineSlug, supabase);

  const { data: lIns, error: lErr } = await supabase
    .from("fi_crm_leads")
    .insert({
      tenant_id: tid,
      organisation_id: null,
      clinic_id: null,
      person_id: personId,
      patient_id: patientId,
      case_id: null,
      current_stage_id: stageId,
      primary_owner_user_id: null,
      status: "open",
      priority: null,
      summary: preview.summary,
      metadata: preview.leadMetadata,
    })
    .select("*")
    .single();
  if (lErr) return { ok: false, error: lErr.message };

  const lead = mapFiCrmLeadRow(lIns as Record<string, unknown>);

  await appendCrmLeadStageHistory(
    {
      tenantId: tid,
      leadId: lead.id,
      fromStageId: null,
      toStageId: stageId,
      changedBy: null,
      source: "system",
      reason: "onboarding_os.hubspot.f5_import",
      metadata: { staging_contact_id: sid, hubspot_contact_id: staging.hubspotContactId },
    },
    supabase
  );

  await appendCrmActivityEvent(
    {
      tenantId: tid,
      leadId: lead.id,
      activityKind: "crm.import.hubspot_f5",
      title: "HubSpot staged import (OnboardingOS F5)",
      detail: {
        staging_contact_id: sid,
        hubspot_contact_id: staging.hubspotContactId,
        merge_person_id: opts?.mergePersonId ?? null,
      },
    },
    supabase
  );

  await syncLeadCreatedReminderJobs(lead, supabase);

  await persistExternalMapping({
    tenantId: tid,
    integrationId: iid,
    sourceProvider: SOURCE_PROVIDER,
    sourceEntityType: "contact",
    externalId: staging.hubspotContactId,
    fiEntityType: "lead",
    fiEntityId: lead.id,
    stagingRecordType: "hubspot_contact",
    stagingRecordId: sid,
    detail: { person_id: personId, patient_id: patientId, merge: Boolean(opts?.mergePersonId) },
    supabase,
  });

  await persistExternalMapping({
    tenantId: tid,
    integrationId: iid,
    sourceProvider: SOURCE_PROVIDER,
    sourceEntityType: "contact",
    externalId: staging.hubspotContactId,
    fiEntityType: "person",
    fiEntityId: personId,
    stagingRecordType: "hubspot_contact",
    stagingRecordId: sid,
    detail: { lead_id: lead.id },
    supabase,
  });

  const now = new Date().toISOString();
  await supabase
    .from("fi_external_hubspot_contact_staging")
    .update({ import_status: "imported", imported_at: now })
    .eq("id", sid)
    .eq("tenant_id", tid);

  await logHubspotImportAudit({
    integrationId: iid,
    tenantId: tid,
    stagingContactId: sid,
    action: opts?.mergePersonId ? "contact_merged" : "contact_imported",
    actorAuthUserId: auth.actorAuthUserId,
    actorFiUserId: auth.fiUserId,
    actorLabel: auth.actorLabel,
    detail: { person_id: personId, lead_id: lead.id, patient_id: patientId },
    supabase,
  });

  await logImportAuditEvent({
    tenantId: tid,
    integrationId: iid,
    stagingRecordType: "hubspot_contact",
    stagingRecordId: sid,
    eventKind: opts?.mergePersonId ? "merge_existing" : "import_completed",
    actorAuthUserId: auth.actorAuthUserId,
    actorFiUserId: auth.fiUserId,
    actorLabel: auth.actorLabel,
    detail: { person_id: personId, lead_id: lead.id },
    supabase,
  });

  logStructured("info", "onboarding_os.hubspot.f5_contact_imported", {
    tenantId: tid,
    stagingContactId: sid,
    leadId: lead.id,
  });

  return { ok: true, data: { personId, leadId: lead.id, patientId } };
}

/** Create FI opportunity (CRM lead) from approved HubSpot deal. Never writes to HubSpot. */
export async function createFiOpportunityFromHubspotDeal(
  stagingDealId: string,
  integrationId: string,
  tenantId: string,
  opts?: ServerOpts & { mergeLeadId?: string | null; personId?: string | null }
): Promise<HubspotImportActionResult<{ leadId: string; personId: string | null }>> {
  const auth = await resolveWriteAuth(tenantId, opts ?? {});
  if (!auth.ok) return auth;

  const supabase = opts?.supabaseClientForTests ?? supabaseAdmin();
  const tid = tenantId.trim();
  const iid = integrationId.trim();
  const sid = stagingDealId.trim();

  const { data: row, error: fetchErr } = await supabase
    .from("fi_external_hubspot_deal_staging")
    .select("*")
    .eq("id", sid)
    .eq("integration_id", iid)
    .eq("tenant_id", tid)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!row) return { ok: false, error: "Staging deal not found." };

  const staging = mapDealStagingRow(row as DealStagingRow);
  if (staging.importStatus !== "approved") {
    return { ok: false, error: "Only approved staging deals can be imported." };
  }

  const preview = buildHubspotDealImportPreview(staging);
  const index = await loadDuplicateCheckIndex(supabase, tid, iid);
  const duplicateCheck = runDuplicateDetection(
    {
      email: preview.email,
      phone: preview.phone,
      displayName: preview.dealName,
      externalId: staging.hubspotDealId,
      externalEntityType: "deal",
    },
    index
  );

  if (duplicateCheck.hasBlockingMatch && !opts?.mergeLeadId) {
    return { ok: false, error: duplicateCheck.summary };
  }

  const existingDealMapping = index.externalMappings.find(
    (m) => m.externalId === staging.hubspotDealId && m.sourceEntityType === "deal"
  );
  if (existingDealMapping && !opts?.mergeLeadId) {
    return { ok: false, error: "HubSpot deal already mapped to an FI record." };
  }

  let personId = opts?.personId?.trim() ?? null;

  if (!personId && staging.hubspotContactId) {
    const contactMapping = index.externalMappings.find(
      (m) => m.externalId === staging.hubspotContactId && m.sourceEntityType === "contact" && m.fiEntityType === "person"
    );
    if (contactMapping) personId = contactMapping.fiEntityId;

    if (!personId) {
      const { data: psRow } = await supabase
        .from("fi_person_source_ids")
        .select("person_id")
        .eq("tenant_id", tid)
        .eq("source_system", HUBSPOT_PERSON_SOURCE)
        .eq("source_person_id", staging.hubspotContactId)
        .maybeSingle();
      if (psRow) personId = String((psRow as { person_id: string }).person_id);
    }
  }

  if (!personId) {
    return { ok: false, error: "Cannot create opportunity without a linked FI person — import the contact first or provide personId." };
  }

  const stageId = await resolvePipelineStageId(tid, preview.mappedPipelineSlug, supabase);

  const { data: lIns, error: lErr } = await supabase
    .from("fi_crm_leads")
    .insert({
      tenant_id: tid,
      organisation_id: null,
      clinic_id: null,
      person_id: personId,
      patient_id: null,
      case_id: null,
      current_stage_id: stageId,
      primary_owner_user_id: null,
      status: "open",
      priority: null,
      summary: preview.summary,
      metadata: preview.leadMetadata,
    })
    .select("*")
    .single();
  if (lErr) return { ok: false, error: lErr.message };

  const lead = mapFiCrmLeadRow(lIns as Record<string, unknown>);

  await appendCrmLeadStageHistory(
    {
      tenantId: tid,
      leadId: lead.id,
      fromStageId: null,
      toStageId: stageId,
      changedBy: null,
      source: "system",
      reason: "onboarding_os.hubspot.f5_deal_import",
      metadata: { staging_deal_id: sid, hubspot_deal_id: staging.hubspotDealId },
    },
    supabase
  );

  const { error: dealSourceErr } = await supabase.from("fi_crm_lead_source_ids").insert({
    tenant_id: tid,
    lead_id: lead.id,
    source_system: HUBSPOT_DEAL_SOURCE,
    source_lead_id: staging.hubspotDealId,
  });
  if (dealSourceErr?.code === "23505") {
    return { ok: false, error: "HubSpot deal ID already linked to an FI lead." };
  }
  if (dealSourceErr) return { ok: false, error: dealSourceErr.message };

  await appendCrmActivityEvent(
    {
      tenantId: tid,
      leadId: lead.id,
      activityKind: "crm.import.hubspot_f5_deal",
      title: "HubSpot deal staged import (OnboardingOS F5)",
      detail: {
        staging_deal_id: sid,
        hubspot_deal_id: staging.hubspotDealId,
        hubspot_contact_id: staging.hubspotContactId,
      },
    },
    supabase
  );

  await syncLeadCreatedReminderJobs(lead, supabase);

  await persistExternalMapping({
    tenantId: tid,
    integrationId: iid,
    sourceProvider: SOURCE_PROVIDER,
    sourceEntityType: "deal",
    externalId: staging.hubspotDealId,
    fiEntityType: "opportunity",
    fiEntityId: lead.id,
    stagingRecordType: "hubspot_deal",
    stagingRecordId: sid,
    detail: { person_id: personId },
    supabase,
  });

  const now = new Date().toISOString();
  await supabase
    .from("fi_external_hubspot_deal_staging")
    .update({ import_status: "imported", imported_at: now })
    .eq("id", sid)
    .eq("tenant_id", tid);

  await logHubspotImportAudit({
    integrationId: iid,
    tenantId: tid,
    stagingDealId: sid,
    action: opts?.mergeLeadId ? "deal_merged" : "deal_imported",
    actorAuthUserId: auth.actorAuthUserId,
    actorFiUserId: auth.fiUserId,
    actorLabel: auth.actorLabel,
    detail: { lead_id: lead.id, person_id: personId },
    supabase,
  });

  await logImportAuditEvent({
    tenantId: tid,
    integrationId: iid,
    stagingRecordType: "hubspot_deal",
    stagingRecordId: sid,
    eventKind: opts?.mergeLeadId ? "merge_existing" : "import_completed",
    actorAuthUserId: auth.actorAuthUserId,
    actorFiUserId: auth.fiUserId,
    actorLabel: auth.actorLabel,
    detail: { lead_id: lead.id, person_id: personId },
    supabase,
  });

  return { ok: true, data: { leadId: lead.id, personId } };
}

/** Persist external → FI mapping (insert only; no overwrite). */
export async function persistExternalMapping(params: {
  tenantId: string;
  integrationId: string;
  sourceProvider: string;
  sourceEntityType: string;
  externalId: string;
  fiEntityType: string;
  fiEntityId: string;
  stagingRecordType?: string | null;
  stagingRecordId?: string | null;
  detail?: Record<string, unknown>;
  supabase?: SupabaseClient;
}): Promise<void> {
  const supabase = params.supabase ?? supabaseAdmin();
  const { error } = await supabase.from("fi_external_record_mappings").insert({
    tenant_id: params.tenantId.trim(),
    integration_id: params.integrationId.trim(),
    source_provider: params.sourceProvider,
    source_entity_type: params.sourceEntityType,
    external_id: params.externalId.trim(),
    fi_entity_type: params.fiEntityType,
    fi_entity_id: params.fiEntityId,
    staging_record_type: params.stagingRecordType ?? null,
    staging_record_id: params.stagingRecordId ?? null,
    detail: params.detail ?? {},
  });
  if (error?.code === "23505") return;
  if (error) throw new Error(error.message);

  const entityType =
    params.fiEntityType === "opportunity" || params.fiEntityType === "lead"
      ? "lead"
      : params.fiEntityType === "patient"
        ? "patient"
        : null;
  if (entityType) {
    const r = await supabase.from("fi_external_entity_mappings").insert({
      tenant_id: params.tenantId.trim(),
      source_system: params.sourceProvider === "hubspot" ? "hubspot" : params.sourceProvider,
      entity_type: entityType,
      external_id: params.externalId.trim(),
      internal_id: params.fiEntityId,
    });
    if (r.error?.code !== "23505" && r.error) throw new Error(r.error.message);
  }
}

/** Append-only import audit event. */
export async function logImportAuditEvent(params: {
  tenantId: string;
  integrationId: string;
  stagingRecordType: "hubspot_contact" | "hubspot_deal" | "calendar_event" | null;
  stagingRecordId: string | null;
  eventKind: string;
  actorAuthUserId?: string | null;
  actorFiUserId?: string | null;
  actorLabel?: string | null;
  detail?: Record<string, unknown>;
  supabase?: SupabaseClient;
}): Promise<void> {
  const supabase = params.supabase ?? supabaseAdmin();
  const { error } = await supabase.from("fi_external_import_events").insert({
    tenant_id: params.tenantId.trim(),
    integration_id: params.integrationId.trim(),
    source_provider: SOURCE_PROVIDER,
    staging_record_type: params.stagingRecordType,
    staging_record_id: params.stagingRecordId,
    event_kind: params.eventKind,
    actor_auth_user_id: params.actorAuthUserId ?? null,
    actor_fi_user_id: params.actorFiUserId ?? null,
    actor_label: params.actorLabel ?? null,
    detail: params.detail ?? {},
  });
  if (error) throw new Error(error.message);
}

async function logHubspotImportAudit(params: {
  integrationId: string;
  tenantId: string;
  stagingContactId?: string | null;
  stagingDealId?: string | null;
  action: string;
  actorAuthUserId: string;
  actorFiUserId: string | null;
  actorLabel: string;
  detail: Record<string, unknown>;
  supabase: SupabaseClient;
}): Promise<void> {
  const { error } = await params.supabase.from("fi_external_hubspot_import_audit").insert({
    integration_id: params.integrationId,
    tenant_id: params.tenantId,
    staging_contact_id: params.stagingContactId ?? null,
    staging_deal_id: params.stagingDealId ?? null,
    action: params.action,
    actor_auth_user_id: params.actorAuthUserId,
    actor_fi_user_id: params.actorFiUserId,
    actor_label: params.actorLabel,
    detail: params.detail,
  });
  if (error) throw new Error(error.message);
}

/** Cancel a pending import (logs audit; staging stays approved for retry). */
export async function cancelHubspotImport(
  kind: "contact" | "deal",
  stagingId: string,
  integrationId: string,
  tenantId: string,
  opts?: ServerOpts
): Promise<HubspotImportActionResult> {
  const auth = await resolveWriteAuth(tenantId, opts ?? {});
  if (!auth.ok) return auth;

  const supabase = opts?.supabaseClientForTests ?? supabaseAdmin();
  const tid = tenantId.trim();
  const iid = integrationId.trim();

  await logImportAuditEvent({
    tenantId: tid,
    integrationId: iid,
    stagingRecordType: kind === "contact" ? "hubspot_contact" : "hubspot_deal",
    stagingRecordId: stagingId,
    eventKind: "import_cancelled",
    actorAuthUserId: auth.actorAuthUserId,
    actorFiUserId: auth.fiUserId,
    actorLabel: auth.actorLabel,
    detail: { kind },
    supabase,
  });

  await logHubspotImportAudit({
    integrationId: iid,
    tenantId: tid,
    stagingContactId: kind === "contact" ? stagingId : null,
    stagingDealId: kind === "deal" ? stagingId : null,
    action: kind === "contact" ? "contact_import_cancelled" : "deal_import_cancelled",
    actorAuthUserId: auth.actorAuthUserId,
    actorFiUserId: auth.fiUserId,
    actorLabel: auth.actorLabel,
    detail: {},
    supabase,
  });

  return { ok: true };
}

/** Merge with existing FI person — link mapping without creating duplicate person. */
export async function mergeHubspotContactWithExisting(
  stagingContactId: string,
  integrationId: string,
  tenantId: string,
  existingPersonId: string,
  opts?: ServerOpts
): Promise<HubspotImportActionResult<{ personId: string; leadId: string }>> {
  return createFiLeadFromHubspotContact(stagingContactId, integrationId, tenantId, {
    ...opts,
    mergePersonId: existingPersonId,
  });
}

/** Load HubSpot integration for tenant (first active hubspot connector). */
export async function loadHubspotIntegrationForTenant(
  tenantId: string,
  opts?: ServerOpts
): Promise<HubspotImportActionResult<{ integrationId: string; label: string }>> {
  const auth = await resolveReadAuth(tenantId, { ...opts, allowTenantMemberRead: true });
  if (!auth.ok) return auth;

  const supabase = opts?.supabaseClientForTests ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_tenant_external_integrations")
    .select("id, provider, config")
    .eq("tenant_id", tenantId.trim())
    .eq("provider", "hubspot")
    .neq("status", "disabled")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "No HubSpot connector configured for this tenant." };

  const row = data as { id: string; config: Record<string, unknown> };
  const label = typeof row.config?.label === "string" ? row.config.label : "HubSpot";
  return { ok: true, data: { integrationId: row.id, label } };
}

/** Upsert preview cache for a staging record. */
export async function upsertImportPreviewCache(params: {
  tenantId: string;
  integrationId: string;
  stagingRecordType: "hubspot_contact" | "hubspot_deal";
  stagingRecordId: string;
  previewPayload: Record<string, unknown>;
  duplicateCheckPayload: Record<string, unknown>;
  proposedAction: string;
  supabase?: SupabaseClient;
}): Promise<void> {
  const supabase = params.supabase ?? supabaseAdmin();
  const { error } = await supabase.from("fi_external_import_preview_cache").upsert(
    {
      tenant_id: params.tenantId.trim(),
      integration_id: params.integrationId.trim(),
      source_provider: SOURCE_PROVIDER,
      staging_record_type: params.stagingRecordType,
      staging_record_id: params.stagingRecordId,
      preview_payload: params.previewPayload,
      duplicate_check_payload: params.duplicateCheckPayload,
      proposed_action: params.proposedAction,
      computed_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,integration_id,staging_record_type,staging_record_id" }
  );
  if (error) throw new Error(error.message);
}
