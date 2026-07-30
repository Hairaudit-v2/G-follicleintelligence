/**
 * FI-CONTROLLED-PILOT-ACTIVATION-1B Governance Closure —
 * resolve staff / platform signals → PilotControlRoleKey (pure).
 *
 * Precedence (fail-closed):
 * 1. Explicit permission / explicit pilot role assignment
 * 2. Canonical platform role (platform admin)
 * 3. Canonical staff function (including finance titles)
 * 4. Controlled fallback (tenant-admin / fi_users role)
 * 5. Deny (null)
 *
 * Job title alone must not elevate to administrator.
 * CFO / finance labels map to finance — never administrator.
 */

import type { PilotControlRoleKey } from "../pilotControlContracts";
import { PILOT_CONTROL_ROLE_KEYS } from "../pilotControlContracts";
import { normalizeStaffRoleKey } from "@/src/lib/staffAccess/staffAccessRegistry";

const ROLE_SET = new Set<string>(PILOT_CONTROL_ROLE_KEYS);

/** Executive / finance job titles that must resolve to finance, not administrator. */
const FINANCE_TITLE_TOKENS = new Set([
  "cfo",
  "chief_financial_officer",
  "finance",
  "finance_manager",
  "finance_admin",
  "financial_controller",
  "bookkeeper",
  "accounts",
  "accountant",
  "billing",
  "billing_manager",
]);

/** Titles that must never elevate via jobTitle alone. */
const NON_ELEVATING_JOB_TITLES = new Set([
  "ceo",
  "coo",
  "cto",
  "vp",
  "vice_president",
  "executive",
  "executive_director",
]);

export type ResolvePilotControlRoleInput = {
  /** Explicit pilot-control role assignment (highest precedence after permissions). */
  explicitPilotRole?: string | null;
  /** Explicit permission assignment list — if contains pilot admin scopes, may elevate. */
  permissionAssignments?: readonly string[] | null;
  /** Canonical platform role signal. */
  platformRole?: string | null;
  platformAdmin?: boolean;
  /** Canonical staff function / staff_role. */
  staffRole?: string | null;
  /** Free-text job title — never elevates to administrator alone. */
  jobTitle?: string | null;
  fiUserRole?: string | null;
  tenantAdminRole?: string | null;
};

/**
 * Resolve Pilot Control role. Prefer {@link resolvePilotControlRole}; 
 * {@link mapToPilotControlRole} remains as a compatibility alias.
 */
export function resolvePilotControlRole(
  input: ResolvePilotControlRoleInput
): PilotControlRoleKey | null {
  // 1. Explicit permission assignment
  const fromPermissions = mapPermissionAssignments(input.permissionAssignments);
  if (fromPermissions) return fromPermissions;

  const explicit = normalizePilotRoleToken(input.explicitPilotRole);
  if (explicit) return explicit;

  // 2. Canonical platform role
  if (input.platformAdmin) return "administrator";
  const fromPlatform = mapPlatformRole(input.platformRole);
  if (fromPlatform) return fromPlatform;

  // 3. Canonical staff function (finance titles before any admin fallback)
  const fromStaff = mapStaffRoleToPilot(input.staffRole);
  if (fromStaff) return fromStaff;

  // Job title: finance titles only — never administrator elevation
  const fromTitle = mapJobTitleToPilot(input.jobTitle);
  if (fromTitle) return fromTitle;

  // 4. Controlled fallback (tenant-admin / fi_users)
  const admin = String(input.tenantAdminRole ?? "")
    .trim()
    .toLowerCase();
  if (admin === "clinic_admin" || admin === "owner") return "director";
  if (admin === "operations_admin") return "clinic_manager";
  if (admin === "finance_admin") return "finance";

  const fi = normalizeToken(input.fiUserRole);
  if (fi === "owner" || fi === "admin" || fi === "tenant_owner") return "director";
  // tenant_backend alone is not finance; only administrator when no finance staff signal
  if (fi === "tenant_backend" || fi === "tenant_admin") return "administrator";
  if (fi === "manager" || fi === "clinic_manager") return "clinic_manager";
  if (fi === "reception" || fi === "receptionist" || fi === "front_desk") return "reception";
  if (fi === "consultant" || fi === "advisor") return "consultant";
  if (fi === "clinical" || fi === "nurse" || fi === "doctor" || fi === "clinician") {
    return "clinical";
  }
  if (FINANCE_TITLE_TOKENS.has(fi)) return "finance";
  if (fi === "technical" || fi === "it" || fi === "integration") return "technical";

  // CRM shell operators with no staff mapping → deny
  if (fi === "operator" || fi === "member") return null;

  // Job title alone claiming director/admin elevation → fail closed (no other signal matched)
  if (jobTitleClaimsElevation(input.jobTitle)) {
    return null;
  }

  // 5. Deny
  return null;
}

/** @deprecated Prefer resolvePilotControlRole — kept for existing call sites. */
export function mapToPilotControlRole(input: {
  explicitPilotRole?: string | null;
  staffRole?: string | null;
  fiUserRole?: string | null;
  tenantAdminRole?: string | null;
  platformAdmin?: boolean;
  jobTitle?: string | null;
  permissionAssignments?: readonly string[] | null;
  platformRole?: string | null;
}): PilotControlRoleKey | null {
  return resolvePilotControlRole(input);
}

function mapPermissionAssignments(
  assignments: readonly string[] | null | undefined
): PilotControlRoleKey | null {
  if (!assignments || assignments.length === 0) return null;
  const normalized = assignments.map((a) => normalizeToken(a)).filter(Boolean);

  // Explicit role tokens in permission list
  for (const a of normalized) {
    if (a.startsWith("pilot_control.role.")) {
      const role = a.slice("pilot_control.role.".length);
      if (ROLE_SET.has(role)) return role as PilotControlRoleKey;
    }
  }

  // Ambiguous: both finance-only and admin elevation claimed without explicit role
  const wantsFinance = normalized.some(
    (a) => a.includes("finance") && !a.includes("admin")
  );
  const wantsAdmin = normalized.some(
    (a) =>
      a === "pilot_control.admin" ||
      a === "tenant.admin" ||
      a === "platform.admin" ||
      a.includes("activation.approve")
  );
  if (wantsFinance && wantsAdmin) {
    // Fail closed on ambiguous elevation claims
    return null;
  }
  if (wantsAdmin) return "administrator";
  if (wantsFinance) return "finance";

  return null;
}

function mapPlatformRole(raw: string | null | undefined): PilotControlRoleKey | null {
  const r = normalizeToken(raw);
  if (!r) return null;
  if (r === "platform_admin" || r === "fi_os_platform_admin") return "administrator";
  if (ROLE_SET.has(r)) return r as PilotControlRoleKey;
  return null;
}

function mapJobTitleToPilot(jobTitle: string | null | undefined): PilotControlRoleKey | null {
  const raw = normalizeToken(jobTitle);
  if (!raw) return null;
  if (FINANCE_TITLE_TOKENS.has(raw)) return "finance";
  // Partial match for titles like "Chief Financial Officer"
  if (raw.includes("financial") || raw.includes("bookkeep") || raw.includes("billing")) {
    return "finance";
  }
  return null;
}

function jobTitleClaimsElevation(jobTitle: string | null | undefined): boolean {
  const raw = normalizeToken(jobTitle);
  if (!raw) return false;
  if (NON_ELEVATING_JOB_TITLES.has(raw)) return true;
  if (raw.includes("director") || raw.includes("administrator") || raw.includes("admin")) {
    // "finance_admin" already handled as finance; other *admin* titles alone → fail closed
    if (FINANCE_TITLE_TOKENS.has(raw)) return false;
    return true;
  }
  return false;
}

function normalizeToken(raw: string | null | undefined): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function normalizePilotRoleToken(raw: string | null | undefined): PilotControlRoleKey | null {
  const r = normalizeToken(raw);
  if (!r) return null;
  if (ROLE_SET.has(r)) return r as PilotControlRoleKey;
  return null;
}

function mapStaffRoleToPilot(staffRole: string | null | undefined): PilotControlRoleKey | null {
  const key = normalizeStaffRoleKey(staffRole);
  if (!key) {
    // Finance / technical often arrive as free-text staff_role values (e.g. "CFO").
    const raw = normalizeToken(staffRole);
    if (!raw) return null;
    if (FINANCE_TITLE_TOKENS.has(raw)) return "finance";
    if (raw.includes("financial") || raw.includes("bookkeep")) return "finance";
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
