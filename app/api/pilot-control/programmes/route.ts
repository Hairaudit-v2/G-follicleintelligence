/**
 * GET /api/pilot-control/programmes
 * Lists programmes the authenticated actor may access (tenant-scoped).
 */
import { resolvePilotControlRequestContext } from "@/src/lib/pilotControl/api/resolvePilotControlRequestContext.server";
import { assembleProgrammesResponse } from "@/src/lib/pilotControl/api/pilotControlServices.server";
import {
  mapPilotControlRouteError,
  pilotControlJsonOk,
} from "@/src/lib/pilotControl/api/pilotControlHttp.server";
import { PilotControlApiError } from "@/src/lib/pilotControl/api/pilotControlApiErrors";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let correlationId = "unknown";
  try {
    const ctx = await resolvePilotControlRequestContext({
      request,
      requireProgramme: false,
    });
    correlationId = ctx.correlationId;
    const payload = await assembleProgrammesResponse(ctx);
    return pilotControlJsonOk(payload);
  } catch (e) {
    if (e instanceof PilotControlApiError) correlationId = e.correlationId;
    return mapPilotControlRouteError(e, correlationId);
  }
}
