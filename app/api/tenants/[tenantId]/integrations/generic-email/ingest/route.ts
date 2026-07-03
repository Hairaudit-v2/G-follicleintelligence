/**
 * POST /api/tenants/[tenantId]/integrations/generic-email/ingest
 * Manual/test generic clinic email activity ingestion (metadata-only).
 */
import { NextResponse } from "next/server";

import { logStructured } from "@/src/lib/server/structuredLog";
import {
  assertGenericClinicEmailWebhookAuthorized,
  GenericEmailIngestionDisabledError,
  GenericEmailWebhookAuthError,
} from "@/src/lib/integrations/genericEmail/genericEmailActivityIngestionSecurity.server";
import {
  ingestGenericEmailActivity,
  normalizeGenericEmailIngestPayload,
} from "@/src/lib/integrations/genericEmail/genericEmailActivityIngestion.server";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ tenantId: string }> }
) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Service unavailable." }, { status: 503 });
    }

    assertGenericClinicEmailWebhookAuthorized(req);

    const { tenantId } = await ctx.params;
    const tid = tenantId?.trim();
    if (!tid) {
      return NextResponse.json({ ok: false, error: "tenantId is required." }, { status: 400 });
    }

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });
    }

    const normalized = normalizeGenericEmailIngestPayload(body);
    const result = await ingestGenericEmailActivity({ tenantId: tid, ...normalized });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.publicMessage }, { status: result.httpStatus });
    }

    if (result.duplicate) {
      return NextResponse.json(
        { ok: true, duplicate: true, activity_id: result.activityId },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        duplicate: false,
        activity_id: result.activity.id,
        match_status: result.activity.match_status,
        matched_lead_id: result.activity.matched_lead_id,
        matched_patient_id: result.activity.matched_patient_id,
        crm_activity_event_id: result.crmActivityEventId,
      },
      { status: 200 }
    );
  } catch (e) {
    if (e instanceof GenericEmailIngestionDisabledError) {
      return NextResponse.json({ ok: false, error: "Service unavailable." }, { status: 503 });
    }
    if (e instanceof GenericEmailWebhookAuthError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }

    logStructured("error", "generic_clinic_email_ingestion_unhandled", {
      route: "POST /api/tenants/[tenantId]/integrations/generic-email/ingest",
      err: e instanceof Error ? e.message : "non_error_throwable",
    });
    return NextResponse.json({ ok: false, error: "Internal server error." }, { status: 500 });
  }
}
