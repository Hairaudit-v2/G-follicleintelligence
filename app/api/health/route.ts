/**
 * FI-IMAGINGOS-PRE-SURGERY-PROJECTION-1A
 * GET /api/health
 *
 * HairAudit healthcheck: GET {HA_IMAGINGOS_PROJECTION_URL}/health with Bearer token.
 * When HA_IMAGINGOS_PROJECTION_URL ends with /api, this route is the target.
 * Requires the dedicated projection service token (not classifier tokens).
 */

import { NextResponse } from "next/server";
import { authorizeProjectionHealthRequest } from "@/src/lib/imaging-os/preSurgeryProjection/auth";
import { ProjectionGatewayError } from "@/src/lib/imaging-os/preSurgeryProjection/errors";
import { buildProjectionHealth } from "@/src/lib/imaging-os/preSurgeryProjection/gateway.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    authorizeProjectionHealthRequest({ req });
    const body = buildProjectionHealth();
    const httpStatus = body.status === "disabled" ? 503 : 200;
    return NextResponse.json(body, { status: httpStatus });
  } catch (e) {
    if (e instanceof ProjectionGatewayError) {
      return NextResponse.json(
        { ok: false, error: e.code, message: e.message },
        { status: e.httpStatus }
      );
    }
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Health check failed" },
      { status: 500 }
    );
  }
}
