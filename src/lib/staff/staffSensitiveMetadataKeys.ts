/** Shared sensitive metadata keys blocked at HR/workforce sync boundaries. */

export const STAFF_SENSITIVE_METADATA_KEYS = [
  "bank",
  "bank_details",
  "tfn",
  "taxfilenumber",
  "tax_file_number",
  "tax_details",
  "super",
  "super_details",
  "dob",
  "date_of_birth",
  "address",
  "home_address",
  "pay_rate",
  "rate",
  "salary",
  "tax_information",
  "contracts",
  "offer_letters",
  "hr_letters",
  "identity_documents",
  "private_notes",
] as const;

export function isStaffSensitiveMetadataKey(key: string): boolean {
  const lower = key.toLowerCase();
  return STAFF_SENSITIVE_METADATA_KEYS.some((k) => lower === k);
}

export function parseIsoStaffMetadataDate(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return undefined;
  return new Date(t).toISOString();
}
