/**
 * POST /api/tenants/[tenantId]/cases/[caseId]/submit
 * Submit case for processing. Idempotent: only transitions draft -> submitted.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; caseId: string }> }
) {
  try {
    const { tenantId, caseId } = await params;
    if (!tenantId || !caseId)
      return NextResponse.json(
        { ok: false, error: "Missing tenantId or caseId." },
        { status: 400 }
      );

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Server misconfigured." }, { status: 500 });
    }

    const supabase = supabaseAdmin();

    const { data: caseRow, error: updateErr } = await supabase
      .from("fi_cases")
      .update({
        status: "submitted",
        updated_at: new Date().toISOString(),
      })
      .eq("id", caseId)
      .eq("tenant_id", tenantId)
      .eq("status", "draft")
      .select("id, status")
      .single();

    if (updateErr)
      return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });

    if (!caseRow) {
      const { data: existing } = await supabase
        .from("fi_cases")
        .select("status")
        .eq("id", caseId)
        .eq("tenant_id", tenantId)
        .single();
      if (!existing)
        return NextResponse.json({ ok: false, error: "Case not found." }, { status: 404 });
      return NextResponse.json({
        ok: true,
        case: { id: caseId, status: existing.status },
        message: "Already submitted.",
      });
    }

    return NextResponse.json({
      ok: true,
      case: { id: caseRow.id, status: caseRow.status },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unexpected error." },
      { status: 500 }
    );
  }
}
