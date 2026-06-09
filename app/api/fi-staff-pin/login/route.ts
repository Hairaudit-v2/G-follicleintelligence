import { NextResponse } from "next/server";

import { createStaffPinClinicSession } from "@/src/lib/staffPin/staffPinSession.server";
import { verifyStaffPinLogin } from "@/src/lib/staffPin/staffPin.server";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(s.trim());
}

function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (xff) return xff;
  return req.headers.get("x-real-ip")?.trim() || null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";
    const staffId = typeof body.staffId === "string" ? body.staffId.trim() : "";
    const pin = typeof body.pin === "string" ? body.pin : "";

    if (!isUuid(tenantId) || !isUuid(staffId)) {
      return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
    }

    const verified = await verifyStaffPinLogin({ tenantId, staffId, pin });
    if (!verified.ok) {
      return NextResponse.json({ ok: false, error: verified.error }, { status: 401 });
    }

    const session = await createStaffPinClinicSession({
      tenantId,
      staffId: verified.staffId,
      staffName: verified.staffName,
      staffRole: verified.staffRole,
      clientIp: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({
      ok: true,
      redirectTo: `/fi-admin/${tenantId}/calendar`,
      staffName: session.staffName,
      expiresAt: session.expiresAt,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unexpected error." },
      { status: 500 }
    );
  }
}
