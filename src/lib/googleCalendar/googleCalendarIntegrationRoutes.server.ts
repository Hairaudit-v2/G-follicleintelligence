import "server-only";

import { NextResponse } from "next/server";

import {
  completeGoogleCalendarOAuth,
  connectGoogleCalendar,
  validateGoogleCalendarConnection,
} from "./googleCalendarAuth.server";
import { loadGoogleCalendarConnectionStatus } from "./googleCalendarConnectionStatus.server";
import {
  assertGoogleCalendarTenantAdminAccess,
  GoogleCalendarIntegrationAccessError,
  type GoogleCalendarIntegrationAccessOpts,
} from "./googleCalendarIntegrationAccess.server";
import {
  resolveGoogleCalendarOAuthStateSecret,
  verifyGoogleCalendarOAuthState,
} from "./googleCalendarOAuthState";

const DEFAULT_CALENDAR_ID = "primary";

type RouteOpts = GoogleCalendarIntegrationAccessOpts & {
  fetchOverride?: typeof fetch;
};

function integrationsSettingsUrl(
  tenantId: string,
  requestUrl?: string,
  query?: Record<string, string>
): string {
  const path = `/fi-admin/${tenantId.trim()}/settings/integrations`;
  const origin = requestUrl
    ? new URL(requestUrl).origin
    : process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  const base = `${origin.replace(/\/+$/, "")}${path}`;
  if (!query || Object.keys(query).length === 0) return base;
  const params = new URLSearchParams(query);
  return `${base}?${params.toString()}`;
}

export async function handleGoogleCalendarOAuthStart(
  tenantId: string,
  opts: RouteOpts = {}
): Promise<NextResponse> {
  try {
    await assertGoogleCalendarTenantAdminAccess(tenantId, opts);

    const result = await connectGoogleCalendar(tenantId);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 503 });
    }

    return NextResponse.redirect(result.authUrl);
  } catch (e) {
    if (e instanceof GoogleCalendarIntegrationAccessError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Unexpected error.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function handleGoogleCalendarOAuthCallback(
  request: Request,
  opts: RouteOpts = {}
): Promise<NextResponse> {
  const url = new URL(request.url);
  const oauthError = url.searchParams.get("error");
  const stateRaw = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code")?.trim() ?? "";

  const stateSecret = resolveGoogleCalendarOAuthStateSecret();
  if (!stateSecret) {
    return NextResponse.json(
      { ok: false, error: "Google Calendar OAuth is not configured." },
      { status: 503 }
    );
  }

  const statePayload = verifyGoogleCalendarOAuthState(stateRaw, stateSecret);
  if (!statePayload) {
    return NextResponse.json(
      { ok: false, error: "Invalid or expired OAuth state." },
      { status: 400 }
    );
  }

  const tenantId = statePayload.tenantId;

  try {
    await assertGoogleCalendarTenantAdminAccess(tenantId, { ...opts, request });

    if (oauthError) {
      return NextResponse.redirect(
        integrationsSettingsUrl(tenantId, request.url, {
          error: "google-calendar",
          reason: oauthError,
        })
      );
    }

    if (!code) {
      return NextResponse.json({ ok: false, error: "Missing OAuth code." }, { status: 400 });
    }

    const fetchFn = opts.fetchOverride ?? fetch;
    const completed = await completeGoogleCalendarOAuth(tenantId, DEFAULT_CALENDAR_ID, code, {
      supabaseClientForTests: opts.supabaseClientForTests,
      fetchOverride: fetchFn,
    });

    if (!completed.ok) {
      return NextResponse.redirect(
        integrationsSettingsUrl(tenantId, request.url, {
          error: "google-calendar",
          reason: "store_failed",
        })
      );
    }

    return NextResponse.redirect(
      integrationsSettingsUrl(tenantId, request.url, { connected: "google-calendar" })
    );
  } catch (e) {
    if (e instanceof GoogleCalendarIntegrationAccessError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Unexpected error.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function handleGoogleCalendarValidate(
  tenantId: string,
  opts: RouteOpts = {}
): Promise<NextResponse> {
  try {
    await assertGoogleCalendarTenantAdminAccess(tenantId, opts);

    const validation = await validateGoogleCalendarConnection(tenantId, {
      supabaseClientForTests: opts.supabaseClientForTests,
      fetchOverride: opts.fetchOverride,
    });

    if (!validation.ok) {
      const status = await loadGoogleCalendarConnectionStatus(tenantId, {
        supabaseClientForTests: opts.supabaseClientForTests,
      });
      return NextResponse.json({
        success: false,
        connected: status.connected,
        status: status.status,
        google_account_email: status.google_account_email,
        calendar_id: status.calendar_id,
        token_expires_at: status.token_expires_at,
        last_synced_at: status.last_synced_at,
        last_sync_status: status.last_sync_status,
        sync_failure_count: status.sync_failure_count,
        last_sync_error_summary: status.last_sync_error_summary,
        last_validated_at: status.last_validated_at,
        can_create_meet: status.can_create_meet,
        sync_health_label: status.sync_health_label,
        error: validation.error,
      });
    }

    const refreshed = await loadGoogleCalendarConnectionStatus(tenantId, {
      supabaseClientForTests: opts.supabaseClientForTests,
    });

    return NextResponse.json({
      success: true,
      connected: refreshed.connected,
      status: refreshed.status,
      google_account_email: refreshed.google_account_email,
      calendar_id: refreshed.calendar_id,
      token_expires_at: refreshed.token_expires_at,
      last_synced_at: refreshed.last_synced_at,
      last_sync_status: refreshed.last_sync_status,
      sync_failure_count: refreshed.sync_failure_count,
      last_sync_error_summary: refreshed.last_sync_error_summary,
      last_validated_at: refreshed.last_validated_at,
      can_create_meet: refreshed.can_create_meet,
      sync_health_label: refreshed.sync_health_label,
    });
  } catch (e) {
    if (e instanceof GoogleCalendarIntegrationAccessError) {
      return NextResponse.json({ success: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Unexpected error.";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
