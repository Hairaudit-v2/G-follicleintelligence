/** Split HubSpot "Associated Deal IDs" cell (comma / semicolon / pipe separated). */

export function splitHubspotDealIds(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return Array.from(new Set(raw.split(/[;,|]/).map((s) => s.trim()).filter(Boolean)));
}
