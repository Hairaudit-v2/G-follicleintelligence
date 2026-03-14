/**
 * GET /api/fi/audit/queue
 * List cases awaiting audit for a tenant (reports in draft or changes_required).
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
    if (!tenant_id)
      return NextResponse.json(
        { ok: false, error: "tenant_id query param is required." },
        { status: 400 }
      );

    const supabase = supabaseAdmin();

    const { data: reports } = await supabase
      .from("fi_reports")
      .select("id, case_id, version, status, created_at")
      .eq("tenant_id", tenant_id)
      .in("status", ["draft", "changes_required"])
      .order("created_at", { ascending: false });

    if (!reports || reports.length === 0) {
      return NextResponse.json({ ok: true, queue: [] });
    }

    const caseIds = reports.reduce<string[]>((acc, report) => {
      if (!acc.includes(report.case_id)) acc.push(report.case_id);
      return acc;
    }, []);
    const { data: intakes } = await supabase
      .from("fi_intakes")
      .select("case_id, full_name, email")
      .in("case_id", caseIds);

    const intakeByCase = new Map(
      (intakes ?? []).map((i) => [i.case_id, { full_name: i.full_name, email: i.email }])
    );

    const queue = reports.map((r) => ({
      report_id: r.id,
      case_id: r.case_id,
      version: r.version,
      report_status: r.status,
      created_at: r.created_at,
      patient: intakeByCase.get(r.case_id) ?? null,
    }));

    return NextResponse.json({ ok: true, queue });
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
