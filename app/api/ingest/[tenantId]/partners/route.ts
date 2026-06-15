/**
 * POST /api/ingest/[tenantId]/partners
 * Signed machine ingest for partner creation (per-tenant HMAC). Legacy `/api/fi/partners` remains until migration completes.
 */
import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logStructured } from "@/src/lib/server/structuredLog";
import {
  insertMachineIngestAcceptedAudit,
  insertMachineIngestRejectedAfterVerify,
  verifySignedMachineIngestPartnersRequest,
} from "@/src/lib/fi/machineIngest/machineIngestHmacVerify.server";
import { createFiPartnerFromBody } from "@/src/lib/fi/partners/fiPartnerCreate.server";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Server misconfigured." }, { status: 500 });
    }

    const { tenantId } = await params;
    const bodyBuf = Buffer.from(await req.arrayBuffer());
    const supabase = supabaseAdmin();
    const pathname = new URL(req.url).pathname;

    const verified = await verifySignedMachineIngestPartnersRequest({
      supabase,
      req,
      pathTenantId: tenantId,
      bodyBuf,
    });

    if (!verified.ok) {
      return NextResponse.json(
        { ok: false, error: verified.publicMessage },
        { status: verified.httpStatus }
      );
    }

    const created = await createFiPartnerFromBody(supabase, verified.jsonBody);

    if (!created.ok) {
      await insertMachineIngestRejectedAfterVerify({
        supabase,
        route: pathname,
        tenantId: verified.tenantId,
        kid: verified.kid,
        bodySha256Hex: verified.bodySha256Hex,
        reason_code: "partner_create_failed",
        httpStatus: created.status,
      });
      return NextResponse.json({ ok: false, error: created.error }, { status: created.status });
    }

    await insertMachineIngestAcceptedAudit({
      supabase,
      route: pathname,
      tenantId: verified.tenantId,
      kid: verified.kid,
      bodySha256Hex: verified.bodySha256Hex,
      httpStatus: 200,
    });

    return NextResponse.json({
      ok: true,
      partner: created.partner,
    });
  } catch (e: unknown) {
    logStructured("error", "machine_ingest_partners_route_unhandled", {
      route: "POST /api/ingest/[tenantId]/partners",
      err: e instanceof Error ? e.message : "non_error_throwable",
    });
    return NextResponse.json({ ok: false, error: "Internal server error." }, { status: 500 });
  }
}
