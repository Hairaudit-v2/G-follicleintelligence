/**
 * Storage path convention (server-owned):
 * `tenant/{tenantId}/patients/{patientId}/{imageId}-{safeFilename}`
 */

export function buildSafePatientImageFilename(originalFilename: string | null | undefined): string {
  const raw = (originalFilename ?? "image").split(/[/\\]/).pop() ?? "image";
  const cleaned = raw.replace(/[^\w.\-]+/g, "_").replace(/^_+|_+$/g, "");
  const base = cleaned.length > 0 ? cleaned : "image";
  return base.slice(0, 180);
}

export function buildPatientImageStoragePath(params: {
  tenantId: string;
  patientId: string;
  imageId: string;
  safeFilename: string;
}): string {
  const tid = params.tenantId.trim();
  const pid = params.patientId.trim();
  const iid = params.imageId.trim();
  const fn = params.safeFilename.trim() || "image";
  return `tenant/${tid}/patients/${pid}/${iid}-${fn}`;
}

export type PatientImageDerivativeVariant = "watermarked" | "marketing" | "internal";

export function buildPatientImageDerivativeStoragePath(params: {
  tenantId: string;
  patientId: string;
  imageId: string;
  safeFilename: string;
  variant: PatientImageDerivativeVariant;
}): string {
  const tid = params.tenantId.trim();
  const pid = params.patientId.trim();
  const iid = params.imageId.trim();
  const fn = params.safeFilename.trim() || "image";
  const suffix =
    params.variant === "watermarked"
      ? "watermarked"
      : params.variant === "marketing"
        ? "marketing"
        : "internal-attributed";
  return `tenant/${tid}/patients/${pid}/${iid}-${suffix}-${fn}`;
}
