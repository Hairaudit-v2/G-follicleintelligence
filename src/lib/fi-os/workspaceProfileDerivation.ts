import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import { isFiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import type { FiTenantAdminRole } from "@/src/lib/tenantAdmin/tenantAdminRoles";
import { isFiTenantAdminRoleString } from "@/src/lib/tenantAdmin/tenantAdminRoles";
import { isFiOsPlatformAdminRole } from "@/src/lib/fiOs/fiOsRoles";
import { normalizeFiOsRole } from "@/src/lib/fiOs/fiOsRoles";

export type WorkspaceProfileDerivationInput = {
  /** Raw `staff_metadata.workspace_profile` value from JSON (if any). */
  explicitWorkspaceProfile?: unknown;
  /** `fi_staff.staff_role` (free text in DB). */
  staffRole?: string | null;
  /** Active tenant backend admin role when linked to the viewer for this tenant. */
  tenantAdminRole?: FiTenantAdminRole | null;
  /** `fi_os_identities.os_role` when present. */
  fiOsRole?: string | null;
};

/**
 * Parses explicit workspace profile from persisted staff metadata.
 * Invalid or unknown strings return null so callers fall back to heuristics.
 */
export function parseExplicitWorkspaceProfile(raw: unknown): FiWorkspaceProfileKey | null {
  if (typeof raw !== "string") return null;
  const k = raw.trim().toLowerCase();
  if (!k || k === "default") return null;
  if (!isFiWorkspaceProfileKey(k)) return null;
  /** `platform_admin` is derived from OS identity — ignore if stored manually to avoid stale impersonation labels. */
  if (k === "platform_admin") return null;
  return k;
}

/**
 * Maps schedulable `fi_staff.staff_role` text to a workspace persona (best-effort).
 * TODO(Stage 4): replace with normalized staff_type / HR job code when available in schema.
 */
export function deriveWorkspaceProfileFromStaffRole(staffRole: string | null | undefined): FiWorkspaceProfileKey | null {
  const t = String(staffRole ?? "").trim().toLowerCase();
  if (!t) return null;
  if (t.includes("surgeon")) return "surgeon";
  if (t.includes("nurse")) return "nurse";
  if (t.includes("consultant")) return "consultant";
  if (t.includes("reception")) return "reception";
  if (t.includes("doctor") || t === "dr" || t.startsWith("dr ")) return "doctor";
  if (t.includes("director")) return "director";
  if (t.includes("manager") || t.includes("operations")) return "clinic_manager";
  if (t.includes("trainer") || t.includes("academy")) return "academy_trainer";
  if (t.includes("audit")) return "auditor";
  return null;
}

export function deriveWorkspaceProfileFromTenantAdminRole(
  role: string | null | undefined
): FiWorkspaceProfileKey | null {
  if (!role || !isFiTenantAdminRoleString(role)) return null;
  const r = role as FiTenantAdminRole;
  if (r === "clinic_admin" || r === "finance_admin") return "director";
  if (r === "operations_admin") return "clinic_manager";
  if (r === "data_safety_admin") return "auditor";
  return null;
}

export function deriveWorkspaceProfileFromFiOsRole(osRole: string | null | undefined): FiWorkspaceProfileKey | null {
  const r = normalizeFiOsRole(osRole);
  if (isFiOsPlatformAdminRole(r)) return "platform_admin";
  if (r === "fi_auditor") return "auditor";
  /** TODO(Stage 4): consider fi_clinic_admin / fi_consultant hints when viewer lacks fi_staff row. */
  return null;
}

/**
 * Deterministic workspace profile resolution for the signed-in viewer.
 * Order: explicit metadata → staff role text → tenant admin → OS role → default.
 */
export function resolveWorkspaceProfileKeyFromSignals(input: WorkspaceProfileDerivationInput): FiWorkspaceProfileKey {
  const explicit = parseExplicitWorkspaceProfile(input.explicitWorkspaceProfile);
  if (explicit) return explicit;

  const fromStaff = deriveWorkspaceProfileFromStaffRole(input.staffRole);
  if (fromStaff) return fromStaff;

  const fromTenant = deriveWorkspaceProfileFromTenantAdminRole(input.tenantAdminRole ?? null);
  if (fromTenant) return fromTenant;

  const fromOs = deriveWorkspaceProfileFromFiOsRole(input.fiOsRole ?? null);
  if (fromOs) return fromOs;

  return "default";
}
