import { createHash } from "node:crypto";

import type { HubspotContactLeadExpansionRow } from "./hubspotContactLeadExpansionTypes";

export const HUBSPOT_LEAD_CANDIDATE_REVIEW_MILESTONE = "FI-HUBSPOT-IMPORT-1E-C";
export const HUBSPOT_LEAD_CANDIDATE_BATCH_MAX = 10;

export const HUBSPOT_LEAD_CANDIDATE_STATES = [
  "approved_create_new_lead",
  "link_existing_lead",
  "patient_link_review_required",
  "quarantine_missing_identity",
  "quarantine_duplicate_risk",
  "quarantine_test_or_smoke",
  "quarantine_spam_or_invalid",
  "excluded",
  "deferred_manual_review",
  "already_applied",
] as const;

export type HubspotLeadCandidateReviewState =
  (typeof HUBSPOT_LEAD_CANDIDATE_STATES)[number];

export type HubspotLeadCandidateReviewChecks = {
  sameTenant: boolean;
  sourceFresh: boolean;
  archived: boolean;
  existingMappingLeadId: string | null;
  existingPersonSourceId: string | null;
  existingPatientSourceId: string | null;
  exactEmailPersonIds: string[];
  exactPhonePersonIds: string[];
  duplicateCandidateEmail: boolean;
  duplicateCandidatePhone: boolean;
  validEmail: boolean;
  validPhone: boolean;
  possibleSpam: boolean;
};

export type HubspotLeadCandidateReviewRow = {
  hubspotContactId: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  sourceUpdatedAt: string | null;
  sourcePayloadChecksum: string | null;
  inventoryReasonCode: string;
  state: HubspotLeadCandidateReviewState;
  reasonCode: string;
  approvedForApply: boolean;
  targetLeadId: string | null;
  checks: HubspotLeadCandidateReviewChecks;
};

export function assertLeadCandidateBatchSize(count: number): void {
  if (count < 1 || count > HUBSPOT_LEAD_CANDIDATE_BATCH_MAX) {
    throw new Error(
      `BATCH_LIMIT: 1E-C requires 1-${HUBSPOT_LEAD_CANDIDATE_BATCH_MAX} approved candidates`
    );
  }
}

export function classifyLeadCandidate(input: {
  row: HubspotContactLeadExpansionRow;
  checks: HubspotLeadCandidateReviewChecks;
}): Omit<
  HubspotLeadCandidateReviewRow,
  "sourceUpdatedAt" | "sourcePayloadChecksum" | "inventoryReasonCode"
> {
  const { row, checks } = input;
  const base = {
    hubspotContactId: row.hubspotContactId,
    displayName: row.displayName,
    email: row.email,
    phone: row.phone,
    checks,
    approvedForApply: false,
    targetLeadId: null as string | null,
  };
  if (!checks.sameTenant) {
    return { ...base, state: "excluded", reasonCode: "wrong_tenant_fail_closed" };
  }
  if (checks.existingMappingLeadId) {
    return {
      ...base,
      state: "already_applied",
      reasonCode: "existing_contact_lead_mapping",
      targetLeadId: checks.existingMappingLeadId,
    };
  }
  if (checks.existingPatientSourceId) {
    return {
      ...base,
      state: "patient_link_review_required",
      reasonCode: "existing_patient_source_identity",
    };
  }
  if (checks.archived) {
    return { ...base, state: "excluded", reasonCode: "archived_source_contact" };
  }
  if (!row.hubspotContactId.trim() || (!row.email && !row.displayName.trim() && !row.phone)) {
    return {
      ...base,
      state: "quarantine_missing_identity",
      reasonCode: "minimum_identity_missing",
    };
  }
  if (row.decision === "quarantine_test_or_smoke") {
    return {
      ...base,
      state: "quarantine_test_or_smoke",
      reasonCode: "test_or_smoke_identity",
    };
  }
  if (checks.possibleSpam || (row.email && !checks.validEmail) || (row.phone && !checks.validPhone)) {
    return {
      ...base,
      state: "quarantine_spam_or_invalid",
      reasonCode: "invalid_or_spam_identity_signal",
    };
  }
  if (
    checks.duplicateCandidateEmail ||
    checks.duplicateCandidatePhone ||
    checks.exactEmailPersonIds.length > 1 ||
    checks.exactPhonePersonIds.length > 1
  ) {
    return {
      ...base,
      state: "quarantine_duplicate_risk",
      reasonCode: "duplicate_identity_signal",
    };
  }
  if (
    checks.existingPersonSourceId ||
    checks.exactEmailPersonIds.length === 1 ||
    checks.exactPhonePersonIds.length === 1
  ) {
    return {
      ...base,
      state: "deferred_manual_review",
      reasonCode: "existing_person_requires_nonduplicating_lead_path",
    };
  }
  if (!checks.sourceFresh) {
    return {
      ...base,
      state: "deferred_manual_review",
      reasonCode: "source_changed_after_fixed_cutoff",
    };
  }
  if (!row.email || !checks.validEmail || !row.displayName.trim()) {
    return {
      ...base,
      state: "deferred_manual_review",
      reasonCode: "insufficient_identity_for_first_creation_batch",
    };
  }
  return {
    ...base,
    state: "approved_create_new_lead",
    reasonCode: "unique_same_tenant_identity_at_fixed_cutoff",
    approvedForApply: true,
  };
}

export function deferBeyondFirstBatch(
  rows: HubspotLeadCandidateReviewRow[]
): HubspotLeadCandidateReviewRow[] {
  let approved = 0;
  return [...rows]
    .sort((a, b) => a.hubspotContactId.localeCompare(b.hubspotContactId))
    .map((row) => {
      if (row.state !== "approved_create_new_lead") return row;
      approved += 1;
      if (approved <= HUBSPOT_LEAD_CANDIDATE_BATCH_MAX) return row;
      return {
        ...row,
        state: "deferred_manual_review",
        reasonCode: "safe_candidate_deferred_beyond_first_batch",
        approvedForApply: false,
      };
    });
}

export function computeLeadCandidateReviewChecksum(
  rows: HubspotLeadCandidateReviewRow[]
): string {
  const canonical = [...rows]
    .sort((a, b) => a.hubspotContactId.localeCompare(b.hubspotContactId))
    .map((row) =>
      [
        row.hubspotContactId,
        row.state,
        row.reasonCode,
        row.approvedForApply ? "1" : "0",
        row.targetLeadId ?? "",
        row.sourceUpdatedAt ?? "",
        row.sourcePayloadChecksum ?? "",
      ].join("|")
    )
    .join("\n");
  return createHash("sha256").update(canonical).digest("hex");
}
