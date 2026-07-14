/**
 * Shared Supabase mock for Google Calendar backfill server tests.
 * Pattern aligned with googleCalendarGc1.test.ts createMockSupabase.
 */
import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  deriveExternalConnectorMasterKey,
  encryptExternalConnectorSecret,
} from "@/src/lib/onboarding-os/externalConnectorSecretCrypto.server";

type EventRow = Record<string, unknown>;
type IntegrationRow = Record<string, unknown>;

export function createGoogleCalendarBackfillTestMock(input: {
  tenantId: string;
  integrationId: string;
  calendarId?: string;
  masterKey: string;
}) {
  const calendarId = input.calendarId ?? "primary";
  const key = deriveExternalConnectorMasterKey(input.masterKey)!;

  const integrations: IntegrationRow[] = [
    {
      id: input.integrationId,
      tenant_id: input.tenantId,
      calendar_id: calendarId,
      provider: "google",
      status: "active",
      google_account_email: "clinic@example.com",
      access_token_encrypted: encryptExternalConnectorSecret("access-token", key),
      refresh_token_encrypted: encryptExternalConnectorSecret("refresh-token", key),
      token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
      sync_enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
  const events: EventRow[] = [];
  const inboundCalendars: Record<string, unknown>[] = [
    {
      id: randomUUID(),
      integration_id: input.integrationId,
      tenant_id: input.tenantId,
      provider: "google",
      google_calendar_id: calendarId,
      google_calendar_summary: "Primary",
      is_enabled: true,
      is_primary: true,
    },
  ];
  const reviewItems: Record<string, unknown>[] = [];
  const bookings: Record<string, unknown>[] = [];
  const mappings: Record<string, unknown>[] = [];
  const syncHealth: Record<string, unknown>[] = [];
  const tenants = [{ id: input.tenantId, default_timezone: "Australia/Perth", metadata: {} }];

  const client = {
    from(table: string) {
      if (table === "fi_tenants") {
        return {
          select: () => ({
            eq: (_c: string, val: string) => ({
              maybeSingle: async () => ({
                data: tenants.find((t) => t.id === val) ?? null,
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "fi_calendar_sync_review_items") {
        const filterReview = (filters: Record<string, string>) =>
          reviewItems.filter((r) => Object.entries(filters).every(([k, v]) => r[k] === v));
        const buildReviewChain = (filters: Record<string, string> = {}) => {
          const chain = {
            eq(col: string, val: string) {
              filters[col] = val;
              return chain;
            },
            order: () => chain,
            limit: () => chain,
            maybeSingle: async () => ({ data: filterReview(filters)[0] ?? null, error: null }),
          };
          return chain;
        };
        return {
          select: () => buildReviewChain(),
          insert: (row: Record<string, unknown>) => {
            reviewItems.push({ id: randomUUID(), status: "open", ...row });
            return {
              select: () => ({
                single: async () => ({ data: reviewItems.at(-1), error: null }),
              }),
            };
          },
        };
      }

      if (table === "fi_calendar_inbound_sync_calendars") {
        const filterInbound = (filters: Record<string, string | boolean>) =>
          inboundCalendars.filter((r) => Object.entries(filters).every(([k, v]) => r[k] === v));
        const buildInboundChain = (filters: Record<string, string | boolean> = {}) => {
          const chain = {
            eq(col: string, val: string | boolean) {
              filters[col] = val;
              return chain;
            },
            order: () => chain,
            then(resolve: (v: { data: Record<string, unknown>[]; error: null }) => void) {
              resolve({ data: filterInbound(filters), error: null });
            },
          };
          return chain;
        };
        return {
          select: () => buildInboundChain(),
          update: (patch: Record<string, unknown>) => ({
            eq: (col: string, val: string) => ({
              eq: (col2: string, val2: string) => {
                const row = inboundCalendars.find((r) => r[col] === val && r[col2] === val2);
                if (row) Object.assign(row, patch);
                return Promise.resolve({ error: null });
              },
            }),
          }),
        };
      }

      if (table === "fi_calendar_integrations") {
        return {
          select: () => ({
            eq(col: string, val: string) {
              const chain = {
                eq(col2: string, val2: string) {
                  return {
                    order: () => ({
                      limit: () => ({
                        maybeSingle: async () => ({
                          data:
                            integrations.find(
                              (r) =>
                                r.tenant_id === val && r[col2] === val2 && r.status === "active"
                            ) ?? null,
                          error: null,
                        }),
                      }),
                    }),
                    maybeSingle: async () => ({
                      data:
                        integrations.find((r) => r.tenant_id === val && r[col2] === val2) ?? null,
                      error: null,
                    }),
                  };
                },
                neq: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({
                        data: integrations.find((r) => r.tenant_id === val) ?? null,
                        error: null,
                      }),
                    }),
                  }),
                }),
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({
                      data:
                        integrations.find((r) => r.tenant_id === val && r.status === "active") ??
                        null,
                      error: null,
                    }),
                  }),
                }),
                maybeSingle: async () => ({
                  data: integrations.find((r) => r.tenant_id === val) ?? null,
                  error: null,
                }),
              };
              return chain;
            },
          }),
        };
      }

      if (table === "fi_calendar_events") {
        type EventFilters = { eq: Record<string, string> };
        const filterEvents = (filters: EventFilters) =>
          events.filter((r) => Object.entries(filters.eq).every(([k, v]) => r[k] === v));
        const buildEventChain = (filters: EventFilters = { eq: {} }) => {
          const chain = {
            eq(col: string, val: string) {
              filters.eq[col] = val;
              return chain;
            },
            lt: () => chain,
            gt: () => chain,
            not: () => chain,
            gte: () => chain,
            lte: () => chain,
            order: () => Promise.resolve({ data: filterEvents(filters), error: null }),
            maybeSingle: async () => ({ data: filterEvents(filters)[0] ?? null, error: null }),
            then(resolve: (v: { data: EventRow[]; error: null }) => void) {
              resolve({ data: filterEvents(filters), error: null });
            },
          };
          return chain;
        };
        return {
          select: () => buildEventChain(),
          insert: (row: EventRow) => {
            const full: EventRow = {
              ...row,
              id: randomUUID(),
              provider: "google",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            const dup = events.find(
              (e) =>
                typeof e.external_event_id === "string" &&
                e.external_event_id === full.external_event_id
            );
            if (dup) return { error: { code: "23505", message: "duplicate" } };
            events.push(full);
            return { error: null };
          },
          update: (patch: EventRow) => ({
            eq: (col: string, val: string) => ({
              eq: (col2: string, val2: string) => {
                const row = events.find((r) => r[col] === val && r[col2] === val2);
                if (row) Object.assign(row, patch);
                return Promise.resolve({ error: null });
              },
            }),
          }),
        };
      }

      if (table === "fi_bookings") {
        const build = (filters: Record<string, string> = {}) => ({
          eq(col: string, val: string) {
            filters[col] = val;
            return build(filters);
          },
          lt: () => build(filters),
          gt: () => build(filters),
          insert: (row: Record<string, unknown>) => {
            const full = { id: randomUUID(), ...row };
            bookings.push(full);
            return { select: () => ({ single: async () => ({ data: full, error: null }) }) };
          },
          maybeSingle: async () => ({
            data: bookings.find((b) =>
              Object.entries(filters).every(([k, v]) => String(b[k]) === String(v))
            ),
            error: null,
          }),
          then(resolve: (v: { data: Record<string, unknown>[]; error: null }) => void) {
            resolve({
              data: bookings.filter((b) =>
                Object.entries(filters).every(([k, v]) => String(b[k]) === String(v))
              ),
              error: null,
            });
          },
        });
        return {
          select: () => build(),
          update: (patch: Record<string, unknown>) => ({
            eq: (col: string, val: string) => ({
              eq: (col2: string, val2: string) => {
                const row = bookings.find((r) => r[col] === val && r[col2] === val2);
                if (row) Object.assign(row, patch);
                return Promise.resolve({ error: null });
              },
            }),
          }),
        };
      }

      if (table === "fi_external_entity_mappings") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: mappings[0] ?? null, error: null }),
                  }),
                }),
              }),
            }),
          }),
          upsert: (row: Record<string, unknown>) => {
            mappings.push(row);
            return Promise.resolve({ error: null });
          },
        };
      }

      if (table === "fi_calendar_sync_health") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: syncHealth[0] ?? null, error: null }),
              }),
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: syncHealth[0] ?? null, error: null }),
                }),
              }),
            }),
          }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
          insert: (row: Record<string, unknown>) => {
            syncHealth.push(row);
            return Promise.resolve({ error: null });
          },
        };
      }

      if (
        table === "fi_patients" ||
        table === "fi_network_subject_members" ||
        table === "fi_network_subjects" ||
        table === "fi_crm_leads"
      ) {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
                  resolve({ data: [], error: null }),
              }),
              order: () => ({
                then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
                  resolve({ data: [], error: null }),
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };

  return {
    client: client as unknown as SupabaseClient,
    events,
    bookings,
    mappings,
    reviewItems,
  };
}
