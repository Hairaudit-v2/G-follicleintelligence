import { PATIENT_IMAGES_BUCKET_DEFAULT } from "@/src/lib/patientImages/patientImagePolicy";

export const PATIENT_DOCUMENT_TYPES = ["consent", "other"] as const;
export type PatientDocumentType = (typeof PATIENT_DOCUMENT_TYPES)[number];

export const PATIENT_CONSENT_ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export const PATIENT_CONSENT_MAX_BYTES = 15 * 1024 * 1024;

export const PATIENT_DOCUMENTS_BUCKET_DEFAULT = PATIENT_IMAGES_BUCKET_DEFAULT;

export function buildSafePatientDocumentFilename(originalFilename: string | null | undefined): string {
  const raw = (originalFilename ?? "document").split(/[/\\]/).pop() ?? "document";
  const cleaned = raw.replace(/[^\w.\-]+/g, "_").replace(/^_+|_+$/g, "");
  const base = cleaned.length > 0 ? cleaned : "document";
  return base.slice(0, 180);
}

export function buildPatientDocumentStoragePath(params: {
  tenantId: string;
  patientId: string;
  documentId: string;
  documentType: PatientDocumentType;
  safeFilename: string;
}): string {
  const tid = params.tenantId.trim();
  const pid = params.patientId.trim();
  const did = params.documentId.trim();
  const fn = params.safeFilename.trim() || "document";
  const type = params.documentType.trim() || "consent";
  return `tenant/${tid}/patients/${pid}/documents/${type}/${did}-${fn}`;
}

export function isPatientConsentContentType(contentType: string): boolean {
  const ct = contentType.trim().toLowerCase();
  return (PATIENT_CONSENT_ALLOWED_CONTENT_TYPES as readonly string[]).includes(ct);
}