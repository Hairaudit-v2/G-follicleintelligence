import "server-only";

import { NextResponse } from "next/server";

import { loadConsultationTrichoscopyWorkspace } from "@/src/lib/integrations/hliTrichoscopy/consultation/service.server";
import {
  mapTrichoscopyRouteError,
  resolveConsultationTrichoscopyActor,
} from "./_shared";

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
    const workspace = await loadConsultationTrichoscopyWorkspace({
      tenantId,
      consultationId,
      userId: actor.userId,
    });
    return NextResponse.json({ ok: true, ...workspace });
  } catch (err) {
    return mapTrichoscopyRouteError(err);
  }
}
