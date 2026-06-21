/**
 * Serializable clinical staffing summary for SurgeryOS / ClinicOS surfaces.
 */

export type ClinicalStaffingDisplayStatus =
  | "ready"
  | "missing_roles"
  | "warning"
  | "blocked"
  | "not_configured";

export type ClinicalStaffingMissingRole = {
  role: string;
  required: number;
  assigned: number;
};

export type ClinicalStaffingBlockedAssignment = {
  staffId: string;
  role: string;
  reason: string;
};

export type ClinicalStaffingSummaryDto = {
  displayStatus: ClinicalStaffingDisplayStatus;
  templateConfigured: boolean;
  readinessScore: number;
  ready: boolean;
  requiredRoles: Record<string, number>;
  assignedCounts: Record<string, number>;
  missingRoles: ClinicalStaffingMissingRole[];
  blockedAssignments: ClinicalStaffingBlockedAssignment[];
  warnings: string[];
};
