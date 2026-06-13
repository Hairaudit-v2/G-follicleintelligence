import { NextResponse, type NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readFiPaymentsEnabled } from "@/src/lib/payments/fiPaymentEnv.server";
import { isStripeWebhookDuplicateInsert } from "@/src/lib/payments/stripeWebhookIdempotency";
import { createStripePaymentProvider } from "@/src/lib/payments/providers/stripe/stripePaymentProvider.server";
import {
  recordGatewayPaymentFailure,
  recordGatewayPaymentSuccess,
} from "@/src/lib/revenueOs/revenueInvoiceMutations.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function nonEmptyTenantIdForWebhookRow(tenantId: string | null | undefined): string | null {
  const t = tenantId?.trim();
  return t ? t : null;
}

export async function POST(req: NextRequest) {
  if (!readFiPaymentsEnabled()) {
    return NextResponse.json({ ok: false, error: "FI payments disabled" }, { status: 503 });
  }

  const rawBody = await req.text();
  const signatureHeader = req.headers.get("stripe-signature");
  const provider = createStripePaymentProvider();

  let rawEvent: unknown;
  try {
    rawEvent = await provider.verifyWebhook({ rawBody, signatureHeader });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid webhook signature" }, { status: 400 });
  }

  const ev = rawEvent as { id?: string; type?: string };
  const supabase = supabaseAdmin();
  const mapped = provider.mapWebhookToPaymentEvent(rawEvent);
  const tenantHint =
    mapped.kind === "checkout_completed" || mapped.kind === "checkout_failed" ? mapped.tenantId : null;

  const { data: wh, error: whe } = await supabase
    .from("fi_payment_webhook_events")
    .insert({
      tenant_id: tenantHint,
      provider: "stripe",
      provider_event_id: ev.id ?? null,
      event_type: ev.type ?? null,
      payload: JSON.parse(JSON.stringify(rawEvent)) as Record<string, unknown>,
      processing_status: "pending",
      metadata: { mapped_kind: mapped.kind },
    })
    .select("id")
    .single();

  if (whe) {
    if (isStripeWebhookDuplicateInsert(whe)) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    return NextResponse.json({ ok: false, error: whe.message }, { status: 500 });
  }

  const webhookRowId = String((wh as { id: string }).id);
  const todayYmd = new Date().toISOString().slice(0, 10);

  try {
    if (mapped.kind === "checkout_completed") {
      await recordGatewayPaymentSuccess({
        tenantId: mapped.tenantId,
        invoiceId: mapped.invoiceId,
        amountCents: mapped.amountCents,
        currency: mapped.currency,
        provider: mapped.provider,
        providerRef: mapped.providerRef,
        paymentIntentId: mapped.paymentIntentId,
        paymentRequestId: mapped.paymentRequestId,
        todayYmd,
      });
      const completedTenantFilter = nonEmptyTenantIdForWebhookRow(mapped.tenantId);
      let completedQ = supabase
        .from("fi_payment_webhook_events")
        .update({ processing_status: "processed", updated_at: new Date().toISOString() })
        .eq("id", webhookRowId);
      if (completedTenantFilter) completedQ = completedQ.eq("tenant_id", completedTenantFilter);
      await completedQ;
    } else if (mapped.kind === "checkout_failed") {
      const tid = mapped.tenantId?.trim();
      if (tid) {
        let leadId: string | null = null;
        let patientId: string | null = null;
        let caseId: string | null = null;
        if (mapped.invoiceId?.trim()) {
          const { data: invRow } = await supabase
            .from("fi_invoices")
            .select("lead_id, patient_id, case_id")
            .eq("tenant_id", tid)
            .eq("id", mapped.invoiceId.trim())
            .maybeSingle();
          if (invRow) {
            const ir = invRow as { lead_id: string | null; patient_id: string | null; case_id: string | null };
            leadId = ir.lead_id;
            patientId = ir.patient_id;
            caseId = ir.case_id;
          }
        }
        await recordGatewayPaymentFailure({
          tenantId: tid,
          invoiceId: mapped.invoiceId,
          leadId,
          patientId,
          caseId,
          message: mapped.message,
          provider: mapped.provider,
          paymentRequestId: mapped.paymentRequestId,
        });
      }
      const failedTenantFilter = nonEmptyTenantIdForWebhookRow(mapped.tenantId);
      let failedQ = supabase
        .from("fi_payment_webhook_events")
        .update({ processing_status: "processed", updated_at: new Date().toISOString() })
        .eq("id", webhookRowId);
      if (failedTenantFilter) failedQ = failedQ.eq("tenant_id", failedTenantFilter);
      await failedQ;
    } else {
      const ignoredTenantFilter = nonEmptyTenantIdForWebhookRow(tenantHint);
      let ignoredQ = supabase
        .from("fi_payment_webhook_events")
        .update({
          processing_status: "ignored",
          updated_at: new Date().toISOString(),
          metadata: { reason: mapped.reason },
        })
        .eq("id", webhookRowId);
      if (ignoredTenantFilter) ignoredQ = ignoredQ.eq("tenant_id", ignoredTenantFilter);
      await ignoredQ;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "processing_error";
    const errTenantFilter = nonEmptyTenantIdForWebhookRow(tenantHint);
    let errQ = supabase
      .from("fi_payment_webhook_events")
      .update({
        processing_status: "error",
        error_message: msg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", webhookRowId);
    if (errTenantFilter) errQ = errQ.eq("tenant_id", errTenantFilter);
    await errQ;
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
