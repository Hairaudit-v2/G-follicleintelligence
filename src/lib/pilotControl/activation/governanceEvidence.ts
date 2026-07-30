/**
 * FI-CONTROLLED-PILOT-ACTIVATION-1B Governance Closure —
 * human governance evidence evaluators (pure).
 *
 * Templates and documents alone never satisfy gates.
 * Named approvals must be explicitly recorded — never inferred.
 */

export type NamedApprovalDecision =
  | "approved"
  | "approved_with_conditions"
  | "deferred"
  | "rejected";

export type NamedApproval = {
  area: string;
  approverName: string;
  approverUserId?: string;
  approverRole: string;
  decision: NamedApprovalDecision;
  decisionReason: string;
  conditions: string[];
  evidenceReferences: string[];
  decidedAt: string;
  expiresAt?: string;
};

export type PilotSopApproval = {
  programmeId: string;
  sopVersion: string;
  sopChecksum: string;
  approverName: string;
  approverUserId?: string;
  approverRole: string;
  decision: NamedApprovalDecision;
  approvedSections: string[];
  conditions: string[];
  decisionReason: string;
  decidedAt: string;
  reviewDueAt?: string;
};

export const REQUIRED_SOP_SECTIONS = [
  "Daily operating rhythm",
  "Blocker ownership",
  "Escalation response",
  "Manual fallback",
  "Pilot pause procedure",
  "Patient withdrawal",
  "End-of-day review",
  "Support handoff",
] as const;

export type PilotStaffTrainingRecord = {
  programmeId: string;
  staffUserId?: string;
  staffName: string;
  staffRole: string;
  trainerUserId?: string;
  trainerName: string;
  sopVersion: string;
  trainingVersion: string;
  trainedAt: string;
  completionStatus:
    | "not_started"
    | "in_progress"
    | "completed"
    | "failed"
    | "expired";
  acknowledgement:
    | "not_recorded"
    | "acknowledged"
    | "assessment_passed"
    | "assessment_failed";
  assessmentScore?: number;
  remainingSupportNeeds: string[];
  evidenceReference?: string;
  expiresAt?: string;
};

export const REQUIRED_TRAINING_ROLES = [
  "director",
  "clinic_manager",
  "reception",
  "consultant",
  "finance",
  "clinical",
  "technical",
] as const;

export type NamedCoverageContact = {
  name: string;
  userId?: string;
  role: string;
  contactMethodReference?: string;
};

export type CoverageWindow = {
  days: string;
  startLocal: string;
  endLocal: string;
};

export type ResponseTarget = {
  class:
    | "critical_identity_privacy"
    | "financial_integrity"
    | "patient_access"
    | "notification_failure"
    | "general_operational"
    | "after_hours";
  targetMinutes: number;
};

export type PilotSupportCoverage = {
  programmeId: string;
  version: string;
  operationalOwner: NamedCoverageContact;
  technicalOwner: NamedCoverageContact;
  financeEscalation: NamedCoverageContact;
  clinicalEscalation: NamedCoverageContact;
  privacyIncidentContact: NamedCoverageContact;
  backupContacts: NamedCoverageContact[];
  timezone: string;
  coverageHours: CoverageWindow[];
  responseTargets: ResponseTarget[];
  weekendPosition: string;
  leaveCoverage: string;
  confirmedBy: string;
  confirmedAt: string;
  status: "draft" | "confirmed" | "insufficient" | "expired";
};

export type PatientPilotConsentApproval = {
  documentVersion: string;
  documentChecksum: string;
  clinical: NamedApproval | null;
  privacy: NamedApproval | null;
  operations: NamedApproval | null;
  director: NamedApproval | null;
  fullyApproved: boolean;
  conditions: string[];
  approvedAt?: string;
};

export type PilotGovernanceTabletopRecord = {
  exerciseId: string;
  programmeId: string;
  scenarioVersion: string;
  conductedAt: string;
  facilitator: string;
  participants: { name: string; role: string }[];
  detectedAtStep: number;
  pauseRecommended: boolean;
  fallbackActivated: boolean;
  evidencePreserved: boolean;
  correctionVerified: boolean;
  restartAuthorityIdentified: boolean;
  restartDecision?: string;
  findings: string[];
  sopChanges: string[];
  unresolvedActions: string[];
  result: "passed" | "passed_with_actions" | "failed";
};

export const REQUIRED_ACTIVATION_APPROVAL_AREAS = [
  "technical",
  "operations",
  "clinical_governance",
  "privacy",
  "finance",
  "training",
  "support",
  "incident_response",
  "manual_fallback",
  "rollback",
  "patient_pilot_consent",
  "initial_pathway",
  "initial_cohort",
  "director",
] as const;

export function isNamedApprovalSatisfying(
  approval: NamedApproval | null | undefined,
  opts?: { allowConditions?: boolean }
): boolean {
  if (!approval) return false;
  if (!approval.approverName?.trim()) return false;
  if (!approval.decidedAt) return false;
  if (approval.decision === "approved") return true;
  if (approval.decision === "approved_with_conditions") {
    if (!opts?.allowConditions) return false;
    return (approval.conditions ?? []).length === 0;
  }
  return false;
}

export function evaluateSopApproval(args: {
  approval: PilotSopApproval | null;
  currentSopVersion: string;
  currentSopChecksum: string;
}): { operationalSopApproved: boolean; blockers: string[] } {
  const blockers: string[] = [];
  const a = args.approval;
  if (!a) {
    return { operationalSopApproved: false, blockers: ["sop_approval_missing"] };
  }
  if (!a.approverName?.trim()) blockers.push("sop_approver_unnamed");
  if (a.sopVersion !== args.currentSopVersion) {
    blockers.push("sop_version_mismatch");
  }
  if (a.sopChecksum !== args.currentSopChecksum) {
    blockers.push("sop_checksum_mismatch_or_superseded");
  }
  for (const section of REQUIRED_SOP_SECTIONS) {
    if (!a.approvedSections.includes(section)) {
      blockers.push(`sop_section_unapproved:${section}`);
    }
  }
  if (a.decision === "deferred" || a.decision === "rejected") {
    blockers.push(`sop_decision:${a.decision}`);
  }
  if (a.decision === "approved_with_conditions" && a.conditions.length > 0) {
    blockers.push("sop_conditions_unresolved");
  }
  if (a.decision !== "approved" && a.decision !== "approved_with_conditions") {
    blockers.push("sop_not_approved");
  }
  return { operationalSopApproved: blockers.length === 0, blockers };
}

export function evaluateStaffTraining(args: {
  records: readonly PilotStaffTrainingRecord[];
  requiredRoles?: readonly string[];
}): { staffTrainingCompleted: boolean; blockers: string[] } {
  const blockers: string[] = [];
  const required = args.requiredRoles ?? REQUIRED_TRAINING_ROLES;
  for (const role of required) {
    const record = args.records.find(
      (r) => r.staffRole === role && r.completionStatus === "completed"
    );
    if (!record) {
      blockers.push(`training_missing_role:${role}`);
      continue;
    }
    if (
      record.acknowledgement !== "acknowledged" &&
      record.acknowledgement !== "assessment_passed"
    ) {
      blockers.push(`training_unacknowledged:${role}`);
    }
    if (record.completionStatus === "failed" || record.completionStatus === "expired") {
      blockers.push(`training_invalid:${role}`);
    }
    if (!record.staffName?.trim()) blockers.push(`training_unnamed:${role}`);
  }
  // Document delivery alone is not completion — require named completed records
  if (args.records.length === 0) {
    blockers.push("training_register_empty");
  }
  return { staffTrainingCompleted: blockers.length === 0, blockers };
}

export function evaluateSupportCoverage(args: {
  coverage: PilotSupportCoverage | null;
}): { supportCoverageConfirmed: boolean; blockers: string[] } {
  const blockers: string[] = [];
  const c = args.coverage;
  if (!c) {
    return {
      supportCoverageConfirmed: false,
      blockers: ["support_coverage_missing"],
    };
  }
  if (c.status !== "confirmed") blockers.push(`support_status:${c.status}`);
  if (!c.confirmedBy?.trim()) blockers.push("support_unconfirmed_by");
  if (!c.confirmedAt) blockers.push("support_unconfirmed_at");

  const owners = [
    c.operationalOwner,
    c.technicalOwner,
    c.financeEscalation,
    c.clinicalEscalation,
    c.privacyIncidentContact,
  ];
  for (const o of owners) {
    if (!o?.name?.trim()) blockers.push("support_owner_unnamed");
  }

  const uniqueNames = new Set(owners.map((o) => o.name.trim().toLowerCase()));
  if (uniqueNames.size === 1 && c.backupContacts.length === 0) {
    blockers.push("support_single_contact_without_backup");
  }
  if (c.backupContacts.length === 0) {
    blockers.push("support_backup_missing");
  }
  if (!c.leaveCoverage?.trim()) blockers.push("support_leave_coverage_missing");

  return { supportCoverageConfirmed: blockers.length === 0, blockers };
}

export function evaluatePatientPilotConsent(args: {
  approval: PatientPilotConsentApproval | null;
  currentDocumentVersion: string;
  currentDocumentChecksum: string;
}): { patientPilotConsentApproved: boolean; blockers: string[] } {
  const blockers: string[] = [];
  const a = args.approval;
  if (!a) {
    return {
      patientPilotConsentApproved: false,
      blockers: ["consent_approval_missing"],
    };
  }
  if (a.documentVersion !== args.currentDocumentVersion) {
    blockers.push("consent_version_mismatch");
  }
  if (a.documentChecksum !== args.currentDocumentChecksum) {
    blockers.push("consent_checksum_invalidated");
  }
  for (const key of ["clinical", "privacy", "operations", "director"] as const) {
    if (!isNamedApprovalSatisfying(a[key])) {
      blockers.push(`consent_approval_missing:${key}`);
    }
  }
  if (a.conditions.length > 0) blockers.push("consent_conditions_open");
  if (!a.fullyApproved) blockers.push("consent_not_fully_approved");
  return { patientPilotConsentApproved: blockers.length === 0, blockers };
}

export function evaluateGovernanceTabletop(args: {
  record: PilotGovernanceTabletopRecord | null;
}): {
  incidentResponseConfirmed: boolean;
  manualFallbackConfirmed: boolean;
  blockers: string[];
} {
  const blockers: string[] = [];
  const r = args.record;
  if (!r) {
    return {
      incidentResponseConfirmed: false,
      manualFallbackConfirmed: false,
      blockers: ["tabletop_missing"],
    };
  }
  if (r.result === "failed") blockers.push("tabletop_failed");
  if (r.result === "passed_with_actions" && r.unresolvedActions.length > 0) {
    blockers.push("tabletop_actions_open");
  }
  if (!r.pauseRecommended) blockers.push("tabletop_pause_not_demonstrated");
  if (!r.fallbackActivated) blockers.push("tabletop_fallback_not_demonstrated");
  if (!r.evidencePreserved) blockers.push("tabletop_evidence_not_preserved");
  if (!r.correctionVerified) blockers.push("tabletop_correction_unverified");
  if (!r.restartAuthorityIdentified) {
    blockers.push("tabletop_restart_authority_missing");
  }
  const roles = new Set(r.participants.map((p) => p.role.toLowerCase()));
  for (const need of ["operations", "finance", "technical", "director"]) {
    if (![...roles].some((role) => role.includes(need))) {
      blockers.push(`tabletop_participant_missing:${need}`);
    }
  }
  const ok = blockers.length === 0 && (r.result === "passed" ||
    (r.result === "passed_with_actions" && r.unresolvedActions.length === 0));
  return {
    incidentResponseConfirmed: ok,
    manualFallbackConfirmed: ok && r.fallbackActivated,
    blockers,
  };
}

export function evaluateNamedActivationApprovals(args: {
  approvals: readonly NamedApproval[];
  candidateCount: number;
}): {
  byArea: Record<string, boolean>;
  blockers: string[];
  initialCohortApproved: boolean;
  directorApproval: boolean;
  clinicalGovernanceApproved: boolean;
  privacyApproved: boolean;
  financeApproved: boolean;
  initialPathwayApproved: boolean;
} {
  const blockers: string[] = [];
  const byArea: Record<string, boolean> = {};

  for (const area of REQUIRED_ACTIVATION_APPROVAL_AREAS) {
    const approval = args.approvals.find((a) => a.area === area);
    const ok = isNamedApprovalSatisfying(approval);
    byArea[area] = ok;
    if (!ok) blockers.push(`named_approval_missing:${area}`);
  }

  // No candidates ⇒ cohort approval remains false even if a record claims otherwise
  const initialCohortApproved =
    byArea.initial_cohort === true && args.candidateCount > 0;
  if (byArea.initial_cohort && args.candidateCount === 0) {
    blockers.push("initial_cohort_no_candidates");
    byArea.initial_cohort = false;
  }

  // Director alone cannot satisfy all gates
  const directorOnly =
    byArea.director &&
    REQUIRED_ACTIVATION_APPROVAL_AREAS.filter((a) => a !== "director").every(
      (a) => !byArea[a]
    );
  if (directorOnly) {
    blockers.push("director_cannot_satisfy_all_gates");
  }

  return {
    byArea,
    blockers,
    initialCohortApproved,
    directorApproval: byArea.director === true,
    clinicalGovernanceApproved: byArea.clinical_governance === true,
    privacyApproved: byArea.privacy === true,
    financeApproved: byArea.finance === true,
    initialPathwayApproved: byArea.initial_pathway === true,
  };
}

/** Guard: human approval fields must never be auto-set from role membership. */
export function assertHumanApprovalsNotAutoSet(args: {
  proposed: Record<string, boolean>;
  namedApprovals: readonly NamedApproval[];
}): { valid: boolean; blockers: string[] } {
  const blockers: string[] = [];
  for (const [key, value] of Object.entries(args.proposed)) {
    if (!value) continue;
    const matching = args.namedApprovals.find(
      (a) =>
        a.area === key ||
        a.area.replace(/_/g, "") === key.replace(/_/g, "").toLowerCase()
    );
    if (!matching || !isNamedApprovalSatisfying(matching)) {
      blockers.push(`auto_set_without_named_approval:${key}`);
    }
  }
  return { valid: blockers.length === 0, blockers };
}
