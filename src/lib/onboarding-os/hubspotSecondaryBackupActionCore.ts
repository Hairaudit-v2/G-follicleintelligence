import type { ExternalConnectorStatus } from "./externalConnectorTypes";

export const HUBSPOT_SECONDARY_REQUIRED_SCOPES = [
  "crm.objects.companies.read",
  "crm.objects.tickets.read",
  "crm.objects.owners.read",
  "crm.objects.calls.read",
  "crm.objects.tasks.read",
  "crm.objects.meetings.read",
] as const;

const HUBSPOT_SCOPE_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "crm.objects.tickets.read": ["crm.objects.tickets.read", "tickets.read"],
};

export type HubspotSecondaryBackupActionState = {
  visible: boolean;
  disabled: boolean;
  disabledReason: string | null;
  missingScopes: readonly string[];
  activeRun: boolean;
};

export function resolveHubspotSecondaryBackupActionState(input: {
  credentialConfigured: boolean;
  connectorStatus: ExternalConnectorStatus;
  grantedScopes: readonly string[];
  activeRun: boolean;
  liveCapabilitiesVerified: boolean;
  operatorAuthorized: boolean;
}): HubspotSecondaryBackupActionState {
  const granted = new Set(input.grantedScopes);
  const missingScopes = HUBSPOT_SECONDARY_REQUIRED_SCOPES.filter(
    (scope) =>
      !(HUBSPOT_SCOPE_ALIASES[scope] ?? [scope]).some((candidate) => granted.has(candidate))
  );

  // An active run owns the operator action until it finalizes. Every other blocker is
  // rendered as an explicit disabled reason so operators are not left guessing.
  if (input.activeRun) {
    return { visible: false, disabled: true, disabledReason: null, missingScopes, activeRun: true };
  }
  if (!input.operatorAuthorized) {
    return {
      visible: true,
      disabled: true,
      disabledReason: "Platform admin or authorised tenant operator access is required.",
      missingScopes,
      activeRun: false,
    };
  }
  if (!input.credentialConfigured) {
    return {
      visible: true,
      disabled: true,
      disabledReason: "A stored encrypted credential is required.",
      missingScopes,
      activeRun: false,
    };
  }
  if (input.connectorStatus !== "configured" && input.connectorStatus !== "active") {
    return {
      visible: true,
      disabled: true,
      disabledReason: "The HubSpot connector must be configured or active.",
      missingScopes,
      activeRun: false,
    };
  }
  if (missingScopes.length > 0) {
    return {
      visible: true,
      disabled: true,
      disabledReason: `Missing recorded secondary permission${missingScopes.length === 1 ? "" : "s"}: ${missingScopes.join(", ")}.`,
      missingScopes,
      activeRun: false,
    };
  }
  if (!input.liveCapabilitiesVerified) {
    return {
      visible: true,
      disabled: true,
      disabledReason: "Run Check live backup access before starting the backup.",
      missingScopes: [],
      activeRun: false,
    };
  }
  return {
    visible: true,
    disabled: false,
    disabledReason: null,
    missingScopes: [],
    activeRun: false,
  };
}
