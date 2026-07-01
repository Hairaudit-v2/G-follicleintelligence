export const PATIENT_PORTAL_RELEASE_STATUSES = ["held", "released"] as const;

export type PatientPortalReleaseStatus = (typeof PATIENT_PORTAL_RELEASE_STATUSES)[number];

export function normalizePatientPortalReleaseStatus(
  value: unknown,
  fallback: PatientPortalReleaseStatus = "held"
): PatientPortalReleaseStatus {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  return raw === "released" ? "released" : fallback;
}

export function isPatientPortalReleased(status: PatientPortalReleaseStatus): boolean {
  return status === "released";
}