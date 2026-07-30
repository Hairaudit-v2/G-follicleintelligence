/**
 * GET /api/pilot-control/patients?programmeId=...&page=&pageSize=...
 */
import { resolvePilotControlRequestContext } from "@/src/lib/pilotControl/api/resolvePilotControlRequestContext.server";
import { assemblePatientRegisterResponse } from "@/src/lib/pilotControl/api/pilotControlServices.server";
import {
  mapPilotControlRouteError,
  pilotControlJsonOk,
} from "@/src/lib/pilotControl/api/pilotControlHttp.server";
import { PilotControlApiError } from "@/src/lib/pilotControl/api/pilotControlApiErrors";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let correlationId = "unknown";
  try {
    const url = new URL(request.url);
    const ctx = await resolvePilotControlRequestContext({
      request,
      programmeIdOrKey: url.searchParams.get("programmeId") ?? url.searchParams.get("programmeKey"),
      requireProgramme: true,
    });
    correlationId = ctx.correlationId;
    const payload = await assemblePatientRegisterResponse(ctx, url.searchParams);
    return pilotControlJsonOk(payload);
  } catch (e) {
    if (e instanceof PilotControlApiError) correlationId = e.correlationId;
    return mapPilotControlRouteError(e, correlationId);
  }
}
