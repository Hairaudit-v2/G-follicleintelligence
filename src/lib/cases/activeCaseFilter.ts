/**
 * Active-case filter for fi_cases queries.
 *
 * Supabase filter: `.is("deleted_at", null)`
 *
 * Apply this to any fi_cases SELECT / existence-check query that should
 * return only non-deleted cases (clinical, patient, CRM, dashboard, surgery,
 * calendar, payment, and audit-rejection views).
 *
 * DO NOT apply in:
 *  - Admin / system integrity checks that must count or inspect all cases
 *    (src/lib/fi/foundation/integrity.ts, src/lib/systemStatus/*)
 *  - Backfill / migration scripts that process the full dataset
 *    (src/lib/fi/foundation/backfillFoundation.ts, scripts/*)
 *  - Event-ingestion mapping that resolves/creates cases from external events
 *    (lib/fi/events/mapping.ts, lib/fi/foundation/resolveCaseFoundation.ts)
 *  - Future recycle-bin or restore-case views
 *
 * Usage:
 *   const q = supabase
 *     .from("fi_cases")
 *     .select(...)
 *     .eq("tenant_id", tid);
 *   withActiveCases(q).eq("id", cid);
 *
 * Or inline:
 *   supabase.from("fi_cases").select(...).eq("tenant_id", tid).is("deleted_at", null)
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFilterBuilder = { is(column: string, value: unknown): any };

/**
 * Appends `.is("deleted_at", null)` to a Supabase fi_cases filter chain.
 * Preserves the builder type for continued chaining.
 */
export function withActiveCases<Q extends AnyFilterBuilder>(query: Q): Q {
  return query.is("deleted_at", null) as Q;
}
