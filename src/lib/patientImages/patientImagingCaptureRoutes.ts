export type PatientImagingCaptureIntent = "camera" | "library";

export type PatientPhotoQuickActionSource = "patient_profile" | "patient_slide_over";

export const PATIENT_IMAGING_CAPTURE_DENIED_TOOLTIP = "Photo capture requires imaging access";

export const PATIENT_PHOTO_ADDED_SEARCH_PARAM = "photoAdded";

export const PATIENT_PHOTO_QUICK_ACTION_SOURCE_PARAM = "source";

export const PATIENT_PHOTO_ADDED_TOAST_MESSAGE = "Photo added to patient record.";

const TAB_CAPTURE = "capture";
const TAB_COMPARE = "compare";

export type ImagingWorkspaceTab = "capture" | "compare";

function patientProfileBasePath(tenantId: string, patientId: string): string {
  return `/fi-admin/${encodeURIComponent(tenantId.trim())}/patients/${encodeURIComponent(patientId.trim())}`;
}

function imagingBasePath(tenantId: string, patientId: string): string {
  return `${patientProfileBasePath(tenantId, patientId)}/imaging`;
}

/** Patient profile URL after a successful quick-action photo capture or upload. */
export function buildPatientProfilePhotoAddedHref(
  tenantId: string,
  patientId: string,
  opts?: { tab?: "gallery" | "timeline" | "overview" }
): string {
  const params = new URLSearchParams({ [PATIENT_PHOTO_ADDED_SEARCH_PARAM]: "1" });
  if (opts?.tab && opts.tab !== "overview") {
    params.set("tab", opts.tab);
  }
  return `${patientProfileBasePath(tenantId, patientId)}?${params.toString()}`;
}

/** Deep link into ImagingOS guided capture with patient context pre-attached. */
export function buildPatientImagingCaptureHref(
  tenantId: string,
  patientId: string,
  intent: PatientImagingCaptureIntent,
  source: PatientPhotoQuickActionSource
): string {
  const params = new URLSearchParams({
    tab: TAB_CAPTURE,
    intent,
    [PATIENT_PHOTO_QUICK_ACTION_SOURCE_PARAM]: source,
  });
  return `${imagingBasePath(tenantId, patientId)}?${params.toString()}`;
}

export function parseImagingWorkspaceTab(
  value: string | null | undefined
): ImagingWorkspaceTab | null {
  const v = value?.trim().toLowerCase();
  if (v === TAB_CAPTURE) return "capture";
  if (v === TAB_COMPARE) return "compare";
  return null;
}

export function parseImagingCaptureIntent(
  value: string | null | undefined
): PatientImagingCaptureIntent | null {
  const v = value?.trim().toLowerCase();
  if (v === "camera" || v === "library") return v;
  return null;
}

export function parsePatientPhotoAddedFeedback(value: string | null | undefined): boolean {
  const v = value?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function parsePatientPhotoQuickActionSource(
  value: string | null | undefined
): PatientPhotoQuickActionSource | null {
  const v = value?.trim().toLowerCase();
  if (v === "patient_profile" || v === "patient_slide_over") return v;
  return null;
}
