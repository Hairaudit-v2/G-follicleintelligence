/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.4 — HTTP helpers (server).
 */
import "server-only";

import { NextResponse } from "next/server";

import { CrmAccessError } from "@/src/lib/crm/crmGate";
import { logStructured } from "@/src/lib/server/structuredLog";

import {
  mapDomainErrorToPilotControlApiError,
  PilotControlApiError,
  toPilotControlApiErrorBody,
} from "./pilotControlApiErrors";
import { recordPilotControlAuditEvent } from "./pilotControlActivity.server";

export function pilotControlJsonOk(payload: unknown, status = 200): NextResponse {
  return NextResponse.json(payload, { status });
}

export function pilotControlJsonError(err: PilotControlApiError): NextResponse {
  return NextResponse.json(toPilotControlApiErrorBody(err), { status: err.httpStatus });
}

export function mapPilotControlRouteError(
  e: unknown,
  correlationId: string
): NextResponse {
  if (e instanceof PilotControlApiError) {
    return pilotControlJsonError(e);
  }
  if (e instanceof CrmAccessError) {
    const code =
      e.status === 401
        ? "PILOT_CONTROL_UNAUTHENTICATED"
        : e.status === 403
          ? "PILOT_CONTROL_FORBIDDEN"
          : "PILOT_CONTROL_EVALUATION_FAILED";
    return pilotControlJsonError(
      new PilotControlApiError(
        code as PilotControlApiError["code"],
        e.status === 401
          ? "Authentication required."
          : e.status === 403
            ? "Not authorized."
            : "Request could not be completed.",
        e.status,
        correlationId
      )
    );
  }

  const mapped = mapDomainErrorToPilotControlApiError(e, correlationId);
  logStructured("error", "pilot_control_route_error", {
    code: mapped.code,
    correlationId,
    name: e instanceof Error ? e.name : "unknown",
  });
  return pilotControlJsonError(mapped);
}

export async function auditAccessDenied(args: {
  tenantId?: string;
  programmeId?: string;
  actorId?: string;
  correlationId: string;
  reason: string;
}): Promise<void> {
  if (!args.tenantId) return;
  await recordPilotControlAuditEvent({
    tenantId: args.tenantId,
    programmeId: args.programmeId,
    eventKind: "pilot_control_access_denied",
    actorType: "staff",
    actorId: args.actorId ?? null,
    correlationId: args.correlationId,
    payload: { reason: args.reason },
  });
}
