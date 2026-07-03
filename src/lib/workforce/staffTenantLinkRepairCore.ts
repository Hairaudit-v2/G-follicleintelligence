/**
 * Pure helpers for staff invite/login tenant linking — no server-only imports.
 */

const FI_ADMIN_TENANT_PATH = /^\/fi-admin\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/i;

export function extractTenantIdFromFiAdminPath(path: string | null | undefined): string | null {
  const raw = String(path ?? "").trim();
  if (!raw) return null;
  const match = raw.match(FI_ADMIN_TENANT_PATH);
  return match?.[1] ? String(match[1]).toLowerCase() : null;
}

export function readMetadataTenantId(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  const raw = metadata?.fi_tenant_id;
  const tid = String(raw ?? "").trim().toLowerCase();
  return tid || null;
}

/** FI membership rows are authoritative over stale auth metadata. */
export function resolvePreferredLoginTenantId(input: {
  nextPathTenantId: string | null;
  metadataTenantId: string | null;
  membershipTenantIds: string[];
}): string | null {
  const memberships = Array.from(
    new Set(input.membershipTenantIds.map((id) => id.trim().toLowerCase()).filter(Boolean))
  );
  const nextTenant = input.nextPathTenantId?.trim().toLowerCase() || null;
  const metadataTenant = input.metadataTenantId?.trim().toLowerCase() || null;

  if (nextTenant && memberships.includes(nextTenant)) return nextTenant;
  if (nextTenant && memberships.length === 0) return nextTenant;
  if (memberships.length === 1) return memberships[0] ?? null;
  if (memberships.length > 1) {
    if (nextTenant && memberships.includes(nextTenant)) return nextTenant;
    return null;
  }
  if (metadataTenant) return metadataTenant;
  return nextTenant;
}

export function shouldPreferMembershipOverMetadata(input: {
  metadataTenantId: string | null;
  membershipTenantIds: string[];
}): boolean {
  const metadataTenant = input.metadataTenantId?.trim().toLowerCase() || null;
  if (!metadataTenant) return false;
  const memberships = input.membershipTenantIds
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);
  if (memberships.length === 0) return false;
  return !memberships.includes(metadataTenant);
}

export function formatCrossTenantInviteWarning(input: {
  email: string;
  inviteTenantName: string;
  otherTenantNames: string[];
}): string | null {
  const others = input.otherTenantNames.map((n) => n.trim()).filter(Boolean);
  if (others.length === 0) return null;
  const email = input.email.trim() || "this email";
  const clinic = input.inviteTenantName.trim() || "this clinic";
  return `${email} already has Follicle Intelligence access for ${others.join(", ")}. The invite will link that existing login account to ${clinic}.`;
}

/** Staff Access Centre login is independent of onboarding completion. */
export function blocksStaffAccessLoginForEmploymentStatus(
  employmentStatus: string | null | undefined
): boolean {
  const status = String(employmentStatus ?? "").trim().toLowerCase();
  return status === "terminated" || status === "resigned" || status === "contract_ended" || status === "contract_expired" || status === "merged";
}

export function resolvePostLoginDestination(input: {
  explicitNext: string | null;
  membershipTenantIds: string[];
  metadataTenantId: string | null;
  defaultTenantPickerPath?: string;
  defaultCasesSuffix?: string;
}): string {
  const explicit = input.explicitNext?.trim() || null;
  const picker = input.defaultTenantPickerPath?.trim() || "/fi-admin";
  const casesSuffix = input.defaultCasesSuffix?.trim() || "/cases";

  if (explicit) {
    const explicitTenant = extractTenantIdFromFiAdminPath(explicit);
    const memberships = input.membershipTenantIds.map((id) => id.trim().toLowerCase());
    if (!explicitTenant || memberships.length === 0 || memberships.includes(explicitTenant)) {
      return explicit;
    }
  }

  const preferred = resolvePreferredLoginTenantId({
    nextPathTenantId: extractTenantIdFromFiAdminPath(explicit),
    metadataTenantId: input.metadataTenantId,
    membershipTenantIds: input.membershipTenantIds,
  });

  if (!preferred) {
    if (input.membershipTenantIds.length > 1) return picker;
    return picker;
  }

  if (explicit) return explicit;
  return `/fi-admin/${preferred}${casesSuffix}`;
}
