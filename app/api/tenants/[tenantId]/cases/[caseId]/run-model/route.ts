/**
 * POST /api/tenants/[tenantId]/cases/[caseId]/run-model
 * Create job if none queued/running, then run pipeline (inline or queue).
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runPipeline } from "@/lib/fi/pipeline";
import { assertCrmTenantWriteAllowed } from "@/src/lib/crm/crmGate";
import { extractAdminKeyFromRequest, mapCrmRouteError } from "@/src/lib/crm/crmHttp";

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

    const body = await req.json().catch(() => ({}));
    const adminKey = extractAdminKeyFromRequest(req, body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });

    const supabase = supabaseAdmin();
    const { data: caseRow } = await supabase
      .from("fi_cases")
      .select("id")
      .eq("id", caseId)
      .eq("tenant_id", tenantId)
      .single();
    if (!caseRow)
      return NextResponse.json({ ok: false, error: "Patient not found." }, { status: 404 });

    const dryRun = Boolean(body?.dryRun);

    const result = await runPipeline({ tenantId, caseId, dryRun });

    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 500 });

    return NextResponse.json({
      ok: true,
      jobId: result.jobId,
      reportId: result.reportId,
      storagePath: result.storagePath,
      message: dryRun ? "Pipeline completed (dry run)." : "Pipeline completed.",
    });
  } catch (e: unknown) {
    return mapCrmRouteError(e);
  }
}
