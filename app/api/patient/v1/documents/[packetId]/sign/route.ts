/**
 * POST /api/patient/v1/documents/[packetId]/sign
 */
import { requirePatientGatewayContext } from "@/src/lib/patientPortal/patientGatewayGate.server";
import { writePatientGatewayAudit } from "@/src/lib/patientPortal/patientGatewayAudit.server";
import {
  mapPatientGatewayRouteError,
  patientGatewayJsonDeny,
  patientGatewayJsonOk,
} from "@/src/lib/patientPortal/patientGatewayHttp";
import { signPatientDocumentPacketForGateway } from "@/src/lib/patientJourneyControl/patientGatewayDocuments.server";

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
  ctx: { params: Promise<{ packetId: string }> | { packetId: string } }
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
    const body = await readJson(req);
    const signedByName =
      typeof body.signedByName === "string"
        ? body.signedByName
        : typeof body.name === "string"
          ? body.name
          : "";
    const result = await signPatientDocumentPacketForGateway(
      gateCtx.context,
      params.packetId,
      signedByName
    );
    if (!result.ok) return patientGatewayJsonDeny(result);
    return patientGatewayJsonOk(result);
  } catch (e) {
    return mapPatientGatewayRouteError(e);
  }
}
