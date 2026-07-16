import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeEmail } from "@/src/lib/fi/foundation/normalize";
import { normalizePhoneDigits } from "./hubspotImportIdentity";
import {
  buildContactLeadExpansionInventory,
  saveContactLeadExpansionDecision,
} from "./hubspotContactLeadExpansion.server";
import {
  computeInventorySignature,
  toInventorySignatureRow,
} from "./hubspotContactLeadExpansionCore";
import {
  HUBSPOT_PATIENT_LINK_BATCH_MAX,
  HUBSPOT_PATIENT_LINK_EXPECTED_COHORT_SIZE,
  HUBSPOT_PATIENT_LINK_EXPECTED_TOTAL_CONTACTS,
  HUBSPOT_PATIENT_LINK_FIXED_INVENTORY_CHECKSUM,
  HUBSPOT_PATIENT_LINK_REVIEW_MILESTONE,
  HUBSPOT_PATIENT_LINK_SOURCE_CUTOFF,
  assertExplicitPatientLinkApplyApproval,
  assertIdempotencyAndRollbackPolicy,
  assertNoPatientMutationAllowlist,
  assertPatientLinkBatchSize,
  assertPatientLinkCohortIds,
  assertPatientLinkPreviewChecksum,
  buildPatientLinkMutationPlan,
  capApprovedPatientLinks,
  classifyPatientLinkReview,
  computePatientLinkReviewChecksum,
  isAuthorizedPatientLinkReviewRole,
  maskDisplayName,
  type HubspotPatientLinkEvidenceChecks,
  type HubspotPatientLinkIdentifierKind,
  type HubspotPatientLinkReviewRow,
  type HubspotPatientLinkReviewState,
} from "./hubspotPatientLinkReviewCore";

type StagingRow = {
  hubspot_contact_id: string;
  email: string | null;
  phone: string | null;
  hubspot_updated_at: string | null;
  payload_checksum: string | null;
  archived: boolean | null;
};

function emptyChecks(): HubspotPatientLinkEvidenceChecks {
  return {
    sameTenant: true,
    sourceFresh: true,
    archived: false,
    existingContactLeadMappingId: null,
    existingContactPatientMappingId: null,
    existingPatientSourceId: null,
    existingPersonSourceId: null,
    proposedOrMappedLeadId: null,
    trustedLeadPatientId: null,
    exactEmailPatientIds: [],
    exactPhonePatientIds: [],
    exactEmailPersonIds: [],
    exactPhonePersonIds: [],
    appointmentAssociationPatientIds: [],
    clinicalAssociationPatientIds: [],
    matchedReliableIdentifiers: [],
    missingReliableIdentifiers: [],
    weakOnlySignals: [],
    conflicts: [],
    possiblePatientTargets: [],
    hasClinicalNotesExposureRisk: false,
  };
}

function uniqueSorted(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))].sort();
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
}> {
  const personIdsByEmail = new Map<string, string[]>();
  const personIdsByPhone = new Map<string, string[]>();
  const personToPatientId = new Map<string, string>();

  const uniqueEmails = [...new Set(emails.filter(Boolean))];
  const uniquePhones = [...new Set(phones.filter(Boolean))];
  const phoneSet = new Set(uniquePhones);
  const collectedPersonIds = new Set<string>();

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
        personIdsByEmail.set(email, [...(personIdsByEmail.get(email) ?? []), id]);
      }
      const phoneRaw =
        typeof metadata.phone === "string"
          ? metadata.phone
          : typeof metadata.phone_normalized === "string"
            ? metadata.phone_normalized
            : null;
      const phone = normalizePhoneDigits(phoneRaw);
      if (phone && phoneSet.has(phone)) {
        personIdsByPhone.set(phone, [...(personIdsByPhone.get(phone) ?? []), id]);
      }
    }
  }

  // Bounded phone-only person discovery (no full-tenant scan).
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
      if (error) {
        // Phone metadata filter may be unavailable; email path remains authoritative.
        break;
      }
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
    const { data, error } = await supabase
      .from("fi_patients")
      .select("id, person_id")
      .eq("tenant_id", tenantId)
      .in("person_id", personIds);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const r = row as { id: string; person_id: string | null };
      if (r.person_id) personToPatientId.set(String(r.person_id), String(r.id));
    }
  }

  return { personIdsByEmail, personIdsByPhone, personToPatientId };
}

function patientsForPersons(
  personIds: string[],
  personToPatientId: Map<string, string>
): string[] {
  return [
    ...new Set(
      personIds
        .map((id) => personToPatientId.get(id))
        .filter((id): id is string => Boolean(id))
    ),
  ].sort();
}

export async function buildPatientLinkReviewWorkspace(
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
  rows: HubspotPatientLinkReviewRow[];
  stateCounts: Record<string, number>;
  frozenContactIds: string[];
  mutationPlan: ReturnType<typeof buildPatientLinkMutationPlan>;
  access: {
    roleAuthorized: boolean;
    actorRole: string | null;
    audited: true;
  };
}> {
  if (input.actorRole != null && !isAuthorizedPatientLinkReviewRole(input.actorRole)) {
    throw new Error("ACCESS_GUARD: role is not authorised for clinical identity patient review");
  }

  const fixedInventoryChecksum =
    input.fixedInventoryChecksum ?? HUBSPOT_PATIENT_LINK_FIXED_INVENTORY_CHECKSUM;
  const sourceCutoff = input.sourceCutoff ?? HUBSPOT_PATIENT_LINK_SOURCE_CUTOFF;

  const inventory = await buildContactLeadExpansionInventory(supabase, {
    tenantId: input.tenantId,
    integrationId: input.integrationId,
  });
  const inventoryChecksum = computeInventorySignature(
    inventory.rows.map(toInventorySignatureRow)
  );
  if (inventoryChecksum !== fixedInventoryChecksum) {
    throw new Error("1E_P_GUARD: source inventory checksum changed");
  }
  if (inventory.rows.length !== HUBSPOT_PATIENT_LINK_EXPECTED_TOTAL_CONTACTS) {
    throw new Error(
      `1E_P_GUARD: expected ${HUBSPOT_PATIENT_LINK_EXPECTED_TOTAL_CONTACTS} source contacts, found ${inventory.rows.length}`
    );
  }

  const cohort = inventory.rows.filter(
    (row) => row.decision === "patient_link_review_required"
  );
  if (cohort.length !== HUBSPOT_PATIENT_LINK_EXPECTED_COHORT_SIZE) {
    throw new Error(
      `1E_P_GUARD: expected ${HUBSPOT_PATIENT_LINK_EXPECTED_COHORT_SIZE} patient-review contacts, found ${cohort.length}`
    );
  }
  const frozenContactIds = cohort.map((row) => row.hubspotContactId);
  assertPatientLinkCohortIds(frozenContactIds);

  const { data: stagingData, error: stagingError } = await supabase
    .from("fi_external_hubspot_contact_staging")
    .select(
      "hubspot_contact_id,email,phone,hubspot_updated_at,payload_checksum,archived"
    )
    .eq("tenant_id", input.tenantId)
    .eq("integration_id", input.integrationId)
    .in("hubspot_contact_id", frozenContactIds);
  if (stagingError) throw new Error(stagingError.message);
  const staging = new Map(
    ((stagingData ?? []) as StagingRow[]).map((row) => [row.hubspot_contact_id, row])
  );
  if (staging.size !== cohort.length) {
    throw new Error("1E_P_GUARD: patient-review staging set is incomplete");
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
  for (const result of [personSources, patientSources, leadMappings, patientMappings]) {
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
  for (const row of cohort) {
    const source = staging.get(row.hubspotContactId)!;
    const email = normalizeEmail(source.email ?? row.email);
    const phone = normalizePhoneDigits(source.phone ?? row.phone);
    if (email) emails.push(email);
    if (phone) phones.push(phone);
  }

  const { personIdsByEmail, personIdsByPhone, personToPatientId } =
    await loadPersonsByEmailsAndPhones(supabase, input.tenantId, emails, phones);

  // Trusted lead→patient: existing contact→lead mapping whose lead already has patient_id.
  const leadIds = [
    ...new Set(
      frozenContactIds
        .map((id) => leadMappingByContact.get(id) ?? null)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const leadPatientByLeadId = new Map<string, string>();
  if (leadIds.length) {
    const { data, error } = await supabase
      .from("fi_crm_leads")
      .select("id, patient_id, tenant_id")
      .eq("tenant_id", input.tenantId)
      .in("id", leadIds);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const r = row as { id: string; patient_id: string | null };
      if (r.patient_id) leadPatientByLeadId.set(String(r.id), String(r.patient_id));
    }
  }

  // Appointment / clinical association evidence (presence only — no notes content).
  const patientIdsForAssociation = [
    ...new Set([
      ...patientSourceByContact.values(),
      ...patientMappingByContact.values(),
      ...leadPatientByLeadId.values(),
      ...[...personToPatientId.values()],
    ]),
  ];
  const bookingPatientIds = new Set<string>();
  const consultationPatientIds = new Set<string>();
  if (patientIdsForAssociation.length) {
    const { data: bookings, error: bookingError } = await supabase
      .from("fi_bookings")
      .select("patient_id")
      .eq("tenant_id", input.tenantId)
      .in("patient_id", patientIdsForAssociation)
      .limit(500);
    if (bookingError) throw new Error(bookingError.message);
    for (const row of bookings ?? []) {
      const pid = (row as { patient_id: string | null }).patient_id;
      if (pid) bookingPatientIds.add(String(pid));
    }
    const { data: consults, error: consultError } = await supabase
      .from("fi_consultations")
      .select("patient_id")
      .eq("tenant_id", input.tenantId)
      .in("patient_id", patientIdsForAssociation)
      .limit(500);
    if (consultError) throw new Error(consultError.message);
    for (const row of consults ?? []) {
      const pid = (row as { patient_id: string | null }).patient_id;
      if (pid) consultationPatientIds.add(String(pid));
    }
  }

  const cutoffMs = Date.parse(sourceCutoff);
  if (!Number.isFinite(cutoffMs)) throw new Error("1E_P_GUARD: invalid source cutoff");
  const reviewedAt = new Date().toISOString();

  const classified = cohort.map((row): HubspotPatientLinkReviewRow => {
    const source = staging.get(row.hubspotContactId)!;
    const email = normalizeEmail(source.email ?? row.email);
    const phone = normalizePhoneDigits(source.phone ?? row.phone);
    const emailPersons = email ? [...new Set(personIdsByEmail.get(email) ?? [])] : [];
    const phonePersons = phone ? [...new Set(personIdsByPhone.get(phone) ?? [])] : [];
    const emailPatients = patientsForPersons(emailPersons, personToPatientId);
    const phonePatients = patientsForPersons(phonePersons, personToPatientId);
    const mappedLeadId = leadMappingByContact.get(row.hubspotContactId) ?? null;
    // For patient_link_review_required, inventory proposedLeadId is the patient
    // target from identity matching — never treat it as a CRM lead id.
    const inventoryPatientTargetId = row.proposedLeadId;
    const proposedOrMappedLeadId = mappedLeadId;
    const trustedLeadPatientId = proposedOrMappedLeadId
      ? leadPatientByLeadId.get(proposedOrMappedLeadId) ?? null
      : null;
    const existingPatientSourceId =
      patientSourceByContact.get(row.hubspotContactId) ?? null;
    const existingPersonSourceId =
      personSourceByContact.get(row.hubspotContactId) ?? null;
    const existingContactPatientMappingId =
      patientMappingByContact.get(row.hubspotContactId) ?? null;

    const matchedReliableIdentifiers: HubspotPatientLinkIdentifierKind[] = [];
    const missingReliableIdentifiers: HubspotPatientLinkIdentifierKind[] = [];
    const weakOnlySignals: HubspotPatientLinkIdentifierKind[] = [];
    const conflicts: string[] = [];

    if (existingPatientSourceId) matchedReliableIdentifiers.push("hubspot_patient_source_id");
    else missingReliableIdentifiers.push("hubspot_patient_source_id");
    if (existingPersonSourceId) matchedReliableIdentifiers.push("hubspot_person_source_id");
    else missingReliableIdentifiers.push("hubspot_person_source_id");
    if (emailPatients.length === 1) matchedReliableIdentifiers.push("exact_email");
    else missingReliableIdentifiers.push("exact_email");
    if (phonePatients.length === 1) matchedReliableIdentifiers.push("exact_phone");
    else missingReliableIdentifiers.push("exact_phone");
    if (trustedLeadPatientId) {
      matchedReliableIdentifiers.push("trusted_lead_patient_relationship");
    } else {
      missingReliableIdentifiers.push("trusted_lead_patient_relationship");
    }

    if (emailPatients.length > 1) conflicts.push("exact_email_matches_multiple_patients");
    if (phonePatients.length > 1) conflicts.push("exact_phone_matches_multiple_patients");
    if (
      emailPatients.length === 1 &&
      phonePatients.length === 1 &&
      emailPatients[0] !== phonePatients[0]
    ) {
      conflicts.push("email_and_phone_point_to_different_patients");
    }
    if (
      trustedLeadPatientId &&
      emailPatients.length === 1 &&
      emailPatients[0] !== trustedLeadPatientId
    ) {
      conflicts.push("trusted_lead_patient_differs_from_email_patient");
    }

    // Presence of email/phone patient overlap without a second strong ID is a weak signal context.
    if (emailPatients.length === 1 && phonePatients.length === 0 && !trustedLeadPatientId) {
      weakOnlySignals.push("exact_email");
    }
    if (phonePatients.length === 1 && emailPatients.length === 0 && !trustedLeadPatientId) {
      weakOnlySignals.push("exact_phone");
    }

    const appointmentAssociationPatientIds = [
      ...bookingPatientIds,
    ]
      .filter((id) =>
        [trustedLeadPatientId, ...emailPatients, ...phonePatients, existingPatientSourceId]
          .filter(Boolean)
          .includes(id)
      )
      .sort();
    const clinicalAssociationPatientIds = [
      ...consultationPatientIds,
    ]
      .filter((id) =>
        [trustedLeadPatientId, ...emailPatients, ...phonePatients, existingPatientSourceId]
          .filter(Boolean)
          .includes(id)
      )
      .sort();

    const emailPatientIds = uniqueSorted([
      ...emailPatients,
      ...(inventoryPatientTargetId && emailPatients.length === 0
        ? [inventoryPatientTargetId]
        : []),
    ]);
    if (
      inventoryPatientTargetId &&
      emailPatients.length === 1 &&
      emailPatients[0] !== inventoryPatientTargetId
    ) {
      conflicts.push("inventory_patient_target_differs_from_email_patient");
    }
    if (emailPatientIds.length === 1 && !matchedReliableIdentifiers.includes("exact_email")) {
      matchedReliableIdentifiers.push("exact_email");
      missingReliableIdentifiers.splice(
        missingReliableIdentifiers.indexOf("exact_email"),
        1
      );
      if (
        emailPatientIds.length === 1 &&
        phonePatients.length === 0 &&
        !trustedLeadPatientId
      ) {
        weakOnlySignals.push("exact_email");
      }
    }

    const checks: HubspotPatientLinkEvidenceChecks = {
      ...emptyChecks(),
      sameTenant: true,
      sourceFresh:
        Boolean(source.hubspot_updated_at) &&
        Number.isFinite(Date.parse(String(source.hubspot_updated_at))) &&
        Date.parse(String(source.hubspot_updated_at)) < cutoffMs,
      archived: Boolean(source.archived),
      existingContactLeadMappingId: mappedLeadId,
      existingContactPatientMappingId,
      existingPatientSourceId,
      existingPersonSourceId,
      proposedOrMappedLeadId,
      trustedLeadPatientId,
      exactEmailPatientIds: emailPatientIds,
      exactPhonePatientIds: phonePatients,
      exactEmailPersonIds: emailPersons.sort(),
      exactPhonePersonIds: phonePersons.sort(),
      appointmentAssociationPatientIds,
      clinicalAssociationPatientIds,
      matchedReliableIdentifiers: [...new Set(matchedReliableIdentifiers)],
      missingReliableIdentifiers: [...new Set(missingReliableIdentifiers)],
      weakOnlySignals: [...new Set(weakOnlySignals)],
      conflicts,
      possiblePatientTargets: [],
      hasClinicalNotesExposureRisk: false,
    };

    return {
      ...classifyPatientLinkReview({
        hubspotContactId: row.hubspotContactId,
        displayNameMasked: maskDisplayName(row.displayName),
        emailPresent: Boolean(email),
        phonePresent: Boolean(phone),
        inventoryReasonCode: row.reasonCode,
        checks,
        operatorLabel: input.operatorLabel ?? null,
        reviewedAt,
      }),
      sourceUpdatedAt: source.hubspot_updated_at,
      sourcePayloadChecksum: source.payload_checksum,
      inventoryReasonCode: row.reasonCode,
    };
  });

  const rows = capApprovedPatientLinks(classified);
  assertPatientLinkBatchSize(rows.filter((row) => row.approvedForApply).length);

  const stateCounts: Record<string, number> = {};
  for (const row of rows) stateCounts[row.state] = (stateCounts[row.state] ?? 0) + 1;

  return {
    inventoryChecksum,
    reviewChecksum: computePatientLinkReviewChecksum(rows),
    rows,
    stateCounts,
    frozenContactIds: [...frozenContactIds].sort(),
    mutationPlan: buildPatientLinkMutationPlan(rows),
    access: {
      roleAuthorized: input.actorRole
        ? isAuthorizedPatientLinkReviewRole(input.actorRole)
        : true,
      actorRole: input.actorRole ?? null,
      audited: true,
    },
  };
}

export async function persistPatientLinkReview(
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
  const workspace = await buildPatientLinkReviewWorkspace(supabase, input);
  for (const row of workspace.rows) {
    // Persist review provenance only — decision stays patient_link_review_required.
    await saveContactLeadExpansionDecision(supabase, {
      tenantId: input.tenantId,
      integrationId: input.integrationId,
      operatorFiUserId: null,
      decision: {
        hubspotContactId: row.hubspotContactId,
        decision: "patient_link_review_required",
        approvedForApply: false,
        targetLeadId: row.relatedLeadId,
        operatorNote: `${HUBSPOT_PATIENT_LINK_REVIEW_MILESTONE}: ${row.state}`,
      },
      matchEvidence: {
        milestone: HUBSPOT_PATIENT_LINK_REVIEW_MILESTONE,
        review_state: row.state,
        reason_code: row.inventoryReasonCode,
        review_reason_code: row.reasonCode,
        confidence: row.confidence,
        review_checksum: workspace.reviewChecksum,
        fixed_source_inventory_checksum: workspace.inventoryChecksum,
        source_cutoff: input.sourceCutoff ?? HUBSPOT_PATIENT_LINK_SOURCE_CUTOFF,
        source_updated_at: row.sourceUpdatedAt,
        source_payload_checksum: row.sourcePayloadChecksum,
        possible_patient_target_id: row.possiblePatientTargetId,
        related_lead_id: row.relatedLeadId,
        plain_language_evidence: row.plainLanguageEvidence,
        warnings: row.warnings,
        checks: {
          ...row.checks,
          // Never persist raw clinical note content.
          hasClinicalNotesExposureRisk: false,
        },
        actor_label: input.operatorLabel,
        actor_role: input.actorRole ?? null,
        reviewed_at: row.reviewedAt,
        apply_disabled: true,
        next_gate: "FI-HUBSPOT-IMPORT-1E-Q",
      },
    });
  }
  return workspace;
}

export async function previewPatientLinkBatch(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    integrationId: string;
    fixedInventoryChecksum?: string;
    sourceCutoff?: string;
    operatorLabel?: string;
    actorRole?: string | null;
  }
) {
  const workspace = await buildPatientLinkReviewWorkspace(supabase, input);
  const approved = workspace.rows.filter((row) => row.approvedForApply);
  assertPatientLinkBatchSize(approved.length);

  // Interim gate: no production apply batch is created; rollback policy is a no-op.
  assertIdempotencyAndRollbackPolicy({
    applyExecuted: false,
    rollbackAllowedWithoutApply: true,
  });

  return {
    milestone: HUBSPOT_PATIENT_LINK_REVIEW_MILESTONE,
    batchStatus: "interim_awaiting_explicit_approval" as const,
    applyEnabled: false as const,
    batchMax: HUBSPOT_PATIENT_LINK_BATCH_MAX,
    reviewChecksum: workspace.reviewChecksum,
    inventoryChecksum: workspace.inventoryChecksum,
    frozenContactIds: workspace.frozenContactIds,
    approvedForLaterApply: approved.map((row) => ({
      hubspotContactId: row.hubspotContactId,
      state: row.state,
      possiblePatientTargetId: row.possiblePatientTargetId,
      relatedLeadId: row.relatedLeadId,
      reasonCode: row.reasonCode,
    })),
    proposedProductionLinkCount: approved.length,
    mutationPlan: workspace.mutationPlan,
    stateCounts: workspace.stateCounts,
    rows: workspace.rows,
    plainLanguage: {
      primaryAction:
        "STOP — patient-link apply requires explicit human approval at FI-HUBSPOT-IMPORT-1E-Q",
      patientsStaffUsersNotificationsUnchanged: true as const,
      tablesThatMayChangeDuringInterim: [
        "fi_hubspot_contact_lead_pilot_decisions",
      ] as const,
    },
    nextGate: "FI-HUBSPOT-IMPORT-1E-Q" as const,
  };
}

/**
 * Production apply is intentionally unimplemented at the interim gate.
 * Callers must receive APPROVAL_GATE until 1E-Q explicit approval.
 */
export async function applyPatientLinkBatch(
  _supabase: SupabaseClient,
  input: {
    explicitHumanApproval: boolean;
    approvalToken?: string | null;
    expectedChecksum: string;
    reviewChecksum: string;
  }
): Promise<never> {
  assertPatientLinkPreviewChecksum(input.reviewChecksum, input.expectedChecksum);
  assertExplicitPatientLinkApplyApproval({
    explicitHumanApproval: input.explicitHumanApproval,
    approvalToken: input.approvalToken,
    expectedToken: input.expectedChecksum,
  });
  // Even with a matching token, interim 1E-P must not write patient relationships.
  assertNoPatientMutationAllowlist("fi_patients", "update");
  throw new Error(
    "APPROVAL_GATE: FI-HUBSPOT-IMPORT-1E-P completed interim review only — proceed under FI-HUBSPOT-IMPORT-1E-Q"
  );
}

export type { HubspotPatientLinkReviewRow, HubspotPatientLinkReviewState };
