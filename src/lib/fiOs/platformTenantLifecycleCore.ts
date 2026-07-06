import {
  KNOWN_DEMO_TENANT_SLUGS,
  PROTECTED_TENANT_SLUGS,
} from "./platformTenantLifecycleConstants";

export type FiPlatformTenantLifecycleRow = {
  id: string;
  name: string;
  slug: string;
  created_at: string | null;
  archived_at: string | null;
  archived_by: string | null;
  archive_reason: string | null;
  is_demo: boolean;
  is_production_visible: boolean;
};

export type FiPlatformTenantListOptions = {
  includeArchived?: boolean;
  includeDemo?: boolean;
  includeHidden?: boolean;
};

export function isTenantArchived(tenant: Pick<FiPlatformTenantLifecycleRow, "archived_at">): boolean {
  return Boolean(tenant.archived_at?.trim());
}

export function isTenantDemo(tenant: Pick<FiPlatformTenantLifecycleRow, "is_demo" | "slug">): boolean {
  return tenant.is_demo === true || KNOWN_DEMO_TENANT_SLUGS.has(tenant.slug.trim().toLowerCase());
}

export function shouldShowTenantHomeLink(
  tenant: Pick<FiPlatformTenantLifecycleRow, "archived_at" | "is_production_visible">
): boolean {
  if (isTenantArchived(tenant)) return false;
  return tenant.is_production_visible !== false;
}

export function filterPlatformTenantList(
  tenants: FiPlatformTenantLifecycleRow[],
  opts: FiPlatformTenantListOptions = {}
): FiPlatformTenantLifecycleRow[] {
  const includeArchived = opts.includeArchived === true;
  const includeDemo = opts.includeDemo !== false;
  const includeHidden = opts.includeHidden === true;

  return tenants.filter((t) => {
    if (!includeArchived && isTenantArchived(t)) return false;
    if (!includeDemo && isTenantDemo(t) && !isTenantArchived(t)) return false;
    if (!includeHidden && t.is_production_visible === false && !isTenantArchived(t)) return false;
    return true;
  });
}

export type FiPlatformTenantAdminGroups = {
  production: FiPlatformTenantLifecycleRow[];
  demo: FiPlatformTenantLifecycleRow[];
  archived: FiPlatformTenantLifecycleRow[];
};

/** Groups non-archived tenants into production vs demo; archived tenants are separate. */
export function groupPlatformTenantsForAdminUi(
  tenants: FiPlatformTenantLifecycleRow[]
): FiPlatformTenantAdminGroups {
  const production: FiPlatformTenantLifecycleRow[] = [];
  const demo: FiPlatformTenantLifecycleRow[] = [];
  const archived: FiPlatformTenantLifecycleRow[] = [];

  for (const t of tenants) {
    if (isTenantArchived(t)) {
      archived.push(t);
      continue;
    }
    if (isTenantDemo(t)) {
      demo.push(t);
      continue;
    }
    production.push(t);
  }

  return { production, demo, archived };
}

export type CanArchiveTenantInput = {
  tenant: Pick<FiPlatformTenantLifecycleRow, "id" | "slug" | "archived_at">;
  actorActiveTenantIds: string[];
  sessionActiveTenantId?: string | null;
  allowProtectedArchive?: boolean;
};

export function canArchiveTenant(
  input: CanArchiveTenantInput
): { ok: true } | { ok: false; reason: string } {
  const slug = input.tenant.slug.trim().toLowerCase();

  if (isTenantArchived(input.tenant)) {
    return { ok: false, reason: "Tenant is already archived." };
  }

  if (PROTECTED_TENANT_SLUGS.has(slug) && !input.allowProtectedArchive) {
    return {
      ok: false,
      reason: "This tenant is protected and cannot be archived without an explicit override.",
    };
  }

  const sessionId = input.sessionActiveTenantId?.trim() || null;
  if (sessionId && sessionId === input.tenant.id.trim()) {
    const activeIds = input.actorActiveTenantIds.filter(Boolean);
    if (activeIds.length <= 1) {
      return {
        ok: false,
        reason:
          "Cannot archive the only active tenant for your session. Switch to another tenant first.",
      };
    }
  }

  return { ok: true };
}

export function tenantLifecycleBadges(
  tenant: Pick<FiPlatformTenantLifecycleRow, "archived_at" | "is_demo" | "slug" | "is_production_visible">
): Array<"Archived" | "Demo" | "Sandbox" | "Hidden"> {
  const badges: Array<"Archived" | "Demo" | "Sandbox" | "Hidden"> = [];
  if (isTenantArchived(tenant)) badges.push("Archived");
  if (isTenantDemo(tenant)) badges.push("Demo");
  if (tenant.is_production_visible === false && !isTenantArchived(tenant)) badges.push("Hidden");
  if (KNOWN_DEMO_TENANT_SLUGS.has(tenant.slug.trim().toLowerCase()) && !badges.includes("Demo")) {
    badges.push("Sandbox");
  }
  return badges;
}
