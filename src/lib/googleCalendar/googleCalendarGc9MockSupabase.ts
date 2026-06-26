/**
 * Shared Supabase mock for CalendarOS GC-9/GC-10 integration tests.
 */
import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  attachFiEventBusMockToClient,
  createFiEventBusMockTables,
} from "@/src/lib/events/fiEventBusMockTables";

import { withGc8IntegrationDefaults } from "./googleCalendarGc8MockTables";
import { createGc9MockTables } from "./googleCalendarGc9MockTables";

export type Gc9MockSupabaseOptions = {
  tenantId: string;
  integrationId: string;
  encryptToken: (plaintext: string) => string;
  integrationSeed?: Record<string, unknown>;
};

export function createGc9MockSupabase(options: Gc9MockSupabaseOptions) {
  const gc9 = createGc9MockTables();
  type IntegrationRow = Record<string, unknown>;
  const integrations: IntegrationRow[] = [
    withGc8IntegrationDefaults({
      id: options.integrationId,
      tenant_id: options.tenantId,
      calendar_id: "primary",
      provider: "google",
      status: "active",
      google_account_email: "clinic@example.com",
      access_token_encrypted: options.encryptToken("access-token"),
      refresh_token_encrypted: options.encryptToken("refresh-token"),
      token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
      last_sync_status: "never_synced",
      sync_failure_count: 0,
      realtime_sync_enabled: false,
      ...options.integrationSeed,
    }),
  ];
  const events: Record<string, unknown>[] = [];
  const reviewItems: Record<string, unknown>[] = [];

  const client = {
    from(table: string) {
      const gc9Handler = gc9.tableHandler(table);
      if (gc9Handler) return gc9Handler;

      if (table === "fi_calendar_integrations") {
        const applyFilters = (
          rows: IntegrationRow[],
          filters: Record<string, string | boolean | { is: null }>
        ) =>
          rows.filter((r) =>
            Object.entries(filters).every(([col, val]) => {
              if (val && typeof val === "object" && "is" in val) return r[col] == null;
              return r[col] === val;
            })
          );

        const buildChain = (filters: Record<string, string | boolean | { is: null }> = {}) => {
          const terminal = {
            maybeSingle: async () => {
              const rows = applyFilters(integrations, filters);
              return { data: rows[0] ?? null, error: null };
            },
            limit(n: number) {
              return {
                maybeSingle: async () => {
                  const rows = applyFilters(integrations, filters).slice(0, n);
                  return { data: rows[0] ?? null, error: null };
                },
                then(
                  resolve: (v: { data: IntegrationRow[]; error: null }) => void,
                  reject?: (e: unknown) => void
                ) {
                  try {
                    resolve({ data: applyFilters(integrations, filters).slice(0, n), error: null });
                  } catch (e) {
                    reject?.(e);
                  }
                },
              };
            },
            then(
              resolve: (v: { data: IntegrationRow[]; error: null }) => void,
              reject?: (e: unknown) => void
            ) {
              try {
                resolve({ data: applyFilters(integrations, filters), error: null });
              } catch (e) {
                reject?.(e);
              }
            },
          };

          return {
            eq(col: string, val: string | boolean) {
              filters[col] = val;
              return buildChain(filters);
            },
            is(col: string, val: null) {
              filters[col] = { is: val };
              return buildChain(filters);
            },
            neq(_col: string, _val: string) {
              return buildChain(filters);
            },
            order() {
              return { ...buildChain(filters), ...terminal };
            },
            ...terminal,
          };
        };

        return {
          select() {
            return buildChain();
          },
          update(patch: IntegrationRow) {
            return {
              eq(col: string, val: string) {
                return {
                  eq(col2: string, val2: string) {
                    const row = integrations.find((r) => r[col] === val && r[col2] === val2);
                    if (row) Object.assign(row, patch);
                    return Promise.resolve({ error: null });
                  },
                  then(resolve: (v: { error: null }) => void) {
                    const row = integrations.find((r) => r[col] === val);
                    if (row) Object.assign(row, patch);
                    resolve({ error: null });
                  },
                };
              },
            };
          },
        };
      }

      if (table === "fi_calendar_inbound_sync_calendars") {
        const inboundRows: Record<string, unknown>[] = [
          {
            id: randomUUID(),
            tenant_id: options.tenantId,
            integration_id: options.integrationId,
            google_calendar_id: "primary",
            google_calendar_summary: "Primary",
            is_enabled: true,
            is_primary: true,
          },
        ];
        const buildInbound = (filters: Record<string, unknown> = {}) => ({
          eq(col: string, val: unknown) {
            filters[col] = val;
            return buildInbound(filters);
          },
          order() {
            return {
              order() {
                return Promise.resolve({
                  data: inboundRows.filter((r) =>
                    Object.entries(filters).every(([k, v]) => r[k] === v)
                  ),
                  error: null,
                });
              },
            };
          },
        });
        return {
          select() {
            return buildInbound();
          },
          update(patch: Record<string, unknown>) {
            return {
              eq(col: string, val: string) {
                return {
                  eq(col2: string, val2: string) {
                    const row = inboundRows.find((r) => r[col] === val && r[col2] === val2);
                    if (row) Object.assign(row, patch);
                    return Promise.resolve({ error: null });
                  },
                };
              },
            };
          },
        };
      }

      if (table === "fi_calendar_events") {
        type EventFilters = { eq: Record<string, string>; notNull: string[] };
        const filterEvents = (filters: EventFilters) =>
          events.filter(
            (r) =>
              Object.entries(filters.eq).every(([k, v]) => r[k] === v) &&
              filters.notNull.every((col) => r[col] != null && String(r[col]).trim() !== "")
          );

        const buildEventChain = (filters: EventFilters = { eq: {}, notNull: [] }) => ({
          eq(col: string, val: string) {
            filters.eq[col] = val;
            return buildEventChain(filters);
          },
          not(col: string, op: string, val: unknown) {
            if (op === "is" && val === null) filters.notNull.push(col);
            return buildEventChain(filters);
          },
          gte() {
            return buildEventChain(filters);
          },
          lte() {
            return buildEventChain(filters);
          },
          order() {
            return Promise.resolve({ data: filterEvents(filters), error: null });
          },
          maybeSingle: async () => {
            const row = filterEvents(filters)[0];
            return { data: row ?? null, error: null };
          },
          then(
            resolve: (v: { data: Record<string, unknown>[]; error: null }) => void,
            reject?: (e: unknown) => void
          ) {
            try {
              resolve({ data: filterEvents(filters), error: null });
            } catch (e) {
              reject?.(e);
            }
          },
        });

        return {
          select() {
            return buildEventChain();
          },
          insert(row: Record<string, unknown>) {
            events.push({
              ...row,
              id: row.id ?? randomUUID(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
            return { error: null };
          },
          update(patch: Record<string, unknown>) {
            return {
              eq(col: string, val: string) {
                return {
                  eq(col2: string, val2: string) {
                    return {
                      then(resolve: (v: { error: null }) => void) {
                        const row = events.find((r) => r[col] === val && r[col2] === val2);
                        if (row) Object.assign(row, patch);
                        resolve({ error: null });
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === "fi_calendar_sync_review_items") {
        const buildReview = (filters: Record<string, unknown> = {}) => ({
          eq(col: string, val: unknown) {
            filters[col] = val;
            return buildReview(filters);
          },
          maybeSingle: async () => {
            const row = reviewItems.find((r) => Object.entries(filters).every(([k, v]) => r[k] === v));
            return { data: row ?? null, error: null };
          },
          single: async () => {
            const row = reviewItems.find((r) => Object.entries(filters).every(([k, v]) => r[k] === v));
            return { data: row ?? null, error: row ? null : { message: "not found" } };
          },
          select: () => buildReview(),
        });
        return {
          select() {
            return buildReview();
          },
          insert(row: Record<string, unknown>) {
            const item = { id: randomUUID(), ...row, created_at: new Date().toISOString() };
            reviewItems.push(item);
            return {
              select() {
                return { single: async () => ({ data: item, error: null }) };
              },
            };
          },
          update(patch: Record<string, unknown>) {
            return {
              eq() {
                return { select: () => ({ single: async () => ({ data: { ...patch }, error: null }) }) };
              },
            };
          },
        };
      }

      throw new Error(`unexpected table ${table}`);
    },
  };

  const eventBus = createFiEventBusMockTables();
  const clientWithBus = client as unknown as SupabaseClient;
  attachFiEventBusMockToClient(clientWithBus, eventBus);

  return {
    client: clientWithBus,
    gc9,
    eventBus,
    integrations,
    events,
    reviewItems,
  };
}
