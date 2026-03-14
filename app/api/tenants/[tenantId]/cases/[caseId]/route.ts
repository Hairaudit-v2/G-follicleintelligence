/**
 * GET /api/tenants/[tenantId]/cases/[caseId]
 * Case detail: intake, uploads, signals, scorecard, latest report.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenantId: string; caseId: string }> }
) {
  try {
    const { tenantId, caseId } = await params;
    if (!tenantId || !caseId)
      return NextResponse.json({ ok: false, error: "Missing tenantId or caseId." }, { status: 400 });

    const supabase = supabaseAdmin();

    const { data: caseRow, error: caseErr } = await supabase
      .from("fi_cases")
      .select("id, external_id, status, partner_id, created_at")
      .eq("id", caseId)
      .eq("tenant_id", tenantId)
      .single();

    if (caseErr || !caseRow)
      return NextResponse.json({ ok: false, error: "Case not found." }, { status: 404 });

    const [intakeRes, uploadsRes, bloodRes, imageRes, scorecardRes, reportRes] = await Promise.all([
      supabase
        .from("fi_intakes")
        .select("full_name, email, dob, sex, country, primary_concern, selections")
        .eq("case_id", caseId)
        .eq("tenant_id", tenantId)
        .single(),
      supabase
        .from("fi_uploads")
        .select("id, type, filename, storage_path, mime_type, created_at")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false }),
      supabase
        .from("fi_signals_blood")
        .select("id, payload, confidence")
        .eq("case_id", caseId)
        .eq("tenant_id", tenantId)
        .maybeSingle(),
      supabase
        .from("fi_signals_image")
        .select("id, payload, confidence")
        .eq("case_id", caseId)
        .eq("tenant_id", tenantId),
      supabase
        .from("fi_scorecards")
        .select("id, payload_json, overall_score, risk_tier")
        .eq("case_id", caseId)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("fi_reports")
        .select("id, version, status, report_json, storage_path, created_at")
        .eq("case_id", caseId)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return NextResponse.json({
      ok: true,
      case: caseRow,
      intake: intakeRes.data ?? null,
      uploads: uploadsRes.data ?? [],
      blood_signals: bloodRes.data?.payload ?? null,
      image_signals: imageRes.data ?? [],
      scorecard:
        scorecardRes.data
          ? {
              overall_score: scorecardRes.data.overall_score,
              risk_tier: scorecardRes.data.risk_tier,
              payload: scorecardRes.data.payload_json,
            }
          : null,
      latest_report: reportRes.data ?? null,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unexpected error." },
      { status: 500 }
    );
  }
}
