/**
 * POST /api/tenants/[tenantId]/integrations/timely/patient
 * Zapier → FI OS patient upsert (Timely customer id → fi_patient_source_ids).
 */
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { z } from "zod";

import { assertTimelyWebhookAuthorized, TimelyWebhookAuthError } from "@/src/lib/integrations/timely/timelyWebhookAuth.server";
import { timelyPatientWebhookSchema } from "@/src/lib/integrations/timely/timelyWebhookSchemas";
import { processTimelyPatientWebhook } from "@/src/lib/integrations/timely/timelyPatientWebhook.server";

export const dynamic = "force-dynamic";

const tenantIdParamSchema = z.string().uuid("Invalid tenantId.");

export async function POST(req: Request, ctx: { params: Promise<{ tenantId: string }> }) {
  try {
    assertTimelyWebhookAuthorized(req);
    const { tenantId: rawTenant } = await ctx.params;
    const tenantId = tenantIdParamSchema.parse(rawTenant?.trim());

    const body = await req.json().catch(() => ({}));
    const payload = timelyPatientWebhookSchema.parse(body);

    const result = await processTimelyPatientWebhook(tenantId, payload);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.message }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      patient_id: result.patient_id,
      person_id: result.person_id,
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
