import "server-only";

import { randomBytes } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  decryptExternalConnectorSecret,
  deriveExternalConnectorMasterKey,
  encryptExternalConnectorSecret,
} from "@/src/lib/onboarding-os/externalConnectorSecretCrypto.server";

import {
  buildGoogleOAuthAuthorizeUrl,
  computeTokenExpiresAt,
  isAccessTokenExpired,
} from "./googleCalendarCore";
import type {
  FiCalendarIntegration,
  FiCalendarIntegrationStatus,
  GoogleCalendarOAuthTokenResponse,
} from "./googleCalendarTypes";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
  fetchOverride?: typeof fetch;
};

type IntegrationRow = {
  id: string;
  tenant_id: string;
  provider: string;
  google_account_email: string | null;
  calendar_id: string;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type GoogleCalendarAuthResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export type ConnectGoogleCalendarResult =
  | { ok: true; authUrl: string; state: string }
  | { ok: false; error: string };

export type StoreGoogleCalendarCredentialsInput = {
  tenantId: string;
  calendarId: string;
  googleAccountEmail?: string | null;
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiresAt?: string | null;
  expiresInSeconds?: number | null;
};

function resolveMasterKey(): Buffer | null {
  return deriveExternalConnectorMasterKey(process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY);
}

function resolveGoogleOAuthConfig(): { clientId: string; clientSecret: string; redirectUri: string } | null {
  const clientId = (
    process.env.GOOGLE_CALENDAR_CLIENT_ID ??
    process.env.GOOGLE_CLIENT_ID ??
    ""
  ).trim();
  const clientSecret = (
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET ??
    process.env.GOOGLE_CLIENT_SECRET ??
    ""
  ).trim();
  const redirectUri = (
    process.env.GOOGLE_CALENDAR_REDIRECT_URI ??
    process.env.GOOGLE_OAUTH_REDIRECT_URI ??
    ""
  ).trim();
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

function encryptToken(plaintext: string): string | null {
  const masterKey = resolveMasterKey();
  if (!masterKey) return null;
  return encryptExternalConnectorSecret(plaintext, masterKey);
}

function decryptToken(ciphertext: string | null | undefined): string | null {
  if (!ciphertext?.trim()) return null;
  const masterKey = resolveMasterKey();
  if (!masterKey) return null;
  try {
    return decryptExternalConnectorSecret(ciphertext, masterKey);
  } catch {
    return null;
  }
}

function mapIntegrationRow(row: IntegrationRow): FiCalendarIntegration {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    provider: "google",
    googleAccountEmail: row.google_account_email,
    calendarId: row.calendar_id,
    tokenExpiresAt: row.token_expires_at,
    status: row.status as FiCalendarIntegrationStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadIntegrationRow(
  supabase: SupabaseClient,
  tenantId: string,
  integrationId?: string
): Promise<IntegrationRow | null> {
  let query = supabase
    .from("fi_calendar_integrations")
    .select("*")
    .eq("tenant_id", tenantId.trim());

  if (integrationId) {
    query = query.eq("id", integrationId.trim());
  } else {
    query = query.eq("status", "active").order("updated_at", { ascending: false }).limit(1);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return (data as IntegrationRow | null) ?? null;
}

async function exchangeOAuthCode(
  code: string,
  fetchFn: typeof fetch
): Promise<GoogleCalendarOAuthTokenResponse | null> {
  const config = resolveGoogleOAuthConfig();
  if (!config) return null;

  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetchFn(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!res.ok) return null;
  return (await res.json()) as GoogleCalendarOAuthTokenResponse;
}

async function refreshOAuthToken(
  refreshToken: string,
  fetchFn: typeof fetch
): Promise<GoogleCalendarOAuthTokenResponse | null> {
  const config = resolveGoogleOAuthConfig();
  if (!config) return null;

  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
  });

  const res = await fetchFn(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!res.ok) return null;
  return (await res.json()) as GoogleCalendarOAuthTokenResponse;
}

/** Begin Google Calendar OAuth2 connection — returns authorize URL (no secrets client-side). */
export async function connectGoogleCalendar(
  tenantId: string,
  opts: ServerOpts & { statePayload?: Record<string, unknown> } = {}
): Promise<ConnectGoogleCalendarResult> {
  const config = resolveGoogleOAuthConfig();
  if (!config) {
    return { ok: false, error: "Google Calendar OAuth is not configured (client id/secret/redirect)." };
  }

  const tenant = tenantId.trim();
  if (!tenant) return { ok: false, error: "Tenant id is required." };

  const state = Buffer.from(
    JSON.stringify({
      tenantId: tenant,
      nonce: randomBytes(16).toString("hex"),
      ...(opts.statePayload ?? {}),
    }),
    "utf8"
  ).toString("base64url");

  const authUrl = buildGoogleOAuthAuthorizeUrl({
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    state,
  });

  return { ok: true, authUrl, state };
}

/** Store encrypted Google Calendar OAuth credentials for a tenant integration. */
export async function storeGoogleCalendarCredentials(
  input: StoreGoogleCalendarCredentialsInput,
  opts: ServerOpts = {}
): Promise<GoogleCalendarAuthResult<{ integration: FiCalendarIntegration }>> {
  const tenantId = input.tenantId.trim();
  const calendarId = input.calendarId.trim();
  const accessToken = input.accessToken.trim();

  if (!tenantId || !calendarId || !accessToken) {
    return { ok: false, error: "Tenant id, calendar id, and access token are required." };
  }

  const accessEncrypted = encryptToken(accessToken);
  if (!accessEncrypted) {
    return { ok: false, error: "Credential encryption unavailable — set FI_EXTERNAL_CONNECTOR_MASTER_KEY." };
  }

  let refreshEncrypted: string | null = null;
  const refreshToken = input.refreshToken?.trim();
  if (refreshToken) {
    refreshEncrypted = encryptToken(refreshToken);
    if (!refreshEncrypted) {
      return { ok: false, error: "Failed to encrypt refresh token." };
    }
  }

  let tokenExpiresAt = input.tokenExpiresAt?.trim() ?? null;
  if (!tokenExpiresAt && input.expiresInSeconds && input.expiresInSeconds > 0) {
    tokenExpiresAt = computeTokenExpiresAt(input.expiresInSeconds);
  }

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("fi_calendar_integrations")
    .upsert(
      {
        tenant_id: tenantId,
        provider: "google",
        google_account_email: input.googleAccountEmail?.trim() ?? null,
        calendar_id: calendarId,
        access_token_encrypted: accessEncrypted,
        refresh_token_encrypted: refreshEncrypted,
        token_expires_at: tokenExpiresAt,
        status: "active",
        updated_at: now,
      },
      { onConflict: "tenant_id,calendar_id" }
    )
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to store calendar credentials." };
  }

  return { ok: true, data: { integration: mapIntegrationRow(data as IntegrationRow) } };
}

/** Exchange OAuth code and store credentials (backend callback helper — no UI in GC-1). */
export async function completeGoogleCalendarOAuth(
  tenantId: string,
  calendarId: string,
  code: string,
  opts: ServerOpts & { googleAccountEmail?: string | null } = {}
): Promise<GoogleCalendarAuthResult<{ integration: FiCalendarIntegration }>> {
  const fetchFn = opts.fetchOverride ?? fetch;
  const tokenResponse = await exchangeOAuthCode(code.trim(), fetchFn);
  if (!tokenResponse?.access_token) {
    return { ok: false, error: "Failed to exchange Google OAuth code." };
  }

  return storeGoogleCalendarCredentials(
    {
      tenantId,
      calendarId,
      googleAccountEmail: opts.googleAccountEmail,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresInSeconds: tokenResponse.expires_in,
    },
    opts
  );
}

/** Refresh Google Calendar access token using stored refresh token. */
export async function refreshGoogleCalendarAccessToken(
  tenantId: string,
  opts: ServerOpts & { integrationId?: string } = {}
): Promise<GoogleCalendarAuthResult<{ integration: FiCalendarIntegration; accessToken: string }>> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const row = await loadIntegrationRow(supabase, tenantId, opts.integrationId);
  if (!row) return { ok: false, error: "Calendar integration not found." };

  const refreshToken = decryptToken(row.refresh_token_encrypted);
  if (!refreshToken) {
    return { ok: false, error: "Refresh token not available — reconnect Google Calendar." };
  }

  const fetchFn = opts.fetchOverride ?? fetch;
  const tokenResponse = await refreshOAuthToken(refreshToken, fetchFn);
  if (!tokenResponse?.access_token) {
    await supabase
      .from("fi_calendar_integrations")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", row.id);
    return { ok: false, error: "Failed to refresh Google Calendar access token." };
  }

  const accessEncrypted = encryptToken(tokenResponse.access_token);
  if (!accessEncrypted) {
    return { ok: false, error: "Credential encryption unavailable." };
  }

  const tokenExpiresAt =
    tokenResponse.expires_in && tokenResponse.expires_in > 0
      ? computeTokenExpiresAt(tokenResponse.expires_in)
      : row.token_expires_at;

  let refreshEncrypted = row.refresh_token_encrypted;
  if (tokenResponse.refresh_token?.trim()) {
    refreshEncrypted = encryptToken(tokenResponse.refresh_token.trim()) ?? refreshEncrypted;
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("fi_calendar_integrations")
    .update({
      access_token_encrypted: accessEncrypted,
      refresh_token_encrypted: refreshEncrypted,
      token_expires_at: tokenExpiresAt,
      status: "active",
      updated_at: now,
    })
    .eq("id", row.id)
    .eq("tenant_id", tenantId.trim())
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to persist refreshed token." };
  }

  return {
    ok: true,
    data: {
      integration: mapIntegrationRow(data as IntegrationRow),
      accessToken: tokenResponse.access_token,
    },
  };
}

/** Resolve a valid access token, refreshing automatically when expired. */
export async function resolveGoogleCalendarAccessToken(
  tenantId: string,
  opts: ServerOpts & { integrationId?: string } = {}
): Promise<GoogleCalendarAuthResult<{ accessToken: string; integration: FiCalendarIntegration }>> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const row = await loadIntegrationRow(supabase, tenantId, opts.integrationId);
  if (!row) return { ok: false, error: "Calendar integration not found." };
  if (row.status === "disconnected") {
    return { ok: false, error: "Google Calendar integration is disconnected." };
  }

  const accessToken = decryptToken(row.access_token_encrypted);
  if (accessToken && !isAccessTokenExpired(row.token_expires_at)) {
    return {
      ok: true,
      data: { accessToken, integration: mapIntegrationRow(row) },
    };
  }

  const refreshed = await refreshGoogleCalendarAccessToken(tenantId, opts);
  if (!refreshed.ok) return refreshed;
  return {
    ok: true,
    data: {
      accessToken: refreshed.data!.accessToken,
      integration: refreshed.data!.integration,
    },
  };
}

/** Validate Google Calendar connection by probing the Calendar API. */
export async function validateGoogleCalendarConnection(
  tenantId: string,
  opts: ServerOpts & { integrationId?: string } = {}
): Promise<
  GoogleCalendarAuthResult<{
    integration: FiCalendarIntegration;
    calendarTitle?: string;
  }>
> {
  const tokenResult = await resolveGoogleCalendarAccessToken(tenantId, opts);
  if (!tokenResult.ok) return tokenResult;

  const { accessToken, integration } = tokenResult.data!;
  const fetchFn = opts.fetchOverride ?? fetch;
  const encodedId = encodeURIComponent(integration.calendarId);
  const url = `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodedId}`;

  const res = await fetchFn(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const now = new Date().toISOString();

  if (!res.ok) {
    await supabase
      .from("fi_calendar_integrations")
      .update({ status: "error", updated_at: now })
      .eq("id", integration.id)
      .eq("tenant_id", tenantId.trim());
    return { ok: false, error: `Google Calendar validation failed (${res.status}).` };
  }

  const json = (await res.json()) as { summary?: string };
  await supabase
    .from("fi_calendar_integrations")
    .update({ status: "active", updated_at: now })
    .eq("id", integration.id)
    .eq("tenant_id", tenantId.trim());

  return {
    ok: true,
    data: {
      integration: { ...integration, status: "active" },
      calendarTitle: json.summary?.trim() || undefined,
    },
  };
}

/** Load active calendar integration metadata (no token exposure). */
export async function loadGoogleCalendarIntegration(
  tenantId: string,
  opts: ServerOpts & { integrationId?: string } = {}
): Promise<GoogleCalendarAuthResult<{ integration: FiCalendarIntegration | null }>> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const row = await loadIntegrationRow(supabase, tenantId, opts.integrationId);
  return { ok: true, data: { integration: row ? mapIntegrationRow(row) : null } };
}
