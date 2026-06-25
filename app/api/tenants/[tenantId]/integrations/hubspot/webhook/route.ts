/**
 * POST /api/tenants/[tenantId]/integrations/hubspot/webhook
 * LeadFlowOS LF-2: queue HubSpot contact/deal webhook payloads into fi_external_events.
 * Processing runs asynchronously via the LeadFlow processor (not in-request).
 */
import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import {
  assertHubspotLeadFlowWebhookAuthorized,
  HubspotWebhookAuthError,
} from "@/src/lib/integrations/hubspot/hubspotWebhookAuth.server";
import { queueHubSpotLeadFlowWebhookEvents } from "@/src/lib/leadFlow/hubspotLeadFlowWebhook.server";

export const dynamic = "force-dynamic";

const tenantIdParamSchema = z.string().uuid("Invalid tenantId.");

export async function POST(req: Request, ctx: { params: Promise<{ tenantId: string }> }) {
  try {
    const rawBody = await req.text();
    assertHubspotLeadFlowWebhookAuthorized(req, rawBody);
    const { tenantId: rawTenant } = await ctx.params;
    const tenantId = tenantIdParamSchema.parse(rawTenant?.trim());

    const body = (() => {
      if (!rawBody.trim()) return {};
      try {
        return JSON.parse(rawBody) as unknown;
      } catch {
        return {};
      }
    })();
    const result = await queueHubSpotLeadFlowWebhookEvents(tenantId, body);

    return NextResponse.json({
      success: true,
      queued: result.queued,
      duplicates: result.duplicates,
      events: result.events,
    });
  } catch (e) {
    if (e instanceof HubspotWebhookAuthError) {
      return NextResponse.json({ success: false, error: e.message }, { status: e.status });
    }
    if (e instanceof ZodError) {
      const msg = e.errors[0]?.message ?? "Invalid payload.";
      return NextResponse.json({ success: false, error: msg }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : "Unexpected error.";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
