/**
 * GET /api/patient/v1/me
 * FI-PATIENT-APP-1B — authenticated patient-safe profile for the external patient client.
 *
 * Canonical patient identity is always derived server-side from the Bearer JWT
 * via fi_patients.portal_auth_user_id. Client-supplied patient ids are ignored
 * for resolution and denied on mismatch.
 */
import { requirePatientGatewayContext } from "@/src/lib/patientPortal/patientGatewayGate.server";
import {
  mapPatientGatewayRouteError,
  patientGatewayJsonDeny,
  patientGatewayJsonOk,
} from "@/src/lib/patientPortal/patientGatewayHttp";
import { loadPatientGatewayMe } from "@/src/lib/patientPortal/patientGatewayMe.server";

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

    const me = await loadPatientGatewayMe(gate.context);
    return patientGatewayJsonOk(me);
  } catch (e) {
    return mapPatientGatewayRouteError(e);
  }
}
