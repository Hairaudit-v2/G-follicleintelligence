import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import {
  endOpenFiOsImpersonationSessions,
  FI_OS_IMPERSONATION_COOKIE,
} from "@/src/lib/fiOs/fiOsImpersonation.server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const sessionId = await resolveAuthUserId(req);
    if (!sessionId) {
      return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
    }
    await endOpenFiOsImpersonationSessions(sessionId);
    const cookieStore = cookies();
    cookieStore.delete(FI_OS_IMPERSONATION_COOKIE);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unexpected error." },
      { status: 500 }
    );
  }
}
