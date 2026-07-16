/**
 * FI-HUBSPOT-IMPORT-1D — contact→lead pilot workspace, preview, apply, rollback preview.
 * Patient creation is hard-forbidden. Side-effect suppressors: no reminders/notifications.
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
import {
  assertContactLeadMutationAllowlist,
  assertPilotBatchSize,
  computeContactLeadPilotChecksum,
  filterPilotRows,
  isApplyablePilotDecision,
  mapImportDecisionToPilotState,
  plainLanguageDecision,
  selectContactLeadPilotCohort,
  summarizePilotRows,
} from "./hubspotContactLeadPilotCore";
import { planPersonMetadataEnrichment } from "./hubspotContactLeadFieldPolicy";
import {
  HUBSPOT_CONTACT_LEAD_PILOT_BATCH_MAX,
  HUBSPOT_CONTACT_LEAD_PILOT_KIND,
  HUBSPOT_CONTACT_LEAD_PILOT_MILESTONE,
  type HubspotContactLeadPilotDecisionInput,
  type HubspotContactLeadPilotFilter,
  type HubspotContactLeadPilotRow,
  type HubspotContactLeadPilotSummary,
} from "./hubspotContactLeadPilotTypes";

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
    [first, last].filter(Boolean).join(" ").trim() || emailNormalized || `Contact ${r.hubspot_contact_id}`;
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

async function loadContactIdentitySnapshot(
  supabase: SupabaseClient,
  tenantId: string,
  integrationId: string,
  contactIds: string[],
  emails: string[]
): Promise<{ snapshot: FiIdentitySnapshot; pilotAppliedContacts: Set<string> }> {
  const snapshot = emptyFiIdentitySnapshot();
  const pilotAppliedContacts = new Set<string>();
  if (contactIds.length) {
    const { data: personSrc } = await supabase
      .from("fi_person_source_ids")
      .select("person_id, source_person_id")
      .eq("tenant_id", tenantId)
      .eq("source_system", "hubspot")
      .in("source_person_id", contactIds);
    for (const row of personSrc ?? []) {
      const r = row as { person_id: string; source_person_id: string };
      snapshot.externalContactToPerson.set(String(r.source_person_id), String(r.person_id));
    }
    const { data: patientSrc } = await supabase
      .from("fi_patient_source_ids")
      .select("patient_id, source_patient_id")
      .eq("tenant_id", tenantId)
      .eq("source_system", "hubspot")
      .in("source_patient_id", contactIds);
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
      .in("external_id", contactIds);
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
      if (r.detail?.milestone === HUBSPOT_CONTACT_LEAD_PILOT_MILESTONE) {
        pilotAppliedContacts.add(String(r.external_id));
      }
    }
  }

  const personIds = Array.from(new Set([...snapshot.externalContactToPerson.values()]));
  if (emails.length) {
    const { data: byEmail } = await supabase
      .from("fi_persons")
      .select("id, metadata")
      .eq("tenant_id", tenantId)
      .in("metadata->>email_normalized", emails)
      .limit(2000);
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
  if (uniquePersonIds.length) {
    const { data: leads } = await supabase
      .from("fi_crm_leads")
      .select("id, person_id, current_stage_id, summary")
      .eq("tenant_id", tenantId)
      .in("person_id", uniquePersonIds)
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
        summary?: string | null;
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
      .in("person_id", uniquePersonIds)
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

  return { snapshot, pilotAppliedContacts };
}

export async function loadContactLeadPilotWorkspace(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    integrationId: string;
    filter?: HubspotContactLeadPilotFilter;
    search?: string;
    poolLimit?: number;
    rebuildCohort?: boolean;
  }
): Promise<{
  summary: HubspotContactLeadPilotSummary;
  rows: HubspotContactLeadPilotRow[];
  filter: HubspotContactLeadPilotFilter;
  patientCreationForbidden: true;
  fieldMatrixVersion: "v1";
}> {
  if (LEAD_VS_PATIENT_POLICY_V1.createPatientFromHubspotContact) {
    throw new Error("PATIENT_GUARD: createPatientFromHubspotContact must be false");
  }

  const filter = input.filter ?? "all";
  const poolLimit = Math.min(Math.max(input.poolLimit ?? 400, 50), 800);

  const { data: staging, error } = await supabase
    .from("fi_external_hubspot_contact_staging")
    .select(
      "hubspot_contact_id, email, phone, import_status, raw_payload, tenant_id, integration_id, created_at, updated_at"
    )
    .eq("tenant_id", input.tenantId)
    .eq("integration_id", input.integrationId)
    .order("hubspot_contact_id", { ascending: true })
    .limit(Math.floor(poolLimit / 2));
  if (error) throw new Error(error.message);
  const { data: stagingDesc, error: err2 } = await supabase
    .from("fi_external_hubspot_contact_staging")
    .select(
      "hubspot_contact_id, email, phone, import_status, raw_payload, tenant_id, integration_id, created_at, updated_at"
    )
    .eq("tenant_id", input.tenantId)
    .eq("integration_id", input.integrationId)
    .order("hubspot_contact_id", { ascending: false })
    .limit(Math.ceil(poolLimit / 2));
  if (err2) throw new Error(err2.message);

  const byId = new Map<string, ReturnType<typeof mapStagingContactRow>>();
  for (const row of [...(staging ?? []), ...(stagingDesc ?? [])]) {
    const mapped = mapStagingContactRow(row as Record<string, unknown>);
    byId.set(mapped.hubspotContactId, mapped);
  }
  const contacts = Array.from(byId.values());
  const contactIds = contacts.map((c) => c.hubspotContactId);
  const emails = contacts.map((c) => c.emailNormalized).filter(Boolean) as string[];
  const { snapshot, pilotAppliedContacts } = await loadContactIdentitySnapshot(
    supabase,
    input.tenantId,
    input.integrationId,
    contactIds,
    emails
  );

  const { data: decisions } = await supabase
    .from("fi_hubspot_contact_lead_pilot_decisions")
    .select(
      "id, hubspot_contact_id, decision_state, target_lead_id, approved_for_apply, match_evidence, import_batch_id, applied_at, operator_note"
    )
    .eq("tenant_id", input.tenantId)
    .eq("integration_id", input.integrationId)
    .is("superseded_at", null);
  const decisionByContact = new Map(
    (decisions ?? []).map((d) => [
      String((d as { hubspot_contact_id: string }).hubspot_contact_id),
      d as {
        decision_state: HubspotContactLeadPilotRow["decision"];
        target_lead_id: string | null;
        approved_for_apply: boolean;
        match_evidence: { reason_code?: string; milestone?: string };
        applied_at: string | null;
        import_batch_id: string | null;
        operator_note: string | null;
      },
    ])
  );

  const leadLabels = new Map<string, string>();
  const leadIds = Array.from(
    new Set(
      contacts
        .map((c) => {
          const resolved = resolveHubspotContactImportIdentity(c, snapshot, {
            expectedTenantId: input.tenantId,
          });
          return resolved.proposedFiEntityId;
        })
        .filter(Boolean) as string[]
    )
  );
  if (leadIds.length) {
    const { data: leadRows } = await supabase
      .from("fi_crm_leads")
      .select("id, summary")
      .eq("tenant_id", input.tenantId)
      .in("id", leadIds);
    for (const l of leadRows ?? []) {
      const r = l as { id: string; summary: string | null };
      leadLabels.set(String(r.id), r.summary?.trim() || `Lead ${String(r.id).slice(0, 8)}`);
    }
  }

  const candidates: HubspotContactLeadPilotRow[] = [];
  for (const c of contacts) {
    const resolved = resolveHubspotContactImportIdentity(c, snapshot, {
      expectedTenantId: input.tenantId,
    });
    const hasExternalLead = snapshot.externalContactToLead.has(c.hubspotContactId);
    const hasPerson = snapshot.externalContactToPerson.has(c.hubspotContactId);
    const saved = decisionByContact.get(c.hubspotContactId);
    const appliedByPilot =
      Boolean(saved?.applied_at) ||
      saved?.decision_state === "already_applied" ||
      pilotAppliedContacts.has(c.hubspotContactId);

    let decision = mapImportDecisionToPilotState({
      decision: resolved.decision,
      wrongTenant: resolved.wrongTenant,
      hasExternalLeadMapping: hasExternalLead,
      hasPersonSourceId: hasPerson,
      appliedByPilotBatch: appliedByPilot,
    });
    // On rebuild, recompute from identity. Otherwise retain operator/saved decisions.
    if (!input.rebuildCohort && saved?.decision_state) {
      decision = saved.decision_state;
    }

    const ownerMapped = c.hubspotOwnerId
      ? snapshot.externalOwnerToStaff.has(c.hubspotOwnerId)
      : false;
    const stageMap = mapHubspotSalesPipelineStageV1(c.dealStageLabel);
    const proposedLeadId = saved?.target_lead_id ?? resolved.proposedFiEntityId;
    const patientWarning =
      decision === "patient_link_review_required"
        ? "Possible patient relationship needs clinical review. This pilot will not create or link patients."
        : null;

    candidates.push({
      hubspotContactId: c.hubspotContactId,
      displayName: c.displayName,
      email: c.emailNormalized,
      phone: c.phoneDisplay,
      decision,
      reasonCode: saved?.match_evidence?.reason_code ?? resolved.reasonCode,
      matchEvidence: resolved.reasonCode,
      proposedLeadId,
      proposedLeadLabel: proposedLeadId ? leadLabels.get(proposedLeadId) ?? null : null,
      hubspotOwnerId: c.hubspotOwnerId,
      ownerResolutionStatus: ownerMapped
        ? "mapped_staff"
        : c.hubspotOwnerId
          ? "unmapped_or_archived"
          : "none",
      sourceStageLabel: c.dealStageLabel,
      mappedFiStageSlug: stageMap.fiSlug,
      patientProtectionWarning: patientWarning,
      quarantineReason: decision.startsWith("quarantine_")
        ? plainLanguageDecision(decision)
        : null,
      lastSourceActivityAt: c.sourceUpdatedAt,
      approvedForApply: saved
        ? Boolean(saved.approved_for_apply)
        : isApplyablePilotDecision(decision),
      identityTier: resolved.identityTier,
    });
  }

  // Prefer persisted 1D cohort when present and not rebuilding.
  const persistedCohort = candidates.filter((c) => {
    const d = decisionByContact.get(c.hubspotContactId);
    if (!d) return false;
    return (
      d.match_evidence?.milestone === HUBSPOT_CONTACT_LEAD_PILOT_MILESTONE ||
      (d.operator_note ?? "").includes("1D auto-selected")
    );
  });
  const pilotRows =
    !input.rebuildCohort && persistedCohort.length > 0
      ? persistedCohort
      : selectContactLeadPilotCohort(candidates, HUBSPOT_CONTACT_LEAD_PILOT_BATCH_MAX);

  // Persist auto-selected cohort only when empty or explicitly rebuilding.
  if (input.rebuildCohort || persistedCohort.length === 0) {
    for (const row of pilotRows) {
      await saveContactLeadPilotDecision(supabase, {
        tenantId: input.tenantId,
        integrationId: input.integrationId,
        operatorFiUserId: null,
        decision: {
          hubspotContactId: row.hubspotContactId,
          decision: row.decision,
          approvedForApply: row.approvedForApply,
          targetLeadId: row.proposedLeadId,
          operatorNote: "1D auto-selected pilot cohort",
        },
        matchEvidence: {
          milestone: HUBSPOT_CONTACT_LEAD_PILOT_MILESTONE,
          reason_code: row.reasonCode,
          match_evidence: row.matchEvidence,
          identity_tier: row.identityTier,
        },
      });
    }
  }

  let filtered = filterPilotRows(pilotRows, filter);
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

  return {
    summary: summarizePilotRows(pilotRows),
    rows: filtered,
    filter,
    patientCreationForbidden: true,
    fieldMatrixVersion: "v1",
  };
}

export async function saveContactLeadPilotDecision(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    integrationId: string;
    decision: HubspotContactLeadPilotDecisionInput;
    operatorFiUserId: string | null;
    matchEvidence?: Record<string, unknown>;
  }
): Promise<{ decisionId: string }> {
  if (input.decision.decision === "patient_link_review_required") {
    // Patient apply remains forbidden even if operator escalates.
  }
  if (
    (input.decision.decision === "link_existing_lead" ||
      input.decision.decision === "create_new_lead") &&
    input.decision.decision === "link_existing_lead" &&
    !input.decision.targetLeadId
  ) {
    // create_new_lead may omit target; link requires target when approving.
  }

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

  assertContactLeadMutationAllowlist("fi_hubspot_contact_lead_pilot_decisions", "insert");
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
        milestone: HUBSPOT_CONTACT_LEAD_PILOT_MILESTONE,
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

export async function previewContactLeadPilotBatch(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    integrationId: string;
    operatorLabel?: string;
  }
): Promise<{
  batchId: string;
  checksum: string;
  links: Array<{ hubspotContactId: string; leadId: string; displayName: string }>;
  creates: Array<{ hubspotContactId: string; displayName: string }>;
  quarantined: number;
  patientReviewsExcluded: number;
  plainLanguage: {
    primaryAction: "Apply approved lead pilot";
    patientsStaffUsersNotificationsUnchanged: true;
    tablesThatMayChange: string[];
  };
}> {
  const workspace = await loadContactLeadPilotWorkspace(supabase, {
    tenantId: input.tenantId,
    integrationId: input.integrationId,
    filter: "all",
    rebuildCohort: false,
  });

  const approved = workspace.rows.filter(
    (r) =>
      r.approvedForApply &&
      isApplyablePilotDecision(r.decision) &&
      r.decision !== "patient_link_review_required"
  );
  assertPilotBatchSize(approved.length);

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

  // Fail closed: patient reviews must never be in apply set.
  if (approved.some((r) => r.decision === "patient_link_review_required")) {
    throw new Error("APPLY_GUARD: patient-link review records cannot be applied in 1D");
  }

  const checksum = computeContactLeadPilotChecksum(
    approved.map((r) => ({
      hubspotContactId: r.hubspotContactId,
      decision: r.decision,
      proposedLeadId: r.proposedLeadId,
    }))
  );

  assertContactLeadMutationAllowlist("fi_import_batches", "insert");
  const { data: batch, error } = await supabase
    .from("fi_import_batches")
    .insert({
      tenant_id: input.tenantId,
      source_system: HUBSPOT_IMPORT_SOURCE_SYSTEM,
      kind: HUBSPOT_CONTACT_LEAD_PILOT_KIND,
      status: "dry_run_passed",
      dry_run_passed: true,
      dry_run_at: new Date().toISOString(),
      dry_run_report: {
        milestone: HUBSPOT_CONTACT_LEAD_PILOT_MILESTONE,
        checksum,
        links,
        creates,
        approved: approved.map((r) => ({
          hubspotContactId: r.hubspotContactId,
          decision: r.decision,
          leadId: r.proposedLeadId,
          reasonCode: r.reasonCode,
        })),
        patientCreationForbidden: true,
        sideEffectSuppression: true,
      },
      row_count: approved.length,
      imported_row_count: 0,
      metadata: {
        milestone: HUBSPOT_CONTACT_LEAD_PILOT_MILESTONE,
        integration_id: input.integrationId,
        checksum,
        actor_label: input.operatorLabel ?? "1d-preview",
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
    quarantined: workspace.summary.quarantined,
    patientReviewsExcluded: workspace.summary.patientLinkReviews,
    plainLanguage: {
      primaryAction: "Apply approved lead pilot",
      patientsStaffUsersNotificationsUnchanged: true,
      tablesThatMayChange: [
        "fi_import_batches",
        "fi_external_record_mappings",
        "fi_hubspot_contact_lead_pilot_decisions",
        ...(creates.length
          ? ["fi_persons", "fi_person_source_ids", "fi_crm_leads"]
          : []),
      ],
    },
  };
}

export async function applyContactLeadPilotBatch(
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
}> {
  if (input.confirmToken !== input.approvedBatchId) {
    throw new Error("APPLY_GUARD: confirmation must equal the approved batch id");
  }
  if (LEAD_VS_PATIENT_POLICY_V1.createPatientFromHubspotContact) {
    throw new Error("PATIENT_GUARD: createPatientFromHubspotContact must be false");
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
      approved?: Array<{
        hubspotContactId: string;
        decision: string;
        leadId?: string | null;
        reasonCode?: string;
      }>;
      links?: Array<{ hubspotContactId: string; leadId: string }>;
      creates?: Array<{ hubspotContactId: string }>;
    };
    metadata: Record<string, unknown>;
    imported_row_count: number;
  };
  if (b.tenant_id !== input.tenantId) throw new Error("APPLY_GUARD: tenant mismatch");
  if (b.kind !== HUBSPOT_CONTACT_LEAD_PILOT_KIND) {
    throw new Error(`APPLY_GUARD: unexpected kind ${b.kind}`);
  }
  const checksum = String(b.dry_run_report?.checksum ?? b.metadata.checksum ?? "");
  if (!checksum || checksum !== input.expectedChecksum) {
    throw new Error("APPLY_GUARD: preview has changed since approval (checksum mismatch)");
  }
  const approved = b.dry_run_report.approved ?? [];
  assertPilotBatchSize(approved.length);

  let linked = 0;
  let created = 0;
  let alreadyApplied = 0;
  const newLeadIds: string[] = [];
  const mappingIds: string[] = [];

  // Entry stage for new leads
  const { data: entryStage } = await supabase
    .from("fi_crm_pipeline_stages")
    .select("id, slug")
    .eq("tenant_id", input.tenantId)
    .eq("is_entry", true)
    .limit(1)
    .maybeSingle();
  const entryStageId = entryStage ? String((entryStage as { id: string }).id) : null;

  assertContactLeadMutationAllowlist("fi_import_batches", "update");
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
          .select("id, tenant_id, person_id, current_stage_id, primary_owner_user_id")
          .eq("id", leadId)
          .maybeSingle();
        if (!lead || String((lead as { tenant_id: string }).tenant_id) !== input.tenantId) {
          throw new Error("APPLY_GUARD: cross-tenant or missing lead");
        }

        const { data: existingMap } = await supabase
          .from("fi_external_record_mappings")
          .select("id, fi_entity_id, detail")
          .eq("tenant_id", input.tenantId)
          .eq("integration_id", input.integrationId)
          .eq("source_provider", "hubspot")
          .eq("source_entity_type", "contact")
          .eq("external_id", item.hubspotContactId)
          .maybeSingle();

        if (existingMap) {
          const em = existingMap as {
            id: string;
            fi_entity_id: string;
            detail?: { milestone?: string };
          };
          if (String(em.fi_entity_id) !== leadId) {
            throw new Error("APPLY_GUARD: source contact already maps to another target");
          }
          alreadyApplied += 1;
          mappingIds.push(String(em.id));
        } else {
          assertContactLeadMutationAllowlist("fi_external_record_mappings", "insert");
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
                milestone: HUBSPOT_CONTACT_LEAD_PILOT_MILESTONE,
                import_batch_id: b.id,
                action: "link_existing_lead",
                reason_code: item.reasonCode ?? "deterministic_link",
                actor_label: input.actorLabel ?? "1d-apply",
                patient_creation: false,
              },
            })
            .select("id")
            .single();
          if (insErr) throw new Error(insErr.message);
          mappingIds.push(String((ins as { id: string }).id));
          linked += 1;

          // Fill-when-blank person enrichment only (never clinical).
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
              assertContactLeadMutationAllowlist("fi_persons", "update");
              await supabase
                .from("fi_persons")
                .update({
                  metadata: {
                    ...planned.next,
                    hubspot_import_1d: {
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
        // Ensure no existing mapping / person source
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

        assertContactLeadMutationAllowlist("fi_persons", "insert");
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
                milestone: HUBSPOT_CONTACT_LEAD_PILOT_MILESTONE,
              },
            },
          })
          .select("id")
          .single();
        if (pErr) throw new Error(pErr.message);
        const personId = String((personIns as { id: string }).id);

        assertContactLeadMutationAllowlist("fi_person_source_ids", "insert");
        const { error: psErr } = await supabase.from("fi_person_source_ids").insert({
          tenant_id: input.tenantId,
          person_id: personId,
          source_system: "hubspot",
          source_person_id: item.hubspotContactId,
        });
        if (psErr) throw new Error(psErr.message);

        if (!entryStageId) throw new Error("APPLY_GUARD: no entry pipeline stage for tenant");
        assertContactLeadMutationAllowlist("fi_crm_leads", "insert");
        const summary =
          [first, last].filter(Boolean).join(" ").trim() || email || `HubSpot ${item.hubspotContactId}`;
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
              milestone: HUBSPOT_CONTACT_LEAD_PILOT_MILESTONE,
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

        assertContactLeadMutationAllowlist("fi_external_record_mappings", "insert");
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
              milestone: HUBSPOT_CONTACT_LEAD_PILOT_MILESTONE,
              import_batch_id: b.id,
              action: "create_new_lead",
              actor_label: input.actorLabel ?? "1d-apply",
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

    assertContactLeadMutationAllowlist("fi_import_batches", "update");
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
          side_effects: [],
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
        },
      })
      .eq("id", b.id);
    throw err;
  }

  const watermarkAfter = await readNotesWatermark(supabase, input.tenantId);
  const leadCountAfter = await countTable("fi_crm_leads");
  const patientCountAfter = await countTable("fi_patients");
  if (patientCountAfter !== patientCountBefore) {
    throw new Error("PATIENT_GUARD: patient count changed during 1D apply — fail closed");
  }

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
  };
}

export async function previewRollbackContactLeadPilotBatch(
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
  if (b.kind !== HUBSPOT_CONTACT_LEAD_PILOT_KIND) throw new Error("ROLLBACK_PREVIEW: wrong kind");

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

  return {
    ok: blockedLeads.length === 0,
    removableMappings,
    newLeadsEligible,
    blockedLeads,
    watermark: await readNotesWatermark(supabase, input.tenantId),
  };
}
