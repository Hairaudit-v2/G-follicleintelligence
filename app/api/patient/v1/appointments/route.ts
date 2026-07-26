/**
 * GET /api/patient/v1/appointments
 * FI-PATIENT-APP-1D — patient-safe appointment list for the authenticated patient.
 *
 * Only appointments linked to the server-resolved fi_patients.id + tenant are returned.
 */
import { requirePatientGatewayContext } from "@/src/lib/patientPortal/patientGatewayGate.server";
import { writePatientGatewayAudit } from "@/src/lib/patientPortal/patientGatewayAudit.server";
import { listPatientGatewayAppointments } from "@/src/lib/patientPortal/patientGatewayAppointments.server";
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
    if (!gate.ok) {
      writePatientGatewayAudit({
        action: "appointments_list_denied",
        outcome: "deny",
        code: gate.code,
        authUserId: null,
        patientId: null,
        tenantId: null,
        resourceKind: "appointment",
      });
      return patientGatewayJsonDeny(gate);
    }

    const list = await listPatientGatewayAppointments(gate.context);
    if (!list.ok) return patientGatewayJsonDeny(list);
    return patientGatewayJsonOk(list);
  } catch (e) {
    return mapPatientGatewayRouteError(e);
  }
}
