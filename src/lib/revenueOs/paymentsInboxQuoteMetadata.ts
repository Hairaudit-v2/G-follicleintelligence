/** Shared helpers for Payments inbox quote linkage (importable from tests without `server-only`). */

export function readCrmQuoteIdFromObjectMetadata(meta: Record<string, unknown> | null | undefined): string | null {
  const v = meta?.crm_quote_id;
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) return null;
  return s;
}
