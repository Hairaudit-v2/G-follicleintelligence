/**
 * GET /api/fi/report
 * Retrieve report metadata and report_json for preview.
 * If report_id provided, fetch that report (any status). Else fetch latest approved.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Server misconfigured." }, { status: 500 });
    }

    const url = new URL(req.url);
    const tenant_id = url.searchParams.get("tenant_id");
    const case_id = url.searchParams.get("case_id");
    const report_id = url.searchParams.get("report_id");

    if (!tenant_id)
      return NextResponse.json(
        { ok: false, error: "tenant_id query param is required." },
        { status: 400 }
      );

    if (!case_id && !report_id)
      return NextResponse.json(
        { ok: false, error: "case_id or report_id is required." },
        { status: 400 }
      );

    const supabase = supabaseAdmin();

    let report: { id: string; version: number; status: string; storage_path?: string; storage_url?: string; created_at?: string; approved_at?: string; released_at?: string; report_json?: Record<string, unknown> } | null;

    if (report_id && !case_id) {
      const { data } = await supabase
        .from("fi_reports")
        .select("id, version, status, storage_path, storage_url, created_at, approved_at, released_at, report_json")
        .eq("id", report_id)
        .eq("tenant_id", tenant_id)
        .single();
      report = data;
    } else if (report_id && case_id) {
      const { data: caseRow } = await supabase
        .from("fi_cases")
        .select("id")
        .eq("id", case_id)
        .eq("tenant_id", tenant_id)
        .single();
      if (!caseRow)
        return NextResponse.json({ ok: false, error: "Case not found." }, { status: 404 });
      const { data } = await supabase
        .from("fi_reports")
        .select("id, version, status, storage_path, storage_url, created_at, approved_at, released_at, report_json")
        .eq("id", report_id)
        .eq("case_id", case_id)
        .eq("tenant_id", tenant_id)
        .single();
      report = data;
    } else if (case_id) {
      const { data: caseRow } = await supabase
        .from("fi_cases")
        .select("id")
        .eq("id", case_id)
        .eq("tenant_id", tenant_id)
        .single();
      if (!caseRow)
        return NextResponse.json({ ok: false, error: "Case not found." }, { status: 404 });
      const { data } = await supabase
        .from("fi_reports")
        .select("id, version, status, storage_path, storage_url, created_at, approved_at, released_at, report_json")
        .eq("case_id", case_id)
        .eq("tenant_id", tenant_id)
        .in("status", ["approved", "released"])
        .order("approved_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      report = data;
    }

    if (!report)
      return NextResponse.json(
        {
          ok: false,
          error: report_id ? "Report not found." : "No approved report found for this case.",
        },
        { status: 404 }
      );

    return NextResponse.json({
      ok: true,
      report: {
        id: report.id,
        version: report.version,
        status: report.status,
        storage_path: report.storage_path,
        storage_url: report.storage_url,
        created_at: report.created_at,
        approved_at: report.approved_at,
        released_at: report.released_at,
        report_json: report.report_json ?? null,
      },
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
