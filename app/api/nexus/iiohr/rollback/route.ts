/**
 * POST /api/nexus/iiohr/rollback
 * Signed IIOHR Nexus rollback (Phase 9A). Disabled unless FI_OS_NEXUS_ENABLED=true.
 */
import { NextResponse } from "next/server";

import { handleNexusRollbackHttp } from "@/src/lib/nexus/nexusIiohrApi.server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const { httpStatus, body } = await handleNexusRollbackHttp(req, rawBody);
    return NextResponse.json(body, { status: httpStatus });
  } catch {
    return NextResponse.json({ ok: false, error: "Internal error." }, { status: 500 });
  }
}
