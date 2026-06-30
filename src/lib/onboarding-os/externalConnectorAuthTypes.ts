/**
 * OnboardingOS Phase F2 — External connector auth & verification types (safe for core unit tests; no server-only).
 */

import type { ExternalConnectorProvider } from "./externalConnectorTypes";

export const EXTERNAL_CONNECTOR_AUTH_METHODS = [
  "oauth2",
  "api_key",
  "webhook_secret",
  "manual_placeholder",
] as const;
export type ExternalConnectorAuthMethod = (typeof EXTERNAL_CONNECTOR_AUTH_METHODS)[number];

export const EXTERNAL_CONNECTOR_AUTH_STATUSES = [
  "not_started",
  "pending",
  "verified",
  "failed",
  "expired",
  "revoked",
  "insufficient_permissions",
] as const;
export type ExternalConnectorAuthStatus = (typeof EXTERNAL_CONNECTOR_AUTH_STATUSES)[number];

export const EXTERNAL_CONNECTOR_VERIFICATION_OUTCOMES = [
  "success",
  "warning",
  "error",
  "info",
] as const;
export type ExternalConnectorVerificationOutcome =
  (typeof EXTERNAL_CONNECTOR_VERIFICATION_OUTCOMES)[number];

export const EXTERNAL_CONNECTOR_TOKEN_REFRESH_OUTCOMES = ["success", "failed", "skipped"] as const;
export type ExternalConnectorTokenRefreshOutcome =
  (typeof EXTERNAL_CONNECTOR_TOKEN_REFRESH_OUTCOMES)[number];

export type ExternalConnectorAuthSession = {
  id: string;
  integrationId: string;
  tenantId: string;
  provider: ExternalConnectorProvider;
  authMethod: ExternalConnectorAuthMethod;
  authStatus: ExternalConnectorAuthStatus;
  credentialId: string | null;
  scopesGranted: readonly string[];
  providerPayload: Record<string, unknown>;
  tokenExpiresAt: string | null;
  verifiedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExternalConnectorPermissionScope = {
  scopeKey: string;
  scopeLabel: string;
  required: boolean;
  granted: boolean;
};

export type ExternalConnectorVerificationResult = {
  authStatus: ExternalConnectorAuthStatus;
  outcome: ExternalConnectorVerificationOutcome;
  permissionCoveragePercent: number;
  requiredScopes: readonly ExternalConnectorPermissionScope[];
  grantedScopes: readonly ExternalConnectorPermissionScope[];
  summary: string;
  blockers: readonly string[];
  warnings: readonly string[];
  providerPayload: Record<string, unknown>;
  testMode: boolean;
};

export type ExternalConnectorTokenRefreshEvent = {
  id: string;
  authSessionId: string;
  integrationId: string;
  tenantId: string;
  provider: ExternalConnectorProvider;
  outcome: ExternalConnectorTokenRefreshOutcome;
  detail: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
};

export type ExternalConnectorVerificationEvent = {
  id: string;
  authSessionId: string;
  integrationId: string;
  tenantId: string;
  provider: ExternalConnectorProvider;
  authStatus: ExternalConnectorAuthStatus;
  outcome: ExternalConnectorVerificationOutcome;
  actorLabel: string | null;
  detail: Record<string, unknown>;
  providerPayload: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
};

export type ExternalConnectorAuthInput = {
  authMethod: ExternalConnectorAuthMethod;
  testMode?: boolean;
  apiKey?: string | null;
  oauthAccessToken?: string | null;
  webhookSecret?: string | null;
  grantedScopes?: readonly string[] | null;
  tokenExpiresAt?: string | null;
};

export type ExternalConnectorAuthInputValidationResult =
  | { ok: true; authMethod: ExternalConnectorAuthMethod }
  | { ok: false; errors: string[] };

export type ExternalConnectorAuthHealthSummary = {
  authStatus: ExternalConnectorAuthStatus;
  permissionCoveragePercent: number;
  tokenExpiryWarning: string | null;
  summary: string;
  readyForLiveSync: boolean;
  blockers: readonly string[];
  warnings: readonly string[];
};

export type ExternalConnectorAuthSummary = {
  integrationId: string;
  provider: ExternalConnectorProvider;
  authSession: ExternalConnectorAuthSession | null;
  requiredScopes: readonly ExternalConnectorPermissionScope[];
  grantedScopes: readonly ExternalConnectorPermissionScope[];
  permissionCoveragePercent: number;
  tokenExpiryWarning: string | null;
  latestVerificationEvent: ExternalConnectorVerificationEvent | null;
  healthSummary: ExternalConnectorAuthHealthSummary;
};

export type TenantConnectorAuthSnapshot = {
  tenantId: string;
  summaries: readonly ExternalConnectorAuthSummary[];
  calculatedAt: string;
};

export const EXTERNAL_CONNECTOR_AUTH_STATUS_BADGES: Record<
  ExternalConnectorAuthStatus,
  { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }
> = {
  not_started: { label: "Not started", tone: "neutral" },
  pending: { label: "Pending", tone: "info" },
  verified: { label: "Verified", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  expired: { label: "Expired", tone: "warning" },
  revoked: { label: "Revoked", tone: "neutral" },
  insufficient_permissions: { label: "Insufficient permissions", tone: "warning" },
};

export function isExternalConnectorAuthMethod(value: string): value is ExternalConnectorAuthMethod {
  return (EXTERNAL_CONNECTOR_AUTH_METHODS as readonly string[]).includes(value);
}

export function isExternalConnectorAuthStatus(value: string): value is ExternalConnectorAuthStatus {
  return (EXTERNAL_CONNECTOR_AUTH_STATUSES as readonly string[]).includes(value);
}
