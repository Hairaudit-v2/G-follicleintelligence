/**
 * GET handler for `/api/cron/leadflow/process-hubspot-events`.
 * Vercel Cron invokes GET with Bearer `CRON_SECRET`; delegates to {@link drainHubSpotLeadFlowQueue}.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  drainHubSpotLeadFlowQueue,
  LEADFLOW_HUBSPOT_DRAIN_MAX_BATCH,
  type LeadFlowDrainTenantSummary,
} from "@/src/lib/leadFlow/hubspotLeadFlowQueueDrain.server";
import { assertCronAuthorized } from "@/src/lib/server/cronAuth";
import { logStructured } from "@/src/lib/server/structuredLog";

export type LeadFlowHubspotEventsCronResponse = {
  success: boolean;
  processed: number;
  failed: number;
  retried: number;
  skipped: number;
  tenants: LeadFlowDrainTenantSummary[];
  source: "vercel_cron";
};

export type LeadFlowHubspotEventsCronOptions = {
  getEnv?: (key: string) => string | undefined;
  drainQueue?: typeof drainHubSpotLeadFlowQueue;
};

function resolveGetEnv(opts?: LeadFlowHubspotEventsCronOptions): (key: string) => string | undefined {
  return opts?.getEnv ?? ((key) => process.env[key]);
}

function parseCronQueryParams(
  req: NextRequest
): { tenantId?: string; limit?: number } | NextResponse<{ success: false; error: string }> {
  const url = new URL(req.url);
  const tenantIdRaw = url.searchParams.get("tenantId")?.trim();
  if (tenantIdRaw && !z.string().uuid().safeParse(tenantIdRaw).success) {
    return NextResponse.json({ success: false, error: "Invalid tenantId." }, { status: 400 });
  }

  const limitRaw = url.searchParams.get("limit");
  let limit: number | undefined;
  if (limitRaw != null && limitRaw.trim() !== "") {
    const parsed = Number(limitRaw);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return NextResponse.json({ success: false, error: "Invalid limit." }, { status: 400 });
    }
    limit = Math.min(parsed, LEADFLOW_HUBSPOT_DRAIN_MAX_BATCH);
  }

  return { tenantId: tenantIdRaw || undefined, limit };
}

export async function handleLeadFlowHubspotEventsCronGet(
  req: NextRequest,
  opts?: LeadFlowHubspotEventsCronOptions
): Promise<Response> {
  if (req.method !== "GET") {
    return NextResponse.json({ success: false, error: "Method not allowed." }, { status: 405 });
  }

  const getEnv = resolveGetEnv(opts);
  const auth = assertCronAuthorized(
    req,
    [getEnv("CRON_SECRET") ?? "", getEnv("FI_LEADFLOW_CRON_SECRET") ?? ""],
    { alternateTimingSafeHeaderName: "x-fi-leadflow-secret" }
  );
  if (auth) return auth;

  const parsed = parseCronQueryParams(req);
  if (parsed instanceof NextResponse) return parsed;

  const drain = opts?.drainQueue ?? drainHubSpotLeadFlowQueue;

  try {
    const result = await drain({
      tenantId: parsed.tenantId,
      limit: parsed.limit,
    });

    const body: LeadFlowHubspotEventsCronResponse = {
      success: result.success,
      processed: result.processed,
      failed: result.failed,
      retried: result.retried,
      skipped: result.skipped,
      tenants: result.tenants,
      source: "vercel_cron",
    };
    return NextResponse.json(body);
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown_error";
    logStructured("error", "leadflow_hubspot_cron_drain_failed", { message });
    return NextResponse.json({ success: false, error: "Processor unavailable." }, { status: 500 });
  }
}
