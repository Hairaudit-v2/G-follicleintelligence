/**
 * POST /api/tenants/[tenantId]/tick-jobs
 * Process queued jobs for a tenant. Idempotent: locking prevents duplicate work.
 */
import { NextResponse } from "next/server";
import { getQueuedJobs } from "@/lib/fi/jobRunner";
import { runPipeline } from "@/lib/fi/pipeline";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    if (!tenantId)
      return NextResponse.json({ ok: false, error: "Missing tenantId." }, { status: 400 });

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Server misconfigured." }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(1, Number(body?.limit) || 5), 20);

    const jobs = await getQueuedJobs(tenantId, limit);
    const results: { jobId: string; ok: boolean; error?: string }[] = [];

    for (const job of jobs) {
      const result = await runPipeline({
        tenantId,
        caseId: job.case_id,
        jobId: job.id,
      });
      results.push({
        jobId: job.id,
        ok: result.ok,
        error: result.error,
      });
    }

    return NextResponse.json({
      ok: true,
      processed: results.length,
      results,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unexpected error." },
      { status: 500 }
    );
  }
}
