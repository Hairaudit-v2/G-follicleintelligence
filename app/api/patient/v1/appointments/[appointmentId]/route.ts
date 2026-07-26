/**
 * GET /api/patient/v1/appointments/{appointmentId}
 * FI-PATIENT-APP-1D — single appointment read with ownership re-check.
 *
 * Appointment IDs are untrusted input. Ownership is verified against the
 * server-resolved patient/tenant before any data is returned.
 */
import { requirePatientGatewayContext } from "@/src/lib/patientPortal/patientGatewayGate.server";
import { writePatientGatewayAudit } from "@/src/lib/patientPortal/patientGatewayAudit.server";
import { getPatientGatewayAppointment } from "@/src/lib/patientPortal/patientGatewayAppointments.server";
import {
  mapPatientGatewayRouteError,
  patientGatewayJsonDeny,
  patientGatewayJsonOk,
} from "@/src/lib/patientPortal/patientGatewayHttp";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ appointmentId: string }> }
) {
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
        action: "appointment_read_denied",
        outcome: "deny",
        code: gate.code,
        authUserId: null,
        patientId: null,
        tenantId: null,
        resourceKind: "appointment",
      });
      return patientGatewayJsonDeny(gate);
    }

    const { appointmentId } = await ctx.params;
    const result = await getPatientGatewayAppointment(gate.context, appointmentId);
    if (!result.ok) return patientGatewayJsonDeny(result);
    return patientGatewayJsonOk(result);
  } catch (e) {
    return mapPatientGatewayRouteError(e);
  }
}
