/**
 * FI-IMAGINGOS-PRE-SURGERY-PROJECTION-1A
 * POST /api/v1/pre-surgery/projections
 *
 * HairAudit sets HA_IMAGINGOS_PROJECTION_URL to the FiOS API root (…/api) so that
 * POST {URL}/v1/pre-surgery/projections resolves here.
 * Signing path verified as "/v1/pre-surgery/projections" (HairAudit contract).
 */

import { NextResponse } from "next/server";
import { handleHairAuditProjectionRequest } from "@/src/lib/imaging-os/preSurgeryProjection/gateway.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const result = await handleHairAuditProjectionRequest({ req, rawBody });
  return NextResponse.json(result.body, { status: result.httpStatus });
}
