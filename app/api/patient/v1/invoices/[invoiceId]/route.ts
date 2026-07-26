/**
 * GET /api/patient/v1/invoices/{invoiceId}
 * FI-PATIENT-APP-1E — single invoice with ownership re-check.
 */
import { requirePatientGatewayContext } from "@/src/lib/patientPortal/patientGatewayGate.server";
import { writePatientGatewayAudit } from "@/src/lib/patientPortal/patientGatewayAudit.server";
import { getPatientGatewayInvoice } from "@/src/lib/patientPortal/patientGatewayBilling.server";
import {
  mapPatientGatewayRouteError,
  patientGatewayJsonDeny,
  patientGatewayJsonOk,
} from "@/src/lib/patientPortal/patientGatewayHttp";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ invoiceId: string }> }
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
        action: "invoice_read_denied",
        outcome: "deny",
        code: gate.code,
        resourceKind: "invoice",
      });
      return patientGatewayJsonDeny(gate);
    }

    const { invoiceId } = await ctx.params;
    const result = await getPatientGatewayInvoice(gate.context, invoiceId);
    if (!result.ok) return patientGatewayJsonDeny(result);
    return patientGatewayJsonOk(result);
  } catch (e) {
    return mapPatientGatewayRouteError(e);
  }
}
