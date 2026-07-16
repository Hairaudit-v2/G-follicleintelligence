/**
 * Canonical patient-profile identity contract (FI-PATIENT-IDENTITY-1).
 *
 * Ordinary clinic surfaces accept only `fi_patients.id` + exact `tenant_id`.
 * No email / fuzzy / lead / first-row fallback.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ResolvePatientProfileInput = {
  tenantId: string;
  /** Must be canonical `fi_patients.id`. */
  patientId: string;
};

export type ResolvePatientProfileErrorCode =
  | "missing_tenant"
  | "missing_patient_id"
  | "invalid_patient_id"
  | "patient_not_found"
  | "person_not_found"
  | "person_tenant_mismatch"
  | "ambiguous_identity"
  | "cross_tenant_denied"
  | "tenant_required";

export type ResolvedPatientProfile = {
  entityType: "patient";
  tenantId: string;
  patientId: string;
  personId: string;
  profileHref: string;
};

export type ResolvePatientProfileSuccess = {
  ok: true;
  data: ResolvedPatientProfile;
};

export type ResolvePatientProfileFailure = {
  ok: false;
  error: ResolvePatientProfileErrorCode;
};

export type ResolvePatientProfileResult =
  | ResolvePatientProfileSuccess
  | ResolvePatientProfileFailure;

export type CanonicalPatientSearchHit = {
  entityType: "patient";
  patientId: string;
  personId: string;
  profileHref: string;
  displayName: string;
  email: string | null;
  phone: string | null;
};

/** Cache / query key for any patient-scoped client or server memoisation. */
export function patientProfileCacheKey(tenantId: string, patientId: string): string {
  return `patient-profile:v1:${tenantId.trim()}:${patientId.trim()}`;
}

export function isUuidLike(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function buildCanonicalPatientProfileHref(tenantId: string, patientId: string): string {
  return `/fi-admin/${tenantId.trim()}/patients/${patientId.trim()}`;
}

export function validateResolvePatientProfileInput(
  input: ResolvePatientProfileInput
): ResolvePatientProfileFailure | null {
  const tenantId = input.tenantId?.trim() ?? "";
  const patientId = input.patientId?.trim() ?? "";
  if (!tenantId) return { ok: false, error: "missing_tenant" };
  if (!patientId) return { ok: false, error: "missing_patient_id" };
  if (!isUuidLike(patientId)) return { ok: false, error: "invalid_patient_id" };
  return null;
}

export function buildResolvedPatientProfile(input: {
  tenantId: string;
  patientId: string;
  personId: string;
}): ResolvedPatientProfile {
  const tenantId = input.tenantId.trim();
  const patientId = input.patientId.trim();
  const personId = input.personId.trim();
  return {
    entityType: "patient",
    tenantId,
    patientId,
    personId,
    profileHref: buildCanonicalPatientProfileHref(tenantId, patientId),
  };
}

export function toCanonicalPatientSearchHit(input: {
  tenantId: string;
  patientId: string;
  personId: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
}): CanonicalPatientSearchHit {
  const tenantId = input.tenantId.trim();
  const patientId = input.patientId.trim();
  const personId = input.personId.trim();
  return {
    entityType: "patient",
    patientId,
    personId,
    profileHref: buildCanonicalPatientProfileHref(tenantId, patientId),
    displayName: input.displayName.trim() || "Patient",
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
  };
}

/**
 * Ordinary clinic patient search always requires an explicit tenant workspace id.
 * Platform admins must proxy into a tenant; they must not search across tenants.
 */
export function assertOrdinaryPatientSearchTenantContext(
  tenantId: string | null | undefined
): { ok: true; tenantId: string } | { ok: false; error: "tenant_required" } {
  const tid = tenantId?.trim() ?? "";
  if (!tid) return { ok: false, error: "tenant_required" };
  return { ok: true, tenantId: tid };
}
