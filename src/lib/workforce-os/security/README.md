# WorkforceOS tenant-scoping guard (WORKFORCE-GUARD-1)

WorkforceOS reads and writes with the Supabase **service-role** client (`supabaseAdmin()`).
The service-role key **bypasses Row Level Security**, so RLS is only a backstop here — tenant
isolation depends on every query carrying a `tenant_id` guarantee. A single forgotten filter can
leak another clinic's staff, payroll, credential or compliance data.

## The rule

Every WorkforceOS service-role query on a tenant-owned table must satisfy **one** of:

1. **Use the helper** — `workforceTenantClient(tenantId)` from
   [`tenantScopedQuery.server.ts`](./tenantScopedQuery.server.ts). Its `list` / `byId` / `insert` /
   `update` / `upsert` / `remove` methods inject `tenant_id` for you.
2. **Carry an explicit `tenant_id`** in the same statement (e.g. `.eq("tenant_id", tid)` or a
   `tenant_id:` column in an insert payload). Existing hand-scoped queries are fine.
3. **Be justified inline** with a `// tenant-guard-allow: <reason>` comment placed on/near the query.
   Use this only for genuinely cross-tenant work (e.g. a cron that enumerates all tenants) or global
   reference tables that have no `tenant_id` column.

Inserts through the helper **force `tenant_id` from the trusted, server-resolved `tenantId`** and
**strip any caller-supplied `tenant_id`** — a request payload can never redirect a write to another
tenant. Never derive `tenant_id` from a request body; resolve it from the authenticated
session/route context (e.g. `resolveHrOsRouteAccess`) first.

## Enforcement

[`tenantScopingGuard.test.ts`](./tenantScopingGuard.test.ts) statically scans
`src/lib/workforce`, `src/lib/workforce-os` and the WorkforceOS action files. It **fails** when it
finds a `.from("<table>")` service-role query with none of the three guarantees above. It runs as
part of `pnpm test:unit`.

If the guard fails on a new query: add a `tenant_id` filter (prefer `workforceTenantClient`), or —
only if tenant scoping genuinely does not apply — annotate it with `// tenant-guard-allow: <reason>`.

## Notes / limits

- The scanner is a pragmatic text check, not a full AST analysis. It matches `.from("literal")`
  calls; helper calls use `.from(<variable>)` internally and are inherently excluded.
- It does not (yet) analyse `.from(<variableTable>)` call sites. Prefer string-literal table names
  or the helper so queries stay analysable.
- RLS on the underlying tables and the existing action/route gates remain in force — this guard is an
  additional layer, not a replacement.
