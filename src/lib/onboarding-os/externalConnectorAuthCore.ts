/**
 * OnboardingOS Phase F2 — External connector auth & verification engine (pure; no server-only).
 * Stub verification only — no live external API calls.
 */

import type {
  ExternalConnectorAuthHealthSummary,
  ExternalConnectorAuthInput,
  ExternalConnectorAuthInputValidationResult,
  ExternalConnectorAuthMethod,
  ExternalConnectorAuthSession,
  ExternalConnectorAuthStatus,
  ExternalConnectorPermissionScope,
  ExternalConnectorVerificationResult,
} from "./externalConnectorAuthTypes";
import {
  isExternalConnectorAuthMethod,
  isExternalConnectorAuthStatus,
} from "./externalConnectorAuthTypes";
import type { ExternalConnectorProvider } from "./externalConnectorTypes";
import { isExternalConnectorProvider } from "./externalConnectorTypes";

const PROVIDER_AUTH_METHODS: Record<ExternalConnectorProvider, readonly ExternalConnectorAuthMethod[]> = {
  pabau: ["api_key", "manual_placeholder"],
  cliniko: ["api_key", "manual_placeholder"],
  hubspot: ["oauth2", "api_key", "manual_placeholder"],
  google_calendar: ["oauth2", "manual_placeholder"],
  microsoft_outlook: ["oauth2", "manual_placeholder"],
  stripe: ["api_key", "webhook_secret", "manual_placeholder"],
  xero: ["oauth2", "api_key", "manual_placeholder"],
  meta_ads: ["oauth2", "api_key", "manual_placeholder"],
  google_ads: ["oauth2", "manual_placeholder"],
};

const PROVIDER_REQUIRED_SCOPES: Record<
  ExternalConnectorProvider,
  readonly { key: string; label: string }[]
> = {
  hubspot: [
    { key: "contacts.read", label: "Read contacts" },
    { key: "deals.read", label: "Read deals" },
    { key: "tickets.read", label: "Read tickets" },
  ],
  pabau: [
    { key: "patients.read", label: "Read patients" },
    { key: "appointments.read", label: "Read appointments" },
  ],
  cliniko: [
    { key: "patients.read", label: "Read patients" },
    { key: "appointments.read", label: "Read appointments" },
    { key: "invoices.read", label: "Read invoices" },
  ],
  google_calendar: [{ key: "calendar.readonly", label: "Read calendar events" }],
  microsoft_outlook: [{ key: "calendars.read", label: "Read calendars" }],
  stripe: [
    { key: "charges.read", label: "Read charges" },
    { key: "invoices.read", label: "Read invoices" },
    { key: "customers.read", label: "Read customers" },
  ],
  xero: [
    { key: "accounting.transactions.read", label: "Read transactions" },
    { key: "accounting.contacts.read", label: "Read contacts" },
  ],
  meta_ads: [{ key: "ads_read", label: "Read ad campaigns" }],
  google_ads: [{ key: "adwords.readonly", label: "Read Google Ads data" }],
};

const TOKEN_EXPIRY_WARNING_DAYS = 14;

/** Resolve supported auth methods for a connector provider. */
export function resolveSupportedAuthMethods(
  provider: ExternalConnectorProvider
): readonly ExternalConnectorAuthMethod[] {
  return PROVIDER_AUTH_METHODS[provider] ?? ["manual_placeholder"];
}

/** Build required permission scopes for a provider. */
export function buildRequiredPermissionScopes(
  provider: ExternalConnectorProvider
): readonly ExternalConnectorPermissionScope[] {
  const defs = PROVIDER_REQUIRED_SCOPES[provider] ?? [];
  return defs.map((d) => ({
    scopeKey: d.key,
    scopeLabel: d.label,
    required: true,
    granted: false,
  }));
}

/** Validate connector auth input before verification. */
export function validateConnectorAuthInput(
  provider: ExternalConnectorProvider | string,
  input: ExternalConnectorAuthInput
): ExternalConnectorAuthInputValidationResult {
  const errors: string[] = [];
  const providerRaw = String(provider ?? "").trim();

  if (!isExternalConnectorProvider(providerRaw)) {
    errors.push(`Unknown connector provider: ${providerRaw || "(empty)"}.`);
    return { ok: false, errors };
  }

  const method = String(input.authMethod ?? "").trim();
  if (!isExternalConnectorAuthMethod(method)) {
    errors.push(`Unsupported auth method: ${method || "(empty)"}.`);
    return { ok: false, errors };
  }

  const supported = resolveSupportedAuthMethods(providerRaw);
  if (!supported.includes(method)) {
    errors.push(`Auth method "${method}" is not supported for ${providerRaw}.`);
  }

  if (method === "api_key" && !input.testMode) {
    if (!input.apiKey?.trim() && !input.oauthAccessToken?.trim()) {
      errors.push("API key or access token is required for api_key auth.");
    }
  } else if (method === "oauth2" && !input.testMode) {
    if (!input.oauthAccessToken?.trim()) {
      errors.push("OAuth access token is required for oauth2 auth.");
    }
  } else if (method === "webhook_secret" && !input.testMode) {
    if (!input.webhookSecret?.trim()) {
      errors.push("Webhook secret is required for webhook_secret auth.");
    }
  }

  if (input.tokenExpiresAt) {
    const parsed = Date.parse(input.tokenExpiresAt);
    if (Number.isNaN(parsed)) {
      errors.push("Token expiry must be a valid ISO timestamp.");
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, authMethod: method };
}

function mergeGrantedScopes(
  required: readonly ExternalConnectorPermissionScope[],
  grantedKeys: readonly string[]
): ExternalConnectorPermissionScope[] {
  const grantedSet = new Set(grantedKeys.map((k) => k.trim()).filter(Boolean));
  return required.map((scope) => ({
    ...scope,
    granted: grantedSet.has(scope.scopeKey),
  }));
}

/** Calculate permission coverage as percentage of required scopes granted. */
export function calculatePermissionCoverage(
  requiredScopes: readonly ExternalConnectorPermissionScope[]
): number {
  const required = requiredScopes.filter((s) => s.required);
  if (required.length === 0) return 100;
  const granted = required.filter((s) => s.granted).length;
  return Math.round((granted / required.length) * 100);
}

/** Resolve auth status from session state and scope coverage. */
export function resolveConnectorAuthStatus(opts: {
  currentStatus: ExternalConnectorAuthStatus | string;
  permissionCoveragePercent: number;
  tokenExpiresAt: string | null;
  revoked: boolean;
  credentialPresent: boolean;
  verificationAttempted: boolean;
}): ExternalConnectorAuthStatus {
  if (opts.revoked) return "revoked";

  if (opts.tokenExpiresAt) {
    const expires = Date.parse(opts.tokenExpiresAt);
    if (!Number.isNaN(expires) && expires < Date.now()) {
      return "expired";
    }
  }

  if (!opts.credentialPresent && !opts.verificationAttempted) {
    return opts.currentStatus === "not_started" ? "not_started" : "pending";
  }

  if (opts.permissionCoveragePercent < 100 && opts.verificationAttempted) {
    return "insufficient_permissions";
  }

  if (opts.permissionCoveragePercent >= 100 && opts.verificationAttempted && opts.credentialPresent) {
    return "verified";
  }

  if (opts.verificationAttempted && !opts.credentialPresent) {
    return "failed";
  }

  const current = isExternalConnectorAuthStatus(opts.currentStatus) ? opts.currentStatus : "pending";
  return current;
}

/** Build stub verification result (test_mode only — no live API). */
export function buildConnectorVerificationResult(opts: {
  provider: ExternalConnectorProvider;
  authMethod: ExternalConnectorAuthMethod;
  input: ExternalConnectorAuthInput;
  credentialConfigured: boolean;
}): ExternalConnectorVerificationResult {
  const testMode = opts.input.testMode === true;
  const requiredScopes = buildRequiredPermissionScopes(opts.provider);
  const blockers: string[] = [];
  const warnings: string[] = [];

  const validation = validateConnectorAuthInput(opts.provider, opts.input);
  if (!validation.ok) {
    return {
      authStatus: "failed",
      outcome: "error",
      permissionCoveragePercent: 0,
      requiredScopes,
      grantedScopes: requiredScopes,
      summary: "Credential verification failed — invalid input.",
      blockers: validation.errors,
      warnings: [],
      providerPayload: { stub: true, test_mode: testMode },
      testMode,
    };
  }

  if (!testMode) {
    return {
      authStatus: "failed",
      outcome: "error",
      permissionCoveragePercent: 0,
      requiredScopes,
      grantedScopes: requiredScopes,
      summary: "Live verification is not enabled yet — use test_mode.",
      blockers: ["Enable test_mode for architecture verification only."],
      warnings: [],
      providerPayload: { stub: true, test_mode: false },
      testMode: false,
    };
  }

  const hasCredentialMaterial =
    opts.credentialConfigured ||
    Boolean(opts.input.apiKey?.trim()) ||
    Boolean(opts.input.oauthAccessToken?.trim()) ||
    Boolean(opts.input.webhookSecret?.trim()) ||
    opts.authMethod === "manual_placeholder";

  if (!hasCredentialMaterial) {
    return {
      authStatus: "failed",
      outcome: "error",
      permissionCoveragePercent: 0,
      requiredScopes,
      grantedScopes: requiredScopes,
      summary: "Credential verification failed — missing credential material.",
      blockers: ["Store connector credentials before verification."],
      warnings: [],
      providerPayload: { stub: true, test_mode: true, reason: "missing_credentials" },
      testMode,
    };
  }

  const grantedKeys =
    opts.input.grantedScopes?.length
      ? opts.input.grantedScopes
      : testMode
        ? requiredScopes.map((s) => s.scopeKey)
        : [];

  const grantedScopes = mergeGrantedScopes(requiredScopes, grantedKeys);
  const coverage = calculatePermissionCoverage(grantedScopes);

  if (coverage < 100) {
    const missing = grantedScopes.filter((s) => s.required && !s.granted).map((s) => s.scopeKey);
    return {
      authStatus: "insufficient_permissions",
      outcome: "warning",
      permissionCoveragePercent: coverage,
      requiredScopes,
      grantedScopes,
      summary: "Credentials accepted but required permission scopes are missing.",
      blockers: missing.map((k) => `Missing scope: ${k}`),
      warnings: ["Verification required before live sync."],
      providerPayload: {
        stub: true,
        test_mode: true,
        granted_scopes: grantedKeys,
        missing_scopes: missing,
      },
      testMode,
    };
  }

  return {
    authStatus: "verified",
    outcome: "success",
    permissionCoveragePercent: 100,
    requiredScopes,
    grantedScopes,
    summary: "Connector credentials verified (test mode — no live API call).",
    blockers: [],
    warnings: ["Live sync is not enabled yet — verification is architecture-only."],
    providerPayload: {
      stub: true,
      test_mode: true,
      granted_scopes: grantedKeys,
      auth_method: opts.authMethod,
    },
    testMode,
  };
}

/** Build token expiry warning when expiry is within threshold. */
export function buildTokenExpiryWarning(tokenExpiresAt: string | null | undefined): string | null {
  if (!tokenExpiresAt?.trim()) return null;
  const expires = Date.parse(tokenExpiresAt);
  if (Number.isNaN(expires)) return null;

  const now = Date.now();
  if (expires <= now) {
    return "Connector token has expired — re-authenticate before enabling sync.";
  }

  const daysRemaining = (expires - now) / (24 * 60 * 60 * 1000);
  if (daysRemaining <= TOKEN_EXPIRY_WARNING_DAYS) {
    const rounded = Math.max(1, Math.ceil(daysRemaining));
    return `Connector token expires in ${rounded} day(s) — plan refresh before go-live.`;
  }

  return null;
}

/** Build auth health summary for UI and deployment intelligence signals. */
export function buildConnectorAuthHealthSummary(opts: {
  authSession: ExternalConnectorAuthSession | null;
  requiredScopes: readonly ExternalConnectorPermissionScope[];
  grantedScopes: readonly ExternalConnectorPermissionScope[];
}): ExternalConnectorAuthHealthSummary {
  const coverage = calculatePermissionCoverage(
    opts.grantedScopes.length ? opts.grantedScopes : opts.requiredScopes
  );
  const authStatus = opts.authSession?.authStatus ?? "not_started";
  const tokenExpiryWarning = buildTokenExpiryWarning(opts.authSession?.tokenExpiresAt ?? null);
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (authStatus === "not_started") {
    blockers.push("Connector authentication not started.");
  } else if (authStatus === "pending") {
    warnings.push("Verification pending — confirm credentials before live sync.");
  } else if (authStatus === "failed") {
    blockers.push("Credential verification failed.");
  } else if (authStatus === "insufficient_permissions") {
    warnings.push("Granted scopes do not cover all required permissions.");
  } else if (authStatus === "expired") {
    warnings.push("Auth token expired — refresh credentials.");
  } else if (authStatus === "revoked") {
    blockers.push("Connector auth session revoked.");
  }

  if (tokenExpiryWarning) warnings.push(tokenExpiryWarning);
  if (authStatus !== "verified") {
    warnings.push("Verification required before live sync.");
  }

  const readyForLiveSync = authStatus === "verified" && coverage >= 100 && !tokenExpiryWarning?.includes("expired");

  const summary =
    authStatus === "verified"
      ? "Connector credentials verified — ready for future sync enablement."
      : authStatus === "insufficient_permissions"
        ? `Permission coverage ${coverage}% — additional scopes required.`
        : authStatus === "failed"
          ? "Credential verification failed — review connector setup."
          : authStatus === "revoked"
            ? "Auth session revoked."
            : "Complete credential verification before enabling live sync.";

  return {
    authStatus,
    permissionCoveragePercent: coverage,
    tokenExpiryWarning,
    summary,
    readyForLiveSync,
    blockers,
    warnings,
  };
}

/** Default auth method for a provider (first supported non-placeholder). */
export function defaultAuthMethodForProvider(provider: ExternalConnectorProvider): ExternalConnectorAuthMethod {
  const methods = resolveSupportedAuthMethods(provider);
  return methods.find((m) => m !== "manual_placeholder") ?? methods[0] ?? "manual_placeholder";
}
