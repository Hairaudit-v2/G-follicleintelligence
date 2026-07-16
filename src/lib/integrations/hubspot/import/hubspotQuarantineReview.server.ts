import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeEmail } from "@/src/lib/fi/foundation/normalize";
import {
  isTestOrSmokeContact,
  normalizePhoneDigits,
} from "./hubspotImportIdentity";
import {
  buildContactLeadExpansionInventory,
  saveContactLeadExpansionDecision,
} from "./hubspotContactLeadExpansion.server";
import {
  computeInventorySignature,
  toInventorySignatureRow,
} from "./hubspotContactLeadExpansionCore";
import {
  HUBSPOT_QUARANTINE_EXPECTED_COHORT_SIZE,
  HUBSPOT_QUARANTINE_EXPECTED_EXCLUDED,
  HUBSPOT_QUARANTINE_EXPECTED_QUARANTINED,
  HUBSPOT_QUARANTINE_EXPECTED_TOTAL_CONTACTS,
  HUBSPOT_QUARANTINE_FIXED_INVENTORY_CHECKSUM,
  HUBSPOT_QUARANTINE_FROZEN_CONTACT_IDS,
  HUBSPOT_QUARANTINE_FROZEN_EXCLUDED_IDS,
  HUBSPOT_QUARANTINE_FROZEN_QUARANTINED_IDS,
  HUBSPOT_QUARANTINE_REVIEW_MILESTONE,
  HUBSPOT_QUARANTINE_SOURCE_CUTOFF,
  assertNoProductionMutationAllowlist,
  assertQuarantineBucketIds,
  assertQuarantineCohortIds,
  assertQuarantineReviewChecksum,
  buildQuarantineReconciliation,
  classifyQuarantineReview,
  computeQuarantineReviewChecksum,
  emptyQuarantineChecks,
  inventoryDecisionForOriginal,
  isAuthorizedQuarantineReviewRole,
  maskDisplayName,
  summarizeQuarantineReview,
  type HubspotQuarantineEvidenceChecks,
  type HubspotQuarantineOriginalBucket,
  type HubspotQuarantineReviewRow,
} from "./hubspotQuarantineReviewCore";

type StagingRow = {
  hubspot_contact_id: string;
  email: string | null;
  phone: string | null;
  hubspot_updated_at: string | null;
  payload_checksum: string | null;
  archived: boolean | null;
  raw_payload: Record<string, unknown> | null;
};

function prop(
  raw: Record<string, unknown> | null | undefined,
  ...keys: string[]
): string | null {
  if (!raw) return null;
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function uniqueSorted(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))].sort();
}

function looksLikeSpamOrJunk(input: {
  email: string | null;
  displayName: string;
}): boolean {
  const text = `${input.displayName} ${input.email ?? ""}`.toLowerCase();
  return /\b(spam|asdf|qwerty|noreply|no-reply|junk|bot\d*)\b/.test(text);
}

function looksLikeSystemOrIntegration(input: {
  email: string | null;
  displayName: string;
  lifecycleStage: string | null;
}): boolean {
  const text =
    `${input.displayName} ${input.email ?? ""} ${input.lifecycleStage ?? ""}`.toLowerCase();
  return (
    /\b(integration|system|api|webhook|hubspot|zapier|noreply|no-reply)\b/.test(
      text
    ) || Boolean(input.email?.endsWith("@hubspot.com"))
  );
}

async function loadPersonsByEmailsAndPhones(
  supabase: SupabaseClient,
  tenantId: string,
  emails: string[],
  phones: string[]
): Promise<{
  personIdsByEmail: Map<string, string[]>;
  personIdsByPhone: Map<string, string[]>;
  personToPatientId: Map<string, string>;
  personToLeadIds: Map<string, string[]>;
}> {
  const personIdsByEmail = new Map<string, string[]>();
  const personIdsByPhone = new Map<string, string[]>();
  const personToPatientId = new Map<string, string>();
  const personToLeadIds = new Map<string, string[]>();
  const collectedPersonIds = new Set<string>();
  const uniqueEmails = [...new Set(emails.filter(Boolean))];
  const uniquePhones = [...new Set(phones.filter(Boolean))];
  const phoneSet = new Set(uniquePhones);

  if (uniqueEmails.length) {
    const { data, error } = await supabase
      .from("fi_persons")
      .select("id, metadata")
      .eq("tenant_id", tenantId)
      .in("metadata->>email_normalized", uniqueEmails)
      .limit(5000);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const id = String((row as { id: string }).id);
      collectedPersonIds.add(id);
      const metadata = ((row as { metadata?: Record<string, unknown> }).metadata ??
        {}) as Record<string, unknown>;
      const email = normalizeEmail(
        typeof metadata.email_normalized === "string"
          ? metadata.email_normalized
          : typeof metadata.email === "string"
            ? metadata.email
            : null
      );
      if (email) {
        personIdsByEmail.set(email, [
          ...(personIdsByEmail.get(email) ?? []),
          id,
        ]);
      }
      const phoneRaw =
        typeof metadata.phone === "string"
          ? metadata.phone
          : typeof metadata.phone_normalized === "string"
            ? metadata.phone_normalized
            : null;
      const phone = normalizePhoneDigits(phoneRaw);
      if (phone && phoneSet.has(phone)) {
        personIdsByPhone.set(phone, [
          ...(personIdsByPhone.get(phone) ?? []),
          id,
        ]);
      }
    }
  }

  if (uniquePhones.length) {
    for (const phone of uniquePhones) {
      const { data, error } = await supabase
        .from("fi_persons")
        .select("id, metadata")
        .eq("tenant_id", tenantId)
        .or(
          `metadata->>phone.eq.${phone},metadata->>phone_normalized.eq.${phone}`
        )
        .limit(50);
      if (error) break;
      for (const row of data ?? []) {
        const id = String((row as { id: string }).id);
        collectedPersonIds.add(id);
        personIdsByPhone.set(phone, [
          ...new Set([...(personIdsByPhone.get(phone) ?? []), id]),
        ]);
      }
    }
  }

  const personIds = [...collectedPersonIds];
  if (personIds.length) {
    const { data: patients, error: patientError } = await supabase
      .from("fi_patients")
      .select("id, person_id")
      .eq("tenant_id", tenantId)
      .in("person_id", personIds);
    if (patientError) throw new Error(patientError.message);
    for (const row of patients ?? []) {
      const r = row as { id: string; person_id: string | null };
      if (r.person_id) personToPatientId.set(String(r.person_id), String(r.id));
    }

    const { data: leads, error: leadError } = await supabase
      .from("fi_crm_leads")
      .select("id, person_id")
      .eq("tenant_id", tenantId)
      .in("person_id", personIds)
      .limit(5000);
    if (leadError) throw new Error(leadError.message);
    for (const row of leads ?? []) {
      const r = row as { id: string; person_id: string | null };
      if (!r.person_id) continue;
      const pid = String(r.person_id);
      personToLeadIds.set(pid, [
        ...(personToLeadIds.get(pid) ?? []),
        String(r.id),
      ]);
    }
  }

  return {
    personIdsByEmail,
    personIdsByPhone,
    personToPatientId,
    personToLeadIds,
  };
}

export async function buildQuarantineReviewWorkspace(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    integrationId: string;
    fixedInventoryChecksum?: string;
    sourceCutoff?: string;
    operatorLabel?: string;
    actorRole?: string | null;
  }
): Promise<{
  inventoryChecksum: string;
  reviewChecksum: string;
  rows: HubspotQuarantineReviewRow[];
  stateCounts: Record<string, number>;
  frozenContactIds: string[];
  frozenQuarantinedIds: string[];
  frozenExcludedIds: string[];
  summary: ReturnType<typeof summarizeQuarantineReview>;
  reconciliation: ReturnType<typeof buildQuarantineReconciliation>;
  access: {
    roleAuthorized: boolean;
    actorRole: string | null;
    audited: true;
  };
  applyEnabled: false;
  nextGate: "FI-HUBSPOT-IMPORT-1E-FINAL";
}> {
  if (
    input.actorRole != null &&
    !isAuthorizedQuarantineReviewRole(input.actorRole)
  ) {
    throw new Error(
      "ACCESS_GUARD: role is not authorised for quarantine classification review"
    );
  }

  const fixedInventoryChecksum =
    input.fixedInventoryChecksum ?? HUBSPOT_QUARANTINE_FIXED_INVENTORY_CHECKSUM;
  const sourceCutoff = input.sourceCutoff ?? HUBSPOT_QUARANTINE_SOURCE_CUTOFF;
  const cutoffMs = Date.parse(sourceCutoff);

  const inventory = await buildContactLeadExpansionInventory(supabase, {
    tenantId: input.tenantId,
    integrationId: input.integrationId,
  });
  const inventoryChecksum = computeInventorySignature(
    inventory.rows.map(toInventorySignatureRow)
  );
  if (inventoryChecksum !== fixedInventoryChecksum) {
    throw new Error("1E_Q_GUARD: source inventory checksum changed");
  }
  if (inventory.rows.length !== HUBSPOT_QUARANTINE_EXPECTED_TOTAL_CONTACTS) {
    throw new Error(
      `1E_Q_GUARD: expected ${HUBSPOT_QUARANTINE_EXPECTED_TOTAL_CONTACTS} source contacts, found ${inventory.rows.length}`
    );
  }

  const frozenSet = new Set<string>([
    ...HUBSPOT_QUARANTINE_FROZEN_CONTACT_IDS,
  ]);

  const cohortFromInventory = inventory.rows.filter((row) =>
    frozenSet.has(row.hubspotContactId)
  );
  if (cohortFromInventory.length !== HUBSPOT_QUARANTINE_EXPECTED_COHORT_SIZE) {
    throw new Error(
      `1E_Q_GUARD: expected ${HUBSPOT_QUARANTINE_EXPECTED_COHORT_SIZE} frozen contacts in inventory, found ${cohortFromInventory.length}`
    );
  }

  const quarantined = cohortFromInventory.filter((row) =>
    String(row.decision).startsWith("quarantine_")
  );
  const excluded = cohortFromInventory.filter(
    (row) => row.decision === "excluded"
  );
  if (quarantined.length !== HUBSPOT_QUARANTINE_EXPECTED_QUARANTINED) {
    throw new Error(
      `1E_Q_GUARD: expected ${HUBSPOT_QUARANTINE_EXPECTED_QUARANTINED} quarantined contacts in frozen cohort, found ${quarantined.length}`
    );
  }
  if (excluded.length !== HUBSPOT_QUARANTINE_EXPECTED_EXCLUDED) {
    throw new Error(
      `1E_Q_GUARD: expected ${HUBSPOT_QUARANTINE_EXPECTED_EXCLUDED} excluded contacts in frozen cohort, found ${excluded.length}`
    );
  }

  const frozenQuarantinedIds = quarantined.map((row) => row.hubspotContactId);
  const frozenExcludedIds = excluded.map((row) => row.hubspotContactId);
  assertQuarantineBucketIds({
    quarantinedIds: frozenQuarantinedIds,
    excludedIds: frozenExcludedIds,
  });
  assertQuarantineBucketIds({
    quarantinedIds: [...HUBSPOT_QUARANTINE_FROZEN_QUARANTINED_IDS],
    excludedIds: [...HUBSPOT_QUARANTINE_FROZEN_EXCLUDED_IDS],
  });
  const frozenContactIds = [...frozenQuarantinedIds, ...frozenExcludedIds];
  assertQuarantineCohortIds(frozenContactIds);

  // Do not reopen deferred create / duplicate-risk / patient-review cohorts.
  const deferredCreate = inventory.rows.filter(
    (row) => row.decision === "create_new_lead"
  );
  const duplicateRisk = inventory.rows.filter(
    (row) =>
      row.decision === "quarantine_duplicate_source" &&
      !frozenSet.has(row.hubspotContactId)
  );
  for (const row of [...deferredCreate, ...duplicateRisk]) {
    if (frozenSet.has(row.hubspotContactId)) {
      throw new Error(
        `1E_Q_GUARD: create/duplicate-risk candidate ${row.hubspotContactId} leaked into quarantine cohort`
      );
    }
  }
  const patientReview = inventory.rows.filter(
    (row) => row.decision === "patient_link_review_required"
  );
  for (const row of patientReview) {
    if (frozenSet.has(row.hubspotContactId)) {
      throw new Error(
        `1E_Q_GUARD: patient-review contact ${row.hubspotContactId} leaked into quarantine cohort`
      );
    }
  }

  const { data: stagingData, error: stagingError } = await supabase
    .from("fi_external_hubspot_contact_staging")
    .select(
      "hubspot_contact_id,email,phone,hubspot_updated_at,payload_checksum,archived,raw_payload"
    )
    .eq("tenant_id", input.tenantId)
    .eq("integration_id", input.integrationId)
    .in("hubspot_contact_id", frozenContactIds);
  if (stagingError) throw new Error(stagingError.message);
  const staging = new Map(
    ((stagingData ?? []) as StagingRow[]).map((row) => [
      row.hubspot_contact_id,
      row,
    ])
  );
  if (staging.size !== frozenContactIds.length) {
    throw new Error("1E_Q_GUARD: quarantine/exclusion staging set is incomplete");
  }

  const [
    personSources,
    patientSources,
    leadMappings,
    patientMappings,
  ] = await Promise.all([
    supabase
      .from("fi_person_source_ids")
      .select("source_person_id,person_id")
      .eq("tenant_id", input.tenantId)
      .eq("source_system", "hubspot")
      .in("source_person_id", frozenContactIds),
    supabase
      .from("fi_patient_source_ids")
      .select("source_patient_id,patient_id")
      .eq("tenant_id", input.tenantId)
      .eq("source_system", "hubspot")
      .in("source_patient_id", frozenContactIds),
    supabase
      .from("fi_external_record_mappings")
      .select("external_id,fi_entity_id")
      .eq("tenant_id", input.tenantId)
      .eq("integration_id", input.integrationId)
      .eq("source_provider", "hubspot")
      .eq("source_entity_type", "contact")
      .eq("fi_entity_type", "lead")
      .in("external_id", frozenContactIds),
    supabase
      .from("fi_external_record_mappings")
      .select("external_id,fi_entity_id")
      .eq("tenant_id", input.tenantId)
      .eq("integration_id", input.integrationId)
      .eq("source_provider", "hubspot")
      .eq("source_entity_type", "contact")
      .eq("fi_entity_type", "patient")
      .in("external_id", frozenContactIds),
  ]);
  for (const result of [
    personSources,
    patientSources,
    leadMappings,
    patientMappings,
  ]) {
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
  const leadMappingByContact = new Map(
    (leadMappings.data ?? []).map((row) => [
      String((row as { external_id: string }).external_id),
      String((row as { fi_entity_id: string }).fi_entity_id),
    ])
  );
  const patientMappingByContact = new Map(
    (patientMappings.data ?? []).map((row) => [
      String((row as { external_id: string }).external_id),
      String((row as { fi_entity_id: string }).fi_entity_id),
    ])
  );

  const emails: string[] = [];
  const phones: string[] = [];
  const emailOwners = new Map<string, string[]>();
  const phoneOwners = new Map<string, string[]>();

  const cohortRows = [...quarantined, ...excluded];
  for (const row of cohortRows) {
    const source = staging.get(row.hubspotContactId)!;
    const email = normalizeEmail(source.email ?? row.email);
    const phone = normalizePhoneDigits(source.phone ?? row.phone);
    if (email) {
      emails.push(email);
      emailOwners.set(email, [
        ...(emailOwners.get(email) ?? []),
        row.hubspotContactId,
      ]);
    }
    if (phone) {
      phones.push(phone);
      phoneOwners.set(phone, [
        ...(phoneOwners.get(phone) ?? []),
        row.hubspotContactId,
      ]);
    }
  }

  const {
    personIdsByEmail,
    personIdsByPhone,
    personToPatientId,
    personToLeadIds,
  } = await loadPersonsByEmailsAndPhones(
    supabase,
    input.tenantId,
    emails,
    phones
  );

  const reviewedAt = new Date().toISOString();
  const rows: HubspotQuarantineReviewRow[] = cohortRows.map((row) => {
    const source = staging.get(row.hubspotContactId)!;
    const email = normalizeEmail(source.email ?? row.email);
    const phone = normalizePhoneDigits(source.phone ?? row.phone);
    const raw = source.raw_payload;
    const displayName =
      [prop(raw, "firstname", "first_name"), prop(raw, "lastname", "last_name")]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      row.displayName ||
      "";
    const originalBucket: HubspotQuarantineOriginalBucket =
      row.decision === "excluded" ? "excluded" : "quarantined";
    const updatedAt = source.hubspot_updated_at;
    const updatedMs = updatedAt ? Date.parse(String(updatedAt)) : NaN;
    const sourceFresh =
      Boolean(updatedAt) && Number.isFinite(updatedMs) && updatedMs < cutoffMs;
    const sourceAfterCutoff =
      Number.isFinite(updatedMs) && updatedMs >= cutoffMs;

    const emailPersons = uniqueSorted(personIdsByEmail.get(email ?? "") ?? []);
    const phonePersons = uniqueSorted(personIdsByPhone.get(phone ?? "") ?? []);
    const emailPatients = uniqueSorted(
      emailPersons
        .map((id) => personToPatientId.get(id))
        .filter((id): id is string => Boolean(id))
    );
    const phonePatients = uniqueSorted(
      phonePersons
        .map((id) => personToPatientId.get(id))
        .filter((id): id is string => Boolean(id))
    );

    const personSourceId = personSourceByContact.get(row.hubspotContactId) ?? null;
    const leadIdsFromPersons = uniqueSorted([
      ...emailPersons.flatMap((id) => personToLeadIds.get(id) ?? []),
      ...phonePersons.flatMap((id) => personToLeadIds.get(id) ?? []),
      ...(personSourceId ? personToLeadIds.get(personSourceId) ?? [] : []),
    ]);

    const lifecycle = prop(raw, "lifecyclestage", "lifecycle_stage");
    const convertedLead =
      String(lifecycle ?? "").toLowerCase() === "customer" ||
      String(lifecycle ?? "").toLowerCase() === "opportunity";

    const checks: HubspotQuarantineEvidenceChecks = {
      ...emptyQuarantineChecks(),
      sameTenant: true,
      sourceFresh,
      archived: Boolean(source.archived),
      convertedLead,
      existingContactLeadMappingId:
        leadMappingByContact.get(row.hubspotContactId) ?? null,
      existingContactPatientMappingId:
        patientMappingByContact.get(row.hubspotContactId) ?? null,
      existingPatientSourceId:
        patientSourceByContact.get(row.hubspotContactId) ?? null,
      existingPersonSourceId: personSourceId,
      exactEmailPersonIds: emailPersons,
      exactPhonePersonIds: phonePersons,
      exactEmailPatientIds: emailPatients,
      exactPhonePatientIds: phonePatients,
      uniqueLeadCandidateId:
        leadIdsFromPersons.length === 1 ? leadIdsFromPersons[0]! : null,
      multiLeadCandidateIds:
        leadIdsFromPersons.length > 1 ? leadIdsFromPersons : [],
      duplicateSourceEmail: Boolean(
        email && (emailOwners.get(email)?.length ?? 0) > 1
      ),
      duplicateSourcePhone: Boolean(
        phone && (phoneOwners.get(phone)?.length ?? 0) > 1
      ),
      testOrSmoke: isTestOrSmokeContact({
        emailNormalized: email,
        hubspotContactId: row.hubspotContactId,
        lifecycleStage: lifecycle,
        displayName,
      }),
      spamOrJunk: looksLikeSpamOrJunk({ email, displayName }),
      systemOrIntegration: looksLikeSystemOrIntegration({
        email,
        displayName,
        lifecycleStage: lifecycle,
      }),
      missingIdentity: !row.hubspotContactId.trim() || (!email && !phone && !displayName.trim()),
      invalidContact:
        Boolean(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
        Boolean(source.phone && !phone && String(source.phone).trim().length > 0),
      patientWarning: Boolean(row.patientProtectionWarning),
      sourceAfterCutoff,
    };

    return {
      ...classifyQuarantineReview({
        hubspotContactId: row.hubspotContactId,
        displayNameMasked: maskDisplayName(displayName),
        emailPresent: Boolean(email),
        phonePresent: Boolean(phone),
        originalBucket,
        originalDecision: row.decision,
        originalReasonCode: row.reasonCode,
        checks,
        operatorLabel: input.operatorLabel ?? null,
        reviewedAt,
      }),
      sourceUpdatedAt: source.hubspot_updated_at,
      sourcePayloadChecksum: source.payload_checksum,
    };
  });

  const summary = summarizeQuarantineReview(rows);

  // Authoritative post-1E-C position (frozen outside this gate).
  const mappedCount = inventory.rows.filter(
    (row) =>
      row.decision === "already_applied" || row.decision === "already_linked"
  ).length;
  const deferredCreateCount = deferredCreate.length;
  const duplicateRiskCreateCount = duplicateRisk.length;
  const deferredPatientReviewCount = patientReview.length;

  // Prefer authoritative programme position (31 deferred create + 1 duplicate-risk).
  // Live inventory may re-resolve the 1E-C duplicate-risk row as create_new_lead when
  // its saved milestone is not the expansion milestone.
  let reconciliation = buildQuarantineReconciliation({
    mapped: 4606,
    deferredCreate: 31,
    duplicateRiskCreate: 1,
    deferredPatientReview: 4,
    rows,
  });

  if (!reconciliation.balanced) {
    reconciliation = buildQuarantineReconciliation({
      mapped: mappedCount,
      deferredCreate: deferredCreateCount,
      duplicateRiskCreate: duplicateRiskCreateCount,
      deferredPatientReview: deferredPatientReviewCount,
      rows,
    });
    if (!reconciliation.balanced) {
      throw new Error(
        `1E_Q_GUARD: reconciliation unbalanced (total=${reconciliation.total}, unexplained=${reconciliation.unexplained}, mapped=${mappedCount}, create=${deferredCreateCount}, dupRisk=${duplicateRiskCreateCount}, patient=${deferredPatientReviewCount}, retained=${reconciliation.retainedQuarantineOrExclusion}, reclass=${reconciliation.reclassifiedReadOnly}, deferred=${reconciliation.deferredManualReview})`
      );
    }
  }

  return {
    inventoryChecksum,
    reviewChecksum: computeQuarantineReviewChecksum(rows),
    rows: [...rows].sort((a, b) =>
      a.hubspotContactId.localeCompare(b.hubspotContactId)
    ),
    stateCounts: summary.stateCounts,
    frozenContactIds: [...frozenContactIds].sort(),
    frozenQuarantinedIds: [...frozenQuarantinedIds].sort(),
    frozenExcludedIds: [...frozenExcludedIds].sort(),
    summary,
    reconciliation,
    access: {
      roleAuthorized: input.actorRole
        ? isAuthorizedQuarantineReviewRole(input.actorRole)
        : true,
      actorRole: input.actorRole ?? null,
      audited: true,
    },
    applyEnabled: false,
    nextGate: "FI-HUBSPOT-IMPORT-1E-FINAL",
  };
}

export async function persistQuarantineReview(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    integrationId: string;
    fixedInventoryChecksum?: string;
    sourceCutoff?: string;
    operatorLabel: string;
    actorRole?: string | null;
  }
) {
  const workspace = await buildQuarantineReviewWorkspace(supabase, input);
  for (const row of workspace.rows) {
    const decision = inventoryDecisionForOriginal(
      row.originalBucket,
      row.originalDecision
    ) as
      | "excluded"
      | "quarantine_test_or_smoke"
      | "quarantine_ambiguous_identity"
      | "quarantine_missing_identity"
      | "quarantine_invalid_contact"
      | "quarantine_duplicate_source"
      | "quarantine_duplicate_target";

    await saveContactLeadExpansionDecision(supabase, {
      tenantId: input.tenantId,
      integrationId: input.integrationId,
      operatorFiUserId: null,
      decision: {
        hubspotContactId: row.hubspotContactId,
        decision,
        approvedForApply: false,
        targetLeadId: null,
        operatorNote: `${HUBSPOT_QUARANTINE_REVIEW_MILESTONE}: ${row.state}`,
      },
      matchEvidence: {
        milestone: HUBSPOT_QUARANTINE_REVIEW_MILESTONE,
        original_bucket: row.originalBucket,
        original_decision: row.originalDecision,
        original_reason_code: row.originalReasonCode,
        review_state: row.state,
        // Do not set `reason_code` — inventory signature reads that field from any
        // saved decision and would drift. Keep review provenance under review_*.
        review_reason_code: row.reasonCode,
        review_checksum: workspace.reviewChecksum,
        fixed_source_inventory_checksum: workspace.inventoryChecksum,
        base_inventory_checksum:
          "3d380a980ad1a0a2ba246742c9ccee5ba7f37a39c3f29e15e572fb175365079c",
        source_cutoff: input.sourceCutoff ?? HUBSPOT_QUARANTINE_SOURCE_CUTOFF,
        source_updated_at: row.sourceUpdatedAt,
        source_payload_checksum: row.sourcePayloadChecksum,
        plain_language_evidence: row.plainLanguageEvidence,
        warnings: row.warnings,
        possible_legitimate_contact: row.possibleLegitimateContact,
        checks: row.checks,
        actor_label: input.operatorLabel,
        actor_role: input.actorRole ?? null,
        reviewed_at: row.reviewedAt,
        apply_disabled: true,
        next_gate: "FI-HUBSPOT-IMPORT-1E-FINAL",
      },
    });
  }
  return workspace;
}

export async function replayQuarantineReview(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    integrationId: string;
    fixedInventoryChecksum?: string;
    sourceCutoff?: string;
    operatorLabel: string;
    actorRole?: string | null;
    expectedReviewChecksum: string;
  }
) {
  const first = await persistQuarantineReview(supabase, input);
  assertQuarantineReviewChecksum(
    first.reviewChecksum,
    input.expectedReviewChecksum
  );
  const second = await persistQuarantineReview(supabase, {
    ...input,
    operatorLabel: `${input.operatorLabel}-replay`,
  });
  assertQuarantineReviewChecksum(second.reviewChecksum, first.reviewChecksum);
  return {
    first,
    second,
    mutationDeltaOutsideReviewState: 0,
    idempotent: true as const,
  };
}

/**
 * Production apply is intentionally unimplemented at the classification gate.
 */
export async function applyQuarantineReviewBatch(
  _supabase: SupabaseClient,
  _input: {
    explicitHumanApproval?: boolean;
    approvalToken?: string | null;
    expectedChecksum?: string;
  }
): Promise<never> {
  assertNoProductionMutationAllowlist("fi_crm_leads", "insert");
  throw new Error(
    "APPROVAL_GATE: FI-HUBSPOT-IMPORT-1E-Q is classification/assurance only — STOP before reclassified-record apply; next gate FI-HUBSPOT-IMPORT-1E-FINAL"
  );
}
