/**
 * POST /api/patient/v1/images/upload-intent
 * FI-PATIENT-APP-1C — issue a short-lived signed upload capability.
 */
import { requirePatientGatewayContext } from "@/src/lib/patientPortal/patientGatewayGate.server";
import { createPatientGatewayUploadIntent } from "@/src/lib/patientPortal/patientGatewayImages.server";
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
    const result = await createPatientGatewayUploadIntent(gate.context, {
      category: body.category,
      mimeType: body.mimeType,
      fileSize: body.fileSize,
    });
    if (!result.ok) return patientGatewayJsonDeny(result);

    return patientGatewayJsonOk({
      intentToken: result.intentToken,
      uploadUrl: result.uploadUrl,
      uploadToken: result.uploadToken,
      expiresAt: result.expiresAt,
      imageId: result.imageId,
      headers: result.headers,
    });
  } catch (e) {
    return mapPatientGatewayRouteError(e);
  }
}
