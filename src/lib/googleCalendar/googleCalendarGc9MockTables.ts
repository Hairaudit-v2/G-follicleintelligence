/**
 * Shared in-memory Supabase table mocks for CalendarOS GC-9 webhook / version tables.
 */
import { randomUUID } from "node:crypto";

import { createGc8MonitoringMockTables } from "./googleCalendarGc8MockTables";

type Row = Record<string, unknown>;

export function createGc9MockTables() {
  const gc8 = createGc8MonitoringMockTables();
  const webhookSubscriptions: Row[] = [];
  const eventVersions: Row[] = [];
  const reconciliationLogs: Row[] = [];

  function applyEqFilters(rows: Row[], filters: Record<string, unknown>): Row[] {
    return rows.filter((row) =>
      Object.entries(filters).every(([col, val]) => {
        if (val && typeof val === "object" && "is" in (val as Record<string, unknown>)) {
          const isVal = (val as { is: unknown }).is;
          if (isVal === null) return row[col] == null;
        }
        if (val && typeof val === "object" && "lt" in (val as Record<string, unknown>)) {
          const ltVal = (val as { lt: unknown }).lt;
          return String(row[col] ?? "") < String(ltVal ?? "");
        }
        if (val && typeof val === "object" && "lte" in (val as Record<string, unknown>)) {
          const lteVal = (val as { lte: unknown }).lte;
          return String(row[col] ?? "") <= String(lteVal ?? "");
        }
        return row[col] === val;
      })
    );
  }

  function buildGenericChain(rows: Row[], filters: Record<string, unknown> = {}) {
    const terminal = {
      limit(n: number) {
        return {
          maybeSingle: async () => {
            const matched = applyEqFilters(rows, filters).slice(0, n);
            return { data: matched[0] ?? null, error: null };
          },
        };
      },
      maybeSingle: async () => {
        const matched = applyEqFilters(rows, filters);
        return { data: matched[0] ?? null, error: null };
      },
      single: async () => {
        const matched = applyEqFilters(rows, filters);
        if (!matched[0]) return { data: null, error: { message: "not found" } };
        return { data: matched[0], error: null };
      },
      order(_col: string, opts?: { ascending?: boolean }) {
        const sorted = [...applyEqFilters(rows, filters)].sort((a, b) => {
          const av = String(a[_col] ?? "");
          const bv = String(b[_col] ?? "");
          return opts?.ascending === false ? bv.localeCompare(av) : av.localeCompare(bv);
        });
        return {
          limit(n: number) {
            return {
              maybeSingle: async () => ({ data: sorted.slice(0, n)[0] ?? null, error: null }),
              range(from: number, to: number) {
                return Promise.resolve({ data: sorted.slice(from, to + 1), error: null });
              },
              then(
                resolve: (v: { data: Row[]; error: null }) => void,
                reject?: (e: unknown) => void
              ) {
                try {
                  resolve({ data: sorted.slice(0, n), error: null });
                } catch (e) {
                  reject?.(e);
                }
              },
            };
          },
          range(from: number, to: number) {
            return Promise.resolve({ data: sorted.slice(from, to + 1), error: null });
          },
        };
      },
      then(resolve: (v: { data: Row[]; error: null }) => void, reject?: (e: unknown) => void) {
        try {
          resolve({ data: applyEqFilters(rows, filters), error: null });
        } catch (e) {
          reject?.(e);
        }
      },
    };

    const chain = {
      eq(col: string, val: unknown) {
        filters[col] = val;
        return buildGenericChain(rows, filters);
      },
      lt(col: string, val: unknown) {
        filters[col] = { lt: val };
        return buildGenericChain(rows, filters);
      },
      lte(col: string, val: unknown) {
        filters[col] = { lte: val };
        return buildGenericChain(rows, filters);
      },
      select(_cols?: string) {
        return buildGenericChain(rows, filters);
      },
      insert(row: Row | Row[]) {
        const rowsToInsert = Array.isArray(row) ? row : [row];
        const inserted: Row[] = [];
        for (const item of rowsToInsert) {
          const full = {
            id: item.id ?? randomUUID(),
            failure_count: 0,
            metadata: {},
            ...item,
            created_at: item.created_at ?? new Date().toISOString(),
            updated_at: item.updated_at ?? new Date().toISOString(),
          };
          rows.push(full);
          inserted.push(full);
        }
        return {
          error: null,
          select() {
            return {
              single: async () => ({
                data: inserted[0] ?? null,
                error: inserted[0] ? null : { message: "not found" },
              }),
            };
          },
        };
      },
      update(patch: Row) {
        return {
          eq(col: string, val: unknown) {
            const matched = rows.filter((r) => r[col] === val);
            matched.forEach((r) =>
              Object.assign(r, patch, { updated_at: new Date().toISOString() })
            );
            return {
              select() {
                return {
                  single: async () => ({
                    data: matched[0] ?? null,
                    error: matched[0] ? null : { message: "not found" },
                  }),
                };
              },
              then(resolve: (v: { error: null }) => void) {
                resolve({ error: null });
              },
            };
          },
        };
      },
      ...terminal,
    };

    return chain;
  }

  return {
    gc8,
    webhookSubscriptions,
    eventVersions,
    reconciliationLogs,
    tableHandler(table: string) {
      if (table === "fi_calendar_webhook_subscriptions")
        return buildGenericChain(webhookSubscriptions);
      if (table === "fi_calendar_event_versions") return buildGenericChain(eventVersions);
      if (table === "fi_calendar_reconciliation_logs") return buildGenericChain(reconciliationLogs);
      const gc8Handler = gc8.tableHandler(table);
      if (gc8Handler) return gc8Handler;
      return null;
    },
  };
}
