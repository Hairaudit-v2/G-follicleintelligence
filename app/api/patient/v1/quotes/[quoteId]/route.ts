/**
 * GET /api/patient/v1/quotes/[quoteId]
 */
import { requirePatientGatewayContext } from "@/src/lib/patientPortal/patientGatewayGate.server";
import {
  mapPatientGatewayRouteError,
  patientGatewayJsonDeny,
  patientGatewayJsonOk,
} from "@/src/lib/patientPortal/patientGatewayHttp";
import { getPatientQuoteForGateway } from "@/src/lib/patientJourneyControl/patientGatewayQuotes.server";

export const dynamic = "force-dynamic";

function envReady(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ quoteId: string }> }
) {
  try {
    if (!envReady()) {
      return patientGatewayJsonDeny({
        ok: false,
        code: "misconfigured",
        status: 500,
        message: "Server misconfigured.",
      });
    }
    const gateCtx = await requirePatientGatewayContext(req);
    if (!gateCtx.ok) return patientGatewayJsonDeny(gateCtx);
    const params = await Promise.resolve(ctx.params);
    const result = await getPatientQuoteForGateway(gateCtx.context, params.quoteId);
    if (!result.ok) return patientGatewayJsonDeny(result);
    return patientGatewayJsonOk(result);
  } catch (e) {
    return mapPatientGatewayRouteError(e);
  }
}
