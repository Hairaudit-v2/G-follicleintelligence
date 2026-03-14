/**
 * POST /api/fi/audit/reject
 * Rejects with notes, sets report to changes_required, case status to MODEL_RUNNING or NEEDS_DATA.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type RejectType = "model_running" | "needs_data";

export async function POST(req: Request) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Server misconfigured." }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const tenant_id = typeof body.tenant_id === "string" ? body.tenant_id.trim() : null;
    const report_id = typeof body.report_id === "string" ? body.report_id.trim() : null;
    const note = typeof body.note === "string" ? body.note.trim() : null;
    const reject_type: RejectType =
      body.reject_type === "needs_data" ? "needs_data" : "model_running";
    const reviewer_id = typeof body.reviewer_id === "string" ? body.reviewer_id.trim() : null;

    if (!tenant_id || !report_id)
      return NextResponse.json(
        { ok: false, error: "tenant_id and report_id are required." },
        { status: 400 }
      );

    if (!note || note.length < 1)
      return NextResponse.json(
        { ok: false, error: "note is required (rejection reason)." },
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
        { ok: false, error: "Cannot reject released (issued) report." },
        { status: 400 }
      );

    const caseStatus = reject_type === "needs_data" ? "draft" : "processing";

    const now = new Date().toISOString();

    const { error: reportErr } = await supabase
      .from("fi_reports")
      .update({ status: "changes_required", updated_at: now })
      .eq("id", report_id)
      .eq("tenant_id", tenant_id);

    if (reportErr)
      return NextResponse.json({ ok: false, error: reportErr.message }, { status: 500 });

    const { error: caseErr } = await supabase
      .from("fi_cases")
      .update({ status: caseStatus, updated_at: now })
      .eq("id", report.case_id)
      .eq("tenant_id", tenant_id);

    if (caseErr) return NextResponse.json({ ok: false, error: caseErr.message }, { status: 500 });

    await supabase.from("fi_audits").insert({
      tenant_id,
      report_id,
      case_id: report.case_id,
      reviewer_id: reviewer_id || null,
      note,
      status: "changes_required",
    });

    return NextResponse.json({
      ok: true,
      report_id,
      report_status: "changes_required",
      case_status: caseStatus,
      reject_type,
      message: `Rejected. Case set to ${caseStatus}.`,
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
