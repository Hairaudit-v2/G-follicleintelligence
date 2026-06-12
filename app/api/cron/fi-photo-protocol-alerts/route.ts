/**
 * POST or GET /api/cron/fi-photo-protocol-alerts
 *
 * Authorisation: Bearer `FI_PHOTO_PROTOCOL_ALERTS_CRON_SECRET` or `CRON_SECRET`, or header `x-fi-photo-protocol-alerts-secret`.
 *
 * Query: optional `tenantId` (UUID) to process a single tenant; otherwise iterates `fi_tenants` (capped) and upserts alerts per tenant.
 */
import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertCronAuthorized } from "@/src/lib/server/cronAuth";
import { upsertPhotoProtocolAlertEventsForTenant } from "@/src/lib/hair-intelligence/photoProtocols/protocolAlertEvents.server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  const auth = assertCronAuthorized(
    req,
    [process.env.FI_PHOTO_PROTOCOL_ALERTS_CRON_SECRET ?? "", process.env.CRON_SECRET ?? ""],
    { alternateTimingSafeHeaderName: "x-fi-photo-protocol-alerts-secret" }
  );
  if (auth) return auth;

  const url = new URL(req.url);
  const singleTenant = url.searchParams.get("tenantId")?.trim() || null;

  try {
    if (singleTenant) {
      const r = await upsertPhotoProtocolAlertEventsForTenant(singleTenant, {});
      return NextResponse.json({ ok: true, mode: "single_tenant", tenantId: singleTenant, ...r });
    }

    const supabase = supabaseAdmin();
    const { data: tenants, error } = await supabase.from("fi_tenants").select("id").order("name").limit(500);
    if (error) throw new Error(error.message);

    const ids = (tenants ?? []).map((t) => String((t as { id: string }).id));
    const perTenant: { tenant_id: string; upserted: number; computed_count: number; error?: string }[] = [];

    for (const tid of ids) {
      try {
        const r = await upsertPhotoProtocolAlertEventsForTenant(tid, {});
        perTenant.push({ tenant_id: tid, upserted: r.upserted, computed_count: r.computed_count });
      } catch (e) {
        perTenant.push({
          tenant_id: tid,
          upserted: 0,
          computed_count: 0,
          error: e instanceof Error ? e.message : "upsert_failed",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      mode: "all_tenants",
      tenants: ids.length,
      results: perTenant,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Processor unavailable." }, { status: 500 });
  }
}
