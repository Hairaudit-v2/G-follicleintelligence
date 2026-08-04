import "server-only";

import { NextResponse } from "next/server";

import { createConsultationTrichoscopyAction } from "@/src/lib/integrations/hliTrichoscopy/consultation/service.server";
import {
  TRICHOSCOPY_DECISION_KINDS,
  type TrichoscopyDecisionKind,
  type TrichoscopyInvestigationCategory,
} from "@/src/lib/integrations/hliTrichoscopy/consultation/types";
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
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const decisionKind = String(body.decisionKind ?? "");
  if (!(TRICHOSCOPY_DECISION_KINDS as readonly string[]).includes(decisionKind)) {
    return NextResponse.json({ error: "Invalid decisionKind" }, { status: 400 });
  }

  const targetEntityType = String(body.targetEntityType ?? "").trim();
  if (!targetEntityType) {
    return NextResponse.json({ error: "targetEntityType is required" }, { status: 400 });
  }

  try {
    const result = await createConsultationTrichoscopyAction({
      tenantId,
      consultationId,
      userId: actor.userId,
      decisionKind: decisionKind as TrichoscopyDecisionKind,
      findingId: body.findingId ? String(body.findingId) : undefined,
      findingReviewId: body.findingReviewId ? String(body.findingReviewId) : undefined,
      targetEntityType,
      targetEntityId: body.targetEntityId ? String(body.targetEntityId) : undefined,
      targetCode: body.targetCode ? String(body.targetCode) : undefined,
      decisionSummary: body.decisionSummary ? String(body.decisionSummary) : undefined,
      qualificationNote: body.qualificationNote ? String(body.qualificationNote) : undefined,
      investigationCategory: body.investigationCategory
        ? (String(body.investigationCategory) as TrichoscopyInvestigationCategory)
        : undefined,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return mapTrichoscopyRouteError(err);
  }
}
