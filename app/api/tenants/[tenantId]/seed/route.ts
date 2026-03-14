/**
 * POST /api/tenants/[tenantId]/seed
 * Dev-only: ensure tenant exists. Returns tenant info.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    if (!tenantId)
      return NextResponse.json({ ok: false, error: "Missing tenantId." }, { status: 400 });

    const supabase = supabaseAdmin();
    const { data } = await supabase
      .from("fi_tenants")
      .select("id, name, slug")
      .eq("id", tenantId)
      .single();

    if (!data)
      return NextResponse.json(
        {
          ok: false,
          error:
            "Tenant not found. Create one via SQL: insert into fi_tenants (name, slug) values ('Demo', 'demo');",
        },
        { status: 404 }
      );

    return NextResponse.json({ ok: true, tenant: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unexpected error." },
      { status: 500 }
    );
  }
}
