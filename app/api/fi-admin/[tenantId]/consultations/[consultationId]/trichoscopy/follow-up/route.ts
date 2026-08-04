import "server-only";

import { NextResponse } from "next/server";

import { scheduleConsultationTrichoscopyFollowUp } from "@/src/lib/integrations/hliTrichoscopy/consultation/service.server";
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

  try {
    const result = await scheduleConsultationTrichoscopyFollowUp({
      tenantId,
      consultationId,
      userId: actor.userId,
      targetDate: body.targetDate ? String(body.targetDate) : undefined,
      targetIntervalMonths: body.targetIntervalMonths
        ? Number(body.targetIntervalMonths)
        : undefined,
      regionsToRepeat: Array.isArray(body.regionsToRepeat)
        ? (body.regionsToRepeat as string[])
        : undefined,
      treatmentBeingMonitored: body.treatmentBeingMonitored
        ? String(body.treatmentBeingMonitored)
        : undefined,
      expectedEvidenceRequirements: body.expectedEvidenceRequirements
        ? String(body.expectedEvidenceRequirements)
        : undefined,
      patientInstructions: body.patientInstructions
        ? String(body.patientInstructions)
        : undefined,
      responsibleTeam: body.responsibleTeam ? String(body.responsibleTeam) : undefined,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return mapTrichoscopyRouteError(err);
  }
}
