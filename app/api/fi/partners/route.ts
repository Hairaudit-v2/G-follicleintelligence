/**
 * POST /api/fi/partners
 * Create partner (tenant-scoped). Admin supabase, no cookies.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Server misconfigured." }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const tenant_id = typeof body.tenant_id === "string" ? body.tenant_id.trim() : null;
    const name = typeof body.name === "string" ? body.name.trim() : null;
    const reference_code = typeof body.reference_code === "string" ? body.reference_code.trim() : null;

    if (!tenant_id || !name || !reference_code)
      return NextResponse.json(
        { ok: false, error: "tenant_id, name, and reference_code are required." },
        { status: 400 }
      );

    if (!/^[a-zA-Z0-9_-]+$/.test(reference_code))
      return NextResponse.json(
        { ok: false, error: "reference_code must be alphanumeric, underscore, or hyphen." },
        { status: 400 }
      );

    const supabase = supabaseAdmin();

    const { data: tenant } = await supabase
      .from("fi_tenants")
      .select("id")
      .eq("id", tenant_id)
      .single();
    if (!tenant)
      return NextResponse.json({ ok: false, error: "Tenant not found." }, { status: 404 });

    const { data: partner, error } = await supabase
      .from("fi_partners")
      .insert({
        tenant_id,
        name,
        reference_code,
        slug: body.slug ?? null,
        metadata: body.metadata ?? {},
      })
      .select("id, name, reference_code, created_at")
      .single();

    if (error) {
      if (error.code === "23505")
        return NextResponse.json(
          { ok: false, error: "Partner with this reference_code already exists for tenant." },
          { status: 409 }
        );
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      partner: {
        id: partner!.id,
        name: partner!.name,
        reference_code: partner!.reference_code,
        created_at: partner!.created_at,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unexpected error." },
      { status: 500 }
    );
  }
}
