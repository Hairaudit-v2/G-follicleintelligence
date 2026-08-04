import "server-only";

import { NextResponse } from "next/server";

import { upsertConsultationTrichoscopyIndication } from "@/src/lib/integrations/hliTrichoscopy/consultation/service.server";
import { isTrichoscopyIndicationCode } from "@/src/lib/integrations/hliTrichoscopy/consultation/status";
import type { TrichoscopyIndicationCode } from "@/src/lib/integrations/hliTrichoscopy/consultation/types";
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

  const indicationCodes = (
    Array.isArray(body.indicationCodes) ? body.indicationCodes : []
  )
    .map(String)
    .filter(isTrichoscopyIndicationCode) as TrichoscopyIndicationCode[];

  try {
    const result = await upsertConsultationTrichoscopyIndication({
      tenantId,
      consultationId,
      userId: actor.userId,
      indication: {
        indicationCodes,
        clinicianNote: body.clinicianNote ? String(body.clinicianNote) : null,
        urgency:
          body.urgency === "urgent" || body.urgency === "priority"
            ? (body.urgency as "urgent" | "priority")
            : "routine",
        anatomicalRegions: Array.isArray(body.anatomicalRegions)
          ? (body.anatomicalRegions as string[])
          : [],
        waitForTreatmentPlanning: Boolean(body.waitForTreatmentPlanning),
        medicalReviewRequired: Boolean(body.medicalReviewRequired),
        patientConsentCapture: Boolean(body.patientConsentCapture),
        patientConsentTransfer: Boolean(body.patientConsentTransfer),
        symptoms: body.symptoms ? String(body.symptoms) : null,
        onsetProgression: body.onsetProgression ? String(body.onsetProgression) : null,
        knownDiagnoses: body.knownDiagnoses ? String(body.knownDiagnoses) : null,
        currentTreatments: body.currentTreatments ? String(body.currentTreatments) : null,
        relevantMedications: body.relevantMedications ? String(body.relevantMedications) : null,
        recentProcedures: body.recentProcedures ? String(body.recentProcedures) : null,
        availableBloodResultsSummary: body.availableBloodResultsSummary
          ? String(body.availableBloodResultsSummary)
          : null,
        clinicianQuestion: body.clinicianQuestion ? String(body.clinicianQuestion) : null,
      },
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return mapTrichoscopyRouteError(err);
  }
}
