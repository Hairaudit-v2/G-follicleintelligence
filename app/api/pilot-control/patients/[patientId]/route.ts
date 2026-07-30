/**
 * GET /api/pilot-control/patients/:patientId?programmeId=...
 */
import { resolvePilotControlRequestContext } from "@/src/lib/pilotControl/api/resolvePilotControlRequestContext.server";
import { assemblePatientDetailResponse } from "@/src/lib/pilotControl/api/pilotControlServices.server";
import {
  mapPilotControlRouteError,
  pilotControlJsonOk,
} from "@/src/lib/pilotControl/api/pilotControlHttp.server";
import { PilotControlApiError } from "@/src/lib/pilotControl/api/pilotControlApiErrors";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ patientId: string }> }
) {
  let correlationId = "unknown";
  try {
    const { patientId } = await params;
    const url = new URL(request.url);
    const ctx = await resolvePilotControlRequestContext({
      request,
      programmeIdOrKey: url.searchParams.get("programmeId") ?? url.searchParams.get("programmeKey"),
      requireProgramme: true,
    });
    correlationId = ctx.correlationId;
    if (!patientId?.trim()) {
      throw new PilotControlApiError(
        "PILOT_CONTROL_INVALID_FILTER",
        "patientId is required.",
        400,
        correlationId
      );
    }
    const payload = await assemblePatientDetailResponse(ctx, patientId.trim());
    return pilotControlJsonOk(payload);
  } catch (e) {
    if (e instanceof PilotControlApiError) correlationId = e.correlationId;
    return mapPilotControlRouteError(e, correlationId);
  }
}
