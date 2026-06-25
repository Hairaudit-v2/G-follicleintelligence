/**
 * POST /api/internal/leadflow/process-hubspot-events
 * LeadFlowOS LF-2B: drain pending HubSpot fi_external_events into fi_leads.
 * Service-only — requires CRON_SECRET or FI_LEADFLOW_CRON_SECRET (Bearer or x-fi-leadflow-secret).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { drainHubSpotLeadFlowQueue } from "@/src/lib/leadFlow/hubspotLeadFlowQueueDrain.server";
import { assertCronAuthorized } from "@/src/lib/server/cronAuth";
import { logStructured } from "@/src/lib/server/structuredLog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z
  .object({
    tenantId: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  })
  .strict();

export async function GET() {
  return NextResponse.json({ ok: false, error: "Method not allowed." }, { status: 405 });
}

export async function POST(req: NextRequest) {
  const auth = assertCronAuthorized(
    req,
    [process.env.CRON_SECRET ?? "", process.env.FI_LEADFLOW_CRON_SECRET ?? ""],
    { alternateTimingSafeHeaderName: "x-fi-leadflow-secret" }
  );
  if (auth) return auth;

  let rawBody: unknown = {};
  try {
    const text = await req.text();
    if (text.trim()) rawBody = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    const message = parsed.error.errors[0]?.message ?? "Invalid request body.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  try {
    const result = await drainHubSpotLeadFlowQueue({
      tenantId: parsed.data.tenantId,
      limit: parsed.data.limit,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown_error";
    logStructured("error", "leadflow_hubspot_drain_failed", { message });
    return NextResponse.json({ ok: false, error: "Processor unavailable." }, { status: 500 });
  }
}
