import type { ExternalConnectorStatus } from "./externalConnectorTypes";

export const HUBSPOT_ENGAGEMENT_REQUIRED_SCOPES = [
  "crm.objects.notes.read",
  "crm.objects.emails.read",
  "conversations.read",
  "files",
  "forms",
] as const;

const HUBSPOT_ENGAGEMENT_SCOPE_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "crm.objects.emails.read": [
    "crm.objects.emails.read",
    "crm.schemas.emails.read",
    "sales-email-read",
  ],
  files: ["files", "files.ui_hidden.read"],
};

export type HubspotEngagementBackupActionState = {
  visible: boolean;
  disabled: boolean;
  disabledReason: string | null;
  missingScopes: readonly string[];
  grantedEngagementScopes: readonly string[];
  activeRun: boolean;
};

function scopeGranted(granted: Set<string>, scope: string): boolean {
  return (HUBSPOT_ENGAGEMENT_SCOPE_ALIASES[scope] ?? [scope]).some((candidate) =>
    granted.has(candidate)
  );
}

export function resolveHubspotEngagementBackupActionState(input: {
  credentialConfigured: boolean;
  connectorStatus: ExternalConnectorStatus;
  grantedScopes: readonly string[];
  activeRun: boolean;
  liveCapabilitiesVerified: boolean;
  operatorAuthorized: boolean;
}): HubspotEngagementBackupActionState {
  const granted = new Set(input.grantedScopes);
  const missingScopes = HUBSPOT_ENGAGEMENT_REQUIRED_SCOPES.filter(
    (scope) => !scopeGranted(granted, scope)
  );
  const grantedEngagementScopes = HUBSPOT_ENGAGEMENT_REQUIRED_SCOPES.filter((scope) =>
    scopeGranted(granted, scope)
  );

  if (input.activeRun) {
    return {
      visible: false,
      disabled: true,
      disabledReason: null,
      missingScopes,
      grantedEngagementScopes,
      activeRun: true,
    };
  }
  if (!input.operatorAuthorized) {
    return {
      visible: true,
      disabled: true,
      disabledReason: "Platform admin or authorised clinic operator access is required.",
      missingScopes,
      grantedEngagementScopes,
      activeRun: false,
    };
  }
  if (!input.credentialConfigured) {
    return {
      visible: true,
      disabled: true,
      disabledReason: "A stored encrypted credential is required.",
      missingScopes,
      grantedEngagementScopes,
      activeRun: false,
    };
  }
  if (input.connectorStatus !== "configured" && input.connectorStatus !== "active") {
    return {
      visible: true,
      disabled: true,
      disabledReason: "The HubSpot connector must be configured or active.",
      missingScopes,
      grantedEngagementScopes,
      activeRun: false,
    };
  }
  // Partial scopes are allowed: at least one engagement read scope must be granted.
  if (grantedEngagementScopes.length === 0) {
    return {
      visible: true,
      disabled: true,
      disabledReason: `Missing all engagement permission scopes: ${missingScopes.join(", ")}.`,
      missingScopes,
      grantedEngagementScopes,
      activeRun: false,
    };
  }
  if (!input.liveCapabilitiesVerified) {
    return {
      visible: true,
      disabled: true,
      disabledReason: "Run Check engagement backup access before starting the backup.",
      missingScopes,
      grantedEngagementScopes,
      activeRun: false,
    };
  }
  return {
    visible: true,
    disabled: false,
    disabledReason: null,
    missingScopes,
    grantedEngagementScopes,
    activeRun: false,
  };
}
