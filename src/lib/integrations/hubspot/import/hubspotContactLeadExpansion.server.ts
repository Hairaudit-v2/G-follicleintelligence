/**
 * FI-HUBSPOT-IMPORT-1E — contact→lead expansion inventory, batching, apply, reconcile.
 * Patient creation is hard-forbidden. Inter-batch reconcile gate is mandatory.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeEmail } from "@/src/lib/fi/foundation/normalize";
import {
  isScientificNotationPhone,
  isTestOrSmokeContact,
  normalizePhoneDigits,
  resolveHubspotContactImportIdentity,
} from "./hubspotImportIdentity";
import { emptyFiIdentitySnapshot } from "./hubspotImportDryRunCore";
import {
  LEAD_VS_PATIENT_POLICY_V1,
  mapHubspotSalesPipelineStageV1,
} from "./hubspotImportMappingV1";
import type { FiIdentitySnapshot, HubspotContactDryRunInput } from "./hubspotImportTypes";
import { HUBSPOT_IMPORT_SOURCE_SYSTEM } from "./hubspotImportTypes";
import { planPersonMetadataEnrichment } from "./hubspotContactLeadFieldPolicy";
import {
  assertExpansionBatchSize,
  assertExpansionMutationAllowlist,
  assertPriorBatchReconciled,
  assertReconciliationBalanced,
  buildBatchReconciliation,
  computeExpansionChecksum,
  detectDuplicateNewLeadRisk,
  filterExpansionRows,
  isApplyableExpansionDecision,
  mapImportDecisionToExpansionState,
  plainLanguageExpansionDecision,
  profileExpansionDataQuality,
  resolveExpansionBatchMax,
  selectNextExpansionBatch,
  summarizeExpansionInventory,
} from "./hubspotContactLeadExpansionCore";
import {
  HUBSPOT_CONTACT_LEAD_EXPANSION_KIND,
  HUBSPOT_CONTACT_LEAD_EXPANSION_MILESTONE,
  HUBSPOT_CONTACT_LEAD_EXPANSION_INITIAL_BATCH_MAX,
  HUBSPOT_CONTACT_LEAD_EXPANSION_EXPANDED_BATCH_MAX,
  HUBSPOT_CONTACT_LEAD_EXPANSION_EXPANDED_MIN_STREAK,
  type HubspotContactLeadBatchReconciliation,
  type HubspotContactLeadDataQualityProfile,
  type HubspotContactLeadExpansionBatchPolicy,
  type HubspotContactLeadExpansionBatchStatus,
  type HubspotContactLeadExpansionDecisionInput,
  type HubspotContactLeadExpansionFilter,
  type HubspotContactLeadExpansionRow,
  type HubspotContactLeadExpansionSummary,
} from "./hubspotContactLeadExpansionTypes";
import { HUBSPOT_CONTACT_LEAD_PILOT_MILESTONE } from "./hubspotContactLeadPilotTypes";

function prop(raw: Record<string, unknown> | null | undefined, ...keys: string[]): string | null {
  if (!raw) return null;
  const props = (raw.properties as Record<string, unknown> | undefined) ?? raw;
  for (const key of keys) {
    const v = props[key];
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return null;
}

async function readNotesWatermark(
  supabase: SupabaseClient,
  tenantId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("fi_external_hubspot_backup_watermarks")
    .select("watermark_timestamp")
    .eq("tenant_id", tenantId)
    .eq("dataset", "notes")
    .maybeSingle();
  if (error) throw new Error(`watermark: ${error.message}`);
  return data ? String((data as { watermark_timestamp: string }).watermark_timestamp) : null;
}

function mapStagingContactRow(row: Record<string, unknown>): HubspotContactDryRunInput & {
  displayName: string;
  phoneDisplay: string | null;
} {
  const r = row as {
    hubspot_contact_id: string;
    email: string | null;
    phone: string | null;
    import_status: string | null;
    raw_payload: Record<string, unknown>;
    tenant_id: string;
    integration_id: string;
    created_at: string;
    updated_at: string;
  };
  const emailNormalized = normalizeEmail(r.email ?? prop(r.raw_payload, "email"));
  const phoneRaw = r.phone ?? prop(r.raw_payload, "phone", "mobilephone");
  const phoneCorrupted = isScientificNotationPhone(phoneRaw);
  const lifecycleStage = prop(r.raw_payload, "lifecyclestage", "lifecycle_stage");
  const first = prop(r.raw_payload, "firstname", "first_name");
  const last = prop(r.raw_payload, "lastname", "last_name");
  const displayName =
    [first, last].filter(Boolean).join(" ").trim() ||
    emailNormalized ||
    `Contact ${r.hubspot_contact_id}`;
  const contactId = String(r.hubspot_contact_id);
  return {
    hubspotContactId: contactId,
    tenantId: String(r.tenant_id),
    integrationId: String(r.integration_id),
    emailNormalized,
    phoneDigits: phoneCorrupted ? null : normalizePhoneDigits(phoneRaw),
    phoneCorrupted,
    hubspotOwnerId: prop(r.raw_payload, "hubspot_owner_id", "owner_id"),
    lifecycleStage,
    leadStatus: prop(r.raw_payload, "hs_lead_status", "lead_status"),
    dealStageLabel: null,
    archived: String(prop(r.raw_payload, "archived") ?? "false").toLowerCase() === "true",
    isTestOrSmoke: isTestOrSmokeContact({
      emailNormalized,
      hubspotContactId: contactId,
      lifecycleStage,
      displayName: [first, last].filter(Boolean).join(" ").trim() || emailNormalized,
    }),
    sourceCreatedAt: prop(r.raw_payload, "createdate") ?? r.created_at,
    sourceUpdatedAt: prop(r.raw_payload, "lastmodifieddate", "hs_lastmodifieddate") ?? r.updated_at,
    importStatus: r.import_status,
    displayName,
    phoneDisplay: phoneCorrupted ? null : phoneRaw?.trim() || null,
  };
}

async function loadAllStagingContacts(
  supabase: SupabaseClient,
  tenantId: string,
  integrationId: string
): Promise<ReturnType<typeof mapStagingContactRow>[]> {
  const pageSize = 1000;
  let offset = 0;
  const byId = new Map<string, ReturnType<typeof mapStagingContactRow>>();
  for (;;) {
    const { data, error } = await supabase
      .from("fi_external_hubspot_contact_staging")
      .select(
        "hubspot_contact_id, email, phone, import_status, raw_payload, tenant_id, integration_id, created_at, updated_at"
      )
      .eq("tenant_id", tenantId)
      .eq("integration_id", integrationId)
      .order("hubspot_contact_id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    for (const row of rows) {
      const mapped = mapStagingContactRow(row as Record<string, unknown>);
      byId.set(mapped.hubspotContactId, mapped);
    }
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return Array.from(byId.values());
}

async function loadContactIdentitySnapshot(
  supabase: SupabaseClient,
  tenantId: string,
  integrationId: string,
  contactIds: string[],
  emails: string[]
): Promise<{ snapshot: FiIdentitySnapshot; appliedContacts: Set<string> }> {
  const snapshot = emptyFiIdentitySnapshot();
  const appliedContacts = new Set<string>();
  const chunk = <T,>(arr: T[], size: number): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  for (const ids of chunk(contactIds, 500)) {
    if (!ids.length) continue;
    const { data: personSrc } = await supabase
      .from("fi_person_source_ids")
      .select("person_id, source_person_id")
      .eq("tenant_id", tenantId)
      .eq("source_system", "hubspot")
      .in("source_person_id", ids);
    for (const row of personSrc ?? []) {
      const r = row as { person_id: string; source_person_id: string };
      snapshot.externalContactToPerson.set(String(r.source_person_id), String(r.person_id));
    }
    const { data: patientSrc } = await supabase
      .from("fi_patient_source_ids")
      .select("patient_id, source_patient_id")
      .eq("tenant_id", tenantId)
      .eq("source_system", "hubspot")
      .in("source_patient_id", ids);
    for (const row of patientSrc ?? []) {
      const r = row as { patient_id: string; source_patient_id: string };
      snapshot.externalContactToPatient.set(String(r.source_patient_id), String(r.patient_id));
    }
    const { data: extMaps } = await supabase
      .from("fi_external_record_mappings")
      .select("external_id, fi_entity_type, fi_entity_id, detail")
      .eq("tenant_id", tenantId)
      .eq("integration_id", integrationId)
      .eq("source_provider", "hubspot")
      .eq("source_entity_type", "contact")
      .in("external_id", ids);
    for (const row of extMaps ?? []) {
      const r = row as {
        external_id: string;
        fi_entity_type: string;
        fi_entity_id: string;
        detail?: { import_batch_id?: string; milestone?: string };
      };
      if (r.fi_entity_type === "person") {
        snapshot.externalContactToPerson.set(String(r.external_id), String(r.fi_entity_id));
      } else if (r.fi_entity_type === "lead") {
        snapshot.externalContactToLead.set(String(r.external_id), String(r.fi_entity_id));
      } else if (r.fi_entity_type === "patient") {
        snapshot.externalContactToPatient.set(String(r.external_id), String(r.fi_entity_id));
      }
      if (
        r.detail?.milestone === HUBSPOT_CONTACT_LEAD_EXPANSION_MILESTONE ||
        r.detail?.milestone === HUBSPOT_CONTACT_LEAD_PILOT_MILESTONE
      ) {
        appliedContacts.add(String(r.external_id));
      }
    }
  }

  const personIds = Array.from(new Set([...snapshot.externalContactToPerson.values()]));
  for (const ems of chunk(emails.filter(Boolean), 500)) {
    if (!ems.length) continue;
    const { data: byEmail } = await supabase
      .from("fi_persons")
      .select("id, metadata")
      .eq("tenant_id", tenantId)
      .in("metadata->>email_normalized", ems)
      .limit(5000);
    for (const row of byEmail ?? []) {
      const id = String((row as { id: string }).id);
      personIds.push(id);
      const meta = (row as { metadata?: { email_normalized?: string } }).metadata;
      const em = normalizeEmail(meta?.email_normalized ?? null);
      if (em) {
        const list = snapshot.emailToPersonIds.get(em) ?? [];
        list.push(id);
        snapshot.emailToPersonIds.set(em, list);
      }
    }
  }

  const uniquePersonIds = Array.from(new Set(personIds));
  for (const pids of chunk(uniquePersonIds, 500)) {
    if (!pids.length) continue;
    const { data: leads } = await supabase
      .from("fi_crm_leads")
      .select("id, person_id, current_stage_id, summary")
      .eq("tenant_id", tenantId)
      .in("person_id", pids)
      .limit(5000);
    const stageIds = Array.from(
      new Set(
        (leads ?? [])
          .map((l) => (l as { current_stage_id?: string | null }).current_stage_id)
          .filter(Boolean) as string[]
      )
    );
    const stageSlug = new Map<string, string>();
    if (stageIds.length) {
      const { data: stages } = await supabase
        .from("fi_crm_pipeline_stages")
        .select("id, slug")
        .eq("tenant_id", tenantId)
        .in("id", stageIds);
      for (const s of stages ?? []) {
        stageSlug.set(String((s as { id: string }).id), String((s as { slug: string }).slug));
      }
    }
    for (const lead of leads ?? []) {
      const r = lead as {
        id: string;
        person_id: string;
        current_stage_id?: string | null;
      };
      const list = snapshot.personToLeadIds.get(String(r.person_id)) ?? [];
      list.push(String(r.id));
      snapshot.personToLeadIds.set(String(r.person_id), list);
      if (r.current_stage_id) {
        const slug = stageSlug.get(String(r.current_stage_id));
        if (slug) snapshot.leadCurrentStageSlug.set(String(r.id), slug);
      }
    }
    const { data: patients } = await supabase
      .from("fi_patients")
      .select("id, person_id")
      .eq("tenant_id", tenantId)
      .in("person_id", pids)
      .limit(5000);
    for (const p of patients ?? []) {
      const r = p as { id: string; person_id: string };
      snapshot.personToPatientId.set(String(r.person_id), String(r.id));
    }
  }

  const { data: staffSrc } = await supabase
    .from("fi_staff_source_ids")
    .select("staff_id, source_staff_id")
    .eq("tenant_id", tenantId)
    .eq("source_system", "hubspot");
  for (const row of staffSrc ?? []) {
    const r = row as { staff_id: string; source_staff_id: string };
    snapshot.externalOwnerToStaff.set(String(r.source_staff_id), {
      staffId: String(r.staff_id),
      isActive: true,
    });
  }

  return { snapshot, appliedContacts };
}

async function loadExpansionBatchPolicy(
  supabase: SupabaseClient,
  tenantId: string
): Promise<HubspotContactLeadExpansionBatchPolicy> {
  const { data } = await supabase
    .from("fi_import_batches")
    .select("id, status, dry_run_report, metadata, imported_at")
    .eq("tenant_id", tenantId)
    .eq("kind", HUBSPOT_CONTACT_LEAD_EXPANSION_KIND)
    .order("imported_at", { ascending: false, nullsFirst: false })
    .limit(20);

  const batches = (data ?? []) as Array<{
    status: string;
    dry_run_report?: { reconciliation?: { balanced?: boolean; unexplained?: number } };
    metadata?: { reconciliation?: { balanced?: boolean; unexplained?: number } };
  }>;

  let streak = 0;
  for (const b of batches) {
    const recon = b.dry_run_report?.reconciliation ?? b.metadata?.reconciliation;
    const ok =
      b.status === "import_completed" &&
      recon?.balanced === true &&
      (recon.unexplained ?? 1) === 0;
    if (ok) streak += 1;
    else break;
  }

  const appliedCount = batches.filter((b) => b.status === "import_completed").length;

  return {
    batchSequence: appliedCount + 1,
    consecutiveReconciledStreak: streak,
    allowExpandedBatchSize:
      streak >= HUBSPOT_CONTACT_LEAD_EXPANSION_EXPANDED_MIN_STREAK,
  };
}

export async function getPriorExpansionBatchGate(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{
  priorBatchId: string | null;
  reconciled: boolean;
  status: string | null;
}> {
  const { data } = await supabase
    .from("fi_import_batches")
    .select("id, status, dry_run_report, metadata")
    .eq("tenant_id", tenantId)
    .eq("kind", HUBSPOT_CONTACT_LEAD_EXPANSION_KIND)
    .in("status", ["import_completed", "import_failed", "importing"])
    .order("imported_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (!data) return { priorBatchId: null, reconciled: true, status: null };
  const b = data as {
    id: string;
    status: string;
    dry_run_report?: { reconciliation?: { balanced?: boolean; unexplained?: number } };
    metadata?: { reconciliation?: { balanced?: boolean; unexplained?: number } };
  };
  const recon = b.dry_run_report?.reconciliation ?? b.metadata?.reconciliation;
  const reconciled =
    b.status === "import_completed" &&
    recon?.balanced === true &&
    (recon.unexplained ?? 1) === 0;
  return { priorBatchId: b.id, reconciled, status: b.status };
}

function buildInventoryRows(
  contacts: ReturnType<typeof mapStagingContactRow>[],
  snapshot: FiIdentitySnapshot,
  appliedContacts: Set<string>,
  decisionByContact: Map<
    string,
    {
      decision_state: HubspotContactLeadExpansionRow["decision"];
      target_lead_id: string | null;
      approved_for_apply: boolean;
      match_evidence: { reason_code?: string; milestone?: string };
      applied_at: string | null;
    }
  >,
  leadLabels: Map<string, string>,
  emailDupes: Set<string>,
  expectedTenantId: string
): HubspotContactLeadExpansionRow[] {
  const rows: HubspotContactLeadExpansionRow[] = [];
  for (const c of contacts) {
    const resolved = resolveHubspotContactImportIdentity(c, snapshot, {
      expectedTenantId,
    });
    const hasExternalLead = snapshot.externalContactToLead.has(c.hubspotContactId);
    const hasPerson = snapshot.externalContactToPerson.has(c.hubspotContactId);
    const saved = decisionByContact.get(c.hubspotContactId);
    const applied =
      Boolean(saved?.applied_at) ||
      saved?.decision_state === "already_applied" ||
      appliedContacts.has(c.hubspotContactId);

    const invalidContact = !c.hubspotContactId.trim();
    const duplicateSource =
      Boolean(c.emailNormalized && emailDupes.has(c.emailNormalized)) &&
      !hasExternalLead &&
      !applied;

    let decision = mapImportDecisionToExpansionState({
      decision: resolved.decision,
      wrongTenant: resolved.wrongTenant,
      hasExternalLeadMapping: hasExternalLead,
      hasPersonSourceId: hasPerson,
      appliedByExpansionOrPilot: applied,
      duplicateSource: false,
      duplicateTarget: resolved.decision === "conflict_multiple_targets",
      invalidContact,
    });

    // Unmapped owner must not block safe identity linking (deferred enrichment).
    if (decision === "quarantine_unmapped_owner" && hasPerson && !hasExternalLead && !applied) {
      decision = "link_existing_lead";
    }

    if (saved?.decision_state === "already_applied" || applied) {
      decision = hasExternalLead || applied ? "already_applied" : decision;
    } else if (saved?.decision_state && saved.match_evidence?.milestone === HUBSPOT_CONTACT_LEAD_EXPANSION_MILESTONE) {
      decision = saved.decision_state;
    }

    if (duplicateSource && decision === "create_new_lead") {
      decision = "quarantine_duplicate_source";
    }

    const ownerMapped = c.hubspotOwnerId
      ? snapshot.externalOwnerToStaff.has(c.hubspotOwnerId)
      : false;
    const stageMap = mapHubspotSalesPipelineStageV1(c.dealStageLabel);
    const proposedLeadId = saved?.target_lead_id ?? resolved.proposedFiEntityId;
    const patientWarning =
      decision === "patient_link_review_required"
        ? "Possible patient relationship needs clinical review. Migration will not create or link patients."
        : null;

    const applyEligible =
      isApplyableExpansionDecision(decision) &&
      decision !== "patient_link_review_required";

    rows.push({
      hubspotContactId: c.hubspotContactId,
      displayName: c.displayName,
      email: c.emailNormalized,
      phone: c.phoneDisplay,
      decision,
      reasonCode: saved?.match_evidence?.reason_code ?? resolved.reasonCode,
      matchEvidence: resolved.reasonCode,
      proposedLeadId,
      proposedLeadLabel: proposedLeadId
        ? leadLabels.get(proposedLeadId) ?? null
        : null,
      hubspotOwnerId: c.hubspotOwnerId,
      ownerResolutionStatus: ownerMapped
        ? "mapped_staff"
        : c.hubspotOwnerId
          ? "unmapped_or_archived"
          : "none_deferred",
      sourceStageLabel: c.dealStageLabel,
      mappedFiStageSlug: stageMap.fiSlug,
      patientProtectionWarning: patientWarning,
      quarantineReason: decision.startsWith("quarantine_")
        ? plainLanguageExpansionDecision(decision)
        : null,
      lastSourceActivityAt: c.sourceUpdatedAt,
      approvedForApply: saved
        ? Boolean(saved.approved_for_apply)
        : applyEligible && decision === "link_existing_lead",
      identityTier: resolved.identityTier,
      applyEligible,
    });
  }
  return rows;
}

export async function buildContactLeadExpansionInventory(
  supabase: SupabaseClient,
  input: { tenantId: string; integrationId: string }
): Promise<{
  summary: HubspotContactLeadExpansionSummary;
  rows: HubspotContactLeadExpansionRow[];
  dataQuality: HubspotContactLeadDataQualityProfile;
  patientCreationForbidden: true;
  deferredEnrichment: { missingOwner: number; missingStage: number };
}> {
  if (LEAD_VS_PATIENT_POLICY_V1.createPatientFromHubspotContact) {
    throw new Error("PATIENT_GUARD: createPatientFromHubspotContact must be false");
  }

  const contacts = await loadAllStagingContacts(
    supabase,
    input.tenantId,
    input.integrationId
  );
  const contactIds = contacts.map((c) => c.hubspotContactId);
  const emails = contacts.map((c) => c.emailNormalized).filter(Boolean) as string[];
  const { snapshot, appliedContacts } = await loadContactIdentitySnapshot(
    supabase,
    input.tenantId,
    input.integrationId,
    contactIds,
    emails
  );

  const { data: decisions } = await supabase
    .from("fi_hubspot_contact_lead_pilot_decisions")
    .select(
      "hubspot_contact_id, decision_state, target_lead_id, approved_for_apply, match_evidence, applied_at"
    )
    .eq("tenant_id", input.tenantId)
    .eq("integration_id", input.integrationId)
    .is("superseded_at", null);

  const decisionByContact = new Map(
    (decisions ?? []).map((d) => [
      String((d as { hubspot_contact_id: string }).hubspot_contact_id),
      d as {
        decision_state: HubspotContactLeadExpansionRow["decision"];
        target_lead_id: string | null;
        approved_for_apply: boolean;
        match_evidence: { reason_code?: string; milestone?: string };
        applied_at: string | null;
      },
    ])
  );

  const emailCounts = new Map<string, number>();
  for (const c of contacts) {
    if (!c.emailNormalized) continue;
    emailCounts.set(c.emailNormalized, (emailCounts.get(c.emailNormalized) ?? 0) + 1);
  }
  const emailDupes = new Set(
    [...emailCounts.entries()].filter(([, n]) => n > 1).map(([e]) => e)
  );

  const leadIds = new Set<string>();
  for (const c of contacts) {
    const resolved = resolveHubspotContactImportIdentity(c, snapshot, {
      expectedTenantId: input.tenantId,
    });
    if (resolved.proposedFiEntityId) leadIds.add(resolved.proposedFiEntityId);
  }
  const leadLabels = new Map<string, string>();
  const leadIdList = Array.from(leadIds);
  for (let i = 0; i < leadIdList.length; i += 500) {
    const slice = leadIdList.slice(i, i + 500);
    const { data: leadRows } = await supabase
      .from("fi_crm_leads")
      .select("id, summary")
      .eq("tenant_id", input.tenantId)
      .in("id", slice);
    for (const l of leadRows ?? []) {
      const r = l as { id: string; summary: string | null };
      leadLabels.set(
        String(r.id),
        r.summary?.trim() || `Lead ${String(r.id).slice(0, 8)}`
      );
    }
  }

  const rows = buildInventoryRows(
    contacts,
    snapshot,
    appliedContacts,
    decisionByContact,
    leadLabels,
    emailDupes,
    input.tenantId
  );
  const dataQuality = profileExpansionDataQuality(rows);
  const missingOwner = rows.filter((r) => !r.hubspotOwnerId).length;
  const missingStage = rows.filter((r) => !r.sourceStageLabel).length;

  return {
    summary: summarizeExpansionInventory(rows),
    rows,
    dataQuality,
    patientCreationForbidden: true,
    deferredEnrichment: { missingOwner, missingStage },
  };
}

export async function loadContactLeadExpansionWorkspace(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    integrationId: string;
    filter?: HubspotContactLeadExpansionFilter;
    search?: string;
  }
): Promise<{
  summary: HubspotContactLeadExpansionSummary;
  rows: HubspotContactLeadExpansionRow[];
  filter: HubspotContactLeadExpansionFilter;
  dataQuality: HubspotContactLeadDataQualityProfile;
  batchPolicy: HubspotContactLeadExpansionBatchPolicy;
  batchMax: number;
  priorGate: { priorBatchId: string | null; reconciled: boolean; status: string | null };
  patientCreationForbidden: true;
}> {
  const inventory = await buildContactLeadExpansionInventory(supabase, input);
  const filter = input.filter ?? "all";
  let filtered = filterExpansionRows(inventory.rows, filter);
  if (input.search?.trim()) {
    const q = input.search.trim().toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.displayName.toLowerCase().includes(q) ||
        (r.email ?? "").includes(q) ||
        r.hubspotContactId.includes(q) ||
        (r.proposedLeadLabel ?? "").toLowerCase().includes(q)
    );
  }
  const batchPolicy = await loadExpansionBatchPolicy(supabase, input.tenantId);
  const priorGate = await getPriorExpansionBatchGate(supabase, input.tenantId);

  return {
    summary: inventory.summary,
    rows: filtered,
    filter,
    dataQuality: inventory.dataQuality,
    batchPolicy,
    batchMax: resolveExpansionBatchMax(batchPolicy),
    priorGate,
    patientCreationForbidden: true,
  };
}

export async function saveContactLeadExpansionDecision(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    integrationId: string;
    decision: HubspotContactLeadExpansionDecisionInput;
    operatorFiUserId: string | null;
    matchEvidence?: Record<string, unknown>;
  }
): Promise<{ decisionId: string }> {
  const { data: prior } = await supabase
    .from("fi_hubspot_contact_lead_pilot_decisions")
    .select("id")
    .eq("tenant_id", input.tenantId)
    .eq("integration_id", input.integrationId)
    .eq("hubspot_contact_id", input.decision.hubspotContactId)
    .is("superseded_at", null)
    .maybeSingle();
  if (prior) {
    await supabase
      .from("fi_hubspot_contact_lead_pilot_decisions")
      .update({ superseded_at: new Date().toISOString() })
      .eq("id", String((prior as { id: string }).id));
  }

  assertExpansionMutationAllowlist("fi_hubspot_contact_lead_pilot_decisions", "insert");
  const { data: inserted, error } = await supabase
    .from("fi_hubspot_contact_lead_pilot_decisions")
    .insert({
      tenant_id: input.tenantId,
      integration_id: input.integrationId,
      hubspot_contact_id: input.decision.hubspotContactId,
      decision_state: input.decision.decision,
      target_lead_id: input.decision.targetLeadId ?? null,
      approved_for_apply: Boolean(input.decision.approvedForApply),
      match_evidence: {
        milestone: HUBSPOT_CONTACT_LEAD_EXPANSION_MILESTONE,
        ...(input.matchEvidence ?? {}),
      },
      operator_fi_user_id: input.operatorFiUserId,
      operator_note: input.decision.operatorNote ?? null,
      previous_decision_id: prior ? String((prior as { id: string }).id) : null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { decisionId: String((inserted as { id: string }).id) };
}

export async function selectAndPersistExpansionBatch(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    integrationId: string;
    maxSize?: number;
    operatorLabel?: string;
  }
): Promise<{
  selected: HubspotContactLeadExpansionRow[];
  batchMax: number;
  batchSequence: number;
  summary: HubspotContactLeadExpansionSummary;
}> {
  const priorGate = await getPriorExpansionBatchGate(supabase, input.tenantId);
  assertPriorBatchReconciled({
    priorBatch: priorGate.priorBatchId
      ? {
          status: priorGate.status ?? "import_completed",
          reconciliation: priorGate.reconciled
            ? { balanced: true, unexplained: 0 }
            : { balanced: false, unexplained: 1 },
        }
      : null,
  });

  const inventory = await buildContactLeadExpansionInventory(supabase, input);
  const policy = await loadExpansionBatchPolicy(supabase, input.tenantId);
  const batchMax = Math.min(
    input.maxSize ?? resolveExpansionBatchMax(policy),
    resolveExpansionBatchMax(policy)
  );
  const selected = selectNextExpansionBatch(inventory.rows, batchMax);

  for (const row of selected) {
    await saveContactLeadExpansionDecision(supabase, {
      tenantId: input.tenantId,
      integrationId: input.integrationId,
      operatorFiUserId: null,
      decision: {
        hubspotContactId: row.hubspotContactId,
        decision: row.decision,
        approvedForApply: true,
        targetLeadId: row.proposedLeadId,
        operatorNote: `1E auto-selected expansion batch E${policy.batchSequence}`,
      },
      matchEvidence: {
        milestone: HUBSPOT_CONTACT_LEAD_EXPANSION_MILESTONE,
        expansion_batch_seq: policy.batchSequence,
        reason_code: row.reasonCode,
        match_evidence: row.matchEvidence,
        identity_tier: row.identityTier,
        actor_label: input.operatorLabel ?? "1e-select",
      },
    });
  }

  return {
    selected,
    batchMax,
    batchSequence: policy.batchSequence,
    summary: summarizeExpansionInventory(inventory.rows),
  };
}

export async function previewContactLeadExpansionBatch(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    integrationId: string;
    operatorLabel?: string;
    maxSize?: number;
  }
): Promise<{
  batchId: string;
  checksum: string;
  links: Array<{ hubspotContactId: string; leadId: string; displayName: string }>;
  creates: Array<{ hubspotContactId: string; displayName: string }>;
  quarantined: number;
  patientReviewsExcluded: number;
  dataQuality: HubspotContactLeadDataQualityProfile;
  batchStatus: HubspotContactLeadExpansionBatchStatus;
  plainLanguage: {
    primaryAction: string;
    patientsStaffUsersNotificationsUnchanged: true;
    tablesThatMayChange: string[];
  };
}> {
  const priorGate = await getPriorExpansionBatchGate(supabase, input.tenantId);
  assertPriorBatchReconciled({
    priorBatch: priorGate.priorBatchId
      ? {
          status: priorGate.status ?? "import_completed",
          reconciliation: priorGate.reconciled
            ? { balanced: true, unexplained: 0 }
            : { balanced: false, unexplained: 1 },
        }
      : null,
  });

  const inventory = await buildContactLeadExpansionInventory(supabase, input);
  const policy = await loadExpansionBatchPolicy(supabase, input.tenantId);
  const max = Math.min(
    input.maxSize ?? resolveExpansionBatchMax(policy),
    resolveExpansionBatchMax(policy)
  );

  // Prefer already-persisted approved expansion decisions for this sequence.
  const approvedPersisted = inventory.rows.filter(
    (r) =>
      r.approvedForApply &&
      isApplyableExpansionDecision(r.decision) &&
      r.decision !== "patient_link_review_required" &&
      r.decision !== "already_applied"
  );
  let approved =
    approvedPersisted.length > 0 && approvedPersisted.length <= max
      ? approvedPersisted.slice(0, max)
      : selectNextExpansionBatch(inventory.rows, max);

  // If nothing persisted yet, select and use that set.
  if (approvedPersisted.length === 0) {
    const selected = await selectAndPersistExpansionBatch(supabase, {
      ...input,
      maxSize: max,
    });
    approved = selected.selected;
  }

  assertExpansionBatchSize(approved.length, policy);

  if (
    detectDuplicateNewLeadRisk(
      approved.map((r) => ({
        email: r.email,
        displayName: r.displayName,
        decision: r.decision,
      }))
    )
  ) {
    throw new Error("APPLY_GUARD: duplicate new-lead creation risk — review required");
  }

  const links = approved
    .filter((r) => r.decision === "link_existing_lead" || r.decision === "already_linked")
    .filter((r) => r.proposedLeadId)
    .map((r) => ({
      hubspotContactId: r.hubspotContactId,
      leadId: r.proposedLeadId!,
      displayName: r.displayName,
    }));
  const creates = approved
    .filter((r) => r.decision === "create_new_lead")
    .map((r) => ({
      hubspotContactId: r.hubspotContactId,
      displayName: r.displayName,
    }));

  if (approved.some((r) => r.decision === "patient_link_review_required")) {
    throw new Error("APPLY_GUARD: patient-link review records cannot be applied in 1E");
  }

  const checksum = computeExpansionChecksum(
    approved.map((r) => ({
      hubspotContactId: r.hubspotContactId,
      decision: r.decision,
      proposedLeadId: r.proposedLeadId,
    }))
  );

  assertExpansionMutationAllowlist("fi_import_batches", "insert");
  const { data: batch, error } = await supabase
    .from("fi_import_batches")
    .insert({
      tenant_id: input.tenantId,
      source_system: HUBSPOT_IMPORT_SOURCE_SYSTEM,
      kind: HUBSPOT_CONTACT_LEAD_EXPANSION_KIND,
      status: "dry_run_passed",
      dry_run_passed: true,
      dry_run_at: new Date().toISOString(),
      dry_run_report: {
        milestone: HUBSPOT_CONTACT_LEAD_EXPANSION_MILESTONE,
        checksum,
        links,
        creates,
        approved: approved.map((r) => ({
          hubspotContactId: r.hubspotContactId,
          decision: r.decision,
          leadId: r.proposedLeadId,
          reasonCode: r.reasonCode,
        })),
        dataQuality: inventory.dataQuality,
        patientCreationForbidden: true,
        sideEffectSuppression: true,
        batchSequence: policy.batchSequence,
        batchMax: max,
      },
      row_count: approved.length,
      imported_row_count: 0,
      metadata: {
        milestone: HUBSPOT_CONTACT_LEAD_EXPANSION_MILESTONE,
        integration_id: input.integrationId,
        checksum,
        actor_label: input.operatorLabel ?? "1e-preview",
        batch_status: "approved" satisfies HubspotContactLeadExpansionBatchStatus,
      },
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  return {
    batchId: String((batch as { id: string }).id),
    checksum,
    links,
    creates,
    quarantined: inventory.summary.quarantined,
    patientReviewsExcluded: inventory.summary.patientReview,
    dataQuality: inventory.dataQuality,
    batchStatus: "approved",
    plainLanguage: {
      primaryAction: "Apply approved batch",
      patientsStaffUsersNotificationsUnchanged: true,
      tablesThatMayChange: [
        "fi_import_batches",
        "fi_external_record_mappings",
        "fi_hubspot_contact_lead_pilot_decisions",
        ...(creates.length ? ["fi_persons", "fi_person_source_ids", "fi_crm_leads"] : []),
      ],
    },
  };
}

export async function applyContactLeadExpansionBatch(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    integrationId: string;
    approvedBatchId: string;
    confirmToken: string;
    expectedChecksum: string;
    actorLabel?: string;
  }
): Promise<{
  ok: boolean;
  linked: number;
  created: number;
  alreadyApplied: number;
  mode: "apply" | "replay";
  newLeadIds: string[];
  mappingIds: string[];
  watermarkBefore: string | null;
  watermarkAfter: string | null;
  leadCountBefore: number;
  leadCountAfter: number;
  patientCountBefore: number;
  patientCountAfter: number;
  sideEffects: string[];
}> {
  if (input.confirmToken !== input.approvedBatchId) {
    throw new Error("APPLY_GUARD: confirmation must equal the approved batch id");
  }
  if (LEAD_VS_PATIENT_POLICY_V1.createPatientFromHubspotContact) {
    throw new Error("PATIENT_GUARD: createPatientFromHubspotContact must be false");
  }

  const priorGate = await getPriorExpansionBatchGate(supabase, input.tenantId);
  // Allow applying the current dry_run_passed batch; block only if a *different* prior is unreconciled.
  if (
    priorGate.priorBatchId &&
    priorGate.priorBatchId !== input.approvedBatchId &&
    !priorGate.reconciled
  ) {
    assertPriorBatchReconciled({
      priorBatch: {
        status: priorGate.status ?? "import_completed",
        reconciliation: { balanced: false, unexplained: 1 },
      },
    });
  }

  const watermarkBefore = await readNotesWatermark(supabase, input.tenantId);
  const countTable = async (table: string) => {
    const { count, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", input.tenantId);
    if (error) throw new Error(error.message);
    return count ?? 0;
  };
  const leadCountBefore = await countTable("fi_crm_leads");
  const patientCountBefore = await countTable("fi_patients");

  const { data: batch, error } = await supabase
    .from("fi_import_batches")
    .select("id, tenant_id, kind, status, dry_run_report, metadata, imported_row_count")
    .eq("id", input.approvedBatchId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!batch) throw new Error("Approved batch not found");
  const b = batch as {
    id: string;
    tenant_id: string;
    kind: string;
    status: string;
    dry_run_report: {
      checksum?: string;
      batchSequence?: number;
      /** Written by previewContactLeadExpansionBatch — used to restore batch-size policy on apply. */
      batchMax?: number;
      approved?: Array<{
        hubspotContactId: string;
        decision: string;
        leadId?: string | null;
        reasonCode?: string;
      }>;
    };
    metadata: Record<string, unknown>;
    imported_row_count: number;
  };
  if (b.tenant_id !== input.tenantId) throw new Error("APPLY_GUARD: tenant mismatch");
  if (b.kind !== HUBSPOT_CONTACT_LEAD_EXPANSION_KIND) {
    throw new Error(`APPLY_GUARD: unexpected kind ${b.kind}`);
  }
  const checksum = String(b.dry_run_report?.checksum ?? b.metadata.checksum ?? "");
  if (!checksum || checksum !== input.expectedChecksum) {
    throw new Error("APPLY_GUARD: preview has changed since approval (checksum mismatch)");
  }
  const approved = b.dry_run_report.approved ?? [];
  const previewBatchMax = b.dry_run_report.batchMax;
  const policy: HubspotContactLeadExpansionBatchPolicy = {
    batchSequence: b.dry_run_report.batchSequence ?? 1,
    consecutiveReconciledStreak: 0,
    allowExpandedBatchSize:
      (previewBatchMax ?? 0) >= HUBSPOT_CONTACT_LEAD_EXPANSION_EXPANDED_BATCH_MAX,
  };
  assertExpansionBatchSize(approved.length, policy, previewBatchMax);

  let linked = 0;
  let created = 0;
  let alreadyApplied = 0;
  const newLeadIds: string[] = [];
  const mappingIds: string[] = [];
  const sideEffects: string[] = [];

  const { data: entryStage } = await supabase
    .from("fi_crm_pipeline_stages")
    .select("id")
    .eq("tenant_id", input.tenantId)
    .eq("is_entry", true)
    .limit(1)
    .maybeSingle();
  const entryStageId = entryStage ? String((entryStage as { id: string }).id) : null;

  assertExpansionMutationAllowlist("fi_import_batches", "update");
  await supabase.from("fi_import_batches").update({ status: "importing" }).eq("id", b.id);

  try {
    for (const item of approved) {
      if (item.decision === "patient_link_review_required") {
        throw new Error("PATIENT_GUARD: patient-link review cannot be applied");
      }

      if (item.decision === "already_linked" || item.decision === "link_existing_lead") {
        const leadId = item.leadId ? String(item.leadId) : "";
        if (!leadId) throw new Error(`APPLY_GUARD: missing lead for ${item.hubspotContactId}`);

        const { data: lead } = await supabase
          .from("fi_crm_leads")
          .select("id, tenant_id, person_id")
          .eq("id", leadId)
          .maybeSingle();
        if (!lead || String((lead as { tenant_id: string }).tenant_id) !== input.tenantId) {
          throw new Error("APPLY_GUARD: cross-tenant or missing lead");
        }

        const { data: existingMap } = await supabase
          .from("fi_external_record_mappings")
          .select("id, fi_entity_id")
          .eq("tenant_id", input.tenantId)
          .eq("integration_id", input.integrationId)
          .eq("source_provider", "hubspot")
          .eq("source_entity_type", "contact")
          .eq("external_id", item.hubspotContactId)
          .maybeSingle();

        if (existingMap) {
          const em = existingMap as { id: string; fi_entity_id: string };
          if (String(em.fi_entity_id) !== leadId) {
            throw new Error("APPLY_GUARD: source contact already maps to another target");
          }
          alreadyApplied += 1;
          mappingIds.push(String(em.id));
        } else {
          assertExpansionMutationAllowlist("fi_external_record_mappings", "insert");
          const { data: ins, error: insErr } = await supabase
            .from("fi_external_record_mappings")
            .insert({
              tenant_id: input.tenantId,
              integration_id: input.integrationId,
              source_provider: "hubspot",
              source_entity_type: "contact",
              external_id: item.hubspotContactId,
              fi_entity_type: "lead",
              fi_entity_id: leadId,
              staging_record_type: "hubspot_contact",
              detail: {
                milestone: HUBSPOT_CONTACT_LEAD_EXPANSION_MILESTONE,
                import_batch_id: b.id,
                action: "link_existing_lead",
                reason_code: item.reasonCode ?? "deterministic_link",
                actor_label: input.actorLabel ?? "1e-apply",
                patient_creation: false,
              },
            })
            .select("id")
            .single();
          if (insErr) throw new Error(insErr.message);
          mappingIds.push(String((ins as { id: string }).id));
          linked += 1;

          const personId = String((lead as { person_id: string }).person_id);
          const { data: person } = await supabase
            .from("fi_persons")
            .select("id, metadata")
            .eq("id", personId)
            .maybeSingle();
          if (person) {
            const meta = ((person as { metadata?: Record<string, unknown> }).metadata ??
              {}) as Record<string, unknown>;
            const { data: staging } = await supabase
              .from("fi_external_hubspot_contact_staging")
              .select("email, phone, raw_payload")
              .eq("tenant_id", input.tenantId)
              .eq("hubspot_contact_id", item.hubspotContactId)
              .maybeSingle();
            const raw = (staging as { raw_payload?: Record<string, unknown> } | null)?.raw_payload;
            const planned = planPersonMetadataEnrichment({
              existing: meta,
              sourceFirstName: prop(raw, "firstname", "first_name"),
              sourceLastName: prop(raw, "lastname", "last_name"),
              sourceEmailNormalized: normalizeEmail(
                (staging as { email?: string } | null)?.email ?? prop(raw, "email")
              ),
              sourcePhone: (staging as { phone?: string } | null)?.phone ?? prop(raw, "phone"),
            });
            if (planned.changedKeys.length) {
              assertExpansionMutationAllowlist("fi_persons", "update");
              await supabase
                .from("fi_persons")
                .update({
                  metadata: {
                    ...planned.next,
                    hubspot_import_1e: {
                      import_batch_id: b.id,
                      enriched_keys: planned.changedKeys,
                    },
                  },
                })
                .eq("id", personId)
                .eq("tenant_id", input.tenantId);
            }
          }
        }

        await supabase
          .from("fi_hubspot_contact_lead_pilot_decisions")
          .update({
            decision_state: "already_applied",
            applied_at: new Date().toISOString(),
            import_batch_id: b.id,
            target_lead_id: leadId,
          })
          .eq("tenant_id", input.tenantId)
          .eq("integration_id", input.integrationId)
          .eq("hubspot_contact_id", item.hubspotContactId)
          .is("superseded_at", null);
        continue;
      }

      if (item.decision === "create_new_lead") {
        const { data: existingPersonSrc } = await supabase
          .from("fi_person_source_ids")
          .select("person_id")
          .eq("tenant_id", input.tenantId)
          .eq("source_system", "hubspot")
          .eq("source_person_id", item.hubspotContactId)
          .maybeSingle();
        if (existingPersonSrc) {
          throw new Error(
            `APPLY_GUARD: contact ${item.hubspotContactId} already has person source — cannot create new lead`
          );
        }

        const { data: staging } = await supabase
          .from("fi_external_hubspot_contact_staging")
          .select("email, phone, raw_payload")
          .eq("tenant_id", input.tenantId)
          .eq("hubspot_contact_id", item.hubspotContactId)
          .maybeSingle();
        const raw = (staging as { raw_payload?: Record<string, unknown> } | null)?.raw_payload;
        const email = normalizeEmail(
          (staging as { email?: string } | null)?.email ?? prop(raw, "email")
        );
        const first = prop(raw, "firstname", "first_name");
        const last = prop(raw, "lastname", "last_name");
        if (!item.hubspotContactId.trim() || (!email && !first && !last)) {
          throw new Error("APPLY_GUARD: new lead lacks minimum identity");
        }

        assertExpansionMutationAllowlist("fi_persons", "insert");
        const { data: personIns, error: pErr } = await supabase
          .from("fi_persons")
          .insert({
            tenant_id: input.tenantId,
            metadata: {
              first_name: first,
              last_name: last,
              email_normalized: email,
              phone: (staging as { phone?: string } | null)?.phone ?? prop(raw, "phone"),
              import_batch_id: b.id,
              hubspot: {
                contact_id: item.hubspotContactId,
                milestone: HUBSPOT_CONTACT_LEAD_EXPANSION_MILESTONE,
              },
            },
          })
          .select("id")
          .single();
        if (pErr) throw new Error(pErr.message);
        const personId = String((personIns as { id: string }).id);

        assertExpansionMutationAllowlist("fi_person_source_ids", "insert");
        const { error: psErr } = await supabase.from("fi_person_source_ids").insert({
          tenant_id: input.tenantId,
          person_id: personId,
          source_system: "hubspot",
          source_person_id: item.hubspotContactId,
        });
        if (psErr) throw new Error(psErr.message);

        if (!entryStageId) throw new Error("APPLY_GUARD: no entry pipeline stage for tenant");
        assertExpansionMutationAllowlist("fi_crm_leads", "insert");
        const summary =
          [first, last].filter(Boolean).join(" ").trim() ||
          email ||
          `HubSpot ${item.hubspotContactId}`;
        const { data: leadIns, error: lErr } = await supabase
          .from("fi_crm_leads")
          .insert({
            tenant_id: input.tenantId,
            organisation_id: null,
            clinic_id: null,
            person_id: personId,
            patient_id: null,
            case_id: null,
            current_stage_id: entryStageId,
            primary_owner_user_id: null,
            status: "open",
            priority: null,
            summary,
            metadata: {
              import_batch_id: b.id,
              milestone: HUBSPOT_CONTACT_LEAD_EXPANSION_MILESTONE,
              hubspot_contact_id: item.hubspotContactId,
              patient_creation: false,
              side_effects_suppressed: true,
            },
          })
          .select("id")
          .single();
        if (lErr) throw new Error(lErr.message);
        const leadId = String((leadIns as { id: string }).id);
        newLeadIds.push(leadId);

        assertExpansionMutationAllowlist("fi_external_record_mappings", "insert");
        const { data: mapIns, error: mErr } = await supabase
          .from("fi_external_record_mappings")
          .insert({
            tenant_id: input.tenantId,
            integration_id: input.integrationId,
            source_provider: "hubspot",
            source_entity_type: "contact",
            external_id: item.hubspotContactId,
            fi_entity_type: "lead",
            fi_entity_id: leadId,
            staging_record_type: "hubspot_contact",
            detail: {
              milestone: HUBSPOT_CONTACT_LEAD_EXPANSION_MILESTONE,
              import_batch_id: b.id,
              action: "create_new_lead",
              actor_label: input.actorLabel ?? "1e-apply",
              patient_creation: false,
            },
          })
          .select("id")
          .single();
        if (mErr) throw new Error(mErr.message);
        mappingIds.push(String((mapIns as { id: string }).id));
        created += 1;

        await supabase
          .from("fi_hubspot_contact_lead_pilot_decisions")
          .update({
            decision_state: "already_applied",
            applied_at: new Date().toISOString(),
            import_batch_id: b.id,
            target_lead_id: leadId,
          })
          .eq("tenant_id", input.tenantId)
          .eq("integration_id", input.integrationId)
          .eq("hubspot_contact_id", item.hubspotContactId)
          .is("superseded_at", null);
        continue;
      }

      throw new Error(`APPLY_GUARD: unsupported decision ${item.decision}`);
    }

    assertExpansionMutationAllowlist("fi_import_batches", "update");
    const watermarkAfterInner = await readNotesWatermark(supabase, input.tenantId);
    const leadCountAfterInner = await countTable("fi_crm_leads");
    const patientCountAfterInner = await countTable("fi_patients");
    if (patientCountAfterInner !== patientCountBefore) {
      throw new Error("PATIENT_GUARD: patient count changed during 1E apply — fail closed");
    }
    if (watermarkAfterInner !== watermarkBefore) {
      throw new Error("WATERMARK_GUARD: backup watermark changed during 1E apply");
    }

    await supabase
      .from("fi_import_batches")
      .update({
        status: "import_completed",
        imported_at: new Date().toISOString(),
        imported_row_count: linked + created,
        metadata: {
          ...b.metadata,
          linked,
          created,
          already_applied: alreadyApplied,
          mapping_ids: mappingIds,
          new_lead_ids: newLeadIds,
          patient_creation: false,
          side_effects: sideEffects,
          watermark_before: watermarkBefore,
          watermark_after: watermarkAfterInner,
          lead_count_before: leadCountBefore,
          lead_count_after: leadCountAfterInner,
          patient_count_before: patientCountBefore,
          patient_count_after: patientCountAfterInner,
          batch_status: "applied" satisfies HubspotContactLeadExpansionBatchStatus,
        },
      })
      .eq("id", b.id);
  } catch (err) {
    await supabase
      .from("fi_import_batches")
      .update({
        status: "import_failed",
        metadata: {
          ...b.metadata,
          apply_error: err instanceof Error ? err.message : String(err),
          batch_status: "blocked" satisfies HubspotContactLeadExpansionBatchStatus,
        },
      })
      .eq("id", b.id);
    throw err;
  }

  const watermarkAfter = await readNotesWatermark(supabase, input.tenantId);
  const leadCountAfter = await countTable("fi_crm_leads");
  const patientCountAfter = await countTable("fi_patients");

  const mode: "apply" | "replay" =
    linked === 0 && created === 0 && alreadyApplied === approved.length ? "replay" : "apply";

  return {
    ok: true,
    linked,
    created,
    alreadyApplied,
    mode,
    newLeadIds,
    mappingIds,
    watermarkBefore,
    watermarkAfter,
    leadCountBefore,
    leadCountAfter,
    patientCountBefore,
    patientCountAfter,
    sideEffects,
  };
}

export async function reconcileContactLeadExpansionBatch(
  supabase: SupabaseClient,
  input: { tenantId: string; batchId: string }
): Promise<HubspotContactLeadBatchReconciliation> {
  const { data: batch, error } = await supabase
    .from("fi_import_batches")
    .select("id, tenant_id, kind, status, dry_run_report, metadata")
    .eq("id", input.batchId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!batch) throw new Error("RECONCILE: batch not found");
  const b = batch as {
    id: string;
    tenant_id: string;
    kind: string;
    status: string;
    dry_run_report: {
      approved?: unknown[];
      checksum?: string;
      reconciliation?: HubspotContactLeadBatchReconciliation;
    };
    metadata: {
      linked?: number;
      created?: number;
      already_applied?: number;
      side_effects?: string[];
      watermark_before?: string | null;
      watermark_after?: string | null;
      lead_count_before?: number;
      lead_count_after?: number;
      patient_count_before?: number;
      patient_count_after?: number;
    };
  };
  if (b.tenant_id !== input.tenantId) throw new Error("RECONCILE: tenant mismatch");
  if (b.kind !== HUBSPOT_CONTACT_LEAD_EXPANSION_KIND) throw new Error("RECONCILE: wrong kind");
  if (b.status !== "import_completed") {
    throw new Error(`RECONCILE: batch status ${b.status} is not apply-complete`);
  }

  const approvedRecords = (b.dry_run_report.approved ?? []).length;
  const watermark = await readNotesWatermark(supabase, input.tenantId);
  const countTable = async (table: string) => {
    const { count, error: cErr } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", input.tenantId);
    if (cErr) throw new Error(cErr.message);
    return count ?? 0;
  };

  const linked = b.metadata.linked ?? 0;
  const created = b.metadata.created ?? 0;
  const alreadyApplied = b.metadata.already_applied ?? 0;

  const recon = buildBatchReconciliation({
    batchId: b.id,
    approvedRecords,
    appliedMappings: linked,
    newLeads: created,
    alreadyApplied,
    quarantined: 0,
    excluded: 0,
    failedClosed: 0,
    leadCountBefore: b.metadata.lead_count_before ?? (await countTable("fi_crm_leads")) - created,
    leadCountAfter: b.metadata.lead_count_after ?? (await countTable("fi_crm_leads")),
    patientCountBefore: b.metadata.patient_count_before ?? (await countTable("fi_patients")),
    patientCountAfter: b.metadata.patient_count_after ?? (await countTable("fi_patients")),
    sideEffects: b.metadata.side_effects ?? [],
    watermarkBefore: b.metadata.watermark_before ?? watermark,
    watermarkAfter: b.metadata.watermark_after ?? watermark,
  });

  assertReconciliationBalanced(recon);

  assertExpansionMutationAllowlist("fi_import_batches", "update");
  await supabase
    .from("fi_import_batches")
    .update({
      // Keep DB status import_completed; reconciliation lives in report/metadata.
      dry_run_report: {
        ...b.dry_run_report,
        reconciliation: recon,
      },
      metadata: {
        ...b.metadata,
        reconciliation: recon,
        batch_status: "reconciled" satisfies HubspotContactLeadExpansionBatchStatus,
      },
    })
    .eq("id", b.id);

  return recon;
}

export async function previewRollbackContactLeadExpansionBatch(
  supabase: SupabaseClient,
  input: { tenantId: string; batchId: string }
): Promise<{
  ok: boolean;
  removableMappings: Array<{ id: string; hubspotContactId: string; leadId: string }>;
  newLeadsEligible: Array<{ leadId: string }>;
  blockedLeads: Array<{ leadId: string; reason: string }>;
  watermark: string | null;
}> {
  const { data: batch } = await supabase
    .from("fi_import_batches")
    .select("id, tenant_id, kind, metadata")
    .eq("id", input.batchId)
    .maybeSingle();
  if (!batch) throw new Error("ROLLBACK_PREVIEW: batch not found");
  const b = batch as {
    id: string;
    tenant_id: string;
    kind: string;
    metadata: { new_lead_ids?: string[]; mapping_ids?: string[] };
  };
  if (b.tenant_id !== input.tenantId) throw new Error("ROLLBACK_PREVIEW: tenant mismatch");
  if (b.kind !== HUBSPOT_CONTACT_LEAD_EXPANSION_KIND) {
    throw new Error("ROLLBACK_PREVIEW: wrong kind");
  }

  const { data: maps } = await supabase
    .from("fi_external_record_mappings")
    .select("id, external_id, fi_entity_id, detail")
    .eq("tenant_id", input.tenantId)
    .eq("source_provider", "hubspot")
    .eq("source_entity_type", "contact")
    .contains("detail", { import_batch_id: input.batchId });

  const removableMappings = (maps ?? []).map((m) => {
    const r = m as { id: string; external_id: string; fi_entity_id: string };
    return {
      id: String(r.id),
      hubspotContactId: String(r.external_id),
      leadId: String(r.fi_entity_id),
    };
  });

  const newLeadsEligible: Array<{ leadId: string }> = [];
  const blockedLeads: Array<{ leadId: string; reason: string }> = [];
  for (const leadId of b.metadata.new_lead_ids ?? []) {
    const { data: lead } = await supabase
      .from("fi_crm_leads")
      .select("id, patient_id, metadata")
      .eq("id", leadId)
      .maybeSingle();
    if (!lead) {
      blockedLeads.push({ leadId, reason: "lead_missing" });
      continue;
    }
    if ((lead as { patient_id: string | null }).patient_id) {
      blockedLeads.push({ leadId, reason: "has_patient_link" });
      continue;
    }
    const meta = (lead as { metadata?: { import_batch_id?: string } }).metadata;
    if (meta?.import_batch_id !== input.batchId) {
      blockedLeads.push({ leadId, reason: "adopted_or_not_batch_owned" });
      continue;
    }
    newLeadsEligible.push({ leadId });
  }

  await supabase
    .from("fi_import_batches")
    .update({
      metadata: {
        ...b.metadata,
        batch_status: "rollback_preview_ready" satisfies HubspotContactLeadExpansionBatchStatus,
      },
    })
    .eq("id", input.batchId);

  return {
    ok: blockedLeads.length === 0,
    removableMappings,
    newLeadsEligible,
    blockedLeads,
    watermark: await readNotesWatermark(supabase, input.tenantId),
  };
}

/** Re-export initial max for CLI convenience. */
export { HUBSPOT_CONTACT_LEAD_EXPANSION_INITIAL_BATCH_MAX };
