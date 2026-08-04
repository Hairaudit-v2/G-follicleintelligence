import "server-only";

import { NextResponse } from "next/server";

import { requestConsultationTrichoscopy } from "@/src/lib/integrations/hliTrichoscopy/consultation/service.server";
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

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body?.existingLinkId) {
    return NextResponse.json({ error: "existingLinkId is required" }, { status: 400 });
  }

  try {
    const result = await requestConsultationTrichoscopy({
      tenantId,
      consultationId,
      userId: actor.userId,
      requestMode: "link_existing",
      existingLinkId: String(body.existingLinkId),
      clientRequestId: body.clientRequestId ? String(body.clientRequestId) : undefined,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return mapTrichoscopyRouteError(err);
  }
}
