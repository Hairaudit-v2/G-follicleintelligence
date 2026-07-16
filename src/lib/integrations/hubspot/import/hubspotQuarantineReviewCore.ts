import { createHash } from "node:crypto";

/**
 * FI-HUBSPOT-IMPORT-1E-Q — quarantine/exclusion classification assurance gate.
 * Classification and review evidence only. No FI entity apply.
 */

export const HUBSPOT_QUARANTINE_REVIEW_MILESTONE = "FI-HUBSPOT-IMPORT-1E-Q";
export const HUBSPOT_QUARANTINE_EXPECTED_COHORT_SIZE = 110;
export const HUBSPOT_QUARANTINE_EXPECTED_QUARANTINED = 100;
export const HUBSPOT_QUARANTINE_EXPECTED_EXCLUDED = 10;
export const HUBSPOT_QUARANTINE_EXPECTED_TOTAL_CONTACTS = 4752;

/** Authoritative fixed inventory from 1E-R (pre-1E-C creates). */
export const HUBSPOT_QUARANTINE_BASE_INVENTORY_CHECKSUM =
  "3d380a980ad1a0a2ba246742c9ccee5ba7f37a39c3f29e15e572fb175365079c";

/**
 * Post-1E-Q live inventory signature after classification evidence persistence.
 * Programme position remains 4,752 contacts; 1E-C duplicate-risk row resolves live
 * as create_new_lead (saved 1E-C milestone does not override expansion inventory).
 */
export const HUBSPOT_QUARANTINE_FIXED_INVENTORY_CHECKSUM =
  "fcf3aaddd2c6f6b2107640798980d3429e08c450a81d66d430da8964e0805de6";

/** Historical post-1E-C checksum retained for provenance (1E-P boundary). */
export const HUBSPOT_QUARANTINE_POST_1EC_INVENTORY_CHECKSUM =
  "93823b3d3a322ca23abd85bea8439a0188ac71fdc1c5f8420965a34e16b10451";

export const HUBSPOT_QUARANTINE_SOURCE_CUTOFF = "2026-07-16T16:00:34.530Z";

export const HUBSPOT_QUARANTINE_FROZEN_QUARANTINED_IDS = [
  "100040617619",
  "11890514260",
  "150450600528",
  "16383520383",
  "1918501",
  "1938151",
  "1938202",
  "1938251",
  "1938701",
  "1939252",
  "1939253",
  "1939301",
  "1939651",
  "1939801",
  "1985501",
  "2005201",
  "2015451",
  "2060401",
  "2082401",
  "2122051",
  "2123401",
  "2126601",
  "2126651",
  "2138151",
  "2201551",
  "2212851",
  "2220201",
  "2225051",
  "2236401",
  "2272451",
  "228149575980",
  "228157036818",
  "2289301",
  "230741985397",
  "2317101",
  "231956151096",
  "2325751",
  "233032948147",
  "233915878521",
  "2450151",
  "2499401",
  "2601401",
  "2877551",
  "2878751",
  "2933251",
  "3151751",
  "3252301",
  "3359801",
  "5753236888",
  "77457243509",
  "78330815907",
  "78330817551",
  "78330817792",
  "79926214784",
  "79926214920",
  "79937496578",
  "79937771043",
  "79937800582",
  "79937855002",
  "79937905793",
  "79941467568",
  "79943989859",
  "79944378706",
  "79944461691",
  "79944728184",
  "79944892725",
  "79944924182",
  "79944957972",
  "79944957976",
  "79945774434",
  "79945774437",
  "79945792639",
  "79945792641",
  "79947255323",
  "82375591064",
  "82375591065",
  "82386214213",
  "82399268390",
  "82403224496",
  "82403224498",
  "82404694172",
  "82405221734",
  "82405887279",
  "82410538778",
  "82412375900",
  "82412704052",
  "82412949557",
  "82416191883",
  "82416373824",
  "82417566630",
  "82417941556",
  "82419924537",
  "82419952790",
  "82420664400",
  "82420678517",
  "82422841936",
  "82423699231",
  "82427020898",
  "82427023222",
  "82431051267",
] as const;

export const HUBSPOT_QUARANTINE_FROZEN_EXCLUDED_IDS = [
  "209718675563",
  "210108673697",
  "220633307194",
  "225728757851",
  "225808576821",
  "225811989383",
  "226003423354",
  "227250290040",
  "227695783999",
  "228703024446",
] as const;

export const HUBSPOT_QUARANTINE_FROZEN_CONTACT_IDS = [
  ...HUBSPOT_QUARANTINE_FROZEN_QUARANTINED_IDS,
  ...HUBSPOT_QUARANTINE_FROZEN_EXCLUDED_IDS,
] as const;

/** Final quarantine review states (original inventory decision was quarantine_*). */
export const HUBSPOT_QUARANTINE_FINAL_STATES = [
  "retained_test_or_smoke",
  "retained_missing_identity",
  "retained_invalid_contact",
  "retained_spam_or_junk",
  "retained_duplicate_source",
  "retained_duplicate_target_risk",
  "retained_ambiguous_identity",
  "retained_system_or_integration_record",
  "retained_archived_or_historical",
  "reclassify_create_candidate",
  "reclassify_existing_lead_link",
  "reclassify_patient_review",
  "excluded_with_reason",
  "deferred_manual_review",
] as const;

/** Final exclusion review states (original inventory decision was excluded). */
export const HUBSPOT_EXCLUSION_FINAL_STATES = [
  "excluded_test_or_demo",
  "excluded_system_record",
  "excluded_non_person_entity",
  "excluded_out_of_scope_source",
  "excluded_archived_without_business_value",
  "excluded_duplicate_source",
  "excluded_by_documented_business_rule",
  "reclassify_quarantine",
  "reclassify_create_candidate",
  "reclassify_existing_lead_link",
  "deferred_manual_review",
] as const;

export const HUBSPOT_QUARANTINE_REVIEW_STATES = [
  ...new Set([
    ...HUBSPOT_QUARANTINE_FINAL_STATES,
    ...HUBSPOT_EXCLUSION_FINAL_STATES,
  ]),
] as const;

export type HubspotQuarantineReviewState =
  (typeof HUBSPOT_QUARANTINE_REVIEW_STATES)[number];

export type HubspotQuarantineOriginalBucket = "quarantined" | "excluded";

export const HUBSPOT_QUARANTINE_AUTHORIZED_ROLES = [
  "clinic_admin",
  "operations_admin",
  "owner",
  "platform_admin",
] as const;

export type HubspotQuarantineAuthorizedRole =
  (typeof HUBSPOT_QUARANTINE_AUTHORIZED_ROLES)[number];

export type HubspotQuarantineEvidenceChecks = {
  sameTenant: boolean;
  sourceFresh: boolean;
  archived: boolean;
  convertedLead: boolean;
  existingContactLeadMappingId: string | null;
  existingContactPatientMappingId: string | null;
  existingPatientSourceId: string | null;
  existingPersonSourceId: string | null;
  exactEmailPersonIds: string[];
  exactPhonePersonIds: string[];
  exactEmailPatientIds: string[];
  exactPhonePatientIds: string[];
  uniqueLeadCandidateId: string | null;
  multiLeadCandidateIds: string[];
  duplicateSourceEmail: boolean;
  duplicateSourcePhone: boolean;
  testOrSmoke: boolean;
  spamOrJunk: boolean;
  systemOrIntegration: boolean;
  missingIdentity: boolean;
  invalidContact: boolean;
  patientWarning: boolean;
  sourceAfterCutoff: boolean;
};

export type HubspotQuarantineReviewRow = {
  hubspotContactId: string;
  displayNameMasked: string;
  emailPresent: boolean;
  phonePresent: boolean;
  originalBucket: HubspotQuarantineOriginalBucket;
  originalDecision: string;
  originalReasonCode: string;
  state: HubspotQuarantineReviewState;
  reasonCode: string;
  approvedForApply: false;
  possibleLegitimateContact: boolean;
  plainLanguageEvidence: string[];
  warnings: string[];
  checks: HubspotQuarantineEvidenceChecks;
  sourceUpdatedAt: string | null;
  sourcePayloadChecksum: string | null;
  operatorLabel: string | null;
  reviewedAt: string | null;
};

export function emptyQuarantineChecks(): HubspotQuarantineEvidenceChecks {
  return {
    sameTenant: true,
    sourceFresh: true,
    archived: false,
    convertedLead: false,
    existingContactLeadMappingId: null,
    existingContactPatientMappingId: null,
    existingPatientSourceId: null,
    existingPersonSourceId: null,
    exactEmailPersonIds: [],
    exactPhonePersonIds: [],
    exactEmailPatientIds: [],
    exactPhonePatientIds: [],
    uniqueLeadCandidateId: null,
    multiLeadCandidateIds: [],
    duplicateSourceEmail: false,
    duplicateSourcePhone: false,
    testOrSmoke: false,
    spamOrJunk: false,
    systemOrIntegration: false,
    missingIdentity: false,
    invalidContact: false,
    patientWarning: false,
    sourceAfterCutoff: false,
  };
}

export function isAuthorizedQuarantineReviewRole(
  role: string | null | undefined
): boolean {
  const normalized = String(role ?? "")
    .trim()
    .toLowerCase();
  return (HUBSPOT_QUARANTINE_AUTHORIZED_ROLES as readonly string[]).includes(
    normalized
  );
}

export function assertQuarantineCohortIds(ids: string[]): void {
  const expected = [...HUBSPOT_QUARANTINE_FROZEN_CONTACT_IDS].sort();
  const actual = [...ids].sort();
  if (
    actual.length !== expected.length ||
    actual.some((id, i) => id !== expected[i])
  ) {
    throw new Error(
      `1E_Q_GUARD: quarantine/exclusion cohort drift — expected ${expected.length} frozen IDs, found ${actual.length}`
    );
  }
}

export function assertQuarantineBucketIds(input: {
  quarantinedIds: string[];
  excludedIds: string[];
}): void {
  const qExpected = [...HUBSPOT_QUARANTINE_FROZEN_QUARANTINED_IDS].sort();
  const eExpected = [...HUBSPOT_QUARANTINE_FROZEN_EXCLUDED_IDS].sort();
  const qActual = [...input.quarantinedIds].sort();
  const eActual = [...input.excludedIds].sort();
  if (
    qActual.length !== qExpected.length ||
    qActual.some((id, i) => id !== qExpected[i]) ||
    eActual.length !== eExpected.length ||
    eActual.some((id, i) => id !== eExpected[i])
  ) {
    throw new Error(
      "1E_Q_GUARD: quarantined/excluded bucket drift from frozen 1E-R cohort"
    );
  }
}

export function maskDisplayName(name: string | null | undefined): string {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "(unnamed)";
  return parts
    .map((part) => (part.length <= 1 ? "*" : `${part[0]}***`))
    .join(" ");
}

export function assertNoProductionMutationAllowlist(
  table: string,
  operation: string
): void {
  const forbidden = new Set([
    "fi_patients",
    "fi_patient_source_ids",
    "fi_crm_leads",
    "fi_persons",
    "fi_person_source_ids",
    "fi_staff",
    "fi_users",
    "fi_crm_tasks",
    "fi_crm_messages",
    "fi_reception_tasks",
    "fi_admin_notifications",
    "fi_bookings",
    "fi_external_record_mappings",
    "fi_external_hubspot_backup_watermarks",
    "fi_external_hubspot_contact_staging",
  ]);
  if (forbidden.has(table) && operation !== "select") {
    throw new Error(
      `1E_Q_GUARD: ${operation} on ${table} is forbidden during quarantine classification (review evidence only)`
    );
  }
}

export function assertQuarantineReviewChecksum(
  actual: string,
  expected: string
): void {
  if (actual !== expected) {
    throw new Error("1E_Q_GUARD: stale or mutated quarantine review checksum");
  }
}

function isValidFinalState(
  originalBucket: HubspotQuarantineOriginalBucket,
  state: HubspotQuarantineReviewState
): boolean {
  if (originalBucket === "quarantined") {
    return (HUBSPOT_QUARANTINE_FINAL_STATES as readonly string[]).includes(state);
  }
  return (HUBSPOT_EXCLUSION_FINAL_STATES as readonly string[]).includes(state);
}

export function classifyQuarantineReview(input: {
  hubspotContactId: string;
  displayNameMasked: string;
  emailPresent: boolean;
  phonePresent: boolean;
  originalBucket: HubspotQuarantineOriginalBucket;
  originalDecision: string;
  originalReasonCode: string;
  checks: HubspotQuarantineEvidenceChecks;
  operatorLabel?: string | null;
  reviewedAt?: string | null;
}): Omit<HubspotQuarantineReviewRow, "sourceUpdatedAt" | "sourcePayloadChecksum"> {
  const { checks, originalBucket } = input;
  const base = {
    hubspotContactId: input.hubspotContactId,
    displayNameMasked: input.displayNameMasked,
    emailPresent: input.emailPresent,
    phonePresent: input.phonePresent,
    originalBucket,
    originalDecision: input.originalDecision,
    originalReasonCode: input.originalReasonCode,
    approvedForApply: false as const,
    possibleLegitimateContact: false,
    plainLanguageEvidence: [] as string[],
    warnings: [] as string[],
    checks,
    operatorLabel: input.operatorLabel ?? null,
    reviewedAt: input.reviewedAt ?? null,
  };

  const finish = (
    state: HubspotQuarantineReviewState,
    reasonCode: string,
    evidence: string[],
    extra?: Partial<typeof base>
  ): Omit<HubspotQuarantineReviewRow, "sourceUpdatedAt" | "sourcePayloadChecksum"> => {
    if (!isValidFinalState(originalBucket, state)) {
      return {
        ...base,
        ...extra,
        state: "deferred_manual_review",
        reasonCode: "invalid_state_for_original_bucket_fail_closed",
        plainLanguageEvidence: [
          `Proposed state ${state} is not valid for ${originalBucket} — deferred.`,
          ...evidence,
        ],
        warnings: [
          ...(extra?.warnings ?? base.warnings),
          "Fail-closed: invalid final state for original bucket.",
        ],
      };
    }
    return {
      ...base,
      ...extra,
      state,
      reasonCode,
      plainLanguageEvidence: evidence,
    };
  };

  if (!checks.sameTenant) {
    return finish(
      originalBucket === "excluded"
        ? "excluded_out_of_scope_source"
        : "excluded_with_reason",
      "wrong_tenant_fail_closed",
      ["Contact is outside the authorised tenant scope."]
    );
  }

  if (checks.sourceAfterCutoff || !checks.sourceFresh) {
    return finish(
      "deferred_manual_review",
      "source_freshness_incomplete_or_after_cutoff",
      [
        "Source freshness check failed or record changed after the fixed cutoff.",
        "Defaulting to deferred manual review.",
      ],
      { warnings: ["Evidence incomplete for a final retain/reclassify decision."] }
    );
  }

  if (
    checks.patientWarning ||
    checks.existingPatientSourceId ||
    checks.existingContactPatientMappingId ||
    checks.exactEmailPatientIds.length > 0 ||
    checks.exactPhonePatientIds.length > 0
  ) {
    if (originalBucket === "quarantined") {
      return finish(
        "reclassify_patient_review",
        "deterministic_patient_identity_signal",
        [
          "Same-tenant patient identity signals require patient-link review.",
          "Reclassified read-only — not applied.",
        ],
        {
          possibleLegitimateContact: true,
          warnings: ["Patient review remains out of 1E-Q apply scope."],
        }
      );
    }
    return finish(
      "deferred_manual_review",
      "patient_signal_on_excluded_requires_manual_review",
      ["Excluded contact shows patient identity signals — deferred."]
    );
  }

  if (checks.existingContactLeadMappingId) {
    return finish(
      "reclassify_existing_lead_link",
      "existing_contact_lead_mapping_present",
      [
        "An existing same-tenant contact→lead mapping is already present.",
        "Reclassified read-only — not applied.",
      ],
      { possibleLegitimateContact: true }
    );
  }

  if (
    checks.existingPersonSourceId &&
    checks.uniqueLeadCandidateId &&
    checks.multiLeadCandidateIds.length === 0 &&
    checks.exactEmailPersonIds.length <= 1 &&
    checks.exactPhonePersonIds.length <= 1
  ) {
    return finish(
      "reclassify_existing_lead_link",
      "person_source_id_unique_lead_candidate",
      [
        "Person source identity resolves to a unique same-tenant lead candidate.",
        "Reclassified read-only — not applied.",
      ],
      { possibleLegitimateContact: true }
    );
  }

  if (checks.uniqueLeadCandidateId && checks.multiLeadCandidateIds.length === 0) {
    return finish(
      "reclassify_existing_lead_link",
      "unique_same_tenant_lead_candidate",
      [
        "Exact identity resolves to a unique same-tenant lead.",
        "Reclassified read-only — not applied.",
      ],
      { possibleLegitimateContact: true }
    );
  }

  if (
    checks.multiLeadCandidateIds.length > 1 ||
    checks.exactEmailPersonIds.length > 1 ||
    checks.exactPhonePersonIds.length > 1
  ) {
    if (originalBucket === "quarantined") {
      return finish(
        "retained_ambiguous_identity",
        "multi_person_or_multi_lead_ambiguity",
        ["Multiple same-tenant identity targets remain — retained as ambiguous."]
      );
    }
    return finish(
      "deferred_manual_review",
      "ambiguous_identity_on_excluded_cohort",
      ["Excluded contact has ambiguous identity signals — deferred."]
    );
  }

  if (checks.duplicateSourceEmail || checks.duplicateSourcePhone) {
    // Archived exclusions keep the archived reason; duplicate is secondary evidence.
    if (originalBucket === "excluded" && (checks.archived || checks.convertedLead)) {
      return finish(
        "excluded_archived_without_business_value",
        "archived_hubspot_contact_policy_skip",
        [
          "Archived/historical HubSpot contact remains excluded without business value.",
          "Duplicate source signals were noted but do not change the archived exclusion.",
        ]
      );
    }
    if (originalBucket === "quarantined") {
      return finish(
        checks.exactEmailPersonIds.length === 1 ||
          checks.exactPhonePersonIds.length === 1
          ? "retained_duplicate_target_risk"
          : "retained_duplicate_source",
        checks.exactEmailPersonIds.length === 1 ||
          checks.exactPhonePersonIds.length === 1
          ? "duplicate_target_identity_risk"
          : "duplicate_source_identity_signal",
        ["Duplicate source identity signals require retention without apply."]
      );
    }
    return finish(
      "excluded_duplicate_source",
      "duplicate_source_on_excluded_cohort",
      ["Excluded contact retains duplicate-source exclusion."]
    );
  }

  if (checks.testOrSmoke) {
    if (originalBucket === "quarantined") {
      return finish(
        "retained_test_or_smoke",
        "test_or_smoke_identity_retained",
        ["Test/smoke identity signals confirm retention in quarantine."]
      );
    }
    return finish(
      "excluded_test_or_demo",
      "test_or_demo_identity_excluded",
      ["Test/demo identity confirms exclusion."]
    );
  }

  if (checks.systemOrIntegration) {
    if (originalBucket === "quarantined") {
      return finish(
        "retained_system_or_integration_record",
        "system_or_integration_identity",
        ["System/integration record pattern — retained."]
      );
    }
    return finish(
      "excluded_system_record",
      "system_or_integration_excluded",
      ["System/integration record — excluded."]
    );
  }

  if (checks.spamOrJunk) {
    if (originalBucket === "quarantined") {
      return finish(
        "retained_spam_or_junk",
        "spam_or_junk_identity_retained",
        ["Spam/junk identity signals — retained in quarantine."]
      );
    }
    return finish(
      "excluded_by_documented_business_rule",
      "spam_or_junk_excluded_by_policy",
      ["Spam/junk identity — excluded by documented policy."]
    );
  }

  if (checks.archived || checks.convertedLead) {
    if (originalBucket === "excluded") {
      return finish(
        "excluded_archived_without_business_value",
        "archived_hubspot_contact_policy_skip",
        [
          "Archived/historical HubSpot contact remains excluded without business value.",
        ]
      );
    }
    return finish(
      "retained_archived_or_historical",
      "archived_or_converted_retained",
      ["Archived or converted historical contact — retained."]
    );
  }

  if (checks.missingIdentity) {
    if (originalBucket === "quarantined") {
      return finish(
        "retained_missing_identity",
        "minimum_identity_missing",
        ["Minimum identity fields are missing — retained."]
      );
    }
    return finish(
      "excluded_non_person_entity",
      "missing_identity_non_person",
      ["Missing identity on excluded cohort — treated as non-person."]
    );
  }

  if (checks.invalidContact) {
    if (originalBucket === "quarantined") {
      return finish(
        "retained_invalid_contact",
        "invalid_contact_identity",
        ["Invalid contact identity — retained."]
      );
    }
    return finish(
      "excluded_by_documented_business_rule",
      "invalid_contact_excluded",
      ["Invalid contact — excluded by documented rule."]
    );
  }

  // Deterministic create candidate: clean identity, no conflicts, not test/spam.
  if (
    !checks.testOrSmoke &&
    !checks.spamOrJunk &&
    !checks.systemOrIntegration &&
    !checks.archived &&
    !checks.missingIdentity &&
    !checks.invalidContact &&
    !checks.duplicateSourceEmail &&
    !checks.duplicateSourcePhone &&
    checks.exactEmailPersonIds.length === 0 &&
    checks.exactPhonePersonIds.length === 0 &&
    checks.multiLeadCandidateIds.length === 0 &&
    !checks.uniqueLeadCandidateId &&
    (input.emailPresent || input.phonePresent)
  ) {
    return finish(
      "reclassify_create_candidate",
      "deterministic_unique_create_candidate_unapplied",
      [
        "No conflicting same-tenant person/lead/patient identity was found.",
        "Reclassified as create candidate read-only — not applied.",
      ],
      { possibleLegitimateContact: true }
    );
  }

  if (
    originalBucket === "excluded" &&
    input.originalReasonCode === "archived_hubspot_contact_policy_skip"
  ) {
    return finish(
      "excluded_archived_without_business_value",
      "archived_hubspot_contact_policy_skip",
      ["Original archived exclusion retained."]
    );
  }

  if (originalBucket === "quarantined") {
    if (input.originalDecision === "quarantine_ambiguous_identity") {
      return finish(
        "retained_ambiguous_identity",
        input.originalReasonCode || "ambiguous_identity_retained",
        ["Original ambiguous identity classification retained after re-check."]
      );
    }
    if (input.originalDecision === "quarantine_test_or_smoke") {
      return finish(
        "retained_test_or_smoke",
        input.originalReasonCode || "test_or_smoke_retained",
        ["Original test/smoke quarantine retained after re-check."]
      );
    }
  }

  return finish(
    "deferred_manual_review",
    "evidence_incomplete_fail_closed",
    [
      "Evidence is incomplete for a more specific final state.",
      "Defaulting to deferred manual review.",
    ],
    { warnings: ["Fail-closed deferred classification."] }
  );
}

export function computeQuarantineReviewChecksum(
  rows: HubspotQuarantineReviewRow[]
): string {
  const canonical = [...rows]
    .sort((a, b) => a.hubspotContactId.localeCompare(b.hubspotContactId))
    .map((row) =>
      [
        row.hubspotContactId,
        row.originalBucket,
        row.originalDecision,
        row.originalReasonCode,
        row.state,
        row.reasonCode,
        row.sourceUpdatedAt ?? "",
        row.sourcePayloadChecksum ?? "",
      ].join("|")
    )
    .join("\n");
  return createHash("sha256").update(canonical).digest("hex");
}

export function summarizeQuarantineReview(rows: HubspotQuarantineReviewRow[]): {
  stateCounts: Record<string, number>;
  retainedCount: number;
  excludedCount: number;
  reclassifiedCount: number;
  deferredCount: number;
  possibleLegitimateCount: number;
  reclassifiedCohorts: {
    createCandidates: string[];
    existingLeadLinks: string[];
    patientReview: string[];
    reclassifyQuarantine: string[];
  };
} {
  const stateCounts: Record<string, number> = {};
  const reclassifiedCohorts = {
    createCandidates: [] as string[],
    existingLeadLinks: [] as string[],
    patientReview: [] as string[],
    reclassifyQuarantine: [] as string[],
  };
  let retainedCount = 0;
  let excludedCount = 0;
  let reclassifiedCount = 0;
  let deferredCount = 0;
  let possibleLegitimateCount = 0;

  for (const row of rows) {
    stateCounts[row.state] = (stateCounts[row.state] ?? 0) + 1;
    if (row.possibleLegitimateContact) possibleLegitimateCount += 1;
    if (row.state === "deferred_manual_review") deferredCount += 1;
    else if (row.state.startsWith("reclassify_")) {
      reclassifiedCount += 1;
      if (row.state === "reclassify_create_candidate") {
        reclassifiedCohorts.createCandidates.push(row.hubspotContactId);
      } else if (row.state === "reclassify_existing_lead_link") {
        reclassifiedCohorts.existingLeadLinks.push(row.hubspotContactId);
      } else if (row.state === "reclassify_patient_review") {
        reclassifiedCohorts.patientReview.push(row.hubspotContactId);
      } else if (row.state === "reclassify_quarantine") {
        reclassifiedCohorts.reclassifyQuarantine.push(row.hubspotContactId);
      }
    } else if (row.state.startsWith("retained_")) retainedCount += 1;
    else if (row.state.startsWith("excluded_")) excludedCount += 1;
  }

  for (const key of Object.keys(reclassifiedCohorts) as Array<
    keyof typeof reclassifiedCohorts
  >) {
    reclassifiedCohorts[key].sort();
  }

  return {
    stateCounts,
    retainedCount,
    excludedCount,
    reclassifiedCount,
    deferredCount,
    possibleLegitimateCount,
    reclassifiedCohorts,
  };
}

export function buildQuarantineReconciliation(input: {
  mapped: number;
  deferredCreate: number;
  duplicateRiskCreate: number;
  deferredPatientReview: number;
  rows: HubspotQuarantineReviewRow[];
}): {
  mapped: number;
  deferredCreate: number;
  duplicateRiskCreate: number;
  deferredPatientReview: number;
  retainedQuarantineOrExclusion: number;
  reclassifiedReadOnly: number;
  deferredManualReview: number;
  total: number;
  unexplained: number;
  wrongTenant: number;
  balanced: boolean;
} {
  const summary = summarizeQuarantineReview(input.rows);
  const retainedQuarantineOrExclusion =
    summary.retainedCount + summary.excludedCount;
  const reclassifiedReadOnly = summary.reclassifiedCount;
  const deferredManualReview = summary.deferredCount;
  const total =
    input.mapped +
    input.deferredCreate +
    input.duplicateRiskCreate +
    input.deferredPatientReview +
    retainedQuarantineOrExclusion +
    reclassifiedReadOnly +
    deferredManualReview;
  const unexplained = HUBSPOT_QUARANTINE_EXPECTED_TOTAL_CONTACTS - total;
  const wrongTenant = input.rows.filter((r) => !r.checks.sameTenant).length;
  return {
    mapped: input.mapped,
    deferredCreate: input.deferredCreate,
    duplicateRiskCreate: input.duplicateRiskCreate,
    deferredPatientReview: input.deferredPatientReview,
    retainedQuarantineOrExclusion,
    reclassifiedReadOnly,
    deferredManualReview,
    total,
    unexplained,
    wrongTenant,
    balanced:
      unexplained === 0 &&
      wrongTenant === 0 &&
      total === HUBSPOT_QUARANTINE_EXPECTED_TOTAL_CONTACTS,
  };
}

export function inventoryDecisionForOriginal(
  originalBucket: HubspotQuarantineOriginalBucket,
  originalDecision: string
): string {
  if (originalBucket === "excluded") return "excluded";
  if (originalDecision.startsWith("quarantine_")) return originalDecision;
  return "quarantine_ambiguous_identity";
}
