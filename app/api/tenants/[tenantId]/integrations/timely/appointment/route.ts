/**
 * POST /api/tenants/[tenantId]/integrations/timely/appointment
 * Zapier → FI OS booking lifecycle sync (Timely appointment id → fi_bookings).
 */
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { z } from "zod";

import { assertTimelyWebhookAuthorized, TimelyWebhookAuthError } from "@/src/lib/integrations/timely/timelyWebhookAuth.server";
import { processTimelyAppointmentWebhook } from "@/src/lib/integrations/timely/timelyAppointmentWebhook.server";
import { extractTimelyAppointmentEventType } from "@/src/lib/integrations/timely/timelyAppointmentLifecycle";
import { timelyAppointmentWebhookSchema } from "@/src/lib/integrations/timely/timelyWebhookSchemas";
import { TIMELY_WEBHOOK_ROUTES, withTimelyWebhookAudit } from "@/src/lib/integrations/timely/timelyWebhookAudit.server";

export const dynamic = "force-dynamic";

const tenantIdParamSchema = z.string().uuid("Invalid tenantId.");

export async function POST(req: Request, ctx: { params: Promise<{ tenantId: string }> }) {
  try {
    assertTimelyWebhookAuthorized(req);
    const { tenantId: rawTenant } = await ctx.params;
    const tenantId = tenantIdParamSchema.parse(rawTenant?.trim());

    const body = await req.json().catch(() => ({}));
    const payload = timelyAppointmentWebhookSchema.parse(body);

    const audited = await withTimelyWebhookAudit<Record<string, unknown>>({
      tenantId,
      route: TIMELY_WEBHOOK_ROUTES.appointment,
      payload,
      eventType: extractTimelyAppointmentEventType(payload) ?? undefined,
      handler: async () => {
        const result = await processTimelyAppointmentWebhook(tenantId, payload);
        if (!result.ok) {
          return { ok: false, message: result.message, status: result.status };
        }
        if ("duplicate" in result) {
          return {
            ok: true,
            value: {
              duplicate: true,
              reason: result.reason,
              booking_id: result.booking_id,
            },
          };
        }
        return {
          ok: true,
          value: {
            booking_id: result.booking_id,
            action: result.action,
            lifecycle_event: result.lifecycle_event,
            lead_id: result.lead_id,
            lead_resolution: result.lead_resolution,
            consultation_id: result.consultation_id,
            consultation_action: result.consultation_action,
            crm_stage_action: result.crm_stage_action,
            crm_stage_slug: result.crm_stage_slug,
            ...(result.unchanged ? { unchanged: true } : {}),
          },
        };
      },
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
      });
    }

    return NextResponse.json({
      success: true,
      event_id: audited.event_id,
      ...audited.value,
    });
  } catch (e) {
    if (e instanceof TimelyWebhookAuthError) {
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
