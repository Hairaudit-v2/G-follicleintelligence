/**
 * FI-DEMO-DAY-2A.4 — Pure economics strip composition from invoice rows.
 */

import type { FiInvoiceRow } from "@/src/lib/revenueOs/revenueInvoiceModel";
import type {
  OverviewEconomicsSection,
  OverviewInvoiceLine,
} from "./patientTwinOverviewTypes";

export type EconomicsComposeInput = {
  invoices: ReadonlyArray<
    Pick<
      FiInvoiceRow,
      | "invoice_kind"
      | "title"
      | "status"
      | "total_cents"
      | "amount_paid_cents"
      | "currency"
      | "metadata"
    >
  >;
  paymentsHref: string;
  /** Expected graft-story quote total when reconciling showcase (optional). */
  expectedQuoteCents?: number | null;
  expectedDepositCents?: number | null;
  expectedBalanceCents?: number | null;
};

function lineFromInvoice(
  inv: EconomicsComposeInput["invoices"][number]
): OverviewInvoiceLine {
  return {
    kind: String(inv.invoice_kind ?? "invoice"),
    title: inv.title ?? null,
    status: String(inv.status ?? "unknown"),
    totalCents: Number(inv.total_cents) || 0,
    amountPaidCents: Number(inv.amount_paid_cents) || 0,
    currency: String(inv.currency || "AUD").toUpperCase(),
  };
}

function sumByKind(
  invoices: EconomicsComposeInput["invoices"],
  kind: string
): number | null {
  const matched = invoices.filter((i) => String(i.invoice_kind) === kind);
  if (matched.length === 0) return null;
  return matched.reduce((sum, i) => sum + (Number(i.total_cents) || 0), 0);
}

export function composeOverviewEconomics(
  input: EconomicsComposeInput
): OverviewEconomicsSection {
  const invoices = input.invoices ?? [];
  if (invoices.length === 0) {
    return {
      availability: "not_recorded",
      currency: "AUD",
      quoteCents: null,
      depositCents: null,
      balanceCents: null,
      paidTotalCents: 0,
      invoiceCount: 0,
      invoices: [],
      reconciled: null,
      reconciliationNote: null,
      paymentsHref: input.paymentsHref,
    };
  }

  const quoteCents = sumByKind(invoices, "consultation_quote");
  const depositCents = sumByKind(invoices, "surgery_deposit");
  const balanceCents = sumByKind(invoices, "surgery_balance");

  const packagePaid = invoices
    .filter((i) => {
      const kind = String(i.invoice_kind);
      return kind === "surgery_deposit" || kind === "surgery_balance";
    })
    .reduce((sum, i) => sum + (Number(i.amount_paid_cents) || 0), 0);
  const allPaid = invoices.reduce(
    (sum, i) => sum + (Number(i.amount_paid_cents) || 0),
    0
  );
  // Prefer deposit+balance paid totals so a paid quote row is not double-counted.
  const paidTotalCents =
    depositCents != null || balanceCents != null ? packagePaid : allPaid;
  const currency =
    String(invoices[0]?.currency || "AUD").toUpperCase() === "AUD"
      ? "AUD"
      : String(invoices[0]?.currency || "AUD").toUpperCase();

  let reconciled: boolean | null = null;
  let reconciliationNote: string | null = null;

  if (quoteCents != null && depositCents != null && balanceCents != null) {
    reconciled = depositCents + balanceCents === quoteCents;
    reconciliationNote = reconciled
      ? "Deposit and balance reconcile to quote."
      : "Deposit + balance do not equal quote — review Money tab.";
  }

  if (
    reconciled !== false &&
    input.expectedQuoteCents != null &&
    quoteCents != null &&
    quoteCents !== input.expectedQuoteCents
  ) {
    reconciled = false;
    reconciliationNote = "Quote total differs from expected surgical package total.";
  }

  return {
    availability: "recorded",
    currency,
    quoteCents,
    depositCents,
    balanceCents,
    paidTotalCents,
    invoiceCount: invoices.length,
    invoices: invoices.map(lineFromInvoice),
    reconciled,
    reconciliationNote,
    paymentsHref: input.paymentsHref,
  };
}
