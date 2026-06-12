/**
 * Best-effort parse of free-text quote amounts (e.g. "$12,500 AUD", "12500") to integer cents.
 * Returns null when no numeric value can be inferred — caller must not invent clinical/financial amounts.
 */
export function parseMoneyStringToCentsAud(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s0 = String(raw).trim();
  if (!s0) return null;
  const lowered = s0.toLowerCase();
  const stripped = lowered.replace(/aud|nz|usd|gbp|eur/gi, "").replace(/[$€£,\s]/g, "").trim();
  if (!stripped) return null;
  const n = Number.parseFloat(stripped);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
