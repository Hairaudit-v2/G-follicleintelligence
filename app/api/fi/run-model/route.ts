/**
 * POST /api/fi/run-model
 * Enqueue a model run for a case. Tenant-scoped. Admin supabase client, no cookies.
 */
import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/fi/pipeline";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Server misconfigured." }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const tenant_id = typeof body.tenant_id === "string" ? body.tenant_id.trim() : null;
    const case_id = typeof body.case_id === "string" ? body.case_id.trim() : null;

    if (!tenant_id || !case_id)
      return NextResponse.json(
        { ok: false, error: "tenant_id and case_id are required." },
        { status: 400 }
      );

    const dryRun = Boolean(body?.dryRun);

    const result = await runPipeline({ tenantId: tenant_id, caseId: case_id, dryRun });

    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 500 });

    return NextResponse.json({
      ok: true,
      job_id: result.jobId,
      report_id: result.reportId,
      storage_path: result.storagePath,
      message: dryRun ? "Model run completed (dry run)." : "Model run completed.",
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
