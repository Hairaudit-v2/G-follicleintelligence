import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it, beforeEach, afterEach } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildGoogleInboundCalendarScopeMetadata,
  shouldEnableGoogleInboundCalendarByDefault,
} from "./googleCalendarCore";
import { completeGoogleCalendarOAuth } from "./googleCalendarAuth.server";
import {
  seedGoogleInboundCalendarScopesFromCalendarList,
  type SeedGoogleInboundCalendarScopesInput,
} from "./googleCalendarInboundSyncData.server";
import type { GoogleCalendarListEntry } from "./googleCalendarTypes";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MASTER_KEY = "gc6a-test-master-key";

type IntegrationRow = Record<string, unknown>;
type InboundRow = Record<string, unknown>;

function calendarListResponse(entries: GoogleCalendarListEntry[]): Response {
  return new Response(JSON.stringify({ items: entries }), { status: 200 });
}

function createGc6aMockSupabase(seed?: { integrations?: IntegrationRow[]; inbound?: InboundRow[] }) {
  const integrations: IntegrationRow[] = [...(seed?.integrations ?? [])];
  const inboundCalendars: InboundRow[] = [...(seed?.inbound ?? [])];

  const filterRows = <T extends Record<string, unknown>>(rows: T[], filters: Record<string, string | boolean>) =>
    rows.filter((r) => Object.entries(filters).every(([k, v]) => r[k] === v));

  const client = {
    from(table: string) {
      if (table === "fi_calendar_inbound_sync_calendars") {
        const buildChain = (filters: Record<string, string | boolean> = {}) => {
          const chain = {
            eq(col: string, val: string | boolean) {
              filters[col] = val;
              return chain;
            },
            order() {
              return chain;
            },
            then(
              resolve: (v: { data: InboundRow[]; error: null }) => void,
              reject?: (e: unknown) => void
            ) {
              try {
                resolve({ data: filterRows(inboundCalendars, filters), error: null });
              } catch (e) {
                reject?.(e);
              }
            },
          };
          return chain;
        };

        return {
          select() {
            return buildChain();
          },
          insert(row: InboundRow) {
            const full = {
              id: randomUUID(),
              created_at: new Date().toISOString(),
              ...row,
            };
            inboundCalendars.push(full);
            return Promise.resolve({ error: null });
          },
          update(patch: InboundRow) {
            return {
              eq(col: string, val: string) {
                return {
                  eq(col2: string, val2: string) {
                    const row = inboundCalendars.find((r) => r[col] === val && r[col2] === val2);
                    if (row) Object.assign(row, patch);
                    return Promise.resolve({ error: null });
                  },
                };
              },
            };
          },
        };
      }

      if (table === "fi_calendar_integrations") {
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
              last_sync_status: row.last_sync_status ?? "never_synced",
              sync_failure_count: row.sync_failure_count ?? 0,
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
        };
      }

      throw new Error(`unexpected table ${table}`);
    },
  };

  return {
    client: client as unknown as SupabaseClient,
    integrations,
    inboundCalendars,
  };
}

const SAMPLE_CALENDAR_LIST: GoogleCalendarListEntry[] = [
  {
    id: "primary",
    summary: "Clinic Primary",
    primary: true,
    accessRole: "owner",
    timeZone: "America/New_York",
  },
  {
    id: "consultations@follicleintelligence.ai",
    summary: "FI OS Consultations",
    accessRole: "owner",
    backgroundColor: "#9fe1e7",
    foregroundColor: "#000000",
    selected: true,
  },
  {
    id: "appointments@follicleintelligence.ai",
    summary: "Appointments",
    accessRole: "writer",
  },
  {
    id: "support@follicleintelligence.ai",
    summary: "support@follicleintelligence.ai",
    accessRole: "owner",
  },
  {
    id: "birthdays@group.v.calendar.google.com",
    summary: "Birthdays",
    accessRole: "reader",
  },
  {
    id: "personal@gmail.com",
    summary: "Personal",
    accessRole: "owner",
  },
];

function seedInput(integrationId: string, overrides: Partial<SeedGoogleInboundCalendarScopesInput> = {}) {
  return {
    tenantId: TENANT,
    integrationId,
    googleAccountEmail: "support@follicleintelligence.ai",
    accessToken: "access-token",
    defaultCalendarId: "primary",
    ...overrides,
  };
}

const origEnv = { ...process.env };

describe("CalendarOS GC-6A — default inbound enablement", () => {
  it("enables primary calendar", () => {
    assert.equal(
      shouldEnableGoogleInboundCalendarByDefault({ id: "primary", summary: "Work", primary: true }, null),
      true
    );
  });

  it("enables FI OS Consultations calendar", () => {
    assert.equal(
      shouldEnableGoogleInboundCalendarByDefault(
        { id: "c1", summary: "FI OS Consultations" },
        "clinic@example.com"
      ),
      true
    );
  });

  it("enables Appointments calendar", () => {
    assert.equal(
      shouldEnableGoogleInboundCalendarByDefault({ id: "c2", summary: "Appointments" }, null),
      true
    );
  });

  it("enables calendar matching connected account email", () => {
    assert.equal(
      shouldEnableGoogleInboundCalendarByDefault(
        { id: "support@follicleintelligence.ai", summary: "support@follicleintelligence.ai" },
        "support@follicleintelligence.ai"
      ),
      true
    );
  });

  it("disables Birthdays calendar", () => {
    assert.equal(
      shouldEnableGoogleInboundCalendarByDefault(
        { id: "birthdays@group.v.calendar.google.com", summary: "Birthdays" },
        "support@follicleintelligence.ai"
      ),
      false
    );
  });

  it("disables Personal calendar", () => {
    assert.equal(
      shouldEnableGoogleInboundCalendarByDefault({ id: "personal@gmail.com", summary: "Personal" }, null),
      false
    );
  });

  it("stores useful calendar metadata fields", () => {
    const metadata = buildGoogleInboundCalendarScopeMetadata({
      id: "c1",
      summary: "FI OS Consultations",
      summaryOverride: "Consultations Override",
      description: "Clinic consults",
      primary: false,
      accessRole: "owner",
      backgroundColor: "#9fe1e7",
      foregroundColor: "#000000",
      selected: true,
      timeZone: "America/New_York",
    });
    assert.equal(metadata.accessRole, "owner");
    assert.equal(metadata.backgroundColor, "#9fe1e7");
    assert.equal(metadata.foregroundColor, "#000000");
    assert.equal(metadata.selected, true);
    assert.equal(metadata.timeZone, "America/New_York");
    assert.equal(metadata.primary, false);
    assert.equal(metadata.description, "Clinic consults");
    assert.equal(metadata.summaryOverride, "Consultations Override");
  });
});

describe("CalendarOS GC-6A — inbound scope seeder idempotency", () => {
  beforeEach(() => {
    process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY = MASTER_KEY;
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it("first run inserts all discovered calendars with default enablement", async () => {
    const integrationId = randomUUID();
    const { client, inboundCalendars } = createGc6aMockSupabase();

    const fetchOverride: typeof fetch = async (input) => {
      if (String(input).includes("/calendarList")) return calendarListResponse(SAMPLE_CALENDAR_LIST);
      return new Response("not found", { status: 404 });
    };

    const result = await seedGoogleInboundCalendarScopesFromCalendarList(seedInput(integrationId), {
      supabaseClientForTests: client,
      fetchOverride,
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.calendarsDiscovered, SAMPLE_CALENDAR_LIST.length);
    assert.equal(result.inserted, SAMPLE_CALENDAR_LIST.length);
    assert.equal(result.updated, 0);
    assert.equal(result.enabledByDefault, 4);
    assert.equal(result.disabledByDefault, 2);
    assert.equal(inboundCalendars.length, SAMPLE_CALENDAR_LIST.length);

    const birthdays = inboundCalendars.find((r) => r.google_calendar_id === "birthdays@group.v.calendar.google.com");
    assert.equal(birthdays?.is_enabled, false);

    const consultations = inboundCalendars.find(
      (r) => r.google_calendar_id === "consultations@follicleintelligence.ai"
    );
    assert.equal(consultations?.is_enabled, true);
    assert.deepEqual(consultations?.metadata, {
      accessRole: "owner",
      backgroundColor: "#9fe1e7",
      foregroundColor: "#000000",
      selected: true,
    });
  });

  it("second run updates metadata but preserves is_enabled", async () => {
    const integrationId = randomUUID();
    const { client, inboundCalendars } = createGc6aMockSupabase();

    const fetchOverride: typeof fetch = async (input) => {
      if (String(input).includes("/calendarList")) return calendarListResponse(SAMPLE_CALENDAR_LIST);
      return new Response("not found", { status: 404 });
    };

    await seedGoogleInboundCalendarScopesFromCalendarList(seedInput(integrationId), {
      supabaseClientForTests: client,
      fetchOverride,
    });

    const consultations = inboundCalendars.find(
      (r) => r.google_calendar_id === "consultations@follicleintelligence.ai"
    );
    assert.ok(consultations);
    consultations!.is_enabled = false;
    consultations!.google_calendar_summary = "Stale summary";

    const updatedList = SAMPLE_CALENDAR_LIST.map((entry) =>
      entry.id === "consultations@follicleintelligence.ai"
        ? { ...entry, summary: "FI OS Consultations Updated", backgroundColor: "#ffffff" }
        : entry
    );

    const fetchOverride2: typeof fetch = async (input) => {
      if (String(input).includes("/calendarList")) return calendarListResponse(updatedList);
      return new Response("not found", { status: 404 });
    };

    const result = await seedGoogleInboundCalendarScopesFromCalendarList(seedInput(integrationId), {
      supabaseClientForTests: client,
      fetchOverride: fetchOverride2,
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.inserted, 0);
    assert.equal(result.updated, SAMPLE_CALENDAR_LIST.length);
    assert.equal(result.preservedEnabledState, SAMPLE_CALENDAR_LIST.length);
    assert.equal(consultations!.is_enabled, false);
    assert.equal(consultations!.google_calendar_summary, "FI OS Consultations Updated");
    assert.equal((consultations!.metadata as Record<string, unknown>).backgroundColor, "#ffffff");
  });
});

describe("CalendarOS GC-6A — OAuth connect seeds inbound scopes", () => {
  beforeEach(() => {
    process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY = MASTER_KEY;
    process.env.GOOGLE_CALENDAR_CLIENT_ID = "client-id";
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "client-secret";
    process.env.GOOGLE_CALENDAR_REDIRECT_URI = "https://app.example.com/api/google-calendar/oauth/callback";
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it("completeGoogleCalendarOAuth seeds inbound calendars on success", async () => {
    const { client, integrations, inboundCalendars } = createGc6aMockSupabase();

    const fetchOverride: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return new Response(
          JSON.stringify({
            access_token: "access-token-oauth",
            refresh_token: "refresh-token-oauth",
            expires_in: 3600,
          }),
          { status: 200 }
        );
      }
      if (url.includes("googleapis.com/oauth2/v2/userinfo")) {
        return new Response(JSON.stringify({ email: "support@follicleintelligence.ai" }), { status: 200 });
      }
      if (url.includes("/calendarList")) return calendarListResponse(SAMPLE_CALENDAR_LIST);
      return new Response("not found", { status: 404 });
    };

    const result = await completeGoogleCalendarOAuth(TENANT, "primary", "oauth-code", {
      supabaseClientForTests: client,
      fetchOverride,
    });

    assert.equal(result.ok, true);
    assert.equal(integrations.length, 1);
    assert.equal(inboundCalendars.length, SAMPLE_CALENDAR_LIST.length);
  });

  it("calendarList failure does not fail OAuth integration creation", async () => {
    const { client, integrations, inboundCalendars } = createGc6aMockSupabase();

    const fetchOverride: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return new Response(
          JSON.stringify({
            access_token: "access-token-oauth",
            refresh_token: "refresh-token-oauth",
            expires_in: 3600,
          }),
          { status: 200 }
        );
      }
      if (url.includes("googleapis.com/oauth2/v2/userinfo")) {
        return new Response(JSON.stringify({ email: "clinic@example.com" }), { status: 200 });
      }
      if (url.includes("/calendarList")) {
        return new Response("upstream error", { status: 503 });
      }
      return new Response("not found", { status: 404 });
    };

    const result = await completeGoogleCalendarOAuth(TENANT, "primary", "oauth-code", {
      supabaseClientForTests: client,
      fetchOverride,
    });

    assert.equal(result.ok, true);
    assert.equal(integrations.length, 1);
    assert.equal(inboundCalendars.length, 0);
  });
});
