import "server-only";

import { NextResponse } from "next/server";

import { requestConsultationTrichoscopy } from "@/src/lib/integrations/hliTrichoscopy/consultation/service.server";
import type { TrichoscopyRequestMode } from "@/src/lib/integrations/hliTrichoscopy/consultation/types";
import {
  mapTrichoscopyRouteError,
  resolveConsultationTrichoscopyActor,
} from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODES = new Set([
  "new_assessment",
  "link_existing",
  "repeat_assessment",
  "additional_evidence",
]);

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
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const requestMode = String(body.requestMode ?? "new_assessment");
  if (!MODES.has(requestMode)) {
    return NextResponse.json({ error: "Invalid requestMode" }, { status: 400 });
  }

  try {
    const result = await requestConsultationTrichoscopy({
      tenantId,
      consultationId,
      userId: actor.userId,
      requestMode: requestMode as TrichoscopyRequestMode,
      clientRequestId: body.clientRequestId ? String(body.clientRequestId) : undefined,
      purpose: body.purpose ? String(body.purpose) : undefined,
      requestedSites: Array.isArray(body.requestedSites)
        ? (body.requestedSites as string[])
        : undefined,
      clinicalQuestion: body.clinicalQuestion ? String(body.clinicalQuestion) : undefined,
      urgency: body.urgency === "priority" ? "priority" : "routine",
      capturePathway: body.capturePathway ? String(body.capturePathway) : undefined,
      baselineLinkId: body.baselineLinkId ? String(body.baselineLinkId) : undefined,
      existingLinkId: body.existingLinkId ? String(body.existingLinkId) : undefined,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return mapTrichoscopyRouteError(err);
  }
}
