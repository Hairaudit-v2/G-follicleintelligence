/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.5 — client UI permission helpers (pure).
 * Soft-hide chrome only; server/API remain authoritative.
 */

import type { PilotControlRoleKey } from "../pilotControlContracts";
import {
  canExportPilotControl,
  canSeePilotPauseRecommendation,
  roleHasApiPermission,
} from "../api/pilotControlPermissions";

export function canAccessPilotControlOverview(role: PilotControlRoleKey | null | undefined): boolean {
  return roleHasApiPermission(role, "pilot_control.overview.read");
}

export function canAccessPilotControlNav(role: PilotControlRoleKey | null | undefined): boolean {
  return canAccessPilotControlOverview(role);
}

export function canShowExportControl(role: PilotControlRoleKey | null | undefined): boolean {
  return canExportPilotControl(role as PilotControlRoleKey);
}

export function canShowPauseRecommendation(role: PilotControlRoleKey | null | undefined): boolean {
  return canSeePilotPauseRecommendation(role as PilotControlRoleKey);
}

export function canShowClinicalSummary(role: PilotControlRoleKey | null | undefined): boolean {
  return roleHasApiPermission(role, "pilot_control.clinical_summary.read");
}

export function canShowFinancialSummary(role: PilotControlRoleKey | null | undefined): boolean {
  return roleHasApiPermission(role, "pilot_control.financial_summary.read");
}

export function canShowTechnicalSummary(role: PilotControlRoleKey | null | undefined): boolean {
  return roleHasApiPermission(role, "pilot_control.technical_summary.read");
}

export function canShowActivationReadiness(role: PilotControlRoleKey | null | undefined): boolean {
  return roleHasApiPermission(role, "pilot_control.activation_readiness.read");
}

/** Identity / privacy blockers must not show patient-safe summary in UI. */
export function shouldSuppressPatientSafeSummary(category: string | null | undefined): boolean {
  const c = String(category ?? "")
    .trim()
    .toLowerCase();
  return c === "identity" || c === "privacy" || c === "data-quality" || c === "data_quality";
}

/** Detect mutation-control labels that must never appear in 1A.5 UI. */
export const FORBIDDEN_MUTATION_CONTROL_LABELS = [
  "acknowledge blocker",
  "resolve blocker",
  "dismiss blocker",
  "assign blocker",
  "invite patient",
  "send message",
  "retry notification",
  "pause pilot",
  "enable stripe",
  "collect payment",
  "approve invites",
  "activate programme",
  "enrol patient",
] as const;

export function uiContainsForbiddenMutationControl(labels: string[]): boolean {
  const lower = labels.map((l) => l.trim().toLowerCase());
  return FORBIDDEN_MUTATION_CONTROL_LABELS.some((f) => lower.includes(f));
}
