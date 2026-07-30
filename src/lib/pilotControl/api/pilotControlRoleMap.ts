/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.4 — map staff / fi_users roles → PilotControlRoleKey (pure).
 * Fail-closed: unknown mapping returns null (no scopes).
 */

import type { PilotControlRoleKey } from "../pilotControlContracts";
import { PILOT_CONTROL_ROLE_KEYS } from "../pilotControlContracts";
import { normalizeStaffRoleKey } from "@/src/lib/staffAccess/staffAccessRegistry";

const ROLE_SET = new Set<string>(PILOT_CONTROL_ROLE_KEYS);

/**
 * Resolve Pilot Control role from membership + staff signals.
 * Prefer explicit pilot role, then staff role, then tenant-admin / CRM shell, then fi_users.role.
 */
export function mapToPilotControlRole(input: {
  explicitPilotRole?: string | null;
  staffRole?: string | null;
  fiUserRole?: string | null;
  tenantAdminRole?: string | null;
  platformAdmin?: boolean;
}): PilotControlRoleKey | null {
  if (input.platformAdmin) return "administrator";

  const explicit = normalizePilotRoleToken(input.explicitPilotRole);
  if (explicit) return explicit;

  const fromStaff = mapStaffRoleToPilot(input.staffRole);
  if (fromStaff) return fromStaff;

  const admin = String(input.tenantAdminRole ?? "")
    .trim()
    .toLowerCase();
  if (admin === "clinic_admin" || admin === "owner") return "director";
  if (admin === "operations_admin") return "clinic_manager";

  const fi = String(input.fiUserRole ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (fi === "owner" || fi === "admin" || fi === "tenant_owner") return "director";
  if (fi === "tenant_backend" || fi === "tenant_admin") return "administrator";
  if (fi === "manager" || fi === "clinic_manager") return "clinic_manager";
  if (fi === "reception" || fi === "receptionist" || fi === "front_desk") return "reception";
  if (fi === "consultant" || fi === "advisor") return "consultant";
  if (fi === "clinical" || fi === "nurse" || fi === "doctor" || fi === "clinician") return "clinical";
  if (fi === "finance" || fi === "billing") return "finance";
  if (fi === "technical" || fi === "it" || fi === "integration") return "technical";

  // CRM shell operators with no staff mapping → administrator (full ops visibility for tenant admins)
  if (fi === "operator" || fi === "member") return null;

  return null;
}

function normalizePilotRoleToken(raw: string | null | undefined): PilotControlRoleKey | null {
  const r = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!r) return null;
  if (ROLE_SET.has(r)) return r as PilotControlRoleKey;
  return null;
}

function mapStaffRoleToPilot(staffRole: string | null | undefined): PilotControlRoleKey | null {
  const key = normalizeStaffRoleKey(staffRole);
  if (!key) {
    // Finance / technical often arrive as free-text staff_role values.
    const raw = String(staffRole ?? "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
    if (raw === "finance" || raw === "billing" || raw === "accounts") return "finance";
    if (raw === "technical" || raw === "it" || raw === "integration") return "technical";
    return normalizePilotRoleToken(staffRole);
  }
  switch (key) {
    case "owner":
      return "director";
    case "manager":
      return "clinic_manager";
    case "reception":
      return "reception";
    case "consultant":
      return "consultant";
    case "doctor":
    case "nurse":
      return "clinical";
    case "auditor":
      return "technical";
    case "platform_admin":
      return "administrator";
    case "investor":
    case "trainer":
      return null;
    default:
      return null;
  }
}
