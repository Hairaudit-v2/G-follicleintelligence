/**
 * Canonical FI OS Nexus role codes accepted from IIOHR provisioning.
 */
export const FI_OS_NEXUS_ROLE_CODES = [
  "surgeon_operator",
  "consultation_doctor",
  "theatre_nurse",
  "procedure_assistant",
  "consultation_operator",
  "crm_operator",
  "fi_admin",
  "training_observer",
  "audit_viewer",
] as const;

export type FiOsNexusRoleCode = (typeof FI_OS_NEXUS_ROLE_CODES)[number];

const ROLE_SET = new Set<string>(FI_OS_NEXUS_ROLE_CODES);

export function isFiOsNexusRoleCode(value: string): value is FiOsNexusRoleCode {
  return ROLE_SET.has(value.trim());
}

export function validateFiOsNexusRoleCodes(roles: string[]):
  | {
      ok: true;
      roles: FiOsNexusRoleCode[];
    }
  | {
      ok: false;
      invalidRoles: string[];
    } {
  const invalidRoles: string[] = [];
  const normalized: FiOsNexusRoleCode[] = [];
  const seen = new Set<string>();

  for (const raw of roles) {
    const role = raw.trim();
    if (!role) continue;
    if (!isFiOsNexusRoleCode(role)) {
      invalidRoles.push(raw);
      continue;
    }
    if (seen.has(role)) continue;
    seen.add(role);
    normalized.push(role);
  }

  if (invalidRoles.length > 0) {
    return { ok: false, invalidRoles };
  }
  return { ok: true, roles: normalized };
}
