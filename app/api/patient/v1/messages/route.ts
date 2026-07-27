/**
 * GET /api/patient/v1/messages
 * FI-PATIENT-APP-1F — list patient-safe message threads for authenticated patient.
 */
import { requirePatientGatewayContext } from "@/src/lib/patientPortal/patientGatewayGate.server";
import { writePatientGatewayAudit } from "@/src/lib/patientPortal/patientGatewayAudit.server";
import { listPatientGatewayMessageThreads } from "@/src/lib/patientPortal/patientGatewayMessaging.server";
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
        action: "message_threads_list_denied",
        outcome: "deny",
        code: gate.code,
        resourceKind: "message",
      });
      return patientGatewayJsonDeny(gate);
    }

    const result = await listPatientGatewayMessageThreads(gate.context);
    if (!result.ok) return patientGatewayJsonDeny(result);
    return patientGatewayJsonOk(result);
  } catch (e) {
    return mapPatientGatewayRouteError(e);
  }
}
