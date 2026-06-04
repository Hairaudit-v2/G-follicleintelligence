/**
 * Pure display helpers for CRM lead list rows (Stage 2F).
 */

export function personMetadataDisplayLabel(metadata: Record<string, unknown> | null | undefined): string {
  if (!metadata || typeof metadata !== "object") return "—";
  const dn = metadata.display_name;
  if (typeof dn === "string" && dn.trim()) return dn.trim();
  const nd = metadata.normalised_display_name;
  if (typeof nd === "string" && nd.trim()) return nd.trim();
  const em = metadata.email_normalized;
  if (typeof em === "string" && em.trim()) return em.trim();
  return "—";
}

export function leadTitleFromRow(summary: string | null | undefined, leadId: string): string {
  const s = summary?.trim();
  if (s) return s;
  return `Lead ${leadId.slice(0, 8)}…`;
}
