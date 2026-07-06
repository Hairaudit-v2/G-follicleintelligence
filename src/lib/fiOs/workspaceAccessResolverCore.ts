/**
 * FI OS workspace access resolver — pure logic (no I/O).
 *
 * Resolves canonical staff identity for post-login workspace access, normalizes role keys,
 * validates grant lookup uses `fi_staff.id` (not `fi_staff_members.id`), and emits safe
 * diagnostic codes for server logging.
 */

import {
  normalizeStaffRoleKey,
  STAFF_ROLE_TEMPLATE_DEFAULTS,
  type StaffRoleKey,
} from "@/src/lib/staffAccess/staffAccessRegistry";
import { blocksStaffAccessLoginForEmploymentStatus } from "@/src/lib/workforce/staffTenantLinkRepairCore";

export const WORKSPACE_ACCESS_GENERIC_DENIED_MESSAGE =
  "You do not have access to this clinic workspace.";

export type WorkspaceAccessDiagnosticCode =
  | "missing_tenant_templates"
  | "missing_staff_grants"
  | "grants_query_used_wrong_staff_id"
  | "archived_duplicate_selected"
  | "role_unmapped";

export type WorkspaceAccessDiagnostic = {
  code: WorkspaceAccessDiagnosticCode;
  detail?: Record<string, string | boolean | number | null>;
};

export type StaffMemberRowSnapshot = {
  id: string;
  fiStaffId: string | null;
  roleCode: string | null;
  archivedAt: string | null;
  mergedInto: string | null;
  employmentStatus: string;
  systemAccessRevoked: boolean;
};

export type FiStaffRowSnapshot = {
  id: string;
  staffRole: string | null;
  isActive: boolean;
  employmentStatus: string | null;
};

export type WorkspaceStaffIdentity = {
  /** Grant lookup key — always `fi_staff.id` when present. */
  fiStaffId: string | null;
  /** Canonical active `fi_staff_members.id` when resolved. */
  canonicalStaffMemberId: string | null;
  roleKey: StaffRoleKey | null;
  rawRole: string | null;
};

export type WorkspaceAccessResolverInput = {
  fiStaff: FiStaffRowSnapshot | null;
  memberRows: StaffMemberRowSnapshot[];
  tenantTemplateCount: number;
  globalTemplateCount: number;
  activeGrantCountForFiStaffId: number;
  activeGrantCountForMemberId: number | null;
  isAdminOverride: boolean;
};

export type WorkspaceAccessResolverResult = {
  allowed: boolean;
  identity: WorkspaceStaffIdentity;
  diagnostics: WorkspaceAccessDiagnostic[];
  /** Internal reason for server logs when `allowed` is false. */
  denyReason: string | null;
};

/** Explicit production role labels → canonical {@link StaffRoleKey}. */
const WORKSPACE_ROLE_ALIASES: Record<string, StaffRoleKey> = {
  manager: "manager",
  receptionist: "reception",
  nurse: "nurse",
  doctor: "doctor",
  consultant: "consultant",
};

/**
 * Normalize `fi_staff.staff_role` and/or `fi_staff_members.role_code` to a canonical role key.
 */
export function resolveWorkspaceStaffRoleKey(input: {
  staffRole: string | null | undefined;
  roleCode: string | null | undefined;
}): { roleKey: StaffRoleKey | null; rawRole: string | null } {
  const staffRole = String(input.staffRole ?? "").trim();
  const roleCode = String(input.roleCode ?? "").trim();
  const rawRole = staffRole || roleCode || null;

  for (const candidate of [staffRole, roleCode]) {
    if (!candidate) continue;
    const direct = WORKSPACE_ROLE_ALIASES[candidate.trim().toLowerCase()];
    if (direct) return { roleKey: direct, rawRole };
    const normalized = normalizeStaffRoleKey(candidate);
    if (normalized) return { roleKey: normalized, rawRole };
  }

  return { roleKey: null, rawRole };
}

function isArchivedMember(row: StaffMemberRowSnapshot): boolean {
  return Boolean(row.archivedAt?.trim()) || Boolean(row.mergedInto?.trim());
}

function isCanonicalActiveMember(row: StaffMemberRowSnapshot): boolean {
  return !row.archivedAt?.trim() && !row.mergedInto?.trim();
}

/**
 * Pick the canonical `fi_staff_members` row for a linked `fi_staff` projection.
 * Ignores archived rows and rows merged into another member.
 */
export function resolveCanonicalStaffMemberRow(
  memberRows: StaffMemberRowSnapshot[],
  fiStaffId: string
): {
  canonical: StaffMemberRowSnapshot | null;
  naiveFirst: StaffMemberRowSnapshot | null;
  archivedDuplicateSelected: boolean;
} {
  const fid = fiStaffId.trim();
  const linked = memberRows.filter((r) => r.fiStaffId?.trim() === fid);
  const naiveFirst = linked[0] ?? null;
  const canonicalCandidates = linked.filter(isCanonicalActiveMember);

  let canonical: StaffMemberRowSnapshot | null = null;
  if (canonicalCandidates.length === 1) {
    canonical = canonicalCandidates[0] ?? null;
  } else if (canonicalCandidates.length > 1) {
    canonical = [...canonicalCandidates].sort((a, b) => a.id.localeCompare(b.id))[0] ?? null;
  }

  const archivedDuplicateSelected = Boolean(
    naiveFirst &&
      isArchivedMember(naiveFirst) &&
      canonical &&
      naiveFirst.id !== canonical.id
  );

  return { canonical, naiveFirst, archivedDuplicateSelected };
}

/** Follow `merged_into` to the canonical member id when duplicates were merged. */
export function followMergedIntoCanonicalMemberId(
  memberRows: StaffMemberRowSnapshot[],
  memberId: string
): string {
  const byId = new Map(memberRows.map((r) => [r.id, r]));
  let current = memberId.trim();
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    const row = byId.get(current);
    const target = row?.mergedInto?.trim();
    if (!target) return current;
    current = target;
  }
  return memberId.trim();
}

export function buildWorkspaceStaffIdentity(input: {
  fiStaff: FiStaffRowSnapshot | null;
  memberRows: StaffMemberRowSnapshot[];
}): WorkspaceStaffIdentity {
  const fiStaffId = input.fiStaff?.id?.trim() || null;
  const { canonical } =
    fiStaffId != null
      ? resolveCanonicalStaffMemberRow(input.memberRows, fiStaffId)
      : { canonical: null as StaffMemberRowSnapshot | null };

  const { roleKey, rawRole } = resolveWorkspaceStaffRoleKey({
    staffRole: input.fiStaff?.staffRole ?? null,
    roleCode: canonical?.roleCode ?? null,
  });

  return {
    fiStaffId,
    canonicalStaffMemberId: canonical?.id ?? null,
    roleKey,
    rawRole,
  };
}

export function collectWorkspaceAccessDiagnostics(
  input: WorkspaceAccessResolverInput & { identity: WorkspaceStaffIdentity }
): WorkspaceAccessDiagnostic[] {
  const diagnostics: WorkspaceAccessDiagnostic[] = [];
  const { identity } = input;

  if (input.fiStaff && resolveCanonicalStaffMemberRow(input.memberRows, input.fiStaff.id).archivedDuplicateSelected) {
    diagnostics.push({
      code: "archived_duplicate_selected",
      detail: {
        fiStaffId: identity.fiStaffId,
        canonicalStaffMemberId: identity.canonicalStaffMemberId,
      },
    });
  }

  if (
    input.activeGrantCountForMemberId != null &&
    input.activeGrantCountForFiStaffId > 0 &&
    input.activeGrantCountForMemberId === 0 &&
    identity.canonicalStaffMemberId &&
    identity.canonicalStaffMemberId !== identity.fiStaffId
  ) {
    diagnostics.push({
      code: "grants_query_used_wrong_staff_id",
      detail: {
        fiStaffId: identity.fiStaffId,
        memberId: identity.canonicalStaffMemberId,
        grantsForFiStaffId: input.activeGrantCountForFiStaffId,
        grantsForMemberId: input.activeGrantCountForMemberId,
      },
    });
  }

  if (identity.roleKey && input.tenantTemplateCount === 0 && input.globalTemplateCount === 0) {
    diagnostics.push({
      code: "missing_tenant_templates",
      detail: { roleKey: identity.roleKey },
    });
  }

  if (identity.roleKey && input.activeGrantCountForFiStaffId === 0) {
    const registryHasAccess = Boolean(STAFF_ROLE_TEMPLATE_DEFAULTS[identity.roleKey]);
    if (!registryHasAccess && !input.isAdminOverride) {
      diagnostics.push({
        code: "missing_staff_grants",
        detail: { roleKey: identity.roleKey, fiStaffId: identity.fiStaffId },
      });
    }
  }

  if (identity.fiStaffId && !identity.roleKey && !input.isAdminOverride) {
    diagnostics.push({
      code: "role_unmapped",
      detail: { rawRole: identity.rawRole },
    });
  }

  return diagnostics;
}

/**
 * Decide whether the viewer may enter the tenant workspace after Supabase login.
 * Generic denial message is returned separately; `denyReason` is for internal logs only.
 */
export function resolveWorkspaceAccessDecision(
  input: WorkspaceAccessResolverInput
): WorkspaceAccessResolverResult {
  const identity = buildWorkspaceStaffIdentity({
    fiStaff: input.fiStaff,
    memberRows: input.memberRows,
  });
  const diagnostics = collectWorkspaceAccessDiagnostics({ ...input, identity });

  if (input.isAdminOverride) {
    return { allowed: true, identity, diagnostics, denyReason: null };
  }

  if (!input.fiStaff) {
    // Tenant membership without fi_staff (legacy admin / backend) — defer to upstream gates.
    return { allowed: true, identity, diagnostics, denyReason: null };
  }

  if (!input.fiStaff.isActive) {
    return {
      allowed: false,
      identity,
      diagnostics,
      denyReason: "fi_staff_inactive",
    };
  }

  const { canonical } = resolveCanonicalStaffMemberRow(input.memberRows, input.fiStaff.id);
  const linkedMembers = input.memberRows.filter(
    (r) => r.fiStaffId?.trim() === input.fiStaff!.id.trim()
  );

  if (linkedMembers.length > 0 && !canonical) {
    return {
      allowed: false,
      identity,
      diagnostics,
      denyReason: "archived_duplicate_only",
    };
  }

  if (canonical) {
    if (Boolean(canonical.systemAccessRevoked)) {
      return {
        allowed: false,
        identity,
        diagnostics,
        denyReason: "system_access_revoked",
      };
    }

    if (blocksStaffAccessLoginForEmploymentStatus(canonical.employmentStatus)) {
      return {
        allowed: false,
        identity,
        diagnostics,
        denyReason: "employment_status_blocked",
      };
    }
  }

  return { allowed: true, identity, diagnostics, denyReason: null };
}
