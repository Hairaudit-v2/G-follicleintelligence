/**
 * POST /api/patient/v1/quotes/[quoteId]/decline
 */
import { requirePatientGatewayContext } from "@/src/lib/patientPortal/patientGatewayGate.server";
import {
  mapPatientGatewayRouteError,
  patientGatewayJsonDeny,
  patientGatewayJsonOk,
} from "@/src/lib/patientPortal/patientGatewayHttp";
import { declinePatientQuoteForGateway } from "@/src/lib/patientJourneyControl/patientGatewayQuotes.server";

export const dynamic = "force-dynamic";

function envReady(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const text = await req.text();
    if (!text.trim()) return {};
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export async function POST(
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
    const body = await readJson(req);
    const reason = typeof body.reason === "string" ? body.reason : null;
    const params = await Promise.resolve(ctx.params);
    const result = await declinePatientQuoteForGateway(gateCtx.context, params.quoteId, reason);
    if (!result.ok) return patientGatewayJsonDeny(result);
    return patientGatewayJsonOk(result);
  } catch (e) {
    return mapPatientGatewayRouteError(e);
  }
}
