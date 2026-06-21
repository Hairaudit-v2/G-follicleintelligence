/**
 * Pure helpers for clinical staffing status labels and UI tone mapping.
 */

import type {
  ClinicalStaffingDisplayStatus,
  ClinicalStaffingSummaryDto,
} from "@/src/lib/workforce-os/clinicalStaffingSummary.types";
import type { ValidateClinicalEventStaffingResult } from "@/src/lib/workforce-os/workforceRosteringEngine";

export function deriveClinicalStaffingDisplayStatus(
  status: Pick<
    ValidateClinicalEventStaffingResult,
    "ready" | "missingRoles" | "blockedAssignments" | "warnings"
  >,
  templateConfigured: boolean
): ClinicalStaffingDisplayStatus {
  if (!templateConfigured) return "not_configured";
  if (status.blockedAssignments.length > 0) return "blocked";
  if (status.missingRoles.length > 0) return "missing_roles";
  if (status.warnings.length > 0) return "warning";
  if (status.ready) return "ready";
  return "missing_roles";
}

export function clinicalStaffingDisplayStatusLabel(status: ClinicalStaffingDisplayStatus): string {
  switch (status) {
    case "ready":
      return "Staffing ready";
    case "missing_roles":
      return "Missing staff";
    case "warning":
      return "Staff warning";
    case "blocked":
      return "Staff blocked";
    case "not_configured":
      return "No template";
  }
}

export function clinicalStaffingDisplayStatusTone(
  status: ClinicalStaffingDisplayStatus
): "success" | "warning" | "danger" | "neutral" | "info" {
  switch (status) {
    case "ready":
      return "success";
    case "missing_roles":
    case "warning":
      return "warning";
    case "blocked":
      return "danger";
    case "not_configured":
      return "neutral";
  }
}

export function toClinicalStaffingSummaryDto(
  status: ValidateClinicalEventStaffingResult,
  templateConfigured: boolean
): ClinicalStaffingSummaryDto {
  return {
    displayStatus: deriveClinicalStaffingDisplayStatus(status, templateConfigured),
    templateConfigured,
    readinessScore: status.readinessScore,
    ready: status.ready,
    requiredRoles: status.requiredRoles,
    assignedCounts: status.assignedCounts,
    missingRoles: status.missingRoles,
    blockedAssignments: status.blockedAssignments,
    warnings: status.warnings,
  };
}

export function formatRequiredRolesLine(roles: Record<string, number>): string {
  const entries = Object.entries(roles);
  if (!entries.length) return "—";
  return entries.map(([role, count]) => `${role} ×${count}`).join(", ");
}
