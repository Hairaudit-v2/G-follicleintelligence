/**
 * POST /api/patient/v1/images/complete
 * FI-PATIENT-APP-1C — verify ownership and register a completed upload.
 */
import { requirePatientGatewayContext } from "@/src/lib/patientPortal/patientGatewayGate.server";
import { completePatientGatewayUpload } from "@/src/lib/patientPortal/patientGatewayImages.server";
import {
  mapPatientGatewayRouteError,
  patientGatewayJsonDeny,
  patientGatewayJsonOk,
} from "@/src/lib/patientPortal/patientGatewayHttp";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return patientGatewayJsonDeny({
        ok: false,
        code: "misconfigured",
        status: 500,
        message: "Server misconfigured.",
      });
    }

    const gate = await requirePatientGatewayContext(req);
    if (!gate.ok) return patientGatewayJsonDeny(gate);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const result = await completePatientGatewayUpload(gate.context, {
      intentToken: body.intentToken,
      storagePath: body.storagePath,
    });
    if (!result.ok) return patientGatewayJsonDeny(result);

    return patientGatewayJsonOk({
      imageId: result.imageId,
      status: result.status,
    });
  } catch (e) {
    return mapPatientGatewayRouteError(e);
  }
}
