function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Human-readable title for a CRM quote row (matches case pipeline card behaviour). */
export function crmQuoteDisplayTitle(metadata: Record<string, unknown>, lineItemsSnapshot: unknown): string {
  const t = typeof metadata.quote_title === "string" ? metadata.quote_title.trim() : "";
  if (t) return t;
  if (Array.isArray(lineItemsSnapshot) && lineItemsSnapshot[0] && typeof lineItemsSnapshot[0] === "object") {
    const li = lineItemsSnapshot[0] as { title?: string };
    if (typeof li.title === "string" && li.title.trim()) return li.title.trim();
  }
  return "Quote";
}

export function crmQuoteTitleFromRowLike(row: {
  metadata?: unknown;
  line_items_snapshot?: unknown;
}): string {
  const meta = asRecord(row.metadata);
  return crmQuoteDisplayTitle(meta, row.line_items_snapshot);
}
