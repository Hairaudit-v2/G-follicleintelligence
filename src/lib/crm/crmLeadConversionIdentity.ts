import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeEmail, isPlaceholderEmail } from "@/src/lib/fi/foundation/normalize";

export type PersonIdentitySignals = {
  emailNormalized: string | null;
  phoneDigits: string | null;
};

/** Digits only for loose phone equality within a tenant. */
export function normalizePhoneDigits(value: string | null | undefined): string | null {
  if (value == null || typeof value !== "string") return null;
  const d = value.replace(/\D/g, "");
  return d.length >= 6 ? d : null;
}

export function extractPersonIdentitySignals(personMetadata: Record<string, unknown> | null | undefined): PersonIdentitySignals {
  const m = personMetadata && typeof personMetadata === "object" && !Array.isArray(personMetadata) ? personMetadata : {};
  const fromNorm = typeof m.email_normalized === "string" ? m.email_normalized.trim().toLowerCase() : null;
  const emailFromField = normalizeEmail(typeof m.email === "string" ? m.email : null);
  let emailNormalized = fromNorm && fromNorm.length ? fromNorm : emailFromField;
  if (emailNormalized && isPlaceholderEmail(emailNormalized)) {
    emailNormalized = null;
  }
  const phoneRaw = typeof m.phone === "string" ? m.phone : null;
  return {
    emailNormalized: emailNormalized,
    phoneDigits: normalizePhoneDigits(phoneRaw),
  };
}

/**
 * Loads tenant persons and returns distinct person ids whose metadata matches the given email.
 * Excludes placeholder emails.
 */
export async function findPersonIdsWithEmailInTenant(
  supabase: SupabaseClient,
  tenantId: string,
  emailNormalized: string | null
): Promise<string[]> {
  if (!emailNormalized || isPlaceholderEmail(emailNormalized)) return [];
  const { data, error } = await supabase.from("fi_persons").select("id, metadata").eq("tenant_id", tenantId.trim());
  if (error) throw new Error(error.message);
  const ids = new Set<string>();
  for (const row of data ?? []) {
    const r = row as { id: string; metadata: unknown };
    const m = r.metadata as Record<string, unknown> | undefined;
    const en = typeof m?.email_normalized === "string" ? m.email_normalized.trim().toLowerCase() : null;
    const fallback = normalizeEmail(typeof m?.email === "string" ? m.email : null);
    const match = (en && en === emailNormalized) || (fallback && fallback === emailNormalized);
    if (match) ids.add(String(r.id));
  }
  return Array.from(ids);
}

export async function findPersonIdsWithPhoneDigitsInTenant(
  supabase: SupabaseClient,
  tenantId: string,
  phoneDigits: string | null
): Promise<string[]> {
  if (!phoneDigits) return [];
  const { data, error } = await supabase.from("fi_persons").select("id, metadata").eq("tenant_id", tenantId.trim());
  if (error) throw new Error(error.message);
  const ids = new Set<string>();
  for (const row of data ?? []) {
    const r = row as { id: string; metadata: unknown };
    const m = r.metadata as Record<string, unknown> | undefined;
    const p = typeof m?.phone === "string" ? m.phone : null;
    const pd = normalizePhoneDigits(p);
    if (pd && pd === phoneDigits) ids.add(String(r.id));
  }
  return Array.from(ids);
}

/**
 * Throws when email/phone resolution maps to zero or multiple persons other than the lead person.
 * Pure: pass precomputed id lists from {@link findPersonIdsWithEmailInTenant} / {@link findPersonIdsWithPhoneDigitsInTenant}.
 */
export function assertIdentityMatchesLeadPersonOnly(leadPersonId: string, emailIds: string[], phoneIds: string[]): void {
  const lid = leadPersonId.trim();
  const union = new Set<string>([...emailIds, ...phoneIds]);
  if (union.size > 1) {
    throw new Error(
      "Multiple person records in this tenant match the same email or phone. Resolve duplicates manually before converting."
    );
  }
  if (union.size === 1) {
    const only = Array.from(union)[0];
    if (only !== lid) {
      throw new Error(
        "This lead's contact details match a different person record in this tenant. Resolve the link manually before converting."
      );
    }
  }
}

export async function assertNoAmbiguousPersonIdentityInTenant(
  supabase: SupabaseClient,
  tenantId: string,
  leadPersonId: string,
  signals: PersonIdentitySignals
): Promise<void> {
  const emailIds = await findPersonIdsWithEmailInTenant(supabase, tenantId, signals.emailNormalized);
  const phoneIds = await findPersonIdsWithPhoneDigitsInTenant(supabase, tenantId, signals.phoneDigits);
  assertIdentityMatchesLeadPersonOnly(leadPersonId, emailIds, phoneIds);
}
