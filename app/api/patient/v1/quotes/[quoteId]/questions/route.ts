/**
 * POST /api/patient/v1/quotes/[quoteId]/questions
 */
import { requirePatientGatewayContext } from "@/src/lib/patientPortal/patientGatewayGate.server";
import { writePatientGatewayAudit } from "@/src/lib/patientPortal/patientGatewayAudit.server";
import {
  mapPatientGatewayRouteError,
  patientGatewayJsonDeny,
  patientGatewayJsonOk,
} from "@/src/lib/patientPortal/patientGatewayHttp";
import { getPatientQuoteForGateway } from "@/src/lib/patientJourneyControl/patientGatewayQuotes.server";
import {
  ensurePatientGatewayCategoryThread,
  sendPatientGatewayMessage,
} from "@/src/lib/patientPortal/patientGatewayMessaging.server";

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
  ctx: { params: Promise<{ quoteId: string }> | { quoteId: string } }
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
    const quote = await getPatientQuoteForGateway(gateCtx.context, params.quoteId);
    if (!quote.ok) return patientGatewayJsonDeny(quote);
    const body = await readJson(req);
    const question =
      typeof body.body === "string"
        ? body.body
        : typeof body.question === "string"
          ? body.question
          : "";
    const prefixed = question.trim()
      ? ("Quote " + params.quoteId + ": " + question.trim())
      : "";
    const thread = await ensurePatientGatewayCategoryThread(gateCtx.context, "general");
    const result = await sendPatientGatewayMessage(gateCtx.context, thread.id, {
      body: prefixed || question,
    });
    if (!result.ok) return patientGatewayJsonDeny(result);
    return patientGatewayJsonOk({ ok: true, message: result.message, threadId: thread.id });
  } catch (e) {
    return mapPatientGatewayRouteError(e);
  }
}
