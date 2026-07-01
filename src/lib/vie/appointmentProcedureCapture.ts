/**
 * Appointment procedure photo capture policy helpers (pure).
 */

export const APPOINTMENT_PROCEDURE_CAPTURE_SOURCE = "appointment_procedure" as const;
export const APPOINTMENT_PROCEDURE_ADMIN_FALLBACK_SOURCE =
  "appointment_procedure_admin_fallback" as const;

export const APPOINTMENT_PROCEDURE_PROTOCOL_REQUIRED_MESSAGE =
  "Procedure photos require a structured capture protocol. Start a capture protocol, attach to an existing session, or use admin fallback if permitted.";

export function isAppointmentProcedureAdminFallbackSource(source: string): boolean {
  return source === APPOINTMENT_PROCEDURE_ADMIN_FALLBACK_SOURCE;
}

export function appointmentProcedureUploadBlockedReason(input: {
  captureSource: string | null | undefined;
  protocolSessionId: string | null | undefined;
  hasAdminFallbackKey?: boolean;
}): string | null {
  const source = String(input.captureSource ?? "")
    .trim()
    .toLowerCase();

  if (!source) {
    return APPOINTMENT_PROCEDURE_PROTOCOL_REQUIRED_MESSAGE;
  }

  if (isAppointmentProcedureAdminFallbackSource(source)) {
    return input.hasAdminFallbackKey ? null : "Admin fallback upload requires a valid admin key.";
  }

  if (source === APPOINTMENT_PROCEDURE_CAPTURE_SOURCE) {
    const sessionId = input.protocolSessionId?.trim() ?? "";
    if (!sessionId) {
      return APPOINTMENT_PROCEDURE_PROTOCOL_REQUIRED_MESSAGE;
    }
    return null;
  }

  return null;
}