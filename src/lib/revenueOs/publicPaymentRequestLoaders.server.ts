import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readFiPaymentsEnabled, readFiPaymentProviderId } from "@/src/lib/payments/fiPaymentEnv.server";
import { mapInvoiceRow, mapPaymentRequestRow } from "@/src/lib/revenueOs/revenueInvoiceMappers";
import type { FiInvoiceRow } from "@/src/lib/revenueOs/revenueInvoiceModel";
import type { FiPaymentRequestRow } from "@/src/lib/revenueOs/revenueInvoiceModel";
import {
  derivePublicPaymentPageState,
  isPaymentPublicTokenFormat,
  type PublicPaymentRequestUiState,
} from "@/src/lib/revenueOs/publicPaymentRequestModel";

export type PublicPaymentRequestView =
  | { ok: false; state: "invalid" }
  | {
      ok: true;
      state: Exclude<PublicPaymentRequestUiState, "invalid">;
      brandName: string;
      clinicDisplayName: string | null;
      invoiceTitle: string | null;
      invoiceKind: string;
      currency: string;
      amountDueCents: number;
      paymentRequest: Pick<
        FiPaymentRequestRow,
        "total_cents" | "amount_cents" | "currency" | "checkout_url" | "status" | "expires_at" | "sent_at"
      >;
      checkoutUrl: string | null;
    };

export async function loadPublicPaymentRequestView(rawToken: string): Promise<PublicPaymentRequestView> {
  const token = rawToken?.trim() ?? "";
  if (!isPaymentPublicTokenFormat(token)) return { ok: false, state: "invalid" };

  const supabase = supabaseAdmin();
  const { data: prRaw, error: pe } = await supabase.from("fi_payment_requests").select("*").eq("public_token", token).maybeSingle();
  if (pe || !prRaw) return { ok: false, state: "invalid" };
  const pr = mapPaymentRequestRow(prRaw as Record<string, unknown>);

  const { data: invRaw, error: ie } = await supabase
    .from("fi_invoices")
    .select("*")
    .eq("tenant_id", pr.tenant_id)
    .eq("id", pr.invoice_id)
    .maybeSingle();
  if (ie || !invRaw) return { ok: false, state: "invalid" };
  const inv = mapInvoiceRow(invRaw as Record<string, unknown>);

  const { data: tenantRaw } = await supabase.from("fi_tenants").select("name").eq("id", pr.tenant_id).maybeSingle();
  const brandName = String((tenantRaw as { name?: string } | null)?.name ?? "Clinic").trim() || "Clinic";

  let clinicDisplayName: string | null = null;
  if (inv.clinic_id?.trim()) {
    const { data: c } = await supabase.from("fi_clinics").select("name").eq("id", inv.clinic_id.trim()).maybeSingle();
    clinicDisplayName = String((c as { name?: string } | null)?.name ?? "").trim() || null;
  }

  const stripeCheckoutEnabled = readFiPaymentsEnabled() && readFiPaymentProviderId() === "stripe";
  const nowMs = Date.now();
  const state = derivePublicPaymentPageState({ paymentRequest: pr, invoice: inv, nowMs, stripeCheckoutEnabled });
  const amountDue = Math.min(pr.total_cents, Math.max(0, inv.total_cents - inv.amount_paid_cents));

  return {
    ok: true,
    state,
    brandName,
    clinicDisplayName,
    invoiceTitle: inv.title,
    invoiceKind: inv.invoice_kind,
    currency: inv.currency,
    amountDueCents: amountDue,
    paymentRequest: {
      total_cents: pr.total_cents,
      amount_cents: pr.amount_cents,
      currency: pr.currency,
      checkout_url: pr.checkout_url,
      status: pr.status,
      expires_at: pr.expires_at,
      sent_at: pr.sent_at,
    },
    checkoutUrl: pr.checkout_url,
  };
}
