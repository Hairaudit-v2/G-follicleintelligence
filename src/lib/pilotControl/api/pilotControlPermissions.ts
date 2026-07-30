/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.4 — permission aliases over frozen 1A.1 scopes (pure).
 */

import {
  PILOT_CONTROL_ROLE_SCOPES,
  pilotControlRoleHasScope,
  type PilotControlPermissionScope,
  type PilotControlRoleKey,
} from "../pilotControlContracts";

/**
 * Spec-facing dotted permission names map onto frozen PILOT_CONTROL_PERMISSION_SCOPES.
 * Routes assert via frozen scopes; aliases are documentation/API-contract only.
 */
export const PILOT_CONTROL_API_PERMISSION_ALIASES = {
  "pilot_control.programmes.read": ["overview_full", "overview_clinic", "register_read"],
  "pilot_control.overview.read": ["overview_full", "overview_clinic"],
  "pilot_control.patient_register.read": ["register_read"],
  "pilot_control.patient_detail.read": ["detail_identity", "detail_journey", "register_read"],
  "pilot_control.blockers.read": ["register_read", "overview_clinic", "overview_full"],
  "pilot_control.activity.read": ["register_read", "overview_clinic", "overview_full"],
  "pilot_control.health.read": ["overview_full", "overview_clinic"],
  "pilot_control.adoption.read": ["overview_full", "overview_clinic"],
  "pilot_control.export": ["export"],
  "pilot_control.pause_recommendation.read": ["overview_full"],
  "pilot_control.clinical_summary.read": ["detail_clinical_summary", "detail_clinical_full"],
  "pilot_control.financial_summary.read": ["detail_financial_summary", "detail_financial_full"],
  "pilot_control.technical_summary.read": ["detail_technical"],
} as const satisfies Record<string, readonly PilotControlPermissionScope[]>;

export type PilotControlApiPermissionAlias = keyof typeof PILOT_CONTROL_API_PERMISSION_ALIASES;

export function roleHasAnyScope(
  role: PilotControlRoleKey | null | undefined,
  scopes: readonly PilotControlPermissionScope[]
): boolean {
  return scopes.some((s) => pilotControlRoleHasScope(role, s));
}

export function roleHasApiPermission(
  role: PilotControlRoleKey | null | undefined,
  alias: PilotControlApiPermissionAlias
): boolean {
  return roleHasAnyScope(role, PILOT_CONTROL_API_PERMISSION_ALIASES[alias]);
}

export function permissionsForRole(role: PilotControlRoleKey): readonly PilotControlPermissionScope[] {
  return PILOT_CONTROL_ROLE_SCOPES[role] ?? [];
}

export function canSeePilotPauseRecommendation(role: PilotControlRoleKey): boolean {
  return pilotControlRoleHasScope(role, "overview_full");
}

export function canExportPilotControl(role: PilotControlRoleKey): boolean {
  return pilotControlRoleHasScope(role, "export");
}
