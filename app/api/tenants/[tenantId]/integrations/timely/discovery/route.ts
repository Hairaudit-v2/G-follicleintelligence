/**
 * POST /api/tenants/[tenantId]/integrations/timely/discovery
 * Temporary Zapier → FI capture of raw Timely payloads (no patient/booking writes).
 */
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { z } from "zod";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertTimelyWebhookAuthorized, TimelyWebhookAuthError } from "@/src/lib/integrations/timely/timelyWebhookAuth.server";
import { extractTimelyDiscoveryEventType } from "@/src/lib/integrations/timely/timelyWebhookEvents.server";
import { TIMELY_WEBHOOK_ROUTES, withTimelyWebhookAudit } from "@/src/lib/integrations/timely/timelyWebhookAudit.server";

export const dynamic = "force-dynamic";

const tenantIdParamSchema = z.string().uuid("Invalid tenantId.");

export async function POST(req: Request, ctx: { params: Promise<{ tenantId: string }> }) {
  try {
    assertTimelyWebhookAuthorized(req);
    const { tenantId: rawTenant } = await ctx.params;
    const tenantId = tenantIdParamSchema.parse(rawTenant?.trim());

    const supabase = supabaseAdmin();
    const { data: tenant, error: te } = await supabase.from("fi_tenants").select("id").eq("id", tenantId).maybeSingle();
    if (te || !tenant) {
      return NextResponse.json({ success: false, error: "Tenant not found." }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: "Expected a JSON body." }, { status: 400 });
    }

    const audited = await withTimelyWebhookAudit({
      tenantId,
      route: TIMELY_WEBHOOK_ROUTES.discovery,
      payload: body,
      eventType: extractTimelyDiscoveryEventType(body),
      supabase,
      handler: async () => ({
        ok: true as const,
        value: { message: "Timely Zapier payload received" },
      }),
    });

    if (!audited.ok) {
      return NextResponse.json(
        { success: false, error: audited.message, event_id: audited.event_id ?? undefined },
        { status: audited.status }
      );
    }

    if ("duplicate" in audited) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        event_id: audited.event_id,
        message: "Timely Zapier payload already received",
      });
    }

    return NextResponse.json({
      success: true,
      event_id: audited.event_id,
      message: audited.value.message,
    });
  } catch (e) {
    if (e instanceof TimelyWebhookAuthError) {
      return NextResponse.json({ success: false, error: e.message }, { status: e.status });
    }
    if (e instanceof ZodError) {
      const msg = e.errors[0]?.message ?? "Invalid tenantId.";
      return NextResponse.json({ success: false, error: msg }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : "Unexpected error.";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
