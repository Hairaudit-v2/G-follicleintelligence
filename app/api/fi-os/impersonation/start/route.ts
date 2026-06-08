import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  endOpenFiOsImpersonationSessions,
  FI_OS_IMPERSONATION_COOKIE,
  insertFiOsImpersonationSessionRow,
} from "@/src/lib/fiOs/fiOsImpersonation.server";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsPlatformAdminRole } from "@/src/lib/fiOs/fiOsRoles";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(s.trim());
}

function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (xff) return xff;
  const realIp = req.headers.get("x-real-ip")?.trim();
  return realIp || null;
}

export async function POST(req: Request) {
  try {
    const sessionId = await resolveAuthUserId(req);
    if (!sessionId) {
      return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
    }
    const os = await loadFiOsIdentity(sessionId);
    if (!os || !isFiOsPlatformAdminRole(os.osRole)) {
      return NextResponse.json({ ok: false, error: "Platform administrator role required." }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const target = typeof body.targetAuthUserId === "string" ? body.targetAuthUserId.trim() : "";
    const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : undefined;
    if (!isUuid(target)) {
      return NextResponse.json({ ok: false, error: "targetAuthUserId must be a UUID." }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const { data: u, error: uerr } = await supabase.auth.admin.getUserById(target);
    if (uerr || !u?.user) {
      return NextResponse.json({ ok: false, error: "Target user not found." }, { status: 404 });
    }

    await endOpenFiOsImpersonationSessions(sessionId);
    await insertFiOsImpersonationSessionRow({
      initiatorAuthUserId: sessionId,
      targetAuthUserId: target,
      tenantId: tenantId && isUuid(tenantId) ? tenantId : null,
      clientIp: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    const cookieStore = cookies();
    cookieStore.set(FI_OS_IMPERSONATION_COOKIE, target.toLowerCase(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unexpected error." },
      { status: 500 }
    );
  }
}
