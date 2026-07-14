/**
 * Simple operating P&amp;L from FinancialOS master ledger (Stage 6).
 * Revenue ≈ collection credits; Opex ≈ expense_posted debits net of void reversals.
 */

export type ExpensePlLedgerInput = {
  transaction_kind: string;
  direction: "credit" | "debit" | string;
  amount_cents: number;
  created_at: string;
};

export type ExpensePlSummary = {
  period_start: string;
  period_end: string;
  revenue_collected_cents: number;
  opex_posted_cents: number;
  opex_void_reversal_cents: number;
  opex_net_cents: number;
  net_operating_cents: number;
  revenue_event_count: number;
  expense_event_count: number;
};

const REVENUE_KINDS = new Set(["payment_received", "deposit_paid", "balance_paid"]);

function inIsoRange(iso: string, start: string, end: string): boolean {
  const d = iso.slice(0, 10);
  return d >= start.slice(0, 10) && d <= end.slice(0, 10);
}

export function aggregateOperatingPl(input: {
  period_start: string;
  period_end: string;
  ledger: readonly ExpensePlLedgerInput[];
}): ExpensePlSummary {
  const period_start = input.period_start.slice(0, 10);
  const period_end = input.period_end.slice(0, 10);

  let revenue_collected_cents = 0;
  let opex_posted_cents = 0;
  let opex_void_reversal_cents = 0;
  let revenue_event_count = 0;
  let expense_event_count = 0;

  for (const row of input.ledger) {
    if (!inIsoRange(row.created_at, period_start, period_end)) continue;
    const amount = Math.max(0, Math.floor(row.amount_cents));
    const kind = String(row.transaction_kind);
    const dir = String(row.direction);

    if (REVENUE_KINDS.has(kind) && dir === "credit") {
      revenue_collected_cents += amount;
      revenue_event_count += 1;
    }
    if (kind === "expense_posted" && dir === "debit") {
      opex_posted_cents += amount;
      expense_event_count += 1;
    }
    if (kind === "expense_void_reversal" && dir === "credit") {
      opex_void_reversal_cents += amount;
    }
  }

  const opex_net_cents = Math.max(0, opex_posted_cents - opex_void_reversal_cents);
  const net_operating_cents = revenue_collected_cents - opex_net_cents;

  return {
    period_start,
    period_end,
    revenue_collected_cents,
    opex_posted_cents,
    opex_void_reversal_cents,
    opex_net_cents,
    net_operating_cents,
    revenue_event_count,
    expense_event_count,
  };
}
