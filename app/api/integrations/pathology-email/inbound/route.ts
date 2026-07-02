/**
 * POST /api/integrations/pathology-email/inbound
 * Provider-agnostic pathology inbound email webhook (Mailgun, SendGrid, Postmark, etc.).
 */
import { NextResponse } from "next/server";

import { logStructured } from "@/src/lib/server/structuredLog";
import { normalizePathologyEmailWebhookPayload } from "@/src/lib/pathology/email/pathologyEmailAttachmentParser.server";
import { ingestPathologyEmailWebhook } from "@/src/lib/pathology/email/pathologyEmailIngestion.server";
import {
  assertPathologyEmailWebhookAuthorized,
  PathologyEmailIngestionDisabledError,
  PathologyEmailWebhookAuthError,
} from "@/src/lib/pathology/email/pathologyEmailIngestionSecurity.server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Service unavailable." }, { status: 503 });
    }

    assertPathologyEmailWebhookAuthorized(req);

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ ok: false, error: "Invalid webhook payload." }, { status: 400 });
    }

    const payload = normalizePathologyEmailWebhookPayload(body);
    const result = await ingestPathologyEmailWebhook(payload);

    if (!result.ok) {
      logStructured("warn", "pathology_email_ingestion_rejected", {
        route: "POST /api/integrations/pathology-email/inbound",
        httpStatus: result.httpStatus,
        reason: result.publicMessage,
      });
      return NextResponse.json({ ok: false, error: result.publicMessage }, { status: result.httpStatus });
    }

    return NextResponse.json(
      {
        ok: true,
        status: result.status,
        duplicate: result.duplicate,
        message_id: result.messageId,
        tenant_id: result.tenantId,
        accepted_attachment_count: result.acceptedCount,
        rejected_attachment_count: result.rejectedCount,
        created_inbound_document_ids: result.createdDocumentIds,
      },
      { status: 200 }
    );
  } catch (e) {
    if (e instanceof PathologyEmailIngestionDisabledError) {
      return NextResponse.json({ ok: false, error: "Service unavailable." }, { status: 503 });
    }
    if (e instanceof PathologyEmailWebhookAuthError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }

    logStructured("error", "pathology_email_ingestion_unhandled", {
      route: "POST /api/integrations/pathology-email/inbound",
      err: e instanceof Error ? e.message : "non_error_throwable",
    });
    return NextResponse.json({ ok: false, error: "Internal server error." }, { status: 500 });
  }
}
