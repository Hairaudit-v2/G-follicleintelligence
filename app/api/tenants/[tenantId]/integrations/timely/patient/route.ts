/**
 * POST /api/tenants/[tenantId]/integrations/timely/patient
 * Zapier → FI OS patient upsert (Timely customer id → fi_patient_source_ids).
 */
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { z } from "zod";

import { assertTimelyWebhookAuthorized, TimelyWebhookAuthError } from "@/src/lib/integrations/timely/timelyWebhookAuth.server";
import { processTimelyPatientWebhook } from "@/src/lib/integrations/timely/timelyPatientWebhook.server";
import { timelyPatientWebhookSchema } from "@/src/lib/integrations/timely/timelyWebhookSchemas";
import { TIMELY_WEBHOOK_ROUTES, withTimelyWebhookAudit } from "@/src/lib/integrations/timely/timelyWebhookAudit.server";

export const dynamic = "force-dynamic";

const tenantIdParamSchema = z.string().uuid("Invalid tenantId.");

export async function POST(req: Request, ctx: { params: Promise<{ tenantId: string }> }) {
  try {
    assertTimelyWebhookAuthorized(req);
    const { tenantId: rawTenant } = await ctx.params;
    const tenantId = tenantIdParamSchema.parse(rawTenant?.trim());

    const body = await req.json().catch(() => ({}));
    const payload = timelyPatientWebhookSchema.parse(body);

    const audited = await withTimelyWebhookAudit({
      tenantId,
      route: TIMELY_WEBHOOK_ROUTES.patient,
      payload,
      eventType: "timely.patient.upsert",
      handler: async () => {
        const result = await processTimelyPatientWebhook(tenantId, payload);
        if (!result.ok) {
          return { ok: false, message: result.message, status: result.status };
        }
        return {
          ok: true,
          value: {
            patient_id: result.patient_id,
            person_id: result.person_id,
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
