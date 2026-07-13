/**
 * FI-TRUST-MONEY-AND-READINESS-1 — staff-facing Money truth copy (pure).
 * Manual payment records ≠ bank/card settlement; Stripe inbox is optional.
 */

export function moneyHubPageTitle(): string {
  return "Money";
}

export function moneyHubEyebrow(): string {
  return "Clinic money";
}

export function moneyHubHeadline(): string {
  return "Money";
}

export function moneyHubSubtitle(): string {
  return "Deposits, balances, pathways, and collection priorities. Use this hub as the single finance door.";
}

/** Banner under Money headline — payment source of truth. */
export function moneyPaymentTruthBanner(input: {
  paymentsInboxEnabled: boolean;
}): { title: string; body: string } {
  if (input.paymentsInboxEnabled) {
    return {
      title: "Two payment paths",
      body: "Manual surgery payment records track deposits for operations. Online card capture uses the Take payment inbox and Stripe — they are not automatically the same record. Confirm funds before treating a clearance badge as bank proof.",
    };
  }
  return {
    title: "Manual payment tracking",
    body: "Online card capture is off for this clinic. Manual payment records and invoices under Money are operational tracking — not POS or bank settlement proof. Verify deposits with finance before surgery day.",
  };
}

export function moneyTakePaymentCtaLabel(paymentsInboxEnabled: boolean): string {
  return paymentsInboxEnabled ? "Take payment" : "Payment records";
}

export function moneyTakePaymentHref(tenantBase: string, paymentsInboxEnabled: boolean): string {
  const b = tenantBase.replace(/\/+$/, "");
  return paymentsInboxEnabled ? `${b}/payments` : `${b}/financial/payments`;
}

export type MoneyPaymentRowSource = {
  label: string;
  /** True when the row came from a payment provider (e.g. Stripe), not manual entry. */
  providerConfirmed: boolean;
};

/** Row-level source label for payment lists — manual tracking vs provider confirmed. */
export function moneyPaymentRowSourceLabel(provider: string | null | undefined): MoneyPaymentRowSource {
  const raw = provider?.trim() ?? "";
  const p = raw.toLowerCase();
  if (!p || p === "manual") {
    return { label: "Manual tracking", providerConfirmed: false };
  }
  if (p === "stripe") {
    return { label: "Provider confirmed (Stripe)", providerConfirmed: true };
  }
  return { label: `Provider confirmed (${raw})`, providerConfirmed: true };
}

/** Tomorrow board KPI helper — manual surgery payment records only. */
export function moneyTomorrowSurgeryPaymentsKpiHelper(): string {
  return "Manual surgery payment records when tracked — operational tracking, not bank proof.";
}

/** Guard / readiness language — avoid FinancialOS brand in staff errors. */
export function moneyClearanceBlockedStaffMessage(detail?: string | null): string {
  const d = detail?.trim();
  const suffix = d ? ` ${d}.` : "";
  return `Surgery confirmation blocked: financial clearance is not ready (procedure within 14 days).${suffix} Resolve deposit, pathway, or invoice setup in Money, or obtain finance admin sign-off before confirming.`;
}
