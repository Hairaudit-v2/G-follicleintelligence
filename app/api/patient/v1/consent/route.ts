/**
 * GET/POST /api/patient/v1/consent
 * Patient photography consent gate status + in-app attestation.
 *
 * Identity is resolved server-side from the Bearer JWT. Client never supplies
 * tenantId / patientId for authorization.
 */
import { requirePatientGatewayContext } from "@/src/lib/patientPortal/patientGatewayGate.server";
import {
  getPatientGatewayConsent,
  recordPatientGatewayConsent,
} from "@/src/lib/patientPortal/patientGatewayConsent.server";
import {
  mapPatientGatewayRouteError,
  patientGatewayJsonDeny,
  patientGatewayJsonOk,
} from "@/src/lib/patientPortal/patientGatewayHttp";

export const dynamic = "force-dynamic";

function envReady(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function GET(req: Request) {
  try {
    if (!envReady()) {
      return patientGatewayJsonDeny({
        ok: false,
        code: "misconfigured",
        status: 500,
        message: "Server misconfigured.",
      });
    }

    const gate = await requirePatientGatewayContext(req);
    if (!gate.ok) return patientGatewayJsonDeny(gate);

    const status = await getPatientGatewayConsent(gate.context);
    return patientGatewayJsonOk(status);
  } catch (e) {
    return mapPatientGatewayRouteError(e);
  }
}

export async function POST(req: Request) {
  try {
    if (!envReady()) {
      return patientGatewayJsonDeny({
        ok: false,
        code: "misconfigured",
        status: 500,
        message: "Server misconfigured.",
      });
    }

    const gate = await requirePatientGatewayContext(req);
    if (!gate.ok) return patientGatewayJsonDeny(gate);

    const result = await recordPatientGatewayConsent(gate.context);
    if (!result.ok) return patientGatewayJsonDeny(result);

    return patientGatewayJsonOk(result);
  } catch (e) {
    return mapPatientGatewayRouteError(e);
  }
}
