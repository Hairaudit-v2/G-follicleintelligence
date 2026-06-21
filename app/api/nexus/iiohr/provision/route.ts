/**
 * POST /api/nexus/iiohr/provision
 * Signed IIOHR Nexus provisioning (Phase 9A). Disabled unless FI_OS_NEXUS_ENABLED=true.
 */
import { NextResponse } from "next/server";

import { handleNexusProvisionHttp } from "@/src/lib/nexus/nexusIiohrApi.server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const { httpStatus, body } = await handleNexusProvisionHttp(req, rawBody);
    return NextResponse.json(body, { status: httpStatus });
  } catch {
    return NextResponse.json({ ok: false, error: "Internal error." }, { status: 500 });
  }
}
