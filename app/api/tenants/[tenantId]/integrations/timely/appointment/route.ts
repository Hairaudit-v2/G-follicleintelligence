/**
 * POST /api/tenants/[tenantId]/integrations/timely/appointment
 * Zapier → FI OS booking (Timely appointment id → fi_external_entity_mappings + fi_bookings).
 */
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { z } from "zod";

import { assertTimelyWebhookAuthorized, TimelyWebhookAuthError } from "@/src/lib/integrations/timely/timelyWebhookAuth.server";
import { timelyAppointmentWebhookSchema } from "@/src/lib/integrations/timely/timelyWebhookSchemas";
import { processTimelyAppointmentWebhook } from "@/src/lib/integrations/timely/timelyAppointmentWebhook.server";

export const dynamic = "force-dynamic";

const tenantIdParamSchema = z.string().uuid("Invalid tenantId.");

export async function POST(req: Request, ctx: { params: Promise<{ tenantId: string }> }) {
  try {
    assertTimelyWebhookAuthorized(req);
    const { tenantId: rawTenant } = await ctx.params;
    const tenantId = tenantIdParamSchema.parse(rawTenant?.trim());

    const body = await req.json().catch(() => ({}));
    const payload = timelyAppointmentWebhookSchema.parse(body);

    const result = await processTimelyAppointmentWebhook(tenantId, payload);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.message }, { status: result.status });
    }

    const bodyOut: { success: true; booking_id: string; duplicate?: boolean } = {
      success: true,
      booking_id: result.booking_id,
    };
    if (result.duplicate) bodyOut.duplicate = true;

    return NextResponse.json(bodyOut);
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
