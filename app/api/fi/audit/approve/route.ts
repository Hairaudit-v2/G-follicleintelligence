/**
 * POST /api/fi/audit/approve
 * Approves report version, stamps reviewer, creates immutable "released" (issued) version.
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
    const report_id = typeof body.report_id === "string" ? body.report_id.trim() : null;
    const reviewer_id = typeof body.reviewer_id === "string" ? body.reviewer_id.trim() : null;

    if (!tenant_id || !report_id)
      return NextResponse.json(
        { ok: false, error: "tenant_id and report_id are required." },
        { status: 400 }
      );

    const supabase = supabaseAdmin();

    const { data: report } = await supabase
      .from("fi_reports")
      .select("id, case_id, status")
      .eq("id", report_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (!report)
      return NextResponse.json({ ok: false, error: "Report not found." }, { status: 404 });

    if (report.status === "released")
      return NextResponse.json(
        { ok: false, error: "Report already issued (released). Immutable." },
        { status: 400 }
      );

    const now = new Date().toISOString();

    const { error: updateErr } = await supabase
      .from("fi_reports")
      .update({
        status: "released",
        approved_at: now,
        released_at: now,
        updated_at: now,
      })
      .eq("id", report_id)
      .eq("tenant_id", tenant_id);

    if (updateErr)
      return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });

    await supabase.from("fi_audits").insert({
      tenant_id,
      report_id,
      case_id: report.case_id,
      reviewer_id: reviewer_id || null,
      note: "Approved",
      status: "approved",
    });

    return NextResponse.json({
      ok: true,
      report_id,
      status: "released",
      message: "Report approved and issued (immutable).",
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Unexpected error.",
      },
      { status: 500 }
    );
  }
}
