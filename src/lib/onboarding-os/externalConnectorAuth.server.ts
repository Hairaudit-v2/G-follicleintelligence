import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsRoleAllowedForPlatformTenantProvisioning } from "@/src/lib/fiOs/platformTenantProvisionGate";
import { loadActiveTenantAdminProfileForSession } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";
import { logStructured } from "@/src/lib/server/structuredLog";

import {
  buildConnectorAuthHealthSummary,
  buildConnectorVerificationResult,
  buildRequiredPermissionScopes,
  buildTokenExpiryWarning,
  calculatePermissionCoverage,
  defaultAuthMethodForProvider,
} from "./externalConnectorAuthCore";
import type {
  ExternalConnectorAuthInput,
  ExternalConnectorAuthMethod,
  ExternalConnectorAuthSession,
  ExternalConnectorAuthStatus,
  ExternalConnectorAuthSummary,
  ExternalConnectorPermissionScope,
  ExternalConnectorVerificationEvent,
  ExternalConnectorVerificationResult,
  TenantConnectorAuthSnapshot,
} from "./externalConnectorAuthTypes";
import {
  isExternalConnectorAuthMethod,
  isExternalConnectorAuthStatus,
} from "./externalConnectorAuthTypes";
import type { ExternalConnectorProvider } from "./externalConnectorTypes";
import { isExternalConnectorProvider } from "./externalConnectorTypes";

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
  actorAuthUserId?: string | null;
  skipAuthCheck?: boolean;
  allowTenantMemberRead?: boolean;
};

type IntegrationRow = {
  id: string;
  tenant_id: string;
  provider: string;
};

type AuthSessionRow = {
  id: string;
  integration_id: string;
  tenant_id: string;
  provider: string;
  auth_method: string;
  auth_status: string;
  credential_id: string | null;
  scopes_granted: string[] | unknown;
  provider_payload: Record<string, unknown>;
  token_expires_at: string | null;
  verified_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

type ScopeRow = {
  scope_key: string;
  scope_label: string | null;
  required: boolean;
  granted: boolean;
};

type VerificationEventRow = {
  id: string;
  auth_session_id: string;
  integration_id: string;
  tenant_id: string;
  provider: string;
  auth_status: string;
  outcome: string;
  actor_label: string | null;
  detail: Record<string, unknown>;
  provider_payload: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
};

export type ConnectorAuthActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export type VerifyConnectorCredentialsResult =
  | {
      ok: true;
      verification: ExternalConnectorVerificationResult;
      authSession: ExternalConnectorAuthSession;
    }
  | { ok: false; error: string };

async function resolvePlatformAdminAuth(
  opts: ServerOpts
): Promise<{ ok: true; actorAuthUserId: string } | { ok: false; error: string }> {
  const authId = opts.actorAuthUserId ?? (await resolveAuthUserId(null));
  if (!authId) return { ok: false, error: "Authentication required." };
  if (opts.skipAuthCheck && opts.actorAuthUserId) {
    return { ok: true, actorAuthUserId: authId };
  }
  const os = await loadFiOsIdentity(authId);
  if (!isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole)) {
    return { ok: false, error: "Platform administrator access is required." };
  }
  return { ok: true, actorAuthUserId: authId };
}

async function resolveTenantAdminAuth(
  tenantId: string,
  opts: ServerOpts
): Promise<
  | { ok: true; actorAuthUserId: string; fiUserId: string; actorLabel: string }
  | { ok: false; error: string }
> {
  const authId = opts.actorAuthUserId ?? (await resolveAuthUserId(null));
  if (!authId) return { ok: false, error: "Authentication required." };

  const os = await loadFiOsIdentity(authId);
  if (isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole)) {
    if (opts.skipAuthCheck) {
      return { ok: true, actorAuthUserId: authId, fiUserId: "", actorLabel: "Platform admin" };
    }
  }

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_users")
    .select("id, email")
    .eq("tenant_id", tenantId.trim())
    .eq("auth_user_id", authId)
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Tenant membership required." };

  const adminProf = await loadActiveTenantAdminProfileForSession(tenantId, authId);
  if (adminProf?.adminRole !== "clinic_admin" && adminProf?.adminRole !== "operations_admin") {
    if (!opts.skipAuthCheck) {
      const platform = await resolvePlatformAdminAuth(opts);
      if (!platform.ok) return { ok: false, error: "Tenant admin access is required." };
      return { ok: true, actorAuthUserId: authId, fiUserId: "", actorLabel: "Platform admin" };
    }
    return { ok: false, error: "Tenant admin access is required." };
  }

  const row = data as { id: string; email: string | null };
  return {
    ok: true,
    actorAuthUserId: authId,
    fiUserId: String(row.id),
    actorLabel: row.email ?? "Tenant admin",
  };
}

async function resolveWriteAuth(
  tenantId: string,
  opts: ServerOpts
): Promise<
  | { ok: true; actorAuthUserId: string; fiUserId: string | null; actorLabel: string }
  | { ok: false; error: string }
> {
  const platform = await resolvePlatformAdminAuth({ ...opts, skipAuthCheck: false });
  if (platform.ok) {
    return {
      ok: true,
      actorAuthUserId: platform.actorAuthUserId,
      fiUserId: null,
      actorLabel: "Platform admin",
    };
  }
  const tenant = await resolveTenantAdminAuth(tenantId, opts);
  if (!tenant.ok) return tenant;
  return {
    ok: true,
    actorAuthUserId: tenant.actorAuthUserId,
    fiUserId: tenant.fiUserId || null,
    actorLabel: tenant.actorLabel,
  };
}

async function resolveReadAuth(
  tenantId: string,
  opts: ServerOpts
): Promise<{ ok: true } | { ok: false; error: string }> {
  const platform = await resolvePlatformAdminAuth({ ...opts, skipAuthCheck: false });
  if (platform.ok) return { ok: true };

  if (opts.allowTenantMemberRead) {
    const authId = opts.actorAuthUserId ?? (await resolveAuthUserId(null));
    if (!authId) return { ok: false, error: "Authentication required." };
    const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
    const { data: member } = await supabase
      .from("fi_users")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("auth_user_id", authId)
      .maybeSingle();
    if (member) return { ok: true };
  }

  const tenant = await resolveTenantAdminAuth(tenantId, { ...opts, skipAuthCheck: true });
  if (tenant.ok) return { ok: true };
  return { ok: false, error: "Access denied." };
}

function mapAuthSessionRow(row: AuthSessionRow): ExternalConnectorAuthSession {
  const provider = isExternalConnectorProvider(row.provider) ? row.provider : "pabau";
  const authMethod = isExternalConnectorAuthMethod(row.auth_method)
    ? row.auth_method
    : "manual_placeholder";
  const authStatus = isExternalConnectorAuthStatus(row.auth_status)
    ? row.auth_status
    : "not_started";
  const scopesRaw = row.scopes_granted;
  const scopesGranted = Array.isArray(scopesRaw) ? scopesRaw.map(String) : [];

  return {
    id: row.id,
    integrationId: row.integration_id,
    tenantId: row.tenant_id,
    provider,
    authMethod,
    authStatus,
    credentialId: row.credential_id,
    scopesGranted,
    providerPayload: row.provider_payload ?? {},
    tokenExpiresAt: row.token_expires_at,
    verifiedAt: row.verified_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapScopeRows(rows: ScopeRow[]): ExternalConnectorPermissionScope[] {
  return rows.map((r) => ({
    scopeKey: r.scope_key,
    scopeLabel: r.scope_label ?? r.scope_key,
    required: r.required,
    granted: r.granted,
  }));
}

function mapVerificationEventRow(row: VerificationEventRow): ExternalConnectorVerificationEvent {
  const provider = isExternalConnectorProvider(row.provider) ? row.provider : "pabau";
  const authStatus = isExternalConnectorAuthStatus(row.auth_status) ? row.auth_status : "pending";

  return {
    id: row.id,
    authSessionId: row.auth_session_id,
    integrationId: row.integration_id,
    tenantId: row.tenant_id,
    provider,
    authStatus,
    outcome: row.outcome as ExternalConnectorVerificationEvent["outcome"],
    actorLabel: row.actor_label,
    detail: row.detail ?? {},
    providerPayload: row.provider_payload ?? {},
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  };
}

async function loadIntegration(
  supabase: SupabaseClient,
  integrationId: string,
  tenantId: string
): Promise<IntegrationRow | null> {
  const { data, error } = await supabase
    .from("fi_tenant_external_integrations")
    .select("id, tenant_id, provider")
    .eq("id", integrationId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as IntegrationRow | null) ?? null;
}

async function credentialConfiguredForIntegration(
  supabase: SupabaseClient,
  integrationId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("fi_external_connector_credentials")
    .select("id")
    .eq("integration_id", integrationId)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

async function loadAuthSessionRow(
  supabase: SupabaseClient,
  integrationId: string
): Promise<AuthSessionRow | null> {
  const { data } = await supabase
    .from("fi_external_connector_auth_sessions")
    .select("*")
    .eq("integration_id", integrationId)
    .maybeSingle();
  return (data as AuthSessionRow | null) ?? null;
}

/** Create or return existing auth session for an integration. */
export async function createConnectorAuthSession(
  integrationId: string,
  tenantId: string,
  authMethod?: ExternalConnectorAuthMethod | null,
  opts: ServerOpts = {}
): Promise<{ ok: true; authSession: ExternalConnectorAuthSession } | { ok: false; error: string }> {
  const auth = await resolveWriteAuth(tenantId, opts);
  if (!auth.ok) return auth;

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const integration = await loadIntegration(supabase, integrationId, tenantId);
  if (!integration) return { ok: false, error: "Connector not found." };

  const provider = isExternalConnectorProvider(integration.provider) ? integration.provider : null;
  if (!provider) return { ok: false, error: "Invalid connector provider." };

  const existing = await loadAuthSessionRow(supabase, integrationId);
  if (existing) {
    return { ok: true, authSession: mapAuthSessionRow(existing) };
  }

  const method =
    authMethod && isExternalConnectorAuthMethod(authMethod)
      ? authMethod
      : defaultAuthMethodForProvider(provider);

  const { data, error } = await supabase
    .from("fi_external_connector_auth_sessions")
    .insert({
      integration_id: integrationId,
      tenant_id: tenantId,
      provider,
      auth_method: method,
      auth_status: "not_started",
      scopes_granted: [],
      provider_payload: { stub: true },
    })
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create auth session." };
  }

  const session = mapAuthSessionRow(data as AuthSessionRow);
  await recordConnectorPermissionScopes(session.id, integrationId, tenantId, provider, opts);

  logStructured("info", "connector_auth_session_created", {
    tenant_id: tenantId,
    integration_id: integrationId,
    provider,
    auth_method: method,
  });

  return { ok: true, authSession: session };
}

/** Record required and granted permission scopes for an auth session. */
export async function recordConnectorPermissionScopes(
  authSessionId: string,
  integrationId: string,
  tenantId: string,
  provider: ExternalConnectorProvider,
  opts: ServerOpts = {},
  grantedScopeKeys?: readonly string[]
): Promise<ConnectorAuthActionResult> {
  if (!opts.skipAuthCheck) {
    const auth = await resolveWriteAuth(tenantId, opts);
    if (!auth.ok) return auth;
  }

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const required = buildRequiredPermissionScopes(provider);
  const grantedSet = new Set((grantedScopeKeys ?? []).map((k) => k.trim()).filter(Boolean));

  for (const scope of required) {
    const { error } = await supabase.from("fi_external_connector_permission_scopes").upsert(
      {
        auth_session_id: authSessionId,
        integration_id: integrationId,
        tenant_id: tenantId,
        provider,
        scope_key: scope.scopeKey,
        scope_label: scope.scopeLabel,
        required: scope.required,
        granted: grantedSet.has(scope.scopeKey),
        recorded_at: new Date().toISOString(),
      },
      { onConflict: "auth_session_id,scope_key" }
    );
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true };
}

/** Append verification event (insert-only). */
export async function recordConnectorVerificationEvent(
  authSessionId: string,
  integrationId: string,
  tenantId: string,
  event: {
    provider: ExternalConnectorProvider;
    authStatus: ExternalConnectorAuthStatus;
    outcome: ExternalConnectorVerificationEvent["outcome"];
    detail?: Record<string, unknown>;
    providerPayload?: Record<string, unknown>;
    actorAuthUserId?: string | null;
    actorFiUserId?: string | null;
    actorLabel?: string | null;
  },
  opts: ServerOpts = {}
): Promise<ConnectorAuthActionResult<{ eventId: string }>> {
  if (!opts.skipAuthCheck) {
    const auth = await resolveWriteAuth(tenantId, opts);
    if (!auth.ok) return auth;
  }

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_external_connector_verification_events")
    .insert({
      auth_session_id: authSessionId,
      integration_id: integrationId,
      tenant_id: tenantId,
      provider: event.provider,
      auth_status: event.authStatus,
      outcome: event.outcome,
      actor_auth_user_id: event.actorAuthUserId ?? null,
      actor_fi_user_id: event.actorFiUserId ?? null,
      actor_label: event.actorLabel ?? null,
      detail: event.detail ?? {},
      provider_payload: event.providerPayload ?? {},
    })
    .select("id")
    .single();

  if (error || !data)
    return { ok: false, error: error?.message ?? "Failed to record verification event." };
  return { ok: true, data: { eventId: String((data as { id: string }).id) } };
}

/** Stub-verify connector credentials (test_mode only — no live API). */
export async function verifyConnectorCredentials(
  integrationId: string,
  tenantId: string,
  input: ExternalConnectorAuthInput,
  opts: ServerOpts = {}
): Promise<VerifyConnectorCredentialsResult> {
  const auth = await resolveWriteAuth(tenantId, opts);
  if (!auth.ok) return auth;

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const integration = await loadIntegration(supabase, integrationId, tenantId);
  if (!integration) return { ok: false, error: "Connector not found." };

  const provider = isExternalConnectorProvider(integration.provider) ? integration.provider : null;
  if (!provider) return { ok: false, error: "Invalid connector provider." };

  let sessionRow = await loadAuthSessionRow(supabase, integrationId);
  if (!sessionRow) {
    const created = await createConnectorAuthSession(integrationId, tenantId, input.authMethod, {
      ...opts,
      skipAuthCheck: true,
    });
    if (!created.ok) return created;
    sessionRow = await loadAuthSessionRow(supabase, integrationId);
    if (!sessionRow) return { ok: false, error: "Auth session unavailable." };
  }

  const credentialConfigured = await credentialConfiguredForIntegration(supabase, integrationId);
  const verification = buildConnectorVerificationResult({
    provider,
    authMethod: input.authMethod,
    input,
    credentialConfigured,
  });

  const grantedKeys = verification.grantedScopes.filter((s) => s.granted).map((s) => s.scopeKey);
  const now = new Date().toISOString();

  const patch: Record<string, unknown> = {
    auth_method: input.authMethod,
    auth_status: verification.authStatus,
    scopes_granted: grantedKeys,
    provider_payload: verification.providerPayload,
    updated_at: now,
  };

  if (input.tokenExpiresAt) patch.token_expires_at = input.tokenExpiresAt;
  if (verification.authStatus === "verified") patch.verified_at = now;
  if (verification.authStatus === "pending") patch.verified_at = null;

  const { data: updated, error: updateErr } = await supabase
    .from("fi_external_connector_auth_sessions")
    .update(patch)
    .eq("id", sessionRow.id)
    .select("*")
    .single();

  if (updateErr || !updated) {
    return { ok: false, error: updateErr?.message ?? "Failed to update auth session." };
  }

  await recordConnectorPermissionScopes(
    sessionRow.id,
    integrationId,
    tenantId,
    provider,
    { ...opts, skipAuthCheck: true },
    grantedKeys
  );

  await recordConnectorVerificationEvent(
    sessionRow.id,
    integrationId,
    tenantId,
    {
      provider,
      authStatus: verification.authStatus,
      outcome: verification.outcome,
      detail: {
        summary: verification.summary,
        permission_coverage_percent: verification.permissionCoveragePercent,
        test_mode: verification.testMode,
        blockers: verification.blockers,
      },
      providerPayload: verification.providerPayload,
      actorAuthUserId: auth.actorAuthUserId,
      actorFiUserId: auth.fiUserId,
      actorLabel: auth.actorLabel,
    },
    { ...opts, skipAuthCheck: true }
  );

  logStructured("info", "connector_credentials_verified", {
    tenant_id: tenantId,
    integration_id: integrationId,
    provider,
    auth_status: verification.authStatus,
    test_mode: verification.testMode,
  });

  return {
    ok: true,
    verification,
    authSession: mapAuthSessionRow(updated as AuthSessionRow),
  };
}

/** Revoke connector auth session. */
export async function revokeConnectorAuthSession(
  integrationId: string,
  tenantId: string,
  opts: ServerOpts = {}
): Promise<{ ok: true; authSession: ExternalConnectorAuthSession } | { ok: false; error: string }> {
  const auth = await resolveWriteAuth(tenantId, opts);
  if (!auth.ok) return auth;

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const sessionRow = await loadAuthSessionRow(supabase, integrationId);
  if (!sessionRow) return { ok: false, error: "Auth session not found." };

  const provider = isExternalConnectorProvider(sessionRow.provider) ? sessionRow.provider : "pabau";
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("fi_external_connector_auth_sessions")
    .update({
      auth_status: "revoked",
      revoked_at: now,
      verified_at: null,
      updated_at: now,
    })
    .eq("id", sessionRow.id)
    .select("*")
    .single();

  if (error || !data)
    return { ok: false, error: error?.message ?? "Failed to revoke auth session." };

  await recordConnectorVerificationEvent(
    sessionRow.id,
    integrationId,
    tenantId,
    {
      provider,
      authStatus: "revoked",
      outcome: "warning",
      detail: { summary: "Connector auth session revoked." },
      providerPayload: { revoked: true },
      actorAuthUserId: auth.actorAuthUserId,
      actorFiUserId: auth.fiUserId,
      actorLabel: auth.actorLabel,
    },
    { ...opts, skipAuthCheck: true }
  );

  return { ok: true, authSession: mapAuthSessionRow(data as AuthSessionRow) };
}

async function buildAuthSummaryForIntegration(
  supabase: SupabaseClient,
  integration: IntegrationRow
): Promise<ExternalConnectorAuthSummary | null> {
  const provider = isExternalConnectorProvider(integration.provider) ? integration.provider : null;
  if (!provider) return null;

  const sessionRow = await loadAuthSessionRow(supabase, integration.id);
  const authSession = sessionRow ? mapAuthSessionRow(sessionRow) : null;
  const requiredScopes = buildRequiredPermissionScopes(provider);

  let scopeRows: ScopeRow[] = [];
  if (sessionRow) {
    const { data } = await supabase
      .from("fi_external_connector_permission_scopes")
      .select("scope_key, scope_label, required, granted")
      .eq("auth_session_id", sessionRow.id);
    scopeRows = (data ?? []) as ScopeRow[];
  }

  const grantedScopes =
    scopeRows.length > 0
      ? mapScopeRows(scopeRows)
      : requiredScopes.map((s) => ({ ...s, granted: false }));

  let latestVerificationEvent: ExternalConnectorVerificationEvent | null = null;
  if (sessionRow) {
    const { data: eventRow } = await supabase
      .from("fi_external_connector_verification_events")
      .select("*")
      .eq("auth_session_id", sessionRow.id)
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (eventRow)
      latestVerificationEvent = mapVerificationEventRow(eventRow as VerificationEventRow);
  }

  const permissionCoveragePercent = calculatePermissionCoverage(
    grantedScopes.some((s) => s.granted) ? grantedScopes : requiredScopes
  );
  const tokenExpiryWarning = buildTokenExpiryWarning(authSession?.tokenExpiresAt ?? null);
  const healthSummary = buildConnectorAuthHealthSummary({
    authSession,
    requiredScopes,
    grantedScopes,
  });

  return {
    integrationId: integration.id,
    provider,
    authSession,
    requiredScopes,
    grantedScopes,
    permissionCoveragePercent,
    tokenExpiryWarning,
    latestVerificationEvent,
    healthSummary,
  };
}

/** Load connector auth summaries for all tenant integrations. */
export async function loadConnectorAuthSummary(
  tenantId: string,
  opts: ServerOpts = {}
): Promise<{ ok: true; snapshot: TenantConnectorAuthSnapshot } | { ok: false; error: string }> {
  const read = await resolveReadAuth(tenantId, opts);
  if (!read.ok) return read;

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data: integrations, error } = await supabase
    .from("fi_tenant_external_integrations")
    .select("id, tenant_id, provider")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) return { ok: false, error: error.message };

  const summaries: ExternalConnectorAuthSummary[] = [];
  for (const row of (integrations ?? []) as IntegrationRow[]) {
    const summary = await buildAuthSummaryForIntegration(supabase, row);
    if (summary) summaries.push(summary);
  }

  return {
    ok: true,
    snapshot: {
      tenantId,
      summaries,
      calculatedAt: new Date().toISOString(),
    },
  };
}

/** Refresh auth status from token expiry and scope coverage (no external API). */
export async function refreshConnectorAuthStatus(
  integrationId: string,
  tenantId: string,
  opts: ServerOpts = {}
): Promise<{ ok: true; authSession: ExternalConnectorAuthSession } | { ok: false; error: string }> {
  const auth = await resolveWriteAuth(tenantId, opts);
  if (!auth.ok) return auth;

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const sessionRow = await loadAuthSessionRow(supabase, integrationId);
  if (!sessionRow) return { ok: false, error: "Auth session not found." };

  const provider = isExternalConnectorProvider(sessionRow.provider) ? sessionRow.provider : "pabau";
  const { data: scopeRows } = await supabase
    .from("fi_external_connector_permission_scopes")
    .select("scope_key, scope_label, required, granted")
    .eq("auth_session_id", sessionRow.id);

  const grantedScopes = mapScopeRows((scopeRows ?? []) as ScopeRow[]);
  const coverage = calculatePermissionCoverage(grantedScopes);
  const credentialConfigured = await credentialConfiguredForIntegration(supabase, integrationId);

  const nextStatus =
    sessionRow.auth_status === "revoked"
      ? "revoked"
      : buildConnectorAuthHealthSummary({
          authSession: mapAuthSessionRow(sessionRow),
          requiredScopes: buildRequiredPermissionScopes(provider),
          grantedScopes,
        }).authStatus;

  let resolvedStatus = nextStatus;
  if (sessionRow.token_expires_at) {
    const expires = Date.parse(sessionRow.token_expires_at);
    if (!Number.isNaN(expires) && expires < Date.now() && resolvedStatus !== "revoked") {
      resolvedStatus = "expired";
    }
  } else if (coverage < 100 && sessionRow.verified_at && resolvedStatus === "verified") {
    resolvedStatus = "insufficient_permissions";
  } else if (!credentialConfigured && resolvedStatus === "verified") {
    resolvedStatus = "failed";
  }

  const { data, error } = await supabase
    .from("fi_external_connector_auth_sessions")
    .update({
      auth_status: resolvedStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionRow.id)
    .select("*")
    .single();

  if (error || !data)
    return { ok: false, error: error?.message ?? "Failed to refresh auth status." };
  return { ok: true, authSession: mapAuthSessionRow(data as AuthSessionRow) };
}

/** Aggregate connector auth readiness for deployment intelligence. */
export async function loadConnectorAuthReadinessInput(
  supabase: SupabaseClient,
  tenantId: string | null
): Promise<{
  registeredCount: number;
  verifiedCount: number;
  unverifiedCount: number;
  failedCount: number;
  avgPermissionCoverage: number;
}> {
  const empty = {
    registeredCount: 0,
    verifiedCount: 0,
    unverifiedCount: 0,
    failedCount: 0,
    avgPermissionCoverage: 0,
  };
  if (!tenantId) return empty;

  const loaded = await loadConnectorAuthSummary(tenantId, {
    supabaseClientForTests: supabase,
    skipAuthCheck: true,
    allowTenantMemberRead: true,
  });
  if (!loaded.ok || loaded.snapshot.summaries.length === 0) return empty;

  const summaries = loaded.snapshot.summaries;
  let verifiedCount = 0;
  let unverifiedCount = 0;
  let failedCount = 0;
  let coverageSum = 0;

  for (const s of summaries) {
    coverageSum += s.permissionCoveragePercent;
    const status = s.authSession?.authStatus ?? "not_started";
    if (status === "verified") verifiedCount += 1;
    else if (status === "failed" || status === "expired" || status === "revoked") failedCount += 1;
    else unverifiedCount += 1;
  }

  return {
    registeredCount: summaries.length,
    verifiedCount,
    unverifiedCount,
    failedCount,
    avgPermissionCoverage: Math.round(coverageSum / summaries.length),
  };
}
