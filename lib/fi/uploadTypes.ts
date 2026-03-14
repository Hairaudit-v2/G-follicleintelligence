/**
 * Canonical upload types for Follicle Intelligence.
 * patient_photo:<key> style - strict typing, no category mismatch.
 */

export const FI_UPLOAD_TYPES = [
  "blood_pdf",
  "blood_csv",
  "scalp_preop_front",
  "scalp_sides_left",
  "scalp_sides_right",
  "scalp_crown",
  "donor_rear",
  "postop_day0",
  "supporting_docs",
] as const;

export type FiUploadType = (typeof FI_UPLOAD_TYPES)[number];

const ALIASES: Record<string, FiUploadType> = {
  blood: "blood_pdf",
  "blood-pdf": "blood_pdf",
  blood_pdf: "blood_pdf",
  bloodpdf: "blood_pdf",
  "blood-csv": "blood_csv",
  bloodcsv: "blood_csv",
  csv: "blood_csv",
  scalp: "scalp_preop_front",
  front: "scalp_preop_front",
  preop: "scalp_preop_front",
  scalp_preop_front: "scalp_preop_front",
  left: "scalp_sides_left",
  scalp_sides_left: "scalp_sides_left",
  right: "scalp_sides_right",
  scalp_sides_right: "scalp_sides_right",
  crown: "scalp_crown",
  scalp_crown: "scalp_crown",
  donor: "donor_rear",
  donor_rear: "donor_rear",
  postop: "postop_day0",
  day0: "postop_day0",
  postop_day0: "postop_day0",
  docs: "supporting_docs",
  supporting: "supporting_docs",
  supporting_docs: "supporting_docs",
};

/**
 * Normalize user input to canonical FiUploadType.
 * Returns supporting_docs for unknown values (safe fallback).
 */
export function normalizeFiUploadType(input: unknown): FiUploadType {
  const s = String(input ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");
  const canonical = ALIASES[s];
  if (canonical) return canonical;
  if (FI_UPLOAD_TYPES.includes(s as FiUploadType)) return s as FiUploadType;
  return "supporting_docs";
}

/**
 * Build canonical storage path: tenants/{tenantId}/cases/{caseId}/{type}/{filename}
 * Prefixes timestamp to avoid overwrites when multiple files share name/type.
 */
export function buildFiUploadPath(
  tenantId: string,
  caseId: string,
  type: FiUploadType,
  filename: string
): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return `tenants/${tenantId}/cases/${caseId}/${type}/${Date.now()}-${safe}`;
}

/** MIME types and size limits per upload type */
export const FI_UPLOAD_LIMITS: Record<FiUploadType, { mimeTypes: string[]; maxBytes: number }> = {
  blood_pdf: {
    mimeTypes: ["application/pdf"],
    maxBytes: 15 * 1024 * 1024,
  },
  blood_csv: {
    mimeTypes: ["text/csv", "application/csv", "text/plain"],
    maxBytes: 5 * 1024 * 1024,
  },
  scalp_preop_front: { mimeTypes: ["image/jpeg", "image/png"], maxBytes: 10 * 1024 * 1024 },
  scalp_sides_left: { mimeTypes: ["image/jpeg", "image/png"], maxBytes: 10 * 1024 * 1024 },
  scalp_sides_right: { mimeTypes: ["image/jpeg", "image/png"], maxBytes: 10 * 1024 * 1024 },
  scalp_crown: { mimeTypes: ["image/jpeg", "image/png"], maxBytes: 10 * 1024 * 1024 },
  donor_rear: { mimeTypes: ["image/jpeg", "image/png"], maxBytes: 10 * 1024 * 1024 },
  postop_day0: { mimeTypes: ["image/jpeg", "image/png"], maxBytes: 10 * 1024 * 1024 },
  supporting_docs: {
    mimeTypes: ["application/pdf", "image/jpeg", "image/png", "text/plain"],
    maxBytes: 15 * 1024 * 1024,
  },
};
