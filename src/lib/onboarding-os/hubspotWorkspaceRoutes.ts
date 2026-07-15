export const HUBSPOT_WORKSPACE_TABS = [
  "overview",
  "backup-sync",
  "import-review",
  "activity-webhooks",
  "configuration",
  "audit-history",
] as const;

export type HubspotWorkspaceTab = (typeof HUBSPOT_WORKSPACE_TABS)[number];

export function resolveHubspotWorkspaceTab(value: string | undefined): HubspotWorkspaceTab {
  return HUBSPOT_WORKSPACE_TABS.includes(value as HubspotWorkspaceTab)
    ? (value as HubspotWorkspaceTab)
    : "overview";
}

export function hubspotWorkspaceHref(tenantId: string, tab: HubspotWorkspaceTab): string {
  return `/fi-admin/${tenantId}/settings/integrations/hubspot?tab=${tab}`;
}
