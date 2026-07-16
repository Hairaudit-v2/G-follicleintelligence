/**
 * FI-HUBSPOT-IMPORT-1A — deterministic identity resolution (pure, no I/O).
 *
 * Precedence: Tier 1 → 2 → 3 → 4 → 5 (quarantine).
 * Forbidden: fuzzy name, approximate email/phone, AI/probabilistic, cross-tenant.
 */

import { createHash } from "node:crypto";

import { normalizeEmail } from "@/src/lib/fi/foundation/normalize";
import { isPlaceholderEmail } from "@/src/lib/fi/foundation/normalize";
import {
  LEAD_VS_PATIENT_POLICY_V1,
  classifyOwnerMapping,
  mapHubspotSalesPipelineStageV1,
  wouldRegressFiStage,
} from "./hubspotImportMappingV1";
import type {
  FiIdentitySnapshot,
  HubspotContactDryRunInput,
  HubspotImportDecision,
  HubspotImportDecisionRecord,
  HubspotIdentityConfidence,
  HubspotIdentityTier,
  HubspotOwnerDryRunInput,
  HubspotOwnerMappingClass,
  HubspotSideEffectRisk,
} from "./hubspotImportTypes";
import {
  HUBSPOT_IMPORT_MAPPING_VERSION,
  HUBSPOT_IMPORT_SOURCE_SYSTEM,
} from "./hubspotImportTypes";

export function privacySafeSourceIdHash(sourceRecordId: string): string {
  return createHash("sha256").update(`hubspot:${sourceRecordId}`).digest("hex").slice(0, 16);
}

export function isScientificNotationPhone(phone: string | null | undefined): boolean {
  if (!phone?.trim()) return false;
  return /^\d+(\.\d+)?[eE][+\-]\d+$/.test(phone.trim());
}

export function normalizePhoneDigits(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  if (isScientificNotationPhone(phone)) return null;
  const d = phone.replace(/\D/g, "");
  return d.length >= 8 ? d : null;
}

export function isTestOrSmokeContact(input: {
  emailNormalized: string | null;
  hubspotContactId: string;
  lifecycleStage?: string | null;
  displayName?: string | null;
}): boolean {
  if (isPlaceholderEmail(input.emailNormalized)) return true;
  const email = (input.emailNormalized ?? "").toLowerCase();
  if (
    email.startsWith("test@") ||
    email.startsWith("smoke@") ||
    email.includes("+test@") ||
    email.includes("test+") ||
    email.endsWith("@example.com") ||
    email.endsWith("@test.com")
  ) {
    return true;
  }
  const id = input.hubspotContactId.toLowerCase();
  if (id.includes("test") || id.includes("smoke")) return true;
  const life = (input.lifecycleStage ?? "").toLowerCase();
  if (life.includes("fi os backup test") || life.includes("smoke")) return true;
  const name = (input.displayName ?? "").trim().toLowerCase();
  if (name === "test" || name.startsWith("test ") || name.includes(" smoke")) return true;
  return false;
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export type ResolveContactIdentityResult = {
  decision: HubspotImportDecision;
  proposedFiEntityType: HubspotImportDecisionRecord["proposedFiEntityType"];
  proposedFiEntityId: string | null;
  identityTier: HubspotIdentityTier;
  confidenceType: HubspotIdentityConfidence;
  reasonCode: string;
  sideEffectRisks: HubspotSideEffectRisk[];
  wrongTenant: boolean;
};

/**
 * Resolve one HubSpot contact against a tenant-scoped FI snapshot.
 * Caller must only populate the snapshot from the same tenantId.
 */
export function resolveHubspotContactImportIdentity(
  contact: HubspotContactDryRunInput,
  snapshot: FiIdentitySnapshot,
  options?: { expectedTenantId?: string }
): ResolveContactIdentityResult {
  if (options?.expectedTenantId && contact.tenantId !== options.expectedTenantId) {
    return {
      decision: "conflict_multiple_targets",
      proposedFiEntityType: "none",
      proposedFiEntityId: null,
      identityTier: "tier5_ambiguous",
      confidenceType: "none",
      reasonCode: "tenant_mismatch_fail_closed",
      sideEffectRisks: [],
      wrongTenant: true,
    };
  }

  if (!contact.hubspotContactId.trim()) {
    return {
      decision: "quarantine_missing_identity",
      proposedFiEntityType: "none",
      proposedFiEntityId: null,
      identityTier: "none",
      confidenceType: "none",
      reasonCode: "missing_canonical_hubspot_contact_id",
      sideEffectRisks: [],
      wrongTenant: false,
    };
  }

  if (contact.isTestOrSmoke) {
    return {
      decision: "quarantine_test_or_smoke",
      proposedFiEntityType: "none",
      proposedFiEntityId: null,
      identityTier: "none",
      confidenceType: "none",
      reasonCode: "excluded_test_or_smoke_identity",
      sideEffectRisks: [],
      wrongTenant: false,
    };
  }

  if (contact.archived) {
    return {
      decision: "skip_out_of_scope",
      proposedFiEntityType: "none",
      proposedFiEntityId: null,
      identityTier: "none",
      confidenceType: "none",
      reasonCode: "archived_hubspot_contact_policy_skip",
      sideEffectRisks: [],
      wrongTenant: false,
    };
  }

  if (contact.importStatus === "imported") {
    const existingLead = snapshot.externalContactToLead.get(contact.hubspotContactId);
    return {
      decision: "skip_already_imported",
      proposedFiEntityType: existingLead ? "lead" : "none",
      proposedFiEntityId: existingLead ?? null,
      identityTier: "tier1_external_identity",
      confidenceType: "exact_external",
      reasonCode: "staging_import_status_already_imported",
      sideEffectRisks: [],
      wrongTenant: false,
    };
  }

  // Tier 1 / 2 / 3 — existing external / explicit HubSpot refs
  const personFromExternal = snapshot.externalContactToPerson.get(contact.hubspotContactId);
  const patientFromExternal = snapshot.externalContactToPatient.get(contact.hubspotContactId);
  const leadFromExternal = snapshot.externalContactToLead.get(contact.hubspotContactId);

  const linkedTargets: Array<{ type: "lead" | "patient" | "person"; id: string }> = [];
  if (leadFromExternal) linkedTargets.push({ type: "lead", id: leadFromExternal });
  if (patientFromExternal) linkedTargets.push({ type: "patient", id: patientFromExternal });
  if (personFromExternal && !leadFromExternal && !patientFromExternal) {
    linkedTargets.push({ type: "person", id: personFromExternal });
  }

  if (linkedTargets.length > 1) {
    // One source → multiple FI entity types can be valid (person+lead+patient facet),
    // but one source must not map to multiple leads or multiple patients.
    const leadIds = unique(linkedTargets.filter((t) => t.type === "lead").map((t) => t.id));
    const patientIds = unique(linkedTargets.filter((t) => t.type === "patient").map((t) => t.id));
    if (leadIds.length > 1 || patientIds.length > 1) {
      return {
        decision: "conflict_multiple_targets",
        proposedFiEntityType: "none",
        proposedFiEntityId: null,
        identityTier: "tier5_ambiguous",
        confidenceType: "none",
        reasonCode: "one_source_multiple_same_type_targets",
        sideEffectRisks: [],
        wrongTenant: false,
      };
    }
  }

  if (leadFromExternal) {
    return {
      decision: "link_existing_lead",
      proposedFiEntityType: "lead",
      proposedFiEntityId: leadFromExternal,
      identityTier: "tier1_external_identity",
      confidenceType: "exact_external",
      reasonCode: "existing_external_lead_or_source_id",
      sideEffectRisks: sideEffectsForContact(contact, leadFromExternal, snapshot),
      wrongTenant: false,
    };
  }

  if (patientFromExternal) {
    return {
      decision: "link_existing_patient",
      proposedFiEntityType: "patient",
      proposedFiEntityId: patientFromExternal,
      identityTier: "tier1_external_identity",
      confidenceType: "exact_external",
      reasonCode: "existing_external_patient_source_id",
      sideEffectRisks: ["analytics"],
      wrongTenant: false,
    };
  }

  if (personFromExternal) {
    const leads = snapshot.personToLeadIds.get(personFromExternal) ?? [];
    const patientId = snapshot.personToPatientId.get(personFromExternal) ?? null;
    if (leads.length === 1) {
      return {
        decision: "link_existing_lead",
        proposedFiEntityType: "lead",
        proposedFiEntityId: leads[0],
        identityTier: "tier2_explicit_hubspot_ref",
        confidenceType: "exact_external",
        reasonCode: "person_source_id_single_lead",
        sideEffectRisks: sideEffectsForContact(contact, leads[0], snapshot),
        wrongTenant: false,
      };
    }
    if (leads.length > 1) {
      return {
        decision: "quarantine_ambiguous_identity",
        proposedFiEntityType: "none",
        proposedFiEntityId: null,
        identityTier: "tier5_ambiguous",
        confidenceType: "none",
        reasonCode: "person_source_id_multiple_leads",
        sideEffectRisks: [],
        wrongTenant: false,
      };
    }
    if (patientId) {
      return {
        decision: "link_existing_patient",
        proposedFiEntityType: "patient",
        proposedFiEntityId: patientId,
        identityTier: "tier2_explicit_hubspot_ref",
        confidenceType: "exact_external",
        reasonCode: "person_source_id_patient_only",
        sideEffectRisks: ["analytics"],
        wrongTenant: false,
      };
    }
    // Person exists without lead/patient — enrich path creates lead under apply gate.
    return {
      decision: "create_new_lead",
      proposedFiEntityType: "lead",
      proposedFiEntityId: null,
      identityTier: "tier2_explicit_hubspot_ref",
      confidenceType: "exact_external",
      reasonCode: "person_source_id_no_lead_propose_create_lead",
      sideEffectRisks: ownerSideEffects(contact, snapshot),
      wrongTenant: false,
    };
  }

  // Tier 4 — exact email (lead only). Never auto-merge into clinical patient.
  const email = contact.emailNormalized ? normalizeEmail(contact.emailNormalized) : null;
  if (email && LEAD_VS_PATIENT_POLICY_V1.emailAloneMayLinkLead) {
    const personIds = unique(snapshot.emailToPersonIds.get(email) ?? []);
    if (personIds.length > 1) {
      return {
        decision: "quarantine_ambiguous_identity",
        proposedFiEntityType: "none",
        proposedFiEntityId: null,
        identityTier: "tier5_ambiguous",
        confidenceType: "none",
        reasonCode: "email_matches_multiple_persons",
        sideEffectRisks: [],
        wrongTenant: false,
      };
    }
    if (personIds.length === 1) {
      const personId = personIds[0];
      const leads = snapshot.personToLeadIds.get(personId) ?? [];
      const patientId = snapshot.personToPatientId.get(personId) ?? null;
      if (leads.length === 1) {
        return {
          decision: "link_existing_lead",
          proposedFiEntityType: "lead",
          proposedFiEntityId: leads[0],
          identityTier: "tier4_deterministic_business_identity",
          confidenceType: "exact_business",
          reasonCode: "exact_email_single_lead",
          sideEffectRisks: sideEffectsForContact(contact, leads[0], snapshot),
          wrongTenant: false,
        };
      }
      if (leads.length > 1) {
        return {
          decision: "quarantine_ambiguous_identity",
          proposedFiEntityType: "none",
          proposedFiEntityId: null,
          identityTier: "tier5_ambiguous",
          confidenceType: "none",
          reasonCode: "exact_email_multiple_leads",
          sideEffectRisks: [],
          wrongTenant: false,
        };
      }
      if (patientId && !LEAD_VS_PATIENT_POLICY_V1.emailAloneMayLinkPatient) {
        return {
          decision: "quarantine_patient_link_requires_stronger_evidence",
          proposedFiEntityType: "patient",
          proposedFiEntityId: patientId,
          identityTier: "tier5_ambiguous",
          confidenceType: "none",
          reasonCode: "email_matches_patient_without_stronger_evidence",
          sideEffectRisks: [],
          wrongTenant: false,
        };
      }
    }
  }

  // Phone-only: v1 always quarantine (recycled numbers / family phones).
  if (!email && contact.phoneDigits && !contact.phoneCorrupted) {
    const phonePersons = unique(snapshot.phoneToPersonIds.get(contact.phoneDigits) ?? []);
    if (phonePersons.length >= 1) {
      return {
        decision: "quarantine_ambiguous_identity",
        proposedFiEntityType: "none",
        proposedFiEntityId: null,
        identityTier: "tier5_ambiguous",
        confidenceType: "none",
        reasonCode: "phone_only_match_not_deterministic_enough_v1",
        sideEffectRisks: [],
        wrongTenant: false,
      };
    }
  }

  // No match — propose create lead only when minimum safe identity exists.
  const hasMinIdentity = Boolean(email) || Boolean(contact.hubspotContactId);
  if (!hasMinIdentity) {
    return {
      decision: "quarantine_missing_identity",
      proposedFiEntityType: "none",
      proposedFiEntityId: null,
      identityTier: "none",
      confidenceType: "none",
      reasonCode: "insufficient_identity_fields",
      sideEffectRisks: [],
      wrongTenant: false,
    };
  }

  // Never create patient from HubSpot contact.
  if (LEAD_VS_PATIENT_POLICY_V1.createPatientFromHubspotContact) {
    throw new Error("POLICY_VIOLATION: createPatientFromHubspotContact must be false in v1");
  }

  return {
    decision: "create_new_lead",
    proposedFiEntityType: "lead",
    proposedFiEntityId: null,
    identityTier: "none",
    confidenceType: "none",
    reasonCode: "no_deterministic_match_propose_new_lead",
    sideEffectRisks: ownerSideEffects(contact, snapshot),
    wrongTenant: false,
  };
}

function ownerSideEffects(
  contact: HubspotContactDryRunInput,
  snapshot: FiIdentitySnapshot
): HubspotSideEffectRisk[] {
  const risks: HubspotSideEffectRisk[] = ["analytics"];
  if (!contact.hubspotOwnerId) return risks;
  const mapped = snapshot.externalOwnerToStaff.get(contact.hubspotOwnerId);
  if (!mapped) {
    risks.push("staff_assignment");
    return risks;
  }
  if (!mapped.isActive) {
    risks.push("staff_assignment");
    return risks;
  }
  risks.push("staff_assignment");
  return risks;
}

function sideEffectsForContact(
  contact: HubspotContactDryRunInput,
  leadId: string,
  snapshot: FiIdentitySnapshot
): HubspotSideEffectRisk[] {
  const risks = ownerSideEffects(contact, snapshot);
  const stage = mapHubspotSalesPipelineStageV1(contact.dealStageLabel);
  if (stage.classification === "quarantine" || stage.classification === "unsupported") {
    risks.push("analytics");
  }
  const current = snapshot.leadCurrentStageSlug.get(leadId);
  if (wouldRegressFiStage(current, stage.fiSlug)) {
    risks.push("pipeline_regression");
  }
  // Import must never trigger notifications / patient communications / automations.
  return unique(risks);
}

export function toContactDecisionRecord(
  contact: HubspotContactDryRunInput,
  resolved: ResolveContactIdentityResult
): HubspotImportDecisionRecord {
  return {
    sourceIdentity: {
      tenantId: contact.tenantId,
      integrationId: contact.integrationId,
      sourceSystem: HUBSPOT_IMPORT_SOURCE_SYSTEM,
      sourceObjectType: "contact",
      sourceRecordId: contact.hubspotContactId,
    },
    decision: resolved.decision,
    proposedFiEntityType: resolved.proposedFiEntityType,
    proposedFiEntityId: resolved.proposedFiEntityId,
    identityTier: resolved.identityTier,
    confidenceType: resolved.confidenceType,
    reasonCode: resolved.reasonCode,
    mappingVersion: HUBSPOT_IMPORT_MAPPING_VERSION,
    sourceCreatedAt: contact.sourceCreatedAt,
    sourceUpdatedAt: contact.sourceUpdatedAt,
    sideEffectRisks: resolved.sideEffectRisks,
    decisionStatus: "dry_run",
    sourceIdHash: privacySafeSourceIdHash(contact.hubspotContactId),
  };
}

export type ResolveOwnerResult = {
  classification: HubspotOwnerMappingClass;
  staffId: string | null;
  reasonCode: string;
  decision: HubspotImportDecision;
};

export function resolveHubspotOwnerImportIdentity(
  owner: HubspotOwnerDryRunInput,
  snapshot: FiIdentitySnapshot,
  options?: { expectedTenantId?: string }
): ResolveOwnerResult {
  if (options?.expectedTenantId && owner.tenantId !== options.expectedTenantId) {
    return {
      classification: "ambiguous_owner",
      staffId: null,
      reasonCode: "tenant_mismatch_fail_closed",
      decision: "conflict_multiple_targets",
    };
  }

  if (owner.isTestOwner) {
    return {
      classification: "excluded_test_owner",
      staffId: null,
      reasonCode: "excluded_test_owner",
      decision: "skip_out_of_scope",
    };
  }

  if (owner.isSystemOwner) {
    return {
      classification: "integration_system_owner",
      staffId: null,
      reasonCode: "system_or_integration_owner",
      decision: "import_source_evidence",
    };
  }

  const fromExternal = snapshot.externalOwnerToStaff.get(owner.hubspotOwnerId);
  if (fromExternal) {
    const classification = classifyOwnerMapping({
      linkedStaffId: fromExternal.staffId,
      staffIsActive: fromExternal.isActive,
      candidateCount: 1,
      isSystemOwner: false,
      isTestOwner: false,
    });
    return {
      classification,
      staffId: fromExternal.staffId,
      reasonCode: "existing_staff_source_id",
      decision: classification === "linked_active_staff" ? "import_source_evidence" : "quarantine_owner_unmapped",
    };
  }

  if (owner.emailNormalized) {
    const byEmail = snapshot.staffEmailToStaff.get(owner.emailNormalized);
    // Count how many staff share this email key (map values are unique by construction).
    const candidates = byEmail ? [byEmail] : [];
    if (candidates.length > 1) {
      return {
        classification: "ambiguous_owner",
        staffId: null,
        reasonCode: "owner_email_multiple_staff",
        decision: "quarantine_ambiguous_identity",
      };
    }
    if (candidates.length === 1) {
      const classification = classifyOwnerMapping({
        linkedStaffId: candidates[0].staffId,
        staffIsActive: candidates[0].isActive,
        candidateCount: 1,
        isSystemOwner: false,
        isTestOwner: false,
      });
      return {
        classification,
        staffId: candidates[0].staffId,
        reasonCode: "exact_staff_email_within_tenant",
        decision:
          classification === "linked_active_staff"
            ? "import_source_evidence"
            : "quarantine_owner_unmapped",
      };
    }
  }

  return {
    classification: "unknown_owner",
    staffId: null,
    reasonCode: "owner_unmapped_provenance_only",
    decision: "quarantine_owner_unmapped",
  };
}

/** Explicit guard: HubSpot IDs must never become FI primary keys. */
export function assertHubspotIdNotUsedAsFiPrimaryKey(
  hubspotRecordId: string,
  proposedFiEntityId: string | null
): void {
  if (proposedFiEntityId != null && proposedFiEntityId === hubspotRecordId) {
    throw new Error("POLICY_VIOLATION: HubSpot source id must not be used as FI OS primary key");
  }
  // FI PKs are UUIDs; HubSpot ids are numeric strings — reject non-UUID lookalikes when set.
  if (
    proposedFiEntityId != null &&
    /^\d+$/.test(proposedFiEntityId) &&
    /^\d+$/.test(hubspotRecordId)
  ) {
    throw new Error("POLICY_VIOLATION: numeric HubSpot id reused as FI entity id");
  }
}
