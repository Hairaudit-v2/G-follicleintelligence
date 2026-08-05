/**
 * Email / phone normalisation for calendar identity matching.
 * Reuses foundation email rules; phone is digit-normalised (≥8 digits).
 */

import { normalizeEmail, isPlaceholderEmail } from "@/src/lib/fi/foundation/normalize";

export { normalizeEmail, isPlaceholderEmail };

/** Digits only; null when fewer than 8 digits.
 * Australian mobiles are normalised to E.164-without-plus `61…`:
 * - `0421412307` → `61421412307`
 * - `421412307`  → `61421412307`  (SMS: forms without leading 0)
 * - `+61421412307` → `61421412307`
 */
export function normalizeCalendarIdentityPhone(value: string | null | undefined): string | null {
  if (value == null || typeof value !== "string") return null;
  let digits = value.replace(/\D/g, "");
  if (digits.length < 8) return null;

  if (digits.startsWith("61") && digits.length >= 11) {
    // already country-coded
  } else if (digits.length === 10 && digits.startsWith("04")) {
    digits = `61${digits.slice(1)}`;
  } else if (digits.length === 9 && digits.startsWith("4")) {
    // AU mobile without leading 0 (common in clinic SMS labels).
    digits = `61${digits}`;
  }

  return digits.length >= 8 ? digits : null;
}

/** Verified usable email for auto exact-match (rejects placeholders). */
export function verifiedCalendarIdentityEmail(value: string | null | undefined): string | null {
  const n = normalizeEmail(value);
  if (!n || isPlaceholderEmail(n)) return null;
  return n;
}
