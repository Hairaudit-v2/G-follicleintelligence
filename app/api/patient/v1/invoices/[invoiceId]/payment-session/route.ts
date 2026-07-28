/**
 * POST /api/patient/v1/invoices/{invoiceId}/payment-session
 * FI-PATIENT-APP-1E — create Stripe Checkout for server-derived outstanding balance.
 *
 * Client must not supply authoritative amount/currency/patientId.
 * Final paid state is never set here — only verified Stripe webhooks reconcile.
 */
import { requirePatientGatewayContext } from "@/src/lib/patientPortal/patientGatewayGate.server";
import { writePatientGatewayAudit } from "@/src/lib/patientPortal/patientGatewayAudit.server";
import { createPatientGatewayPaymentSession } from "@/src/lib/patientPortal/patientGatewayBilling.server";
import { parsePatientCheckoutPlatform } from "@/src/lib/patientPortal/patientGatewayCheckoutReturn";
import {
  mapPatientGatewayRouteError,
  patientGatewayJsonDeny,
  patientGatewayJsonOk,
} from "@/src/lib/patientPortal/patientGatewayHttp";

export const dynamic = "force-dynamic";

export async function POST(
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
        action: "payment_session_denied",
        outcome: "deny",
        code: gate.code,
        resourceKind: "payment",
      });
      return patientGatewayJsonDeny(gate);
    }

    let body: Record<string, unknown> = {};
    try {
      const parsed = await req.json();
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>;
      }
    } catch {
      body = {};
    }

    const clientAmount =
      typeof body.amount === "number"
        ? body.amount
        : typeof body.amountCents === "number"
          ? body.amountCents / 100
          : null;
    const clientCurrency =
      typeof body.currency === "string" ? body.currency : null;
    const platform = parsePatientCheckoutPlatform(body.platform);

    const { invoiceId } = await ctx.params;
    const session = await createPatientGatewayPaymentSession(gate.context, invoiceId, {
      clientAmountMajor: clientAmount,
      clientCurrency,
      platform,
    });
    if (!session.ok) return patientGatewayJsonDeny(session);
    return patientGatewayJsonOk(session);
  } catch (e) {
    return mapPatientGatewayRouteError(e);
  }
}
