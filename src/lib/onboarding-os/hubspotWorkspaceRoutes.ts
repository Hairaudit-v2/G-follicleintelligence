export const HUBSPOT_WORKSPACE_TABS = [
  "overview",
  "backup-sync",
  "import-review",
  "owner-resolution",
  "lead-pilot",
  "contact-migration",
  "patient-review",
  "quarantine-review",
  "activity-webhooks",
  "configuration",
  "audit-history",
] as const;

export type HubspotWorkspaceTab = (typeof HUBSPOT_WORKSPACE_TABS)[number];

/** CRM-read members without Configuration hub caps may only open Import Review. */
export const HUBSPOT_CRM_READ_TABS = ["import-review"] as const satisfies readonly HubspotWorkspaceTab[];

/**
 * FI-UX-STRUCTURE-2C.2 — canonical HubSpot surface families owned by Integrations.
 * Tab-level capability gates are unchanged; this contract only maps navigation surfaces.
 */
export type HubspotCanonicalSurfaceId =
  | "overview"
  | "connection-sync"
  | "migration-import-review"
  | "identity-resolution"
  | "health-history";

export type HubspotCanonicalSurface = {
  id: HubspotCanonicalSurfaceId;
  label: string;
  /** Primary deep-link tab from the Integrations hub. */
  entryTab: HubspotWorkspaceTab;
  /** Tabs that belong to this surface family. */
  tabs: readonly HubspotWorkspaceTab[];
  /**
   * When true, Configuration-hub capability is required for every tab in the family.
   * When false, CRM-read sessions may open only the intersection with HUBSPOT_CRM_READ_TABS.
   */
  requiresConfigurationHub: boolean;
};

export const HUBSPOT_CANONICAL_SURFACES: readonly HubspotCanonicalSurface[] = [
  {
    id: "overview",
    label: "Overview",
    entryTab: "overview",
    tabs: ["overview"],
    requiresConfigurationHub: true,
  },
  {
    id: "connection-sync",
    label: "Connection and sync",
    entryTab: "backup-sync",
    tabs: ["backup-sync", "configuration", "activity-webhooks"],
    requiresConfigurationHub: true,
  },
  {
    id: "migration-import-review",
    label: "Migration/import review",
    entryTab: "import-review",
    tabs: ["import-review", "lead-pilot", "contact-migration", "quarantine-review"],
    requiresConfigurationHub: false,
  },
  {
    id: "identity-resolution",
    label: "Identity resolution",
    entryTab: "owner-resolution",
    tabs: ["owner-resolution", "patient-review", "quarantine-review"],
    requiresConfigurationHub: true,
  },
  {
    id: "health-history",
    label: "Health and history",
    entryTab: "audit-history",
    tabs: ["backup-sync", "activity-webhooks", "audit-history"],
    requiresConfigurationHub: true,
  },
] as const;

export function resolveHubspotWorkspaceTab(value: string | undefined): HubspotWorkspaceTab {
  return HUBSPOT_WORKSPACE_TABS.includes(value as HubspotWorkspaceTab)
    ? (value as HubspotWorkspaceTab)
    : "overview";
}

/** Default landing tab inside the canonical HubSpot workspace for the session. */
export function hubspotDefaultTabForSession(canManageConfigurationHub: boolean): HubspotWorkspaceTab {
  return canManageConfigurationHub ? "overview" : "import-review";
}

/**
 * Resolve a requested tab for the session.
 * Missing/invalid tabs fall back to the session default instead of Overview-notFound for CRM-read.
 * Explicitly forbidden tabs are returned as `{ forbidden }` so the page can fail closed.
 */
export function resolveHubspotWorkspaceTabForSession(
  value: string | undefined,
  canManageConfigurationHub: boolean
): { tab: HubspotWorkspaceTab } | { forbidden: HubspotWorkspaceTab } {
  if (value && HUBSPOT_WORKSPACE_TABS.includes(value as HubspotWorkspaceTab)) {
    const tab = value as HubspotWorkspaceTab;
    if (isHubspotTabAllowedForSession(tab, canManageConfigurationHub)) {
      return { tab };
    }
    return { forbidden: tab };
  }
  return { tab: hubspotDefaultTabForSession(canManageConfigurationHub) };
}

export function hubspotWorkspaceHref(tenantId: string, tab: HubspotWorkspaceTab): string {
  return `/fi-admin/${tenantId}/settings/integrations/hubspot?tab=${tab}`;
}

export function hubspotSurfaceHref(tenantId: string, surface: HubspotCanonicalSurface): string {
  return hubspotWorkspaceHref(tenantId, surface.entryTab);
}

/** Surfaces the session is authorised to open via Integrations. */
export function hubspotSurfacesForSession(
  canManageConfigurationHub: boolean
): readonly HubspotCanonicalSurface[] {
  return HUBSPOT_CANONICAL_SURFACES.filter(
    (surface) => canManageConfigurationHub || !surface.requiresConfigurationHub
  );
}

/** Tabs visible for the current session capability set. */
export function hubspotTabsForSession(canManageConfigurationHub: boolean): readonly HubspotWorkspaceTab[] {
  return canManageConfigurationHub ? HUBSPOT_WORKSPACE_TABS : HUBSPOT_CRM_READ_TABS;
}

export function isHubspotTabAllowedForSession(
  tab: HubspotWorkspaceTab,
  canManageConfigurationHub: boolean
): boolean {
  return hubspotTabsForSession(canManageConfigurationHub).includes(tab);
}