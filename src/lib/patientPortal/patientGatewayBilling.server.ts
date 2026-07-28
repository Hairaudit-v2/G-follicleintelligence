/**
 * FI-PATIENT-APP-1E — patient gateway billing ownership wrapper + payment session.
 * Reuses FiOS RevenueOS invoice loaders and Stripe checkout via createPaymentRequestForInvoice.
 * Never trusts client patientId / amount / currency / paid status.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  readFiPaymentProviderId,
  readFiPaymentsEnabled,
} from "@/src/lib/payments/fiPaymentEnv.server";
import { mapInvoiceItemRow, mapInvoiceRow } from "@/src/lib/revenueOs/revenueInvoiceMappers";
import {
  createPaymentRequestForInvoice,
} from "@/src/lib/revenueOs/revenueInvoiceMutations.server";
import {
  invoiceBalanceDueCents,
  isInvoiceOpenForCollection,
  type FiInvoiceRow,
} from "@/src/lib/revenueOs/revenueInvoiceModel";
import { loadPatientInvoiceSummary } from "@/src/lib/revenueOs/revenueInvoiceLoaders.server";

import { writePatientGatewayAudit } from "./patientGatewayAudit.server";
import { resolvePatientCheckoutReturnUrls } from "./patientGatewayCheckoutReturn";
import {
  buildPatientGatewayBillingSummary,
  invoiceCanPay,
  mapGatewayPaymentStatusToPatient,
  mapInvoiceItemsToPatientLineItems,
  mapInvoiceToPatientListItem,
  validateClientPaymentClaims,
  type PatientGatewayBillingSummary,
  type PatientGatewayInvoiceDetail,
  type PatientGatewayInvoiceListItem,
  type PatientGatewayPaymentItem,
} from "./patientGatewayBillingCore";
import { patientGatewayDeny } from "./patientGatewayGateCore";
import { assertOwnedBillingRow } from "./patientGatewayOwnershipCore";
import type { PatientGatewayContext, PatientGatewayDeny } from "./patientGatewayTypes";

function paymentsCheckoutEnabled(): boolean {
  return readFiPaymentsEnabled() && readFiPaymentProviderId() === "stripe";
}

export type PatientGatewayBillingOptions = {
  supabase?: SupabaseClient;
  writeAudit?: boolean;
  loadSummary?: typeof loadPatientInvoiceSummary;
  createPaymentRequest?: typeof createPaymentRequestForInvoice;
};

function ownershipDeny(
  ctx: PatientGatewayContext,
  deny: PatientGatewayDeny,
  writeAudit: boolean,
  invoiceId?: string | null
): PatientGatewayDeny {
  if (writeAudit) {
    writePatientGatewayAudit({
      action: "invoice_ownership_denied",
      outcome: "deny",
      code: deny.code,
      authUserId: ctx.authUserId,
      patientId: ctx.patientId,
      tenantId: ctx.tenantId,
      resourceKind: "invoice",
      resourceId: invoiceId ?? null,
    });
  }
  return deny;
}

export function requirePatientGatewayOwnedInvoice(
  ctx: PatientGatewayContext,
  row: { tenant_id: string; patient_id: string | null | undefined },
  invoiceId?: string | null,
  writeAudit = true
): PatientGatewayDeny | null {
  const deny = assertOwnedBillingRow(ctx, row);
  if (!deny) return null;
  return ownershipDeny(ctx, deny, writeAudit, invoiceId);
}

export async function loadPatientGatewayBillingSummary(
  ctx: PatientGatewayContext,
  options?: PatientGatewayBillingOptions
): Promise<PatientGatewayBillingSummary | PatientGatewayDeny> {
  const writeAudit = options?.writeAudit !== false;
  const loadSummary = options?.loadSummary ?? loadPatientInvoiceSummary;
  try {
    const summary = await loadSummary(ctx.tenantId, ctx.patientId);
    for (const inv of summary.invoices) {
      const ownership = requirePatientGatewayOwnedInvoice(
        ctx,
        { tenant_id: inv.tenant_id, patient_id: inv.patient_id },
        inv.id,
        writeAudit
      );
      if (ownership) {
        if (writeAudit) {
          writePatientGatewayAudit({
            action: "billing_summary_read_denied",
            outcome: "deny",
            code: ownership.code,
            authUserId: ctx.authUserId,
            patientId: ctx.patientId,
            tenantId: ctx.tenantId,
            resourceKind: "billing",
            resourceId: inv.id,
          });
        }
        return ownership;
      }
    }
    const response = buildPatientGatewayBillingSummary(
      summary.invoices,
      paymentsCheckoutEnabled()
    );
    if (writeAudit) {
      writePatientGatewayAudit({
        action: "billing_summary_read_success",
        outcome: "allow",
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "billing",
      });
    }
    return response;
  } catch {
    const deny = patientGatewayDeny("misconfigured", 500, "Could not load billing summary.");
    if (writeAudit) {
      writePatientGatewayAudit({
        action: "billing_summary_read_denied",
        outcome: "deny",
        code: deny.code,
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "billing",
      });
    }
    return deny;
  }
}

export async function listPatientGatewayInvoices(
  ctx: PatientGatewayContext,
  options?: PatientGatewayBillingOptions
): Promise<{ ok: true; invoices: PatientGatewayInvoiceListItem[] } | PatientGatewayDeny> {
  const writeAudit = options?.writeAudit !== false;
  const loadSummary = options?.loadSummary ?? loadPatientInvoiceSummary;
  try {
    const summary = await loadSummary(ctx.tenantId, ctx.patientId);
    const enabled = paymentsCheckoutEnabled();
    const invoices: PatientGatewayInvoiceListItem[] = [];
    for (const inv of summary.invoices) {
      const ownership = requirePatientGatewayOwnedInvoice(
        ctx,
        { tenant_id: inv.tenant_id, patient_id: inv.patient_id },
        inv.id,
        writeAudit
      );
      if (ownership) {
        if (writeAudit) {
          writePatientGatewayAudit({
            action: "invoices_list_denied",
            outcome: "deny",
            code: ownership.code,
            authUserId: ctx.authUserId,
            patientId: ctx.patientId,
            tenantId: ctx.tenantId,
            resourceKind: "invoice",
            resourceId: inv.id,
          });
        }
        return ownership;
      }
      // Hide draft invoices from patients unless they somehow have balance (fail closed: omit drafts).
      if (inv.status === "draft") continue;
      invoices.push(mapInvoiceToPatientListItem(inv, enabled));
    }
    if (writeAudit) {
      writePatientGatewayAudit({
        action: "invoices_list_success",
        outcome: "allow",
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "invoice",
      });
    }
    return { ok: true, invoices };
  } catch {
    const deny = patientGatewayDeny("misconfigured", 500, "Could not load invoices.");
    if (writeAudit) {
      writePatientGatewayAudit({
        action: "invoices_list_denied",
        outcome: "deny",
        code: deny.code,
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "invoice",
      });
    }
    return deny;
  }
}

async function loadInvoiceRow(
  tenantId: string,
  invoiceId: string,
  client: SupabaseClient
): Promise<FiInvoiceRow | null> {
  const { data, error } = await client
    .from("fi_invoices")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", invoiceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapInvoiceRow(data as Record<string, unknown>);
}

async function loadInvoiceItems(
  tenantId: string,
  invoiceId: string,
  client: SupabaseClient
) {
  const { data, error } = await client
    .from("fi_invoice_items")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("invoice_id", invoiceId)
    .order("sort_index", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapInvoiceItemRow(r as Record<string, unknown>));
}

async function loadInvoicePayments(
  tenantId: string,
  patientId: string,
  invoiceId: string,
  client: SupabaseClient
): Promise<PatientGatewayPaymentItem[]> {
  const { data, error } = await client
    .from("fi_payments")
    // fi_payments has no paid_at — use created_at as payment time (paid_at is on fi_invoices).
    .select("id, tenant_id, patient_id, invoice_id, status, amount_cents, total_cents, currency, provider, created_at")
    .eq("tenant_id", tenantId)
    .eq("patient_id", patientId)
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map((raw) => {
    const r = raw as Record<string, unknown>;
    const provider = String(r.provider ?? "").toLowerCase();
    return {
      id: String(r.id),
      amount: Math.round(Number(r.total_cents ?? r.amount_cents ?? 0)) / 100,
      currency: String(r.currency ?? "AUD").toUpperCase(),
      status: mapGatewayPaymentStatusToPatient(String(r.status ?? "pending")),
      paidAt: r.created_at != null ? String(r.created_at) : null,
      methodLabel: provider === "stripe" ? "Card" : provider ? "Other" : "Card",
    };
  });
}

export async function getPatientGatewayInvoice(
  ctx: PatientGatewayContext,
  invoiceId: string,
  options?: PatientGatewayBillingOptions
): Promise<{ ok: true; invoice: PatientGatewayInvoiceDetail } | PatientGatewayDeny> {
  const writeAudit = options?.writeAudit !== false;
  const supabase = options?.supabase ?? supabaseAdmin();

  let iid: string;
  try {
    iid = assertNonEmptyUuid(invoiceId, "invoiceId").trim();
  } catch {
    const deny = patientGatewayDeny("not_found", 404, "Invoice not found.");
    if (writeAudit) {
      writePatientGatewayAudit({
        action: "invoice_read_denied",
        outcome: "deny",
        code: deny.code,
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "invoice",
        resourceId: invoiceId,
      });
    }
    return deny;
  }

  try {
    const inv = await loadInvoiceRow(ctx.tenantId, iid, supabase);
    if (!inv) {
      const deny = patientGatewayDeny("not_found", 404, "Invoice not found.");
      if (writeAudit) {
        writePatientGatewayAudit({
          action: "invoice_read_denied",
          outcome: "deny",
          code: deny.code,
          authUserId: ctx.authUserId,
          patientId: ctx.patientId,
          tenantId: ctx.tenantId,
          resourceKind: "invoice",
          resourceId: iid,
        });
      }
      return deny;
    }

    const ownership = requirePatientGatewayOwnedInvoice(
      ctx,
      { tenant_id: inv.tenant_id, patient_id: inv.patient_id },
      inv.id,
      writeAudit
    );
    if (ownership) {
      if (writeAudit) {
        writePatientGatewayAudit({
          action: "invoice_read_denied",
          outcome: "deny",
          code: ownership.code,
          authUserId: ctx.authUserId,
          patientId: ctx.patientId,
          tenantId: ctx.tenantId,
          resourceKind: "invoice",
          resourceId: inv.id,
        });
      }
      return ownership;
    }

    const [items, payments] = await Promise.all([
      loadInvoiceItems(ctx.tenantId, inv.id, supabase),
      loadInvoicePayments(ctx.tenantId, ctx.patientId, inv.id, supabase),
    ]);

    const base = mapInvoiceToPatientListItem(inv, paymentsCheckoutEnabled());
    const invoice: PatientGatewayInvoiceDetail = {
      ...base,
      lineItems: mapInvoiceItemsToPatientLineItems(items),
      payments,
    };

    if (writeAudit) {
      writePatientGatewayAudit({
        action: "invoice_read_success",
        outcome: "allow",
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "invoice",
        resourceId: inv.id,
      });
    }

    return { ok: true, invoice };
  } catch {
    const deny = patientGatewayDeny("misconfigured", 500, "Could not load invoice.");
    if (writeAudit) {
      writePatientGatewayAudit({
        action: "invoice_read_denied",
        outcome: "deny",
        code: deny.code,
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "invoice",
        resourceId: iid,
      });
    }
    return deny;
  }
}

export type CreatePatientGatewayPaymentSessionInput = {
  clientAmountMajor?: number | null;
  clientCurrency?: string | null;
  /** Client platform hint for Checkout return URL selection. */
  platform?: "web" | "native" | null;
};

export type PatientGatewayPaymentSessionResponse = {
  ok: true;
  invoiceId: string;
  checkoutUrl: string;
  expiresAt: string | null;
  currency: string;
  amount: number;
};

/**
 * Create a Stripe Checkout session for the full server-derived outstanding balance.
 * Client amount/currency claims are validated then ignored for derivation.
 */
export async function createPatientGatewayPaymentSession(
  ctx: PatientGatewayContext,
  invoiceId: string,
  input?: CreatePatientGatewayPaymentSessionInput,
  options?: PatientGatewayBillingOptions
): Promise<PatientGatewayPaymentSessionResponse | PatientGatewayDeny> {
  const writeAudit = options?.writeAudit !== false;
  const supabase = options?.supabase ?? supabaseAdmin();
  const createPaymentRequest = options?.createPaymentRequest ?? createPaymentRequestForInvoice;

  const denySession = (deny: PatientGatewayDeny, resourceId?: string | null) => {
    if (writeAudit) {
      writePatientGatewayAudit({
        action: "payment_session_denied",
        outcome: "deny",
        code: deny.code,
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "payment",
        resourceId: resourceId ?? null,
      });
    }
    return deny;
  };

  let iid: string;
  try {
    iid = assertNonEmptyUuid(invoiceId, "invoiceId").trim();
  } catch {
    return denySession(patientGatewayDeny("not_found", 404, "Invoice not found."), invoiceId);
  }

  if (!paymentsCheckoutEnabled()) {
    return denySession(
      patientGatewayDeny(
        "payments_disabled",
        403,
        "Online payments are not available for this clinic."
      ),
      iid
    );
  }

  try {
    const inv = await loadInvoiceRow(ctx.tenantId, iid, supabase);
    if (!inv) {
      return denySession(patientGatewayDeny("not_found", 404, "Invoice not found."), iid);
    }

    const ownership = requirePatientGatewayOwnedInvoice(
      ctx,
      { tenant_id: inv.tenant_id, patient_id: inv.patient_id },
      inv.id,
      writeAudit
    );
    if (ownership) return denySession(ownership, inv.id);

    if (!isInvoiceOpenForCollection(inv.status) || !invoiceCanPay(inv, true)) {
      return denySession(
        patientGatewayDeny(
          "invoice_not_payable",
          409,
          "This invoice cannot accept a payment session."
        ),
        inv.id
      );
    }

    const amountCents = invoiceBalanceDueCents(inv);
    if (amountCents <= 0) {
      return denySession(
        patientGatewayDeny("invoice_not_payable", 409, "Invoice has no outstanding balance."),
        inv.id
      );
    }

    const claim = validateClientPaymentClaims({
      clientAmountMajor: input?.clientAmountMajor,
      clientCurrency: input?.clientCurrency,
      serverAmountCents: amountCents,
      serverCurrency: inv.currency,
    });
    if (!claim.ok) {
      return denySession(
        patientGatewayDeny(claim.code, 400, claim.message),
        inv.id
      );
    }

    let returnUrls: { successUrl: string; cancelUrl: string };
    try {
      returnUrls = resolvePatientCheckoutReturnUrls(input?.platform ?? null);
    } catch {
      return denySession(
        patientGatewayDeny(
          "misconfigured",
          500,
          "Payment return URLs are not configured."
        ),
        inv.id
      );
    }

    const pr = await createPaymentRequest({
      tenantId: ctx.tenantId,
      invoiceId: inv.id,
      amountCents,
      send: true,
      checkoutSuccessUrl: returnUrls.successUrl,
      checkoutCancelUrl: returnUrls.cancelUrl,
    });

    const checkoutUrl = pr.checkout_url?.trim() || "";
    if (!checkoutUrl) {
      return denySession(
        patientGatewayDeny(
          "misconfigured",
          500,
          "Payment session could not be created."
        ),
        inv.id
      );
    }

    if (writeAudit) {
      writePatientGatewayAudit({
        action: "payment_session_created",
        outcome: "allow",
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "payment",
        resourceId: inv.id,
      });
    }

    return {
      ok: true,
      invoiceId: inv.id,
      checkoutUrl,
      expiresAt: pr.expires_at,
      currency: inv.currency.trim().toUpperCase() || "AUD",
      amount: amountCents / 100,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/not open for payment/i.test(msg) || /exceeds invoice balance/i.test(msg)) {
      return denySession(
        patientGatewayDeny("invoice_not_payable", 409, "This invoice cannot accept a payment session."),
        iid
      );
    }
    return denySession(
      patientGatewayDeny("misconfigured", 500, "Could not create payment session."),
      iid
    );
  }
}
