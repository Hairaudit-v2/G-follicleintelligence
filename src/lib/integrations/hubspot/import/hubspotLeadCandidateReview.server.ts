import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeEmail } from "@/src/lib/fi/foundation/normalize";
import { isScientificNotationPhone, normalizePhoneDigits } from "./hubspotImportIdentity";
import {
  applyContactLeadExpansionBatch,
  buildContactLeadExpansionInventory,
  saveContactLeadExpansionDecision,
} from "./hubspotContactLeadExpansion.server";
import {
  assertExpansionMutationAllowlist,
  computeExpansionChecksum,
  computeInventorySignature,
  toInventorySignatureRow,
} from "./hubspotContactLeadExpansionCore";
import { HUBSPOT_CONTACT_LEAD_EXPANSION_KIND } from "./hubspotContactLeadExpansionTypes";
import {
  HUBSPOT_LEAD_CANDIDATE_BATCH_MAX,
  HUBSPOT_LEAD_CANDIDATE_REVIEW_MILESTONE,
  assertLeadCandidateBatchSize,
  classifyLeadCandidate,
  computeLeadCandidateReviewChecksum,
  deferBeyondFirstBatch,
  type HubspotLeadCandidateReviewRow,
  type HubspotLeadCandidateReviewState,
} from "./hubspotLeadCandidateReviewCore";

type StagingRow = {
  hubspot_contact_id: string;
  email: string | null;
  phone: string | null;
  hubspot_updated_at: string | null;
  payload_checksum: string | null;
  archived: boolean | null;
  raw_payload: Record<string, unknown> | null;
};

function persistedDecisionFor(state: HubspotLeadCandidateReviewState): string {
  switch (state) {
    case "approved_create_new_lead":
    case "deferred_manual_review":
      return "create_new_lead";
    case "link_existing_lead":
      return "link_existing_lead";
    case "patient_link_review_required":
      return "patient_link_review_required";
    case "quarantine_missing_identity":
      return "quarantine_missing_identity";
    case "quarantine_duplicate_risk":
      return "quarantine_duplicate_source";
    case "quarantine_test_or_smoke":
      return "quarantine_test_or_smoke";
    case "quarantine_spam_or_invalid":
      return "quarantine_invalid_contact";
    case "excluded":
      return "excluded";
    case "already_applied":
      return "already_applied";
  }
}

function validEmail(email: string | null): boolean {
  return Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

function possibleSpam(row: { displayName: string; email: string | null }): boolean {
  const text = `${row.displayName} ${row.email ?? ""}`.toLowerCase();
  return /\b(test|smoke|dummy|spam|asdf|noreply|no-reply)\b/.test(text);
}

async function loadAllPersons(
  supabase: SupabaseClient,
  tenantId: string
): Promise<Array<{ id: string; metadata: Record<string, unknown> }>> {
  const rows: Array<{ id: string; metadata: Record<string, unknown> }> = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("fi_persons")
      .select("id, metadata")
      .eq("tenant_id", tenantId)
      .order("id")
      .range(offset, offset + 999);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as Array<{ id: string; metadata?: Record<string, unknown> }>;
    rows.push(
      ...page.map((row) => ({ id: String(row.id), metadata: row.metadata ?? {} }))
    );
    if (page.length < 1000) break;
  }
  return rows;
}

export async function buildLeadCandidateReviewWorkspace(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    integrationId: string;
    fixedInventoryChecksum: string;
    sourceCutoff: string;
  }
): Promise<{
  inventoryChecksum: string;
  candidateChecksum: string;
  rows: HubspotLeadCandidateReviewRow[];
  stateCounts: Record<string, number>;
}> {
  const inventory = await buildContactLeadExpansionInventory(supabase, input);
  const inventoryChecksum = computeInventorySignature(
    inventory.rows.map(toInventorySignatureRow)
  );
  if (inventoryChecksum !== input.fixedInventoryChecksum) {
    throw new Error("1E_C_GUARD: source inventory checksum changed");
  }
  const candidates = inventory.rows.filter((row) => row.decision === "create_new_lead");
  if (candidates.length !== 42) {
    throw new Error(`1E_C_GUARD: expected 42 candidates, found ${candidates.length}`);
  }
  const ids = candidates.map((row) => row.hubspotContactId);
  const { data: stagingData, error: stagingError } = await supabase
    .from("fi_external_hubspot_contact_staging")
    .select(
      "hubspot_contact_id,email,phone,hubspot_updated_at,payload_checksum,archived,raw_payload"
    )
    .eq("tenant_id", input.tenantId)
    .eq("integration_id", input.integrationId)
    .in("hubspot_contact_id", ids);
  if (stagingError) throw new Error(stagingError.message);
  const staging = new Map(
    ((stagingData ?? []) as StagingRow[]).map((row) => [row.hubspot_contact_id, row])
  );
  if (staging.size !== candidates.length) {
    throw new Error("1E_C_GUARD: candidate staging set is incomplete");
  }

  const [personSources, patientSources, mappings, persons] = await Promise.all([
    supabase
      .from("fi_person_source_ids")
      .select("source_person_id,person_id")
      .eq("tenant_id", input.tenantId)
      .eq("source_system", "hubspot")
      .in("source_person_id", ids),
    supabase
      .from("fi_patient_source_ids")
      .select("source_patient_id,patient_id")
      .eq("tenant_id", input.tenantId)
      .eq("source_system", "hubspot")
      .in("source_patient_id", ids),
    supabase
      .from("fi_external_record_mappings")
      .select("external_id,fi_entity_id")
      .eq("tenant_id", input.tenantId)
      .eq("integration_id", input.integrationId)
      .eq("source_provider", "hubspot")
      .eq("source_entity_type", "contact")
      .eq("fi_entity_type", "lead")
      .in("external_id", ids),
    loadAllPersons(supabase, input.tenantId),
  ]);
  for (const result of [personSources, patientSources, mappings]) {
    if (result.error) throw new Error(result.error.message);
  }
  const personSourceByContact = new Map(
    (personSources.data ?? []).map((row) => [
      String((row as { source_person_id: string }).source_person_id),
      String((row as { person_id: string }).person_id),
    ])
  );
  const patientSourceByContact = new Map(
    (patientSources.data ?? []).map((row) => [
      String((row as { source_patient_id: string }).source_patient_id),
      String((row as { patient_id: string }).patient_id),
    ])
  );
  const mappingByContact = new Map(
    (mappings.data ?? []).map((row) => [
      String((row as { external_id: string }).external_id),
      String((row as { fi_entity_id: string }).fi_entity_id),
    ])
  );
  const personIdsByEmail = new Map<string, string[]>();
  const personIdsByPhone = new Map<string, string[]>();
  for (const person of persons) {
    const email = normalizeEmail(
      typeof person.metadata.email_normalized === "string"
        ? person.metadata.email_normalized
        : typeof person.metadata.email === "string"
          ? person.metadata.email
          : null
    );
    if (email) personIdsByEmail.set(email, [...(personIdsByEmail.get(email) ?? []), person.id]);
    const phoneRaw =
      typeof person.metadata.phone === "string"
        ? person.metadata.phone
        : typeof person.metadata.phone_normalized === "string"
          ? person.metadata.phone_normalized
          : null;
    const phone = normalizePhoneDigits(phoneRaw);
    if (phone) personIdsByPhone.set(phone, [...(personIdsByPhone.get(phone) ?? []), person.id]);
  }

  const emailCounts = new Map<string, number>();
  const phoneCounts = new Map<string, number>();
  for (const row of candidates) {
    const email = normalizeEmail(row.email);
    const phone = normalizePhoneDigits(row.phone);
    if (email) emailCounts.set(email, (emailCounts.get(email) ?? 0) + 1);
    if (phone) phoneCounts.set(phone, (phoneCounts.get(phone) ?? 0) + 1);
  }
  const cutoffMs = Date.parse(input.sourceCutoff);
  if (!Number.isFinite(cutoffMs)) throw new Error("1E_C_GUARD: invalid source cutoff");

  const classified = candidates.map((row): HubspotLeadCandidateReviewRow => {
    const source = staging.get(row.hubspotContactId)!;
    const email = normalizeEmail(source.email ?? row.email);
    const phone = normalizePhoneDigits(source.phone ?? row.phone);
    const sourceUpdatedAt = source.hubspot_updated_at;
    const checks = {
      sameTenant: true,
      sourceFresh:
        Boolean(sourceUpdatedAt) &&
        Number.isFinite(Date.parse(String(sourceUpdatedAt))) &&
        Date.parse(String(sourceUpdatedAt)) < cutoffMs,
      archived: Boolean(source.archived),
      existingMappingLeadId: mappingByContact.get(row.hubspotContactId) ?? null,
      existingPersonSourceId: personSourceByContact.get(row.hubspotContactId) ?? null,
      existingPatientSourceId: patientSourceByContact.get(row.hubspotContactId) ?? null,
      exactEmailPersonIds: email ? [...new Set(personIdsByEmail.get(email) ?? [])] : [],
      exactPhonePersonIds: phone ? [...new Set(personIdsByPhone.get(phone) ?? [])] : [],
      duplicateCandidateEmail: Boolean(email && (emailCounts.get(email) ?? 0) > 1),
      duplicateCandidatePhone: Boolean(phone && (phoneCounts.get(phone) ?? 0) > 1),
      validEmail: validEmail(email),
      validPhone: !source.phone || (!isScientificNotationPhone(source.phone) && Boolean(phone)),
      possibleSpam: possibleSpam({ displayName: row.displayName, email }),
    };
    return {
      ...classifyLeadCandidate({ row: { ...row, email, phone: source.phone }, checks }),
      sourceUpdatedAt,
      sourcePayloadChecksum: source.payload_checksum,
      inventoryReasonCode: row.reasonCode,
    };
  });
  const rows = deferBeyondFirstBatch(classified);
  const stateCounts: Record<string, number> = {};
  for (const row of rows) stateCounts[row.state] = (stateCounts[row.state] ?? 0) + 1;
  return {
    inventoryChecksum,
    candidateChecksum: computeLeadCandidateReviewChecksum(rows),
    rows,
    stateCounts,
  };
}

export async function persistLeadCandidateReview(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    integrationId: string;
    fixedInventoryChecksum: string;
    sourceCutoff: string;
    operatorLabel: string;
  }
) {
  const workspace = await buildLeadCandidateReviewWorkspace(supabase, input);
  for (const row of workspace.rows) {
    await saveContactLeadExpansionDecision(supabase, {
      tenantId: input.tenantId,
      integrationId: input.integrationId,
      operatorFiUserId: null,
      decision: {
        hubspotContactId: row.hubspotContactId,
        decision: persistedDecisionFor(row.state) as never,
        approvedForApply: row.approvedForApply,
        targetLeadId: row.targetLeadId,
        operatorNote: `${HUBSPOT_LEAD_CANDIDATE_REVIEW_MILESTONE}: ${row.state}`,
      },
      matchEvidence: {
        milestone: HUBSPOT_LEAD_CANDIDATE_REVIEW_MILESTONE,
        review_state: row.state,
        reason_code: row.inventoryReasonCode,
        review_reason_code: row.reasonCode,
        candidate_inventory_checksum: workspace.candidateChecksum,
        fixed_source_inventory_checksum: workspace.inventoryChecksum,
        source_cutoff: input.sourceCutoff,
        source_updated_at: row.sourceUpdatedAt,
        source_payload_checksum: row.sourcePayloadChecksum,
        checks: row.checks,
        actor_label: input.operatorLabel,
      },
    });
  }
  return workspace;
}

export async function previewLeadCandidateBatch(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    integrationId: string;
    fixedInventoryChecksum: string;
    sourceCutoff: string;
  }
) {
  const workspace = await buildLeadCandidateReviewWorkspace(supabase, input);
  const approved = workspace.rows.filter((row) => row.approvedForApply);
  assertLeadCandidateBatchSize(approved.length);
  const creates = approved.map((row) => ({
    hubspotContactId: row.hubspotContactId,
    displayName: row.displayName,
  }));
  const checksum = computeExpansionChecksum(
    approved.map((row) => ({
      hubspotContactId: row.hubspotContactId,
      decision: "create_new_lead",
      proposedLeadId: null,
    }))
  );
  const sourceChecksums = Object.fromEntries(
    approved.map((row) => [row.hubspotContactId, row.sourcePayloadChecksum])
  );
  assertExpansionMutationAllowlist("fi_import_batches", "insert");
  const { data: batch, error } = await supabase
    .from("fi_import_batches")
    .insert({
      tenant_id: input.tenantId,
      source_system: "hubspot",
      kind: HUBSPOT_CONTACT_LEAD_EXPANSION_KIND,
      status: "dry_run_passed",
      dry_run_passed: true,
      dry_run_at: new Date().toISOString(),
      row_count: approved.length,
      imported_row_count: 0,
      dry_run_report: {
        milestone: HUBSPOT_LEAD_CANDIDATE_REVIEW_MILESTONE,
        checksum,
        links: [],
        creates,
        approved: approved.map((row) => ({
          hubspotContactId: row.hubspotContactId,
          decision: "create_new_lead",
          leadId: null,
          reasonCode: row.reasonCode,
        })),
        patientCreationForbidden: true,
        sideEffectSuppression: true,
        batchSequence: 1,
        batchMax: HUBSPOT_LEAD_CANDIDATE_BATCH_MAX,
        candidateInventoryChecksum: workspace.candidateChecksum,
        fixedInventoryChecksum: workspace.inventoryChecksum,
        sourceCutoff: input.sourceCutoff,
        sourcePayloadChecksums: sourceChecksums,
      },
      metadata: {
        milestone: HUBSPOT_LEAD_CANDIDATE_REVIEW_MILESTONE,
        integration_id: input.integrationId,
        checksum,
        actor_label: "1e-c-preview",
        batch_status: "approved",
        candidate_inventory_checksum: workspace.candidateChecksum,
        fixed_inventory_checksum: workspace.inventoryChecksum,
        source_cutoff: input.sourceCutoff,
        source_payload_checksums: sourceChecksums,
        batch_max: HUBSPOT_LEAD_CANDIDATE_BATCH_MAX,
        create_only: true,
      },
    })
    .select("id")
    .single();
  if (error || !batch) throw new Error(error?.message ?? "1E_C_GUARD: preview insert failed");
  return {
    batchId: String((batch as { id: string }).id),
    checksum,
    links: [],
    creates,
    quarantined: workspace.rows.filter((row) => row.state.startsWith("quarantine_")).length,
    patientReviewsExcluded: workspace.rows.filter(
      (row) => row.state === "patient_link_review_required"
    ).length,
    batchStatus: "approved" as const,
    plainLanguage: {
      primaryAction: "Create ten explicitly approved new leads",
      patientsStaffUsersNotificationsUnchanged: true as const,
      tablesThatMayChange: [
        "fi_import_batches",
        "fi_hubspot_contact_lead_pilot_decisions",
        "fi_persons",
        "fi_person_source_ids",
        "fi_crm_leads",
        "fi_external_record_mappings",
      ],
    },
    workspace,
  };
}

export async function applyLeadCandidateBatch(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    integrationId: string;
    batchId: string;
    checksum: string;
    confirmToken: string;
    fixedInventoryChecksum: string;
    sourceCutoff: string;
    actorLabel: string;
  }
) {
  const { data: batch, error } = await supabase
    .from("fi_import_batches")
    .select("dry_run_report,metadata")
    .eq("id", input.batchId)
    .eq("tenant_id", input.tenantId)
    .single();
  if (error || !batch) throw new Error("1E_C_GUARD: batch not found");
  const b = batch as {
    dry_run_report: {
      milestone?: string;
      approved?: Array<{ hubspotContactId: string; decision: string }>;
      sourcePayloadChecksums?: Record<string, string | null>;
    };
    metadata: Record<string, unknown>;
  };
  if (
    b.dry_run_report.milestone !== HUBSPOT_LEAD_CANDIDATE_REVIEW_MILESTONE ||
    b.metadata.milestone !== HUBSPOT_LEAD_CANDIDATE_REVIEW_MILESTONE
  ) {
    throw new Error("1E_C_GUARD: batch is not a 1E-C candidate batch");
  }
  const approved = b.dry_run_report.approved ?? [];
  assertLeadCandidateBatchSize(approved.length);
  if (approved.some((row) => row.decision !== "create_new_lead")) {
    throw new Error("1E_C_GUARD: first candidate batch must be create-only");
  }
  const workspace = await buildLeadCandidateReviewWorkspace(supabase, input);
  const byId = new Map(workspace.rows.map((row) => [row.hubspotContactId, row]));
  for (const item of approved) {
    const current = byId.get(item.hubspotContactId);
    if (!current || current.state !== "approved_create_new_lead") {
      throw new Error(`1E_C_GUARD: ${item.hubspotContactId} is no longer safe to create`);
    }
    if (
      current.sourcePayloadChecksum !==
      (b.dry_run_report.sourcePayloadChecksums ?? {})[item.hubspotContactId]
    ) {
      throw new Error(`1E_C_GUARD: ${item.hubspotContactId} source payload changed`);
    }
  }
  return applyContactLeadExpansionBatch(supabase, {
    tenantId: input.tenantId,
    integrationId: input.integrationId,
    approvedBatchId: input.batchId,
    confirmToken: input.confirmToken,
    expectedChecksum: input.checksum,
    actorLabel: input.actorLabel,
  });
}
