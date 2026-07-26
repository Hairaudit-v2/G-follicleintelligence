/**
 * GET /api/patient/v1/journey
 * FI-PATIENT-APP-1D — patient-safe journey + nextAction for the authenticated patient.
 *
 * Canonical patient/tenant identity is always derived server-side.
 * Client-supplied patientId cannot select another patient.
 */
import { requirePatientGatewayContext } from "@/src/lib/patientPortal/patientGatewayGate.server";
import {
  mapPatientGatewayRouteError,
  patientGatewayJsonDeny,
  patientGatewayJsonOk,
} from "@/src/lib/patientPortal/patientGatewayHttp";
import { loadPatientGatewayJourney } from "@/src/lib/patientPortal/patientGatewayJourney.server";
import { writePatientGatewayAudit } from "@/src/lib/patientPortal/patientGatewayAudit.server";

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
    if (!gate.ok) {
      writePatientGatewayAudit({
        action: "journey_read_denied",
        outcome: "deny",
        code: gate.code,
        authUserId: null,
        patientId: null,
        tenantId: null,
        resourceKind: "journey",
      });
      return patientGatewayJsonDeny(gate);
    }

    const journey = await loadPatientGatewayJourney(gate.context);
    if (!journey.ok) return patientGatewayJsonDeny(journey);
    return patientGatewayJsonOk(journey);
  } catch (e) {
    return mapPatientGatewayRouteError(e);
  }
}
