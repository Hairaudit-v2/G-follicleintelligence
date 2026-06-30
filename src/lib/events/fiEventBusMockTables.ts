/**
 * In-memory Supabase mocks for FI Platform Event Bus tables (GC-10 tests).
 */
import { randomUUID } from "node:crypto";

type Row = Record<string, unknown>;

function getRowValue(row: Row, col: string): unknown {
  if (col.includes("->>")) {
    const [field, jsonKey] = col.split("->>");
    const base = row[field.trim()];
    if (base && typeof base === "object" && !Array.isArray(base)) {
      return (base as Record<string, unknown>)[jsonKey.trim()] ?? null;
    }
    return null;
  }
  return row[col];
}

function applyFilters(rows: Row[], filters: Record<string, unknown>): Row[] {
  return rows.filter((row) =>
    Object.entries(filters).every(([col, val]) => {
      if (val && typeof val === "object" && "is" in (val as Record<string, unknown>)) {
        return getRowValue(row, col) == null;
      }
      if (val && typeof val === "object" && "in" in (val as Record<string, unknown>)) {
        const allowed = (val as { in: unknown[] }).in;
        return allowed.includes(getRowValue(row, col));
      }
      if (val && typeof val === "object" && "gte" in (val as Record<string, unknown>)) {
        return String(getRowValue(row, col) ?? "") >= String((val as { gte: unknown }).gte ?? "");
      }
      if (val && typeof val === "object" && "lte" in (val as Record<string, unknown>)) {
        return String(getRowValue(row, col) ?? "") <= String((val as { lte: unknown }).lte ?? "");
      }
      if (val && typeof val === "object" && "not" in (val as Record<string, unknown>)) {
        const notVal = (val as { not: unknown }).not;
        if (notVal && typeof notVal === "object" && "is" in (notVal as Record<string, unknown>)) {
          return getRowValue(row, col) != null;
        }
      }
      return getRowValue(row, col) === val;
    })
  );
}

export function createFiEventBusMockTables() {
  const events: Row[] = [];
  const subscribers: Row[] = [];
  const deliveries: Row[] = [];
  const analyticsEvents: Row[] = [];
  const adminNotifications: Row[] = [];
  let analyticsInsertShouldFail = false;
  let eventsInsertShouldFail = false;
  const idempotencyKeys = new Set<string>();

  function buildChain(
    rows: Row[],
    filters: Record<string, unknown> = {},
    opts?: { countOnly?: boolean }
  ) {
    const terminal = {
      maybeSingle: async () => {
        const matched = applyFilters(rows, filters);
        return { data: matched[0] ?? null, error: null, count: matched.length };
      },
      single: async () => {
        const matched = applyFilters(rows, filters);
        if (!matched[0]) return { data: null, error: { message: "not found" } };
        return { data: matched[0], error: null };
      },
      limit(n: number) {
        return {
          maybeSingle: async () => {
            const matched = applyFilters(rows, filters).slice(0, n);
            return { data: matched[0] ?? null, error: null };
          },
          then(resolve: (v: { data: Row[]; error: null }) => void, reject?: (e: unknown) => void) {
            try {
              resolve({ data: applyFilters(rows, filters).slice(0, n), error: null });
            } catch (e) {
              reject?.(e);
            }
          },
        };
      },
      order(_col: string, sortOpts?: { ascending?: boolean }) {
        const sorted = [...applyFilters(rows, filters)].sort((a, b) => {
          const av = String(a[_col] ?? "");
          const bv = String(b[_col] ?? "");
          return sortOpts?.ascending === false ? bv.localeCompare(av) : av.localeCompare(bv);
        });
        return {
          limit(n: number) {
            return {
              maybeSingle: async () => ({ data: sorted.slice(0, n)[0] ?? null, error: null }),
              then(resolve: (v: { data: Row[]; error: null }) => void) {
                resolve({ data: sorted.slice(0, n), error: null });
              },
            };
          },
          then(resolve: (v: { data: Row[]; error: null }) => void) {
            resolve({ data: sorted, error: null });
          },
        };
      },
      then(resolve: (v: { data: Row[] | null; error: null; count?: number }) => void) {
        const matched = applyFilters(rows, filters);
        if (opts?.countOnly) {
          resolve({ data: null, error: null, count: matched.length });
          return;
        }
        resolve({ data: matched, error: null, count: matched.length });
      },
    };

    const chain = {
      eq(col: string, val: unknown) {
        filters[col] = val;
        return buildChain(rows, filters, opts);
      },
      gte(col: string, val: unknown) {
        filters[col] = { gte: val };
        return buildChain(rows, filters, opts);
      },
      lte(col: string, val: unknown) {
        filters[col] = { lte: val };
        return buildChain(rows, filters, opts);
      },
      in(col: string, val: unknown[]) {
        filters[col] = { in: val };
        return buildChain(rows, filters, opts);
      },
      is(col: string, val: null) {
        filters[col] = { is: val };
        return buildChain(rows, filters, opts);
      },
      not(col: string, val: unknown) {
        filters[col] = { not: val };
        return buildChain(rows, filters, opts);
      },
      select(_cols?: string, selectOpts?: { count?: string; head?: boolean }) {
        const countOnly = selectOpts?.count === "exact" && selectOpts?.head === true;
        return buildChain(rows, filters, { countOnly });
      },
      insert(row: Row | Row[]) {
        const rowsToInsert = Array.isArray(row) ? row : [row];
        const inserted: Row[] = [];

        for (const item of rowsToInsert) {
          if (rows === events) {
            if (eventsInsertShouldFail) {
              return { error: { message: "event_bus_unavailable" } };
            }
            const key = String((item.metadata as Row | undefined)?.idempotencyKey ?? "");
            if (key && idempotencyKeys.has(`${item.tenant_id}:${item.event_name}:${key}`)) {
              return { error: { code: "23505", message: "duplicate idempotency" } };
            }
            if (key) idempotencyKeys.add(`${item.tenant_id}:${item.event_name}:${key}`);
          }

          if (rows === analyticsEvents && analyticsInsertShouldFail) {
            return {
              select() {
                return {
                  single: async () => ({ data: null, error: { message: "analytics_unavailable" } }),
                };
              },
            };
          }

          const full = {
            id: item.id ?? randomUUID(),
            failure_count: 0,
            metadata: {},
            payload: {},
            processing_status: "pending",
            attempt_count: 0,
            status: "pending",
            is_enabled: true,
            retry_limit: 3,
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
              eq(col2: string, val2: unknown) {
                const narrowed = matched.filter((r) => r[col2] === val2);
                narrowed.forEach((r) =>
                  Object.assign(r, patch, { updated_at: new Date().toISOString() })
                );
                return Promise.resolve({ error: null });
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
    events,
    subscribers,
    deliveries,
    analyticsEvents,
    adminNotifications,
    setAnalyticsInsertShouldFail(value: boolean) {
      analyticsInsertShouldFail = value;
    },
    setEventsInsertShouldFail(value: boolean) {
      eventsInsertShouldFail = value;
    },
    tableHandler(table: string) {
      if (table === "fi_platform_events") return buildChain(events);
      if (table === "fi_platform_event_subscribers") return buildChain(subscribers);
      if (table === "fi_platform_event_deliveries") return buildChain(deliveries);
      if (table === "fi_analytics_events") return buildChain(analyticsEvents);
      if (table === "fi_admin_notifications") return buildChain(adminNotifications);
      return null;
    },
  };
}

export function attachFiEventBusMockToClient(
  client: { from: (table: string) => unknown },
  bus: ReturnType<typeof createFiEventBusMockTables>
) {
  const originalFrom = client.from.bind(client);
  client.from = (table: string) => {
    const handler = bus.tableHandler(table);
    if (handler) return handler;
    return originalFrom(table);
  };
  return client;
}
