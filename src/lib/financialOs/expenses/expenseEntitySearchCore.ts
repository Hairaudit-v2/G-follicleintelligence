/** Pure helpers for expense entity link display (no I/O). */

export function formatExpenseLinkSummary(input: {
  campaignKey?: string | null;
  leadId?: string | null;
  caseId?: string | null;
}): string {
  const parts: string[] = [];
  if (input.campaignKey?.trim()) parts.push(`campaign:${input.campaignKey.trim()}`);
  if (input.leadId?.trim()) parts.push(`lead:${input.leadId.trim().slice(0, 8)}`);
  if (input.caseId?.trim()) parts.push(`case:${input.caseId.trim().slice(0, 8)}`);
  return parts.length ? parts.join(" · ") : "—";
}

export function filterCampaignKeys(keys: readonly string[], query: string, limit = 20): string[] {
  const q = query.trim().toLowerCase();
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of keys) {
    const k = raw.trim();
    if (!k || seen.has(k)) continue;
    if (q && !k.toLowerCase().includes(q)) continue;
    seen.add(k);
    out.push(k);
    if (out.length >= limit) break;
  }
  return out;
}
