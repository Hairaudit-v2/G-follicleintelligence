/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.1 — synthetic cohort fixture (no real patients).
 * Deterministic UUIDs for unit tests only. Must never be used to invite real patients.
 */

import {
  EVOLVED_CONTROLLED_PILOT_COHORT_KEY,
  EVOLVED_CONTROLLED_PILOT_PROGRAMME_KEY,
  EVOLVED_HAIR_TENANT_ID,
  type PilotEnrolmentStatus,
} from "./pilotControlContracts";
import type { PilotDomainReadinessSnapshot } from "./pilotReadinessCore";
import type { PilotHealthBlockerSnapshot } from "./pilotBlockerCore";

/** Fixed synthetic tenant namespace — distinct from production Evolved id in pure tests. */
export const PILOT_SYNTHETIC_TENANT_ID = "a0000000-0000-4000-8000-0000000000p1";
export const PILOT_SYNTHETIC_OTHER_TENANT_ID = "a0000000-0000-4000-8000-0000000000p2";
export const PILOT_SYNTHETIC_PROGRAMME_ID = "b0000000-0000-4000-8000-0000000000p1";

export type SyntheticPilotEnrolment = {
  id: string;
  tenantId: string;
  programmeId: string;
  patientId: string;
  displayName: string;
  pilotProgrammeKey: string;
  pilotCohort: string;
  enrolmentStatus: PilotEnrolmentStatus;
  enrolledAt: string | null;
  invitedAt: string | null;
  activatedAt: string | null;
  pausedAt: string | null;
  completedAt: string | null;
  withdrawnAt: string | null;
  excludedAt: string | null;
  exclusionReason: string | null;
  withdrawalReason: string | null;
  operationalOwnerRole: string | null;
  notes: string | null;
};

const NOW = "2026-07-30T02:00:00.000Z";

function enrolment(
  partial: Partial<SyntheticPilotEnrolment> &
    Pick<
      SyntheticPilotEnrolment,
      "id" | "tenantId" | "patientId" | "displayName" | "enrolmentStatus"
    >
): SyntheticPilotEnrolment {
  return {
    programmeId: partial.programmeId ?? PILOT_SYNTHETIC_PROGRAMME_ID,
    pilotProgrammeKey: EVOLVED_CONTROLLED_PILOT_PROGRAMME_KEY,
    pilotCohort: EVOLVED_CONTROLLED_PILOT_COHORT_KEY,
    enrolledAt: null,
    invitedAt: null,
    activatedAt: null,
    pausedAt: null,
    completedAt: null,
    withdrawnAt: null,
    excludedAt: null,
    exclusionReason: null,
    withdrawalReason: null,
    operationalOwnerRole: "clinic_manager",
    notes: null,
    ...partial,
  };
}

/**
 * Synthetic pilot register covering acceptance scenarios 1–20 foundations.
 * Patient IDs are fixtures only — not real Evolved patients.
 */
export const PILOT_SYNTHETIC_COHORT: readonly SyntheticPilotEnrolment[] = [
  enrolment({
    id: "c0000000-0000-4000-8000-000000000001",
    tenantId: PILOT_SYNTHETIC_TENANT_ID,
    patientId: "d0000000-0000-4000-8000-000000000001",
    displayName: "Synthetic Ready Patient",
    enrolmentStatus: "active",
    enrolledAt: "2026-07-01T00:00:00.000Z",
    invitedAt: "2026-07-02T00:00:00.000Z",
    activatedAt: "2026-07-03T00:00:00.000Z",
    notes: "Scenario 1 — ready, no blockers",
  }),
  enrolment({
    id: "c0000000-0000-4000-8000-000000000002",
    tenantId: PILOT_SYNTHETIC_TENANT_ID,
    patientId: "d0000000-0000-4000-8000-000000000002",
    displayName: "Synthetic Consent Gap",
    enrolmentStatus: "active",
    enrolledAt: "2026-07-01T00:00:00.000Z",
    invitedAt: "2026-07-02T00:00:00.000Z",
    activatedAt: "2026-07-03T00:00:00.000Z",
    notes: "Scenario 2 — mandatory consent missing",
  }),
  enrolment({
    id: "c0000000-0000-4000-8000-000000000003",
    tenantId: PILOT_SYNTHETIC_TENANT_ID,
    patientId: "d0000000-0000-4000-8000-000000000003",
    displayName: "Synthetic Pathology Block",
    enrolmentStatus: "active",
    enrolledAt: "2026-07-01T00:00:00.000Z",
    invitedAt: "2026-07-02T00:00:00.000Z",
    activatedAt: "2026-07-03T00:00:00.000Z",
    notes: "Scenario 3 — pathology unresolved",
  }),
  enrolment({
    id: "c0000000-0000-4000-8000-000000000004",
    tenantId: PILOT_SYNTHETIC_TENANT_ID,
    patientId: "d0000000-0000-4000-8000-000000000004",
    displayName: "Synthetic Deposit Pending",
    enrolmentStatus: "active",
    enrolledAt: "2026-07-01T00:00:00.000Z",
    invitedAt: "2026-07-02T00:00:00.000Z",
    activatedAt: "2026-07-03T00:00:00.000Z",
    notes: "Scenario 4 — deposit unpaid",
  }),
  enrolment({
    id: "c0000000-0000-4000-8000-000000000005",
    tenantId: PILOT_SYNTHETIC_TENANT_ID,
    patientId: "d0000000-0000-4000-8000-000000000005",
    displayName: "Synthetic Optional Doc",
    enrolmentStatus: "active",
    enrolledAt: "2026-07-01T00:00:00.000Z",
    invitedAt: "2026-07-02T00:00:00.000Z",
    activatedAt: "2026-07-03T00:00:00.000Z",
    notes: "Scenario 5 — optional document missing only",
  }),
  enrolment({
    id: "c0000000-0000-4000-8000-000000000006",
    tenantId: PILOT_SYNTHETIC_TENANT_ID,
    patientId: "d0000000-0000-4000-8000-000000000006",
    displayName: "Synthetic App Not Activated",
    enrolmentStatus: "invited",
    enrolledAt: "2026-07-01T00:00:00.000Z",
    invitedAt: "2026-07-20T00:00:00.000Z",
    notes: "Scenario 10 — Patient App not activated",
  }),
  enrolment({
    id: "c0000000-0000-4000-8000-000000000007",
    tenantId: PILOT_SYNTHETIC_TENANT_ID,
    patientId: "d0000000-0000-4000-8000-000000000007",
    displayName: "Synthetic Completed",
    enrolmentStatus: "completed",
    enrolledAt: "2026-06-01T00:00:00.000Z",
    invitedAt: "2026-06-02T00:00:00.000Z",
    activatedAt: "2026-06-03T00:00:00.000Z",
    completedAt: "2026-07-15T00:00:00.000Z",
    notes: "Scenario 19 — historical reporting",
  }),
  enrolment({
    id: "c0000000-0000-4000-8000-000000000008",
    tenantId: PILOT_SYNTHETIC_TENANT_ID,
    patientId: "d0000000-0000-4000-8000-000000000008",
    displayName: "Synthetic Withdrawn",
    enrolmentStatus: "withdrawn",
    enrolledAt: "2026-06-01T00:00:00.000Z",
    invitedAt: "2026-06-02T00:00:00.000Z",
    withdrawnAt: "2026-07-10T00:00:00.000Z",
    withdrawalReason: "Patient withdrew from pilot",
    notes: "Scenario 20 — excluded from active metrics",
  }),
  enrolment({
    id: "c0000000-0000-4000-8000-000000000009",
    tenantId: PILOT_SYNTHETIC_OTHER_TENANT_ID,
    patientId: "d0000000-0000-4000-8000-000000000009",
    displayName: "Synthetic Other Tenant",
    enrolmentStatus: "active",
    enrolledAt: "2026-07-01T00:00:00.000Z",
    invitedAt: "2026-07-02T00:00:00.000Z",
    activatedAt: "2026-07-03T00:00:00.000Z",
    notes: "Scenario 11 — wrong-tenant isolation",
  }),
  enrolment({
    id: "c0000000-0000-4000-8000-00000000000a",
    tenantId: PILOT_SYNTHETIC_TENANT_ID,
    patientId: "d0000000-0000-4000-8000-00000000000a",
    displayName: "Synthetic Excluded",
    enrolmentStatus: "excluded",
    enrolledAt: null,
    excludedAt: "2026-07-05T00:00:00.000Z",
    exclusionReason: "Does not meet pilot inclusion criteria",
    notes: "Exclusion handling",
  }),
];

export function baseReadySnapshot(
  overrides: Partial<PilotDomainReadinessSnapshot> = {}
): PilotDomainReadinessSnapshot {
  return {
    clinical: "ready",
    financial: "cleared",
    operational: "ready",
    patient: "ready",
    consent: "ready",
    documents: "ready",
    pathology: "cleared",
    images: "ready",
    appointment: "confirmed",
    identityIntegrityBlocked: false,
    technicalAttention: false,
    mandatoryConsentGap: false,
    mandatoryFinancialGateUnmet: false,
    clinicalBlockerPresent: false,
    enrolmentCompleted: false,
    provenance: [
      {
        sourceModule: "pilot_enrolment",
        sourceRecordType: "fi_pilot_enrolments",
        sourceRecordId: "c0000000-0000-4000-8000-000000000001",
        observedAt: NOW,
        unknown: false,
      },
    ],
    ...overrides,
  };
}

export function syntheticCriticalIntegrityBlocker(): PilotHealthBlockerSnapshot {
  return {
    id: "e0000000-0000-4000-8000-000000000001",
    tenantId: PILOT_SYNTHETIC_TENANT_ID,
    patientId: "d0000000-0000-4000-8000-000000000001",
    category: "identity",
    severity: "critical",
    sourceModule: "foundation_identity",
    sourceRecordType: "v_fi_patient_resolution",
    sourceRecordId: null,
    firstDetectedAt: NOW,
    lastConfirmedAt: NOW,
    owner: "platform",
    recommendedNextAction: "Pause pilot and resolve identity integrity before continuing",
    resolutionState: "open",
    criticalIntegrity: true,
  };
}

/** Documented production Evolved programme constants (for seed alignment — not auto-enrol). */
export const EVOLVED_PILOT_PROGRAMME_SEED = {
  tenantId: EVOLVED_HAIR_TENANT_ID,
  programmeKey: EVOLVED_CONTROLLED_PILOT_PROGRAMME_KEY,
  cohortKey: EVOLVED_CONTROLLED_PILOT_COHORT_KEY,
  displayName: "Evolved Hair Restoration — Controlled Pilot",
  realPatientInvites: false as const,
};
