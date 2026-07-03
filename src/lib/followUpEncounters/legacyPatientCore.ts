/**
 * Pure logic for legacy returning patient duplicate prevention (FI-LEGACY-FOLLOWUP-IMAGING-1).
 */

import {
  runDuplicateDetection,
  type DuplicateCheckCandidateIndex,
  type DuplicateCheckInput,
  type DuplicateCheckResult,
} from "@/src/lib/onboarding-os/duplicateDetectionEngine";
import { normalizeEmail } from "@/src/lib/fi/foundation/normalize";

export type LegacyPatientMatchInput = {
  email?: string | null;
  phone?: string | null;
  displayName?: string | null;
  dateOfBirth?: string | null;
  legacyExternalId?: string | null;
};

export type LegacyPatientCandidate = {
  patientId: string;
  personId: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  legacySource: string | null;
};

export function buildLegacyPatientDuplicateIndex(
  candidates: readonly LegacyPatientCandidate[]
): DuplicateCheckCandidateIndex {
  const persons = candidates.map((c) => ({
    id: c.personId,
    emailNormalized: normalizeEmail(c.email),
    phoneDigits: c.phone?.replace(/\D/g, "") ?? null,
    displayNameNormalized: c.displayName.trim().toLowerCase() || null,
  }));

  const patients = candidates.map((c) => ({
    id: c.patientId,
    personId: c.personId,
    emailNormalized: normalizeEmail(c.email),
  }));

  return { persons, leads: [], patients, cases: [], externalMappings: [] };
}

export function checkLegacyPatientDuplicates(
  input: LegacyPatientMatchInput,
  index: DuplicateCheckCandidateIndex
): DuplicateCheckResult {
  const duplicateInput: DuplicateCheckInput = {
    email: input.email,
    phone: input.phone,
    displayName: input.displayName,
    externalId: input.legacyExternalId,
    externalEntityType: input.legacyExternalId ? "timely_patient" : undefined,
  };

  return runDuplicateDetection(duplicateInput, index);
}

/** Returns the best existing patient match when duplicate detection finds a blocking hit. */
export function resolveBlockingPatientMatch(
  result: DuplicateCheckResult,
  candidates: readonly LegacyPatientCandidate[]
): LegacyPatientCandidate | null {
  if (!result.hasBlockingMatch || result.matches.length === 0) return null;

  const patientMatch = result.matches.find((m) => m.entityType === "patient");
  if (patientMatch) {
    return candidates.find((c) => c.patientId === patientMatch.entityId) ?? null;
  }

  const personMatch = result.matches.find((m) => m.entityType === "person");
  if (personMatch) {
    return candidates.find((c) => c.personId === personMatch.entityId) ?? null;
  }

  return null;
}

export function buildLegacyPatientMetadata(input: {
  legacySource: string;
  legacyExternalId?: string | null;
  legacyPatientReference?: string | null;
  firstName: string;
  lastName: string;
}): Record<string, unknown> {
  return {
    legacy_source: input.legacySource,
    ...(input.legacyExternalId ? { legacy_external_id: input.legacyExternalId.trim() } : {}),
    ...(input.legacyPatientReference
      ? { legacy_patient_reference: input.legacyPatientReference.trim() }
      : {}),
    returning_patient: true,
    historical_record_note: "Historical record not fully imported yet",
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    surname: input.lastName.trim(),
  };
}
