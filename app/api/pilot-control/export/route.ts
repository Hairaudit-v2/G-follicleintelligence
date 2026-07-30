/**
 * GET /api/pilot-control/export?programmeId=...&type=...&format=csv|json
 */
import { NextResponse } from "next/server";

import { resolvePilotControlRequestContext } from "@/src/lib/pilotControl/api/resolvePilotControlRequestContext.server";
import { assembleExportResponse } from "@/src/lib/pilotControl/api/pilotControlServices.server";
import { mapPilotControlRouteError } from "@/src/lib/pilotControl/api/pilotControlHttp.server";
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
    const result = await assembleExportResponse(ctx, url.searchParams);
    return new NextResponse(result.body, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "X-Correlation-Id": ctx.correlationId,
      },
    });
  } catch (e) {
    if (e instanceof PilotControlApiError) correlationId = e.correlationId;
    return mapPilotControlRouteError(e, correlationId);
  }
}
