import { createHash } from "node:crypto";

/**
 * FI-HUBSPOT-IMPORT-1E-P — read-only patient-link clinical identity review.
 * Apply remains blocked until an explicit later human approval gate (1E-Q).
 */

export const HUBSPOT_PATIENT_LINK_REVIEW_MILESTONE = "FI-HUBSPOT-IMPORT-1E-P";
export const HUBSPOT_PATIENT_LINK_BATCH_MAX = 2;
export const HUBSPOT_PATIENT_LINK_EXPECTED_COHORT_SIZE = 4;

/** Authoritative fixed inventory from 1E-R (pre-1E-C creates). */
export const HUBSPOT_PATIENT_LINK_BASE_INVENTORY_CHECKSUM =
  "3d380a980ad1a0a2ba246742c9ccee5ba7f37a39c3f29e15e572fb175365079c";

/**
 * Post-1E-C live inventory signature (same 4,752 contacts; create cohort reduced by 10).
 * 1E-P rejects any further drift from this boundary.
 */
export const HUBSPOT_PATIENT_LINK_FIXED_INVENTORY_CHECKSUM =
  "93823b3d3a322ca23abd85bea8439a0188ac71fdc1c5f8420965a34e16b10451";

/** @deprecated Use HUBSPOT_PATIENT_LINK_FIXED_INVENTORY_CHECKSUM (post-1E-C). */
export const HUBSPOT_PATIENT_LINK_FIXED_INVENTORY_CHECKSUM_LEGACY =
  HUBSPOT_PATIENT_LINK_BASE_INVENTORY_CHECKSUM;

export const HUBSPOT_PATIENT_LINK_SOURCE_CUTOFF = "2026-07-16T16:00:34.530Z";
export const HUBSPOT_PATIENT_LINK_EXPECTED_TOTAL_CONTACTS = 4752;

/** Frozen cohort discovered from the authoritative inventory (reject drift). */
export const HUBSPOT_PATIENT_LINK_FROZEN_CONTACT_IDS = [
  "229708595090",
  "233738855995",
  "234062240678",
  "234339716176",
] as const;

export const HUBSPOT_PATIENT_LINK_REVIEW_STATES = [
  "approved_link_existing_patient",
  "retain_crm_lead_only",
  "link_existing_lead_patient_relationship_already_trusted",
  "deferred_clinical_identity_review",
  "quarantine_ambiguous_patient_identity",
  "quarantine_multi_patient_conflict",
  "excluded_non_patient",
  "already_resolved",
] as const;

export type HubspotPatientLinkReviewState =
  (typeof HUBSPOT_PATIENT_LINK_REVIEW_STATES)[number];

/** Roles authorised for tenant-scoped clinical identity review (not CRM-only). */
export const HUBSPOT_PATIENT_LINK_AUTHORIZED_ROLES = [
  "clinic_admin",
  "operations_admin",
  "surgeon",
  "consultant",
  "nurse",
  "doctor",
] as const;

export type HubspotPatientLinkAuthorizedRole =
  (typeof HUBSPOT_PATIENT_LINK_AUTHORIZED_ROLES)[number];

export type HubspotPatientLinkIdentifierKind =
  | "hubspot_patient_source_id"
  | "hubspot_person_source_id"
  | "exact_email"
  | "exact_phone"
  | "trusted_lead_patient_relationship"
  | "name_only"
  | "fuzzy"
  | "shared_household"
  | "owner_stage_timing";

/** Identifiers that may contribute to a strong match (never alone except trusted lead→patient). */
export const RELIABLE_PATIENT_IDENTIFIERS: ReadonlySet<HubspotPatientLinkIdentifierKind> =
  new Set([
    "hubspot_patient_source_id",
    "hubspot_person_source_id",
    "exact_email",
    "exact_phone",
    "trusted_lead_patient_relationship",
  ]);

/** Weak signals that must never approve a patient link on their own or in combination without strong IDs. */
export const NEVER_APPROVE_ALONE_IDENTIFIERS: ReadonlySet<HubspotPatientLinkIdentifierKind> =
  new Set([
    "exact_email",
    "exact_phone",
    "name_only",
    "fuzzy",
    "shared_household",
    "owner_stage_timing",
  ]);

export type HubspotPatientLinkEvidenceChecks = {
  sameTenant: boolean;
  sourceFresh: boolean;
  archived: boolean;
  existingContactLeadMappingId: string | null;
  existingContactPatientMappingId: string | null;
  existingPatientSourceId: string | null;
  existingPersonSourceId: string | null;
  proposedOrMappedLeadId: string | null;
  trustedLeadPatientId: string | null;
  exactEmailPatientIds: string[];
  exactPhonePatientIds: string[];
  exactEmailPersonIds: string[];
  exactPhonePersonIds: string[];
  appointmentAssociationPatientIds: string[];
  clinicalAssociationPatientIds: string[];
  matchedReliableIdentifiers: HubspotPatientLinkIdentifierKind[];
  missingReliableIdentifiers: HubspotPatientLinkIdentifierKind[];
  weakOnlySignals: HubspotPatientLinkIdentifierKind[];
  conflicts: string[];
  possiblePatientTargets: string[];
  hasClinicalNotesExposureRisk: boolean;
};

export type HubspotPatientLinkReviewRow = {
  hubspotContactId: string;
  displayNameMasked: string;
  emailPresent: boolean;
  phonePresent: boolean;
  sourceUpdatedAt: string | null;
  sourcePayloadChecksum: string | null;
  inventoryReasonCode: string;
  state: HubspotPatientLinkReviewState;
  reasonCode: string;
  confidence: "high" | "medium" | "low" | "none";
  approvedForApply: boolean;
  possiblePatientTargetId: string | null;
  relatedLeadId: string | null;
  plainLanguageEvidence: string[];
  warnings: string[];
  checks: HubspotPatientLinkEvidenceChecks;
  operatorLabel: string | null;
  reviewedAt: string | null;
};

export function assertPatientLinkBatchSize(count: number): void {
  if (count < 0 || count > HUBSPOT_PATIENT_LINK_BATCH_MAX) {
    throw new Error(
      `BATCH_LIMIT: 1E-P production patient links require 0-${HUBSPOT_PATIENT_LINK_BATCH_MAX} approved records`
    );
  }
}

export function assertPatientLinkCohortIds(ids: string[]): void {
  const expected = [...HUBSPOT_PATIENT_LINK_FROZEN_CONTACT_IDS].sort();
  const actual = [...ids].sort();
  if (
    actual.length !== expected.length ||
    actual.some((id, i) => id !== expected[i])
  ) {
    throw new Error(
      `1E_P_GUARD: patient-review cohort drift — expected ${expected.join(",")}, found ${actual.join(",")}`
    );
  }
}

export function isAuthorizedPatientLinkReviewRole(role: string | null | undefined): boolean {
  const normalized = String(role ?? "")
    .trim()
    .toLowerCase();
  return (HUBSPOT_PATIENT_LINK_AUTHORIZED_ROLES as readonly string[]).includes(normalized);
}

export function assertExplicitPatientLinkApplyApproval(input: {
  explicitHumanApproval: boolean;
  approvalToken: string | null | undefined;
  expectedToken: string;
}): void {
  if (!input.explicitHumanApproval) {
    throw new Error(
      "APPROVAL_GATE: FI-HUBSPOT-IMPORT-1E-P apply is blocked until explicit human approval"
    );
  }
  if (!input.approvalToken || input.approvalToken !== input.expectedToken) {
    throw new Error(
      "APPROVAL_GATE: explicit approval token does not match the frozen interim preview"
    );
  }
}

export function assertPatientLinkPreviewChecksum(
  actual: string,
  expected: string
): void {
  if (actual !== expected) {
    throw new Error("1E_P_GUARD: stale or mutated patient-link preview checksum");
  }
}

export function assertNoPatientMutationAllowlist(table: string, operation: string): void {
  if (
    table === "fi_patients" ||
    table === "fi_patient_source_ids" ||
    table === "fi_crm_leads" ||
    (table === "fi_external_record_mappings" && operation !== "select")
  ) {
    throw new Error(
      `PATIENT_GUARD: ${operation} on ${table} is forbidden during 1E-P interim (read-only)`
    );
  }
}

export function assertIdempotencyAndRollbackPolicy(input: {
  applyExecuted: boolean;
  rollbackAllowedWithoutApply: boolean;
}): void {
  if (input.applyExecuted) {
    throw new Error(
      "IDEMPOTENCY_GUARD: 1E-P interim must not execute production patient-link apply"
    );
  }
  if (!input.rollbackAllowedWithoutApply) {
    throw new Error(
      "ROLLBACK_POLICY: interim gate has no production mutations; rollback is a no-op policy only"
    );
  }
}

function uniqueSorted(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))].sort();
}

export function collectPossiblePatientTargets(
  checks: HubspotPatientLinkEvidenceChecks
): string[] {
  return uniqueSorted([
    ...checks.exactEmailPatientIds,
    ...checks.exactPhonePatientIds,
    ...checks.appointmentAssociationPatientIds,
    ...checks.clinicalAssociationPatientIds,
    ...(checks.trustedLeadPatientId ? [checks.trustedLeadPatientId] : []),
    ...(checks.existingPatientSourceId ? [checks.existingPatientSourceId] : []),
    ...(checks.existingContactPatientMappingId
      ? [checks.existingContactPatientMappingId]
      : []),
  ]);
}

export function classifyPatientLinkReview(input: {
  hubspotContactId: string;
  displayNameMasked: string;
  emailPresent: boolean;
  phonePresent: boolean;
  inventoryReasonCode: string;
  checks: HubspotPatientLinkEvidenceChecks;
  operatorLabel?: string | null;
  reviewedAt?: string | null;
}): Omit<
  HubspotPatientLinkReviewRow,
  "sourceUpdatedAt" | "sourcePayloadChecksum" | "inventoryReasonCode"
> {
  const { checks } = input;
  const possibleTargets = collectPossiblePatientTargets(checks);
  const base = {
    hubspotContactId: input.hubspotContactId,
    displayNameMasked: input.displayNameMasked,
    emailPresent: input.emailPresent,
    phonePresent: input.phonePresent,
    checks: {
      ...checks,
      possiblePatientTargets: possibleTargets,
    },
    approvedForApply: false,
    possiblePatientTargetId: null as string | null,
    relatedLeadId: checks.proposedOrMappedLeadId,
    plainLanguageEvidence: [] as string[],
    warnings: [] as string[],
    operatorLabel: input.operatorLabel ?? null,
    reviewedAt: input.reviewedAt ?? null,
  };

  if (!checks.sameTenant) {
    return {
      ...base,
      state: "excluded_non_patient",
      reasonCode: "wrong_tenant_fail_closed",
      confidence: "none",
      warnings: ["Contact is outside the authorised tenant scope."],
      plainLanguageEvidence: ["Tenant check failed — excluded."],
    };
  }

  if (checks.existingContactPatientMappingId || checks.existingPatientSourceId) {
    const target =
      checks.existingContactPatientMappingId ?? checks.existingPatientSourceId!;
    return {
      ...base,
      state: "already_resolved",
      reasonCode: "existing_patient_identity_already_present",
      confidence: "high",
      possiblePatientTargetId: target,
      plainLanguageEvidence: [
        "An existing same-tenant patient identity mapping is already present.",
      ],
    };
  }

  if (possibleTargets.length > 1) {
    return {
      ...base,
      state: "quarantine_multi_patient_conflict",
      reasonCode: "multiple_patient_targets_conflict",
      confidence: "none",
      warnings: ["More than one possible patient target was found."],
      plainLanguageEvidence: [
        `Multiple patient targets (${possibleTargets.length}) — fail closed.`,
      ],
    };
  }

  if (checks.conflicts.length > 0) {
    return {
      ...base,
      state: "quarantine_ambiguous_patient_identity",
      reasonCode: "identity_conflict_signals",
      confidence: "none",
      warnings: checks.conflicts.slice(0, 5),
      plainLanguageEvidence: ["Conflicting identity signals require quarantine."],
    };
  }

  // Trusted lead→patient relationship is sufficient without a second identifier.
  if (checks.trustedLeadPatientId && possibleTargets.length === 1) {
    return {
      ...base,
      state: "link_existing_lead_patient_relationship_already_trusted",
      reasonCode: "trusted_lead_to_patient_relationship",
      confidence: "high",
      possiblePatientTargetId: checks.trustedLeadPatientId,
      approvedForApply: true,
      plainLanguageEvidence: [
        "An existing same-tenant lead already has a trusted patient relationship.",
        "No new patient is created; only a controlled link may be proposed later.",
      ],
      warnings: [
        "Apply remains disabled until explicit human approval (1E-Q).",
      ],
    };
  }

  const reliable = checks.matchedReliableIdentifiers.filter((id) =>
    RELIABLE_PATIENT_IDENTIFIERS.has(id)
  );
  const weakOnly =
    reliable.length === 0 &&
    (checks.weakOnlySignals.length > 0 ||
      checks.exactEmailPatientIds.length === 1 ||
      checks.exactPhonePatientIds.length === 1);

  // Email-only / phone-only / name-only / fuzzy / household / timing — never approve.
  const emailOnly =
    checks.exactEmailPatientIds.length === 1 &&
    checks.exactPhonePatientIds.length === 0 &&
    !checks.trustedLeadPatientId &&
    !checks.existingPatientSourceId &&
    !checks.existingPersonSourceId;
  const phoneOnly =
    checks.exactPhonePatientIds.length === 1 &&
    checks.exactEmailPatientIds.length === 0 &&
    !checks.trustedLeadPatientId &&
    !checks.existingPatientSourceId &&
    !checks.existingPersonSourceId;

  if (emailOnly || phoneOnly || weakOnly) {
    return {
      ...base,
      state: "deferred_clinical_identity_review",
      reasonCode: emailOnly
        ? "email_only_never_approves_patient_link"
        : phoneOnly
          ? "phone_only_never_approves_patient_link"
          : "weak_identity_signals_never_approve",
      confidence: "low",
      possiblePatientTargetId: possibleTargets[0] ?? null,
      plainLanguageEvidence: [
        emailOnly
          ? "Only an email overlap with a patient was found — email alone never approves a patient link."
          : phoneOnly
            ? "Only a phone overlap with a patient was found — phone alone never approves a patient link."
            : "Only weak identity signals were found — never approve on name, fuzzy, household, owner, stage, or timing.",
      ],
      warnings: [
        "Defaulting to deferred clinical identity review.",
        "Clinical notes and sensitive content are not shown on the primary screen.",
      ],
    };
  }

  // Require ≥2 independent reliable identifiers against the same single patient.
  if (reliable.length >= 2 && possibleTargets.length === 1) {
    return {
      ...base,
      state: "approved_link_existing_patient",
      reasonCode: "two_or_more_reliable_identifiers_same_patient",
      confidence: "high",
      possiblePatientTargetId: possibleTargets[0],
      approvedForApply: true,
      plainLanguageEvidence: [
        `Matched reliable identifiers: ${reliable.join(", ")}.`,
        "Single same-tenant patient target.",
      ],
      warnings: [
        "Apply remains disabled until explicit human approval (1E-Q).",
      ],
    };
  }

  if (
    checks.existingContactLeadMappingId &&
    possibleTargets.length === 0 &&
    !checks.archived
  ) {
    return {
      ...base,
      state: "retain_crm_lead_only",
      reasonCode: "crm_lead_present_without_patient_identity",
      confidence: "medium",
      relatedLeadId: checks.existingContactLeadMappingId,
      plainLanguageEvidence: [
        "Contact already maps to a CRM lead with no confirmed patient identity.",
      ],
    };
  }

  if (checks.archived) {
    return {
      ...base,
      state: "excluded_non_patient",
      reasonCode: "archived_source_contact",
      confidence: "none",
      plainLanguageEvidence: ["Source contact is archived — excluded from patient linking."],
    };
  }

  if (!checks.sourceFresh) {
    return {
      ...base,
      state: "deferred_clinical_identity_review",
      reasonCode: "source_changed_after_fixed_cutoff",
      confidence: "low",
      possiblePatientTargetId: possibleTargets[0] ?? null,
      plainLanguageEvidence: [
        "Source activity is not within the fixed cutoff — deferred for clinical review.",
      ],
    };
  }

  // Default fail-closed.
  return {
    ...base,
    state: "deferred_clinical_identity_review",
    reasonCode: "insufficient_clinical_identity_evidence",
    confidence: "low",
    possiblePatientTargetId: possibleTargets[0] ?? null,
    plainLanguageEvidence: [
      "Evidence is insufficient for a safe patient-link decision — deferred.",
      `Reliable identifiers matched: ${reliable.length}; required: 2 (unless trusted lead→patient).`,
    ],
    warnings: [
      "Defaulting to deferred clinical identity review.",
      "Apply is disabled until a later explicit human approval.",
    ],
  };
}

export function capApprovedPatientLinks(
  rows: HubspotPatientLinkReviewRow[]
): HubspotPatientLinkReviewRow[] {
  let approved = 0;
  return [...rows]
    .sort((a, b) => a.hubspotContactId.localeCompare(b.hubspotContactId))
    .map((row) => {
      if (!row.approvedForApply) return row;
      approved += 1;
      if (approved <= HUBSPOT_PATIENT_LINK_BATCH_MAX) return row;
      return {
        ...row,
        state: "deferred_clinical_identity_review" as const,
        reasonCode: "approved_candidate_deferred_beyond_batch_max",
        approvedForApply: false,
        warnings: [
          ...row.warnings,
          `Batch max ${HUBSPOT_PATIENT_LINK_BATCH_MAX} — deferred beyond cap.`,
        ],
      };
    });
}

export function computePatientLinkReviewChecksum(
  rows: HubspotPatientLinkReviewRow[]
): string {
  const canonical = [...rows]
    .sort((a, b) => a.hubspotContactId.localeCompare(b.hubspotContactId))
    .map((row) =>
      [
        row.hubspotContactId,
        row.state,
        row.reasonCode,
        row.approvedForApply ? "1" : "0",
        row.possiblePatientTargetId ?? "",
        row.relatedLeadId ?? "",
        row.sourceUpdatedAt ?? "",
        row.sourcePayloadChecksum ?? "",
        row.confidence,
      ].join("|")
    )
    .join("\n");
  return createHash("sha256").update(canonical).digest("hex");
}

export function buildPatientLinkMutationPlan(rows: HubspotPatientLinkReviewRow[]): {
  proposedProductionLinks: number;
  proposedMappings: Array<{
    hubspotContactId: string;
    state: HubspotPatientLinkReviewState;
    possiblePatientTargetId: string | null;
    relatedLeadId: string | null;
  }>;
  expectedMutationsIfApprovedLater: string[];
  patientProtection: {
    createPatientForbidden: true;
    mergePatientForbidden: true;
    modifyPatientForbidden: true;
    relationshipWriteForbiddenUntilApproval: true;
  };
} {
  const approved = rows.filter((row) => row.approvedForApply);
  assertPatientLinkBatchSize(approved.length);
  return {
    proposedProductionLinks: approved.length,
    proposedMappings: rows.map((row) => ({
      hubspotContactId: row.hubspotContactId,
      state: row.state,
      possiblePatientTargetId: row.possiblePatientTargetId,
      relatedLeadId: row.relatedLeadId,
    })),
    expectedMutationsIfApprovedLater:
      approved.length === 0
        ? []
        : [
            "fi_hubspot_contact_lead_pilot_decisions (decision provenance only until apply)",
            "fi_external_record_mappings (contact→patient or lead relationship — only after 1E-Q approval)",
          ],
    patientProtection: {
      createPatientForbidden: true,
      mergePatientForbidden: true,
      modifyPatientForbidden: true,
      relationshipWriteForbiddenUntilApproval: true,
    },
  };
}

export function maskDisplayName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "(unnamed)";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return `${parts[0].slice(0, 1)}***`;
  }
  return `${parts[0].slice(0, 1)}*** ${parts[parts.length - 1].slice(0, 1)}***`;
}
