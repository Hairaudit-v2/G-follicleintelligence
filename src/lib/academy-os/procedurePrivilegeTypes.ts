/**
 * AcademyOS Phase C — procedure privilege constants and types.
 * Operational clinic authorization (not IIOHR certification).
 */

export const PROCEDURE_KEYS = [
  "fue_extraction",
  "fue_implantation",
  "graft_sorting",
  "graft_counting",
  "hairline_design",
  "prp_assistance",
  "exosomes_assistance",
  "consultation",
  "donor_assessment",
  "recipient_site_assessment",
  "theatre_setup",
  "medication_assist",
  "post_op_review",
] as const;

export type ProcedureKey = (typeof PROCEDURE_KEYS)[number];

export const PRIVILEGE_LEVELS = [
  "observe",
  "assist",
  "perform_supervised",
  "perform_independent",
  "train_others",
] as const;

export type PrivilegeLevel = (typeof PRIVILEGE_LEVELS)[number];

export const PRIVILEGE_STATUSES = [
  "active",
  "pending_review",
  "suspended",
  "expired",
  "revoked",
] as const;

export type PrivilegeStatus = (typeof PRIVILEGE_STATUSES)[number];

export const PRIVILEGE_SOURCE_SYSTEMS = [
  "fi_os",
  "iiohr_academy",
  "iiohr_nexus",
  "manual_admin",
] as const;

export type PrivilegeSourceSystem = (typeof PRIVILEGE_SOURCE_SYSTEMS)[number];

export const PRIVILEGE_ELIGIBILITY_STATUSES = [
  "eligible",
  "missing_privilege",
  "expired",
  "suspended",
  "insufficient_level",
  "pending_review",
] as const;

export type PrivilegeEligibilityStatus = (typeof PRIVILEGE_ELIGIBILITY_STATUSES)[number];

export const PRIVILEGE_WARNING_CODES = [
  "privilege_expiring_soon",
  "review_due_soon",
  "clinic_specific_required",
  "tenant_wide_fallback_used",
  "no_privilege_requirement_configured",
] as const;

export type PrivilegeWarningCode = (typeof PRIVILEGE_WARNING_CODES)[number];

export const PRIVILEGE_LEVEL_RANK: Record<PrivilegeLevel, number> = {
  observe: 1,
  assist: 2,
  perform_supervised: 3,
  perform_independent: 4,
  train_others: 5,
};

export const PROCEDURE_KEY_LABELS: Record<ProcedureKey, string> = {
  fue_extraction: "FUE Extraction",
  fue_implantation: "FUE Implantation",
  graft_sorting: "Graft Sorting",
  graft_counting: "Graft Counting",
  hairline_design: "Hairline Design",
  prp_assistance: "PRP Assistance",
  exosomes_assistance: "Exosomes Assistance",
  consultation: "Consultation",
  donor_assessment: "Donor Assessment",
  recipient_site_assessment: "Recipient Site Assessment",
  theatre_setup: "Theatre Setup",
  medication_assist: "Medication Assist",
  post_op_review: "Post-Op Review",
};

export const PRIVILEGE_LEVEL_LABELS: Record<PrivilegeLevel, string> = {
  observe: "Observe",
  assist: "Assist",
  perform_supervised: "Perform (Supervised)",
  perform_independent: "Perform (Independent)",
  train_others: "Train Others",
};

export const PRIVILEGE_STATUS_LABELS: Record<PrivilegeStatus, string> = {
  active: "Active",
  pending_review: "Pending Review",
  suspended: "Suspended",
  expired: "Expired",
  revoked: "Revoked",
};

export type FiStaffProcedurePrivilegeRow = {
  id: string;
  tenantId: string;
  clinicId: string | null;
  staffId: string;
  procedureKey: ProcedureKey | string;
  privilegeLevel: PrivilegeLevel;
  privilegeStatus: PrivilegeStatus;
  sourceSystem: string;
  sourceCompetencyKey: string | null;
  sourceProjectionId: string | null;
  grantedBy: string | null;
  grantedAt: string;
  expiresAt: string | null;
  reviewedAt: string | null;
  reviewDueAt: string | null;
  restrictionReason: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type FiProcedurePrivilegeRequirementRow = {
  id: string;
  tenantId: string;
  clinicId: string | null;
  eventType: string;
  assignedRole: string;
  requiredProcedureKey: ProcedureKey | string;
  minimumPrivilegeLevel: PrivilegeLevel;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProcedurePrivilegeEligibilityResult = {
  eligible: boolean;
  status: PrivilegeEligibilityStatus;
  matchedPrivilege: FiStaffProcedurePrivilegeRow | null;
  missingRequirements: Array<{
    requiredProcedureKey: string;
    minimumPrivilegeLevel: PrivilegeLevel;
    assignedRole: string;
  }>;
  warnings: PrivilegeWarningCode[];
};

export function isPrivilegeLevel(value: string): value is PrivilegeLevel {
  return (PRIVILEGE_LEVELS as readonly string[]).includes(value);
}

export function isPrivilegeStatus(value: string): value is PrivilegeStatus {
  return (PRIVILEGE_STATUSES as readonly string[]).includes(value);
}

export function isProcedureKey(value: string): value is ProcedureKey {
  return (PROCEDURE_KEYS as readonly string[]).includes(value);
}

export function comparePrivilegeLevels(a: PrivilegeLevel, b: PrivilegeLevel): number {
  return PRIVILEGE_LEVEL_RANK[a] - PRIVILEGE_LEVEL_RANK[b];
}

/** Returns true when `actual` meets or exceeds `required`. */
export function doesPrivilegeLevelSatisfy(
  actual: PrivilegeLevel,
  required: PrivilegeLevel
): boolean {
  return PRIVILEGE_LEVEL_RANK[actual] >= PRIVILEGE_LEVEL_RANK[required];
}

export function privilegeLevelLabel(level: PrivilegeLevel | string): string {
  if (isPrivilegeLevel(level)) return PRIVILEGE_LEVEL_LABELS[level];
  return level.replace(/_/g, " ");
}

export function procedureKeyLabel(key: ProcedureKey | string): string {
  if (isProcedureKey(key)) return PROCEDURE_KEY_LABELS[key];
  return key.replace(/_/g, " ");
}

export function privilegeStatusLabel(status: PrivilegeStatus | string): string {
  if (isPrivilegeStatus(status)) return PRIVILEGE_STATUS_LABELS[status];
  return status.replace(/_/g, " ");
}
