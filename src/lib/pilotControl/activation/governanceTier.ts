/**
 * FI-CONTROLLED-PILOT-ACTIVATION-1B — tiered human governance model (pure).
 *
 * Tenant size, deployment scope and risk profile determine which human gates
 * apply. Templates for larger tenants remain in-repo but are not mandatory for
 * every clinic (especially Evolved small-team pilot).
 */

export const PILOT_GOVERNANCE_TIERS = [
  "small_team_pilot",
  "standard_tenant",
  "enterprise_or_high_risk",
] as const;

export type PilotGovernanceTier = (typeof PILOT_GOVERNANCE_TIERS)[number];

/** Human fields required for the Evolved small-team pilot. */
export const SMALL_TEAM_PILOT_HUMAN_FIELDS = [
  "teamBriefingCompleted",
  "clinicalWorkflowConfirmed",
  "financeWorkflowConfirmed",
  "supportContactConfirmed",
  "fallbackConfirmed",
  "directorApproval",
] as const;

/** Full standard-tenant human set (legacy 1B enterprise-style checklist). */
export const STANDARD_TENANT_HUMAN_FIELDS = [
  "operationalSopApproved",
  "staffTrainingCompleted",
  "supportCoverageConfirmed",
  "incidentResponseConfirmed",
  "manualFallbackConfirmed",
  "rollbackConfirmed",
  "patientPilotConsentApproved",
  "clinicalGovernanceApproved",
  "privacyApproved",
  "financeApproved",
  "initialPathwayApproved",
  "initialCohortApproved",
  "directorApproval",
] as const;

/** Extra enterprise / high-risk human fields beyond the standard set. */
export const ENTERPRISE_EXTRA_HUMAN_FIELDS = [
  "formalPrivacyCommitteeApproval",
  "multiClinicGovernanceConfirmed",
  "enterpriseIncidentExerciseConfirmed",
  "enterpriseSegregationOfDutiesConfirmed",
  "enterpriseIntegrationApprovalsConfirmed",
  "enterpriseStagedRolloutApproved",
] as const;

export const ENTERPRISE_OR_HIGH_RISK_HUMAN_FIELDS = [
  ...STANDARD_TENANT_HUMAN_FIELDS,
  ...ENTERPRISE_EXTRA_HUMAN_FIELDS,
] as const;

/**
 * Formal artefacts that remain available as templates but are not required
 * for small-team pilot invite readiness.
 */
export const SMALL_TEAM_DEFERRED_OR_NA = [
  "formalPrivacyCommitteeApproval",
  "separateTrainingRegister",
  "separateSupportCoverageDocument",
  "separateSOPApprovalDocument",
  "separateTabletopApproval",
  "multiRoleSegregationBeyondTeam",
  // Legacy gate booleans superseded by the compact small-team set:
  "operationalSopApproved",
  "staffTrainingCompleted",
  "supportCoverageConfirmed",
  "incidentResponseConfirmed",
  "manualFallbackConfirmed",
  "rollbackConfirmed",
  "patientPilotConsentApproved",
  "clinicalGovernanceApproved",
  "privacyApproved",
  "financeApproved",
  "initialPathwayApproved",
  "initialCohortApproved",
] as const;

export type PilotGovernanceTierProfile = {
  tier: PilotGovernanceTier;
  label: string;
  useWhen: readonly string[];
  required: readonly string[];
  requiredNamedContacts: readonly string[];
  deferredOrNotApplicable: readonly string[];
  templateDocuments: readonly string[];
};

export const PILOT_GOVERNANCE_TIER_PROFILES: Record<
  PilotGovernanceTier,
  PilotGovernanceTierProfile
> = {
  small_team_pilot: {
    tier: "small_team_pilot",
    label: "Small team pilot",
    useWhen: [
      "10 staff or fewer",
      "one clinic",
      "one pathway",
      "no complex integrations",
      "limited 3–5 patient cohort",
    ],
    required: SMALL_TEAM_PILOT_HUMAN_FIELDS,
    requiredNamedContacts: [
      "operations_lead",
      "clinical_lead",
      "finance_contact",
      "technical_contact",
    ],
    deferredOrNotApplicable: SMALL_TEAM_DEFERRED_OR_NA,
    templateDocuments: [
      "docs/governance/FI-CONTROLLED-PILOT-SMALL-TEAM-BRIEFING-1B.md",
      "docs/operations/FI-CONTROLLED-PILOT-OPERATING-SOP-1B.md",
      "docs/governance/FI-CONTROLLED-PILOT-ACTIVATION-DECISION-1B.md",
    ],
  },
  standard_tenant: {
    tier: "standard_tenant",
    label: "Standard tenant",
    useWhen: [
      "multi-role clinic team",
      "formal role appointments and access matrix",
      "dedicated training / support artefacts",
    ],
    required: STANDARD_TENANT_HUMAN_FIELDS,
    requiredNamedContacts: [],
    deferredOrNotApplicable: [],
    templateDocuments: [
      "docs/governance/FI-CONTROLLED-PILOT-SOP-APPROVAL-1B.md",
      "docs/governance/FI-CONTROLLED-PILOT-TRAINING-REGISTER-1B.md",
      "docs/governance/FI-CONTROLLED-PILOT-SUPPORT-COVERAGE-1B.md",
      "docs/governance/FI-CONTROLLED-PILOT-CONSENT-APPROVAL-1B.md",
      "docs/governance/FI-CONTROLLED-PILOT-TABLETOP-1B.md",
      "docs/governance/FI-CONTROLLED-PILOT-ACTIVATION-DECISION-1B.md",
    ],
  },
  enterprise_or_high_risk: {
    tier: "enterprise_or_high_risk",
    label: "Enterprise or high-risk tenant",
    useWhen: [
      "multi-clinic governance",
      "complex integrations",
      "formal privacy committee",
      "wider role matrix / staged rollout",
    ],
    required: ENTERPRISE_OR_HIGH_RISK_HUMAN_FIELDS,
    requiredNamedContacts: [],
    deferredOrNotApplicable: [],
    templateDocuments: [
      "docs/governance/FI-CONTROLLED-PILOT-SOP-APPROVAL-1B.md",
      "docs/governance/FI-CONTROLLED-PILOT-TRAINING-REGISTER-1B.md",
      "docs/governance/FI-CONTROLLED-PILOT-SUPPORT-COVERAGE-1B.md",
      "docs/governance/FI-CONTROLLED-PILOT-CONSENT-APPROVAL-1B.md",
      "docs/governance/FI-CONTROLLED-PILOT-TABLETOP-1B.md",
      "docs/governance/FI-CONTROLLED-PILOT-ACTIVATION-DECISION-1B.md",
    ],
  },
};

/** Default when callers omit a tier — preserves legacy standard checklist behaviour. */
export const DEFAULT_PILOT_GOVERNANCE_TIER: PilotGovernanceTier =
  "standard_tenant";

/** Evolved 1B controlled pilot uses the compact small-team model. */
export const EVOLVED_PILOT_GOVERNANCE_TIER: PilotGovernanceTier =
  "small_team_pilot";

export function isPilotGovernanceTier(value: unknown): value is PilotGovernanceTier {
  return (
    typeof value === "string" &&
    (PILOT_GOVERNANCE_TIERS as readonly string[]).includes(value)
  );
}

export function getGovernanceTierProfile(
  tier: PilotGovernanceTier = DEFAULT_PILOT_GOVERNANCE_TIER
): PilotGovernanceTierProfile {
  return PILOT_GOVERNANCE_TIER_PROFILES[tier];
}

/**
 * Resolve tier from programme metadata, with Evolved programme-key fallback.
 */
export function resolveProgrammeGovernanceTier(args: {
  programmeKey?: string | null;
  metadata?: Record<string, unknown> | null;
  evolvedProgrammeKey?: string;
}): PilotGovernanceTier {
  const meta = args.metadata ?? {};
  const raw =
    meta.governance_tier ??
    meta.governanceTier ??
    meta.pilot_governance_tier ??
    null;
  if (isPilotGovernanceTier(raw)) return raw;

  const evolvedKey = args.evolvedProgrammeKey ?? "evolved_controlled_pilot_1a";
  if (args.programmeKey === evolvedKey) return EVOLVED_PILOT_GOVERNANCE_TIER;

  return DEFAULT_PILOT_GOVERNANCE_TIER;
}

export function humanFieldApplicability(
  tier: PilotGovernanceTier,
  field: string
): "required" | "not_applicable" | "optional_template" {
  const profile = getGovernanceTierProfile(tier);
  if (profile.required.includes(field)) return "required";
  if (profile.deferredOrNotApplicable.includes(field)) return "not_applicable";
  if (tier === "small_team_pilot") return "optional_template";
  return "required";
}
