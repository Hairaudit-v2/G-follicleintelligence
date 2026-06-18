/**
 * POST /api/tenants/[tenantId]/integrations/hubspot/deal
 * HubSpot Deal Sync: upsert fi_revenue_pipeline intelligence + append fi_patient_timeline.
 * Read-only against patient/person/lead/quote records — never overwrites them.
 */
import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import {
  assertHubspotWebhookAuthorized,
  HubspotWebhookAuthError,
} from "@/src/lib/integrations/hubspot/hubspotWebhookAuth.server";
import { processHubspotDealWebhook } from "@/src/lib/integrations/hubspot/hubspotTimelineProcessors.server";
import { hubspotDealWebhookSchema } from "@/src/lib/integrations/hubspot/hubspotTimelineSchemas";
import {
  HUBSPOT_TIMELINE_ROUTES,
  withHubspotTimelineAudit,
} from "@/src/lib/integrations/hubspot/hubspotTimelineWebhookAudit.server";

export const dynamic = "force-dynamic";

const tenantIdParamSchema = z.string().uuid("Invalid tenantId.");

export async function POST(req: Request, ctx: { params: Promise<{ tenantId: string }> }) {
  try {
    assertHubspotWebhookAuthorized(req);
    const { tenantId: rawTenant } = await ctx.params;
    const tenantId = tenantIdParamSchema.parse(rawTenant?.trim());

    const body = await req.json().catch(() => ({}));
    const payload = hubspotDealWebhookSchema.parse(body);

    const audited = await withHubspotTimelineAudit<Record<string, unknown>>({
      tenantId,
      route: HUBSPOT_TIMELINE_ROUTES.deal,
      kind: "deal",
      payload,
      handler: async () => {
        const result = await processHubspotDealWebhook(tenantId, payload);
        if (!result.ok) return { ok: false, message: result.message, status: result.status };
        return { ok: true, value: { ...result.value } };
      },
    });

    if (!audited.ok) {
      return NextResponse.json(
        { success: false, error: audited.message, event_id: audited.event_id ?? undefined },
        { status: audited.status }
      );
    }
    if ("duplicate" in audited) {
      return NextResponse.json({ success: true, duplicate: true, event_id: audited.event_id });
    }
    return NextResponse.json({ success: true, event_id: audited.event_id, ...audited.value });
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
