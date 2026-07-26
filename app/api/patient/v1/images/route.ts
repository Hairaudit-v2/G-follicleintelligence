/**
 * GET /api/patient/v1/images
 * FI-PATIENT-APP-1C — list images for the authenticated portal patient only.
 */
import { requirePatientGatewayContext } from "@/src/lib/patientPortal/patientGatewayGate.server";
import { listPatientGatewayImages } from "@/src/lib/patientPortal/patientGatewayImages.server";
import {
  mapPatientGatewayRouteError,
  patientGatewayJsonDeny,
  patientGatewayJsonOk,
} from "@/src/lib/patientPortal/patientGatewayHttp";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
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

    const url = new URL(req.url);
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw ? Number(limitRaw) : 40;

    const result = await listPatientGatewayImages(gate.context, {
      limit: Number.isFinite(limit) ? limit : 40,
    });
    if (!result.ok) return patientGatewayJsonDeny(result);

    return patientGatewayJsonOk({ images: result.images });
  } catch (e) {
    return mapPatientGatewayRouteError(e);
  }
}
