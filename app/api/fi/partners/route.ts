/**
 * POST /api/fi/partners
 * Create partner (tenant-scoped). Admin supabase, no cookies.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertLegacyFiApiAccess } from "@/src/lib/fiOs/legacyFiApiAuth";
import { createFiPartnerFromBody } from "@/src/lib/fi/partners/fiPartnerCreate.server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const legacyAuth = assertLegacyFiApiAccess(req);
  if (legacyAuth) return legacyAuth;

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Server misconfigured." }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const supabase = supabaseAdmin();
    const result = await createFiPartnerFromBody(supabase, body);

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      ok: true,
      partner: result.partner,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unexpected error." },
      { status: 500 }
    );
  }
}
