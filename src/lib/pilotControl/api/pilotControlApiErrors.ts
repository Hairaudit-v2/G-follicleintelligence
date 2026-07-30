/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.4 — API errors (pure).
 */

import type { PilotControlApiErrorBody, PilotControlApiErrorCode } from "./pilotControlApiTypes";

export class PilotControlApiError extends Error {
  constructor(
    readonly code: PilotControlApiErrorCode,
    message: string,
    readonly httpStatus: number,
    readonly correlationId: string
  ) {
    super(message);
    this.name = "PilotControlApiError";
  }
}

export function toPilotControlApiErrorBody(err: PilotControlApiError): PilotControlApiErrorBody {
  return {
    error: {
      code: err.code,
      message: err.message,
      correlationId: err.correlationId,
    },
  };
}

/** Map engine errors to safe public API errors — never leak SQL / stack / foreign existence. */
export function mapDomainErrorToPilotControlApiError(
  e: unknown,
  correlationId: string
): PilotControlApiError {
  if (e instanceof PilotControlApiError) return e;

  const name = e && typeof e === "object" && "name" in e ? String((e as { name: string }).name) : "";
  const code =
    e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";

  if (name === "PilotReadinessEvaluationError" || name === "PilotBlockerEvaluationError") {
    if (code === "not_enrolled" || code === "programme_mismatch") {
      return new PilotControlApiError(
        "PILOT_CONTROL_PATIENT_NOT_ENROLLED",
        "Patient is not enrolled in this pilot programme.",
        404,
        correlationId
      );
    }
    if (code === "ambiguous_enrolment") {
      return new PilotControlApiError(
        "PILOT_CONTROL_IDENTITY_AMBIGUOUS",
        "Patient pilot membership could not be resolved safely.",
        409,
        correlationId
      );
    }
    if (code === "tenant_mismatch") {
      return new PilotControlApiError(
        "PILOT_CONTROL_TENANT_MISMATCH",
        "Request tenant does not match programme scope.",
        403,
        correlationId
      );
    }
  }

  return new PilotControlApiError(
    "PILOT_CONTROL_EVALUATION_FAILED",
    "Pilot control evaluation could not be completed.",
    500,
    correlationId
  );
}
