import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it, beforeEach, afterEach } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { buildGoogleCalendarOAuthScopes, buildGoogleOAuthAuthorizeUrl } from "./googleCalendarCore";
import { connectGoogleCalendar, storeGoogleCalendarCredentials } from "./googleCalendarAuth.server";
import { loadGoogleCalendarConnectionStatus } from "./googleCalendarConnectionStatus.server";
import {
  handleGoogleCalendarOAuthCallback,
  handleGoogleCalendarValidate,
} from "./googleCalendarIntegrationRoutes.server";
import {
  signGoogleCalendarOAuthState,
  verifyGoogleCalendarOAuthState,
} from "./googleCalendarOAuthState";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MASTER_KEY = "gc2-test-master-key";
const STATE_SECRET = "gc2-state-secret";
const ACTOR = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

type IntegrationRow = Record<string, unknown>;

function createMockSupabase() {
  const integrations: IntegrationRow[] = [];

  const client = {
    from(table: string) {
      if (table === "fi_calendar_events") {
        return {
          select() {
            return {
              eq() {
                return {
                  order() {
                    return {
                      limit: async () => ({ data: [], error: null }),
                    };
                  },
                };
              },
            };
          },
        };
      }
      if (table !== "fi_calendar_integrations") throw new Error(`unexpected table ${table}`);
      return {
        upsert(row: IntegrationRow) {
          const tenantId = String(row.tenant_id);
          const calendarId = String(row.calendar_id);
          const idx = integrations.findIndex(
            (r) => r.tenant_id === tenantId && r.calendar_id === calendarId
          );
          const id = idx >= 0 ? integrations[idx].id : randomUUID();
          const full = {
            ...row,
            id,
            provider: "google",
            status: row.status ?? "active",
            created_at: row.created_at ?? new Date().toISOString(),
            updated_at: row.updated_at ?? new Date().toISOString(),
          };
          if (idx >= 0) integrations[idx] = full;
          else integrations.push(full);
          return {
            select() {
              return { single: async () => ({ data: full, error: null }) };
            },
          };
        },
        select(_cols?: string) {
          return {
            eq(col: string, val: string) {
              const chain = {
                eq(col2: string, val2: string) {
                  return {
                    order() {
                      return {
                        limit() {
                          return {
                            maybeSingle: async () => {
                              const row = integrations.find(
                                (r) => r[col] === val && r[col2] === val2
                              );
                              return { data: row ?? null, error: null };
                            },
                          };
                        },
                      };
                    },
                    maybeSingle: async () => {
                      const row = integrations.find((r) => r[col] === val && r[col2] === val2);
                      return { data: row ?? null, error: null };
                    },
                  };
                },
                neq(col2: string, val2: string) {
                  return {
                    order() {
                      return {
                        limit() {
                          return {
                            maybeSingle: async () => {
                              const row = integrations.find(
                                (r) => r[col] === val && r[col2] !== val2
                              );
                              return { data: row ?? null, error: null };
                            },
                          };
                        },
                      };
                    },
                  };
                },
                order() {
                  return {
                    limit() {
                      return {
                        maybeSingle: async () => {
                          const row = integrations.find((r) => r[col] === val);
                          return { data: row ?? null, error: null };
                        },
                      };
                    },
                  };
                },
                maybeSingle: async () => {
                  const row = integrations.find((r) => r[col] === val);
                  return { data: row ?? null, error: null };
                },
              };
              return chain;
            },
          };
        },
        update(patch: IntegrationRow) {
          return {
            eq(col: string, val: string) {
              return {
                eq(col2: string, val2: string) {
                  return {
                    select() {
                      return {
                        single: async () => {
                          const row = integrations.find((r) => r[col] === val && r[col2] === val2);
                          if (!row) return { data: null, error: { message: "not found" } };
                          Object.assign(row, patch);
                          return { data: row, error: null };
                        },
                      };
                    },
                    then: undefined,
                  };
                },
                select() {
                  return {
                    single: async () => {
                      const row = integrations.find((r) => r[col] === val);
                      if (!row) return { data: null, error: { message: "not found" } };
                      Object.assign(row, patch);
                      return { data: row, error: null };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  return { client: client as unknown as SupabaseClient, integrations };
}

const origEnv = { ...process.env };

describe("CalendarOS GC-2 — OAuth state", () => {
  beforeEach(() => {
    process.env.GOOGLE_CALENDAR_OAUTH_STATE_SECRET = STATE_SECRET;
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it("signed state includes tenantId and verifies safely", () => {
    const state = signGoogleCalendarOAuthState(TENANT, STATE_SECRET);
    const parsed = verifyGoogleCalendarOAuthState(state, STATE_SECRET);
    assert.ok(parsed);
    assert.equal(parsed!.tenantId, TENANT);
    assert.ok(parsed!.nonce.length >= 16);
    assert.ok(parsed!.exp > Date.now());
  });

  it("rejects tampered state signature", () => {
    const state = signGoogleCalendarOAuthState(TENANT, STATE_SECRET);
    const tampered = `${state.slice(0, -1)}x`;
    assert.equal(verifyGoogleCalendarOAuthState(tampered, STATE_SECRET), null);
  });

  it("rejects expired state", () => {
    const state = signGoogleCalendarOAuthState(TENANT, STATE_SECRET, {
      exp: Date.now() - 1000,
    });
    assert.equal(verifyGoogleCalendarOAuthState(state, STATE_SECRET), null);
  });

  it("rejects state signed with wrong secret", () => {
    const state = signGoogleCalendarOAuthState(TENANT, "other-secret");
    assert.equal(verifyGoogleCalendarOAuthState(state, STATE_SECRET), null);
  });
});

describe("CalendarOS GC-2 — OAuth authorize URL scopes", () => {
  beforeEach(() => {
    process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY = MASTER_KEY;
    process.env.GOOGLE_CALENDAR_CLIENT_ID = "client-id";
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "client-secret";
    process.env.GOOGLE_CALENDAR_REDIRECT_URI =
      "https://app.example.com/api/google-calendar/oauth/callback";
    process.env.GOOGLE_CALENDAR_OAUTH_STATE_SECRET = STATE_SECRET;
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it("connectGoogleCalendar OAuth URL includes required calendar scopes", async () => {
    const result = await connectGoogleCalendar(TENANT);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const scopes = buildGoogleCalendarOAuthScopes();
    assert.ok(result.authUrl.includes("calendar.events"));
    assert.ok(result.authUrl.includes("www.googleapis.com%2Fauth%2Fcalendar"));

    const statePayload = verifyGoogleCalendarOAuthState(result.state, STATE_SECRET);
    assert.ok(statePayload);
    assert.equal(statePayload!.tenantId, TENANT);
    assert.ok(scopes.includes("https://www.googleapis.com/auth/calendar.events"));
  });

  it("buildGoogleOAuthAuthorizeUrl includes offline access and both scopes", () => {
    const url = buildGoogleOAuthAuthorizeUrl({
      clientId: "cid",
      redirectUri: "https://example.com/cb",
      state: "state-1",
    });
    assert.ok(url.includes("access_type=offline"));
    assert.ok(url.includes("calendar.events"));
    assert.ok(url.includes("calendar"));
  });
});

describe("CalendarOS GC-2 — OAuth callback route", () => {
  beforeEach(() => {
    process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY = MASTER_KEY;
    process.env.GOOGLE_CALENDAR_CLIENT_ID = "client-id";
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "client-secret";
    process.env.GOOGLE_CALENDAR_REDIRECT_URI =
      "https://app.example.com/api/google-calendar/oauth/callback";
    process.env.GOOGLE_CALENDAR_OAUTH_STATE_SECRET = STATE_SECRET;
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it("callback rejects missing code", async () => {
    const state = signGoogleCalendarOAuthState(TENANT, STATE_SECRET);
    const req = new Request(
      `https://app.example.com/api/google-calendar/oauth/callback?state=${encodeURIComponent(state)}`
    );
    const res = await handleGoogleCalendarOAuthCallback(req, {
      skipAuthCheck: true,
      actorAuthUserId: ACTOR,
    });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error?: string };
    assert.match(body.error ?? "", /Missing OAuth code/i);
  });

  it("callback rejects invalid state", async () => {
    const req = new Request(
      "https://app.example.com/api/google-calendar/oauth/callback?code=abc&state=not-valid-state"
    );
    const res = await handleGoogleCalendarOAuthCallback(req, {
      skipAuthCheck: true,
      actorAuthUserId: ACTOR,
    });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error?: string };
    assert.match(body.error ?? "", /Invalid or expired OAuth state/i);
  });

  it("callback stores connection through completeGoogleCalendarOAuth", async () => {
    const { client, integrations } = createMockSupabase();
    const state = signGoogleCalendarOAuthState(TENANT, STATE_SECRET);

    const fetchOverride: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return new Response(
          JSON.stringify({
            access_token: "access-token-1",
            refresh_token: "refresh-token-1",
            expires_in: 3600,
          }),
          { status: 200 }
        );
      }
      if (url.includes("googleapis.com/oauth2/v2/userinfo")) {
        return new Response(JSON.stringify({ email: "clinic@example.com" }), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    };

    const req = new Request(
      `https://app.example.com/api/google-calendar/oauth/callback?code=oauth-code-1&state=${encodeURIComponent(state)}`
    );
    const res = await handleGoogleCalendarOAuthCallback(req, {
      skipAuthCheck: true,
      actorAuthUserId: ACTOR,
      supabaseClientForTests: client,
      fetchOverride,
    });

    assert.equal(res.status, 307);
    const location = res.headers.get("location") ?? "";
    assert.ok(location.includes(`/fi-admin/${TENANT}/settings/integrations`));
    assert.ok(location.includes("connected=google-calendar"));

    assert.equal(integrations.length, 1);
    const row = integrations[0];
    assert.equal(row.tenant_id, TENANT);
    assert.equal(row.calendar_id, "primary");
    assert.equal(row.google_account_email, "clinic@example.com");
    assert.ok(row.access_token_encrypted);
    assert.ok(row.refresh_token_encrypted);
    assert.ok(String(row.access_token_encrypted).length > 20);
    assert.notEqual(row.access_token_encrypted, "access-token-1");
  });
});

describe("CalendarOS GC-2 — connection status loader", () => {
  beforeEach(() => {
    process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY = MASTER_KEY;
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it("connection status does not expose tokens", async () => {
    const { client } = createMockSupabase();
    await storeGoogleCalendarCredentials(
      {
        tenantId: TENANT,
        calendarId: "primary",
        googleAccountEmail: "clinic@example.com",
        accessToken: "access-token-1",
        refreshToken: "refresh-token-1",
        expiresInSeconds: 3600,
      },
      { supabaseClientForTests: client }
    );

    const status = await loadGoogleCalendarConnectionStatus(TENANT, {
      supabaseClientForTests: client,
    });

    assert.equal(status.connected, true);
    assert.equal(status.google_account_email, "clinic@example.com");
    assert.equal(status.calendar_id, "primary");
    assert.equal(status.can_create_meet, true);
    assert.ok(!("access_token_encrypted" in status));
    assert.ok(!("refresh_token_encrypted" in status));
    assert.ok(!("accessToken" in status));
  });
});

describe("CalendarOS GC-2 — validate route", () => {
  beforeEach(() => {
    process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY = MASTER_KEY;
    process.env.GOOGLE_CALENDAR_CLIENT_ID = "client-id";
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "client-secret";
    process.env.GOOGLE_CALENDAR_REDIRECT_URI =
      "https://app.example.com/api/google-calendar/oauth/callback";
    process.env.GOOGLE_CALENDAR_OAUTH_STATE_SECRET = STATE_SECRET;
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it("validate route rejects unauthorized access", async () => {
    const res = await handleGoogleCalendarValidate(TENANT);
    assert.equal(res.status, 401);
    const body = (await res.json()) as { success?: boolean; error?: string };
    assert.equal(body.success, false);
    assert.match(body.error ?? "", /Authentication required/i);
  });

  it("validate route returns sanitized connection result", async () => {
    const { client } = createMockSupabase();
    await storeGoogleCalendarCredentials(
      {
        tenantId: TENANT,
        calendarId: "primary",
        googleAccountEmail: "clinic@example.com",
        accessToken: "live-access",
        refreshToken: "live-refresh",
        expiresInSeconds: 3600,
      },
      { supabaseClientForTests: client }
    );

    const fetchOverride: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "fresh-access", expires_in: 3600 }), {
          status: 200,
        });
      }
      if (url.includes("googleapis.com/calendar/v3/calendars")) {
        return new Response(JSON.stringify({ summary: "Clinic Calendar" }), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    };

    const res = await handleGoogleCalendarValidate(TENANT, {
      skipAuthCheck: true,
      actorAuthUserId: ACTOR,
      supabaseClientForTests: client,
      fetchOverride,
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      success?: boolean;
      connected?: boolean;
      status?: string;
      google_account_email?: string;
      calendar_id?: string;
      access_token?: string;
    };

    assert.equal(body.success, true);
    assert.equal(body.connected, true);
    assert.equal(body.status, "active");
    assert.equal(body.google_account_email, "clinic@example.com");
    assert.equal(body.calendar_id, "primary");
    assert.equal(body.access_token, undefined);
  });
});
