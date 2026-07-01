/**
 * Resolve effective capture_source for patient image uploads (Phase 1 ConsultationOS).
 */

export function resolvePatientImageUploadCaptureSource(input: {
  captureSource: string | null | undefined;
  consultationId: string | null | undefined;
}): string | null {
  const explicit = String(input.captureSource ?? "").trim();
  if (explicit) return explicit;
  const consultationId = String(input.consultationId ?? "").trim();
  if (consultationId) return "consultation_os";
  return null;
}