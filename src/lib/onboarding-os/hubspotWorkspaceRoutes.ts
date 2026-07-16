export const HUBSPOT_WORKSPACE_TABS = [
  "overview",
  "backup-sync",
  "import-review",
  "owner-resolution",
  "lead-pilot",
  "contact-migration",
  "patient-review",
  "activity-webhooks",
  "configuration",
  "audit-history",
] as const;

export type HubspotWorkspaceTab = (typeof HUBSPOT_WORKSPACE_TABS)[number];

/** CRM-read members without Configuration hub caps may only open Import Review. */
export const HUBSPOT_CRM_READ_TABS = ["import-review"] as const satisfies readonly HubspotWorkspaceTab[];

export function resolveHubspotWorkspaceTab(value: string | undefined): HubspotWorkspaceTab {
  return HUBSPOT_WORKSPACE_TABS.includes(value as HubspotWorkspaceTab)
    ? (value as HubspotWorkspaceTab)
    : "overview";
}

export function hubspotWorkspaceHref(tenantId: string, tab: HubspotWorkspaceTab): string {
  return `/fi-admin/${tenantId}/settings/integrations/hubspot?tab=${tab}`;
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
