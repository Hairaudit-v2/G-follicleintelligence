/**
 * Default clinical staffing templates for tenant bootstrap.
 * FI OS owns operational templates — IIOHR does not own shift schedules.
 */

export type ClinicalStaffingEventType =
  | "surgery"
  | "consultation"
  | "prp"
  | "exosomes"
  | "review"
  | "theatre_day";

export type ClinicalStaffingRequiredRoles = Record<string, number>;

export type DefaultClinicalStaffingTemplate = {
  event_type: ClinicalStaffingEventType;
  required_roles: ClinicalStaffingRequiredRoles;
};

export const DEFAULT_CLINICAL_STAFFING_TEMPLATES: DefaultClinicalStaffingTemplate[] = [
  {
    event_type: "surgery",
    required_roles: { surgeon: 1, nurse: 2, technician: 2, consultant: 1 },
  },
  {
    event_type: "consultation",
    required_roles: { consultant: 1 },
  },
  {
    event_type: "prp",
    required_roles: { doctor: 1, nurse: 1 },
  },
  {
    event_type: "exosomes",
    required_roles: { doctor: 1, nurse: 1 },
  },
  {
    event_type: "review",
    required_roles: { consultant: 1 },
  },
  {
    event_type: "theatre_day",
    required_roles: { surgeon: 1, nurse: 2, technician: 2 },
  },
];

export function normalizeRequiredRoles(
  raw: Record<string, unknown> | null | undefined
): ClinicalStaffingRequiredRoles {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: ClinicalStaffingRequiredRoles = {};
  for (const [role, count] of Object.entries(raw)) {
    const key = role.trim().toLowerCase();
    if (!key) continue;
    const n = typeof count === "number" ? count : Number(count);
    if (Number.isFinite(n) && n > 0) out[key] = Math.floor(n);
  }
  return out;
}
