/**
 * GET /api/patient/v1/billing
 * FI-PATIENT-APP-1E — patient-safe account / billing summary.
 */
import { requirePatientGatewayContext } from "@/src/lib/patientPortal/patientGatewayGate.server";
import { writePatientGatewayAudit } from "@/src/lib/patientPortal/patientGatewayAudit.server";
import { loadPatientGatewayBillingSummary } from "@/src/lib/patientPortal/patientGatewayBilling.server";
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
        action: "billing_summary_read_denied",
        outcome: "deny",
        code: gate.code,
        resourceKind: "billing",
      });
      return patientGatewayJsonDeny(gate);
    }

    const summary = await loadPatientGatewayBillingSummary(gate.context);
    if (!summary.ok) return patientGatewayJsonDeny(summary);
    return patientGatewayJsonOk(summary);
  } catch (e) {
    return mapPatientGatewayRouteError(e);
  }
}
