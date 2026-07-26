import { NextResponse } from "next/server";

import type { PatientGatewayDeny } from "./patientGatewayTypes";

export function patientGatewayJsonOk(payload: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(payload, { status });
}

export function patientGatewayJsonDeny(deny: PatientGatewayDeny): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error: deny.message,
      code: deny.code,
    },
    { status: deny.status }
  );
}

export function mapPatientGatewayRouteError(e: unknown): NextResponse {
  if (e instanceof Error) {
    return NextResponse.json(
      { ok: false, error: "Unexpected error.", code: "misconfigured" },
      { status: 500 }
    );
  }
  return NextResponse.json(
    { ok: false, error: "Unexpected error.", code: "misconfigured" },
    { status: 500 }
  );
}
