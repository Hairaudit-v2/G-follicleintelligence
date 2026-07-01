/**
 * POST or GET /api/cron/fi-imaging-ai-analysis
 *
 * Processes queued `fi_imaging_ai_analysis_jobs` per tenant (service role only).
 * Vercel cron: every 15 minutes — see vercel.json.
 *
 * Authorisation: Bearer `FI_IMAGING_AI_ANALYSIS_CRON_SECRET` or `CRON_SECRET`,
 * or header `x-fi-imaging-ai-analysis-secret`.
 *
 * Query params:
 * - tenantId (optional UUID) — process a single tenant
 * - limit (optional, 1–20) — max jobs per tenant in single-tenant mode (default 5)
 */
import { NextRequest, NextResponse } from "next/server";

import { assertCronAuthorized } from "@/src/lib/server/cronAuth";
import { logStructured } from "@/src/lib/server/structuredLog";
import { runImagingAiAnalysisCron } from "@/src/lib/imaging-os/imagingAiAnalysisCron.server";

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
    const summary = await runImagingAiAnalysisCron({
      tenantId: singleTenant,
      limit,
    });
    logStructured("info", "fi_imaging_ai_analysis_cron_completed", {
      mode: summary.mode,
      jobsProcessed: summary.jobsProcessed,
      durationMs: summary.durationMs,
    });
    return NextResponse.json(summary);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "cron failed";
    logStructured("error", "fi_imaging_ai_analysis_cron_failed", { message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}