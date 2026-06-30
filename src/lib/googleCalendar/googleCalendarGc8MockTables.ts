/**
 * Shared in-memory Supabase table mocks for CalendarOS GC-8 monitoring tables.
 */
import { randomUUID } from "node:crypto";

type Row = Record<string, unknown>;

export function createGc8MonitoringMockTables() {
  const syncHealth: Row[] = [];
  const syncRuns: Row[] = [];
  const adminNotifications: Row[] = [];
  const reviewItems: Row[] = [];
  const webhookSubscriptions: Row[] = [];

  function applyEqFilters(rows: Row[], filters: Record<string, unknown>): Row[] {
    return rows.filter((row) =>
      Object.entries(filters).every(([col, val]) => {
        if (val && typeof val === "object" && "is" in (val as Record<string, unknown>)) {
          const isVal = (val as { is: unknown }).is;
          if (isVal === null) return row[col] == null;
        }
        if (val && typeof val === "object" && "lt" in (val as Record<string, unknown>)) {
          return String(row[col] ?? "") < String((val as { lt: unknown }).lt ?? "");
        }
        if (val && typeof val === "object" && "lte" in (val as Record<string, unknown>)) {
          return String(row[col] ?? "") <= String((val as { lte: unknown }).lte ?? "");
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
          range(from: number, to: number) {
            return Promise.resolve({
              data: applyEqFilters(rows, filters).slice(from, to + 1),
              error: null,
            });
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
          then(resolve: (v: { data: Row[]; error: null }) => void, reject?: (e: unknown) => void) {
            try {
              resolve({ data: sorted, error: null });
            } catch (e) {
              reject?.(e);
            }
          },
        };
      },
      then(
        resolve: (v: { data: Row[]; error: null; count?: number }) => void,
        reject?: (e: unknown) => void
      ) {
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
      is(col: string, val: unknown) {
        filters[col] = { is: val };
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
      select(_cols?: string, opts?: { count?: string; head?: boolean }) {
        if (opts?.head) {
          const countChain = (filters: Record<string, unknown> = {}) => ({
            eq(col: string, val: unknown) {
              filters[col] = val;
              return countChain(filters);
            },
            then(
              resolve: (v: { count: number; error: null }) => void,
              reject?: (e: unknown) => void
            ) {
              try {
                resolve({ count: applyEqFilters(rows, filters).length, error: null });
              } catch (e) {
                reject?.(e);
              }
            },
          });
          return countChain();
        }
        return buildGenericChain(rows, filters);
      },
      insert(row: Row | Row[]) {
        const rowsToInsert = Array.isArray(row) ? row : [row];
        const inserted: Row[] = [];
        for (const item of rowsToInsert) {
          const full = {
            id: item.id ?? randomUUID(),
            consecutive_failures: 0,
            total_sync_runs: 0,
            total_events_fetched: 0,
            total_events_inserted: 0,
            total_events_updated: 0,
            total_events_skipped: 0,
            total_review_items_created: 0,
            health_score: 100,
            health_status: "healthy",
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
      delete() {
        return {
          in(col: string, vals: string[]) {
            for (let i = rows.length - 1; i >= 0; i -= 1) {
              if (vals.includes(String(rows[i][col]))) rows.splice(i, 1);
            }
            return Promise.resolve({ error: null });
          },
        };
      },
      ...terminal,
    };

    return chain;
  }

  return {
    syncHealth,
    syncRuns,
    adminNotifications,
    reviewItems,
    webhookSubscriptions,
    tableHandler(table: string) {
      if (table === "fi_calendar_sync_health") return buildGenericChain(syncHealth);
      if (table === "fi_calendar_sync_runs") return buildGenericChain(syncRuns);
      if (table === "fi_admin_notifications") return buildGenericChain(adminNotifications);
      if (table === "fi_calendar_sync_review_items") return buildGenericChain(reviewItems);
      if (table === "fi_calendar_webhook_subscriptions")
        return buildGenericChain(webhookSubscriptions);
      return null;
    },
  };
}

export function withGc8IntegrationDefaults(row: Record<string, unknown>): Record<string, unknown> {
  return {
    sync_enabled: true,
    scheduled_sync_enabled: true,
    sync_frequency_minutes: 15,
    scheduled_sync_paused_at: null,
    scheduled_sync_paused_reason: null,
    realtime_sync_enabled: false,
    ...row,
  };
}
