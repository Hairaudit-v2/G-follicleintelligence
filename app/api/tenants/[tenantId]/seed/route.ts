/**
 * POST /api/tenants/[tenantId]/seed
 * Dev-only: ensure tenant exists. Returns tenant info.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { StaffPinMutationBlockedError, STAFF_PIN_RESTRICTED_MUTATION_MESSAGE } from "@/src/lib/staffPin/staffPinMutationGuard";
import { rejectStaffPinSessionForRestrictedMutation } from "@/src/lib/staffPin/staffPinMutationGuard.server";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { ok: false, error: "This endpoint is disabled in production." },
        { status: 403 }
      );
    }

    const { tenantId } = await params;
    if (!tenantId)
      return NextResponse.json({ ok: false, error: "Missing tenantId." }, { status: 400 });

    await rejectStaffPinSessionForRestrictedMutation(tenantId.trim());

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
    if (e instanceof StaffPinMutationBlockedError) {
      return NextResponse.json({ ok: false, error: STAFF_PIN_RESTRICTED_MUTATION_MESSAGE }, { status: 403 });
    }
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unexpected error." },
      { status: 500 }
    );
  }
}
