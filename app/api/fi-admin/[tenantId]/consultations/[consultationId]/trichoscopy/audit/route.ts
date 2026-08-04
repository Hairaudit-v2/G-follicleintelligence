import "server-only";

import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireTenantModuleCapability } from "@/src/lib/entitlements/requireTenantModuleCapability";
import {
  mapTrichoscopyRouteError,
  resolveConsultationTrichoscopyActor,
} from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ tenantId: string; consultationId: string }> }
): Promise<NextResponse> {
  const { tenantId: rawTenantId, consultationId: rawConsultationId } = await ctx.params;
  const tenantId = rawTenantId?.trim();
  const consultationId = rawConsultationId?.trim();
  if (!tenantId || !consultationId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const actor = await resolveConsultationTrichoscopyActor({ tenantId });
  if ("error" in actor) return actor.error;

  try {
    const access = await requireTenantModuleCapability({
      tenantId,
      userId: actor.userId,
      capability: "trichoscopy.view_audit_history",
      concealModule: true,
      allowHistoricalReadOnly: true,
    });
    if (!access.ok) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("fi_hli_trichoscopy_consultation_audit")
      .select(
        "id, action, source, actor_user_id, evidence_pack_id, pack_version, finding_id, payload, created_at"
      )
      .eq("tenant_id", tenantId)
      .eq("consultation_id", consultationId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    return NextResponse.json({ ok: true, events: data ?? [] });
  } catch (err) {
    return mapTrichoscopyRouteError(err);
  }
}
