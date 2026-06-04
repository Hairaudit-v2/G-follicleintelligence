/**
 * Pure string normalization for foundation resolution (no I/O).
 * Safe to unit-test without Supabase.
 */

/** Lowercase, trim, collapse internal whitespace (for conservative name matching). */
export function normalizeWhitespaceName(value: string | undefined | null): string | null {
  if (value == null || typeof value !== "string") return null;
  const t = value.trim().replace(/\s+/g, " ");
  return t.length ? t.toLowerCase() : null;
}

/** Trim + lowercase email for equality checks within a tenant. */
export function normalizeEmail(value: string | undefined | null): string | null {
  if (value == null || typeof value !== "string") return null;
  const t = value.trim().toLowerCase();
  return t.length ? t : null;
}

/** True when local part is obviously a placeholder (do not use for merge). */
export function isPlaceholderEmail(email: string | null | undefined): boolean {
  const n = normalizeEmail(email);
  if (!n) return true;
  return n.endsWith("@local.invalid") || n.endsWith("@example.com") || n.endsWith("@test.invalid");
}
