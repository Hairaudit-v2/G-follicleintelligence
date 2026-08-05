import "server-only";

import { NextResponse } from "next/server";

import { reviewConsultationTrichoscopyFinding } from "@/src/lib/integrations/hliTrichoscopy/consultation/service.server";
import type { TrichoscopyAcknowledgementState } from "@/src/lib/integrations/hliTrichoscopy/consultation/types";
import { TRICHOSCOPY_ACKNOWLEDGEMENT_STATES } from "@/src/lib/integrations/hliTrichoscopy/consultation/types";
import {
  mapTrichoscopyRouteError,
  resolveConsultationTrichoscopyActor,
} from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  ctx: {
    params: Promise<{ tenantId: string; consultationId: string; findingId: string }>;
  }
): Promise<NextResponse> {
  const { tenantId: rawTenantId, consultationId: rawConsultationId, findingId: rawFindingId } =
    await ctx.params;
  const tenantId = rawTenantId?.trim();
  const consultationId = rawConsultationId?.trim();
  const findingId = rawFindingId?.trim();
  if (!tenantId || !consultationId || !findingId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const actor = await resolveConsultationTrichoscopyActor({ tenantId });
  if ("error" in actor) return actor.error;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const acknowledgementState = String(body.acknowledgementState ?? "");
  if (
    !(TRICHOSCOPY_ACKNOWLEDGEMENT_STATES as readonly string[]).includes(acknowledgementState)
  ) {
    return NextResponse.json({ error: "Invalid acknowledgementState" }, { status: 400 });
  }

  try {
    const result = await reviewConsultationTrichoscopyFinding({
      tenantId,
      consultationId,
      findingId,
      userId: actor.userId,
      acknowledgementState: acknowledgementState as TrichoscopyAcknowledgementState,
      clinicianInterpretation: body.clinicianInterpretation
        ? String(body.clinicianInterpretation)
        : undefined,
      disagreementReason: body.disagreementReason ? String(body.disagreementReason) : undefined,
      qualificationNote: body.qualificationNote ? String(body.qualificationNote) : undefined,
      associatedActionType: body.associatedActionType
        ? String(body.associatedActionType)
        : undefined,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return mapTrichoscopyRouteError(err);
  }
}
