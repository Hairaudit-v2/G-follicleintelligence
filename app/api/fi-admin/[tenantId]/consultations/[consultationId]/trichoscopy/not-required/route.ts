import "server-only";

import { NextResponse } from "next/server";

import { markConsultationTrichoscopyNotRequired } from "@/src/lib/integrations/hliTrichoscopy/consultation/service.server";
import {
  mapTrichoscopyRouteError,
  resolveConsultationTrichoscopyActor,
} from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
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

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    await markConsultationTrichoscopyNotRequired({
      tenantId,
      consultationId,
      userId: actor.userId,
      reason: body.reason ? String(body.reason) : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return mapTrichoscopyRouteError(err);
  }
}
