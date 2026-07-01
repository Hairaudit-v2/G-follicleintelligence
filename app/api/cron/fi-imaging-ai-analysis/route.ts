/**
 * POST or GET /api/cron/fi-imaging-ai-analysis
 *
 * Processes queued `fi_imaging_ai_analysis_jobs` per tenant (service role only).
 * Authorisation: Bearer `FI_IMAGING_AI_ANALYSIS_CRON_SECRET` or `CRON_SECRET`.
 */
import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertCronAuthorized } from "@/src/lib/server/cronAuth";
import { logStructured } from "@/src/lib/server/structuredLog";
import { processPendingImagingAiJobsForTenant } from "@/src/lib/imaging-os/imagingAiAnalysisJobWorker.server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  const auth = assertCronAuthorized(
    req,
    [process.env.FI_IMAGING_AI_ANALYSIS_CRON_SECRET ?? "", process.env.CRON_SECRET ?? ""],
    { alternateTimingSafeHeaderName: "x-fi-imaging-ai-analysis-secret" }
  );
  if (auth) return auth;

  const url = new URL(req.url);
  const singleTenant = url.searchParams.get("tenantId")?.trim() || null;
  const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") ?? "5"), 20));

  try {
    if (singleTenant) {
      const results = await processPendingImagingAiJobsForTenant({
        tenantId: singleTenant,
        limit,
      });
      return NextResponse.json({
        ok: true,
        mode: "single_tenant",
        tenantId: singleTenant,
        processed: results.length,
        results,
      });
    }

    const supabase = supabaseAdmin();
    const { data: tenants, error } = await supabase
      .from("fi_tenants")
      .select("id")
      .order("name")
      .limit(500);
    if (error) throw new Error(error.message);

    const summaries: Array<{ tenantId: string; processed: number }> = [];
    for (const tenant of tenants ?? []) {
      const tenantId = String((tenant as { id: string }).id);
      const results = await processPendingImagingAiJobsForTenant({ tenantId, limit: 3 });
      if (results.length > 0) {
        summaries.push({ tenantId, processed: results.length });
      }
    }

    return NextResponse.json({ ok: true, mode: "all_tenants", tenants: summaries });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "cron failed";
    logStructured("error", "fi_imaging_ai_analysis_cron_failed", { message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}