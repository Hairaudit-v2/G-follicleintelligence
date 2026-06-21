/**
 * GET /api/nexus/iiohr/state?globalProfessionalId=
 * Signed IIOHR Nexus state read (Phase 9A). Disabled unless FI_OS_NEXUS_ENABLED=true.
 *
 * Signature material for GET: `{timestamp}.{globalProfessionalId}` (query value, no JSON body).
 */
import { NextResponse } from "next/server";

import { handleNexusStateHttp } from "@/src/lib/nexus/nexusIiohrApi.server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const globalProfessionalId = url.searchParams.get("globalProfessionalId");
    const { httpStatus, body } = await handleNexusStateHttp(req, globalProfessionalId);
    return NextResponse.json(body, { status: httpStatus });
  } catch {
    return NextResponse.json({ ok: false, error: "Internal error." }, { status: 500 });
  }
}
