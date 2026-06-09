import { NextResponse } from "next/server";

import { clearStaffPinClinicSessionCookie } from "@/src/lib/staffPin/staffPinSession.server";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await clearStaffPinClinicSessionCookie();
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unexpected error." },
      { status: 500 }
    );
  }
}
