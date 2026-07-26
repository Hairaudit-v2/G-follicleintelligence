/**
 * GET /api/patient/v1/invoices
 * FI-PATIENT-APP-1E — list patient-owned invoices only.
 */
import { requirePatientGatewayContext } from "@/src/lib/patientPortal/patientGatewayGate.server";
import { writePatientGatewayAudit } from "@/src/lib/patientPortal/patientGatewayAudit.server";
import { listPatientGatewayInvoices } from "@/src/lib/patientPortal/patientGatewayBilling.server";
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
        action: "invoices_list_denied",
        outcome: "deny",
        code: gate.code,
        resourceKind: "invoice",
      });
      return patientGatewayJsonDeny(gate);
    }

    const list = await listPatientGatewayInvoices(gate.context);
    if (!list.ok) return patientGatewayJsonDeny(list);
    return patientGatewayJsonOk(list);
  } catch (e) {
    return mapPatientGatewayRouteError(e);
  }
}
