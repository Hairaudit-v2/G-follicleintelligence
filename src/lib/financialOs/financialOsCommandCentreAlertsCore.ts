import type { FiInvoiceRow } from "@/src/lib/revenueOs/revenueInvoiceModel";

export type FinancialOsAlertSeverity = "info" | "warning" | "critical";

export type FinancialOsAlertItem = {
  id: string;
  label: string;
  detail?: string;
  severity: FinancialOsAlertSeverity;
};

export type FinancialOsCommandCentreAlertStrip = {
  unmatchedPayments: { count: number; items: FinancialOsAlertItem[] };
  overdueInvoices: { count: number; items: FinancialOsAlertItem[] };
  failedGatewayPayments: { count: number; items: FinancialOsAlertItem[] };
  depositDeadlines48h: { count: number; items: FinancialOsAlertItem[] };
  needsReviewCount: number;
};

export function buildFinancialOsCommandCentreAlerts(args: {
  unmatchedRows: Record<string, unknown>[];
  overdueInvoices: FiInvoiceRow[];
  failedPaymentRows: Record<string, unknown>[];
  depositDeadlineInvoices: FiInvoiceRow[];
}): FinancialOsCommandCentreAlertStrip {
  const unmatchedItems: FinancialOsAlertItem[] = args.unmatchedRows.map((row) => {
    const expected = Number(row.expected_amount_cents ?? 0);
    const received = Number(row.received_amount_cents ?? 0);
    return {
      id: String(row.id),
      label: "Needs review — payment mismatch",
      detail: `Expected ${expected}¢, received ${received}¢ (${String(row.provider ?? "provider")})`,
      severity: "critical",
    };
  });

  const overdueItems: FinancialOsAlertItem[] = args.overdueInvoices.slice(0, 8).map((inv) => ({
    id: inv.id,
    label: inv.title ?? inv.invoice_kind,
    detail: inv.days_overdue > 0 ? `${inv.days_overdue} days overdue` : "Past due",
    severity: inv.days_overdue > 7 ? "critical" : "warning",
  }));

  const failedItems: FinancialOsAlertItem[] = args.failedPaymentRows.map((row) => ({
    id: String(row.id),
    label: "Failed gateway payment",
    detail: String(row.failure_message ?? "Provider reported failure"),
    severity: "warning",
  }));

  const depositItems: FinancialOsAlertItem[] = args.depositDeadlineInvoices.map((inv) => ({
    id: inv.id,
    label: inv.title ?? "Surgery deposit",
    detail: inv.due_date ? `Due ${inv.due_date}` : "Due within 48 hours",
    severity: "warning",
  }));

  const needsReviewCount = unmatchedItems.length;

  return {
    unmatchedPayments: { count: unmatchedItems.length, items: unmatchedItems },
    overdueInvoices: { count: overdueItems.length, items: overdueItems },
    failedGatewayPayments: { count: failedItems.length, items: failedItems },
    depositDeadlines48h: { count: depositItems.length, items: depositItems },
    needsReviewCount,
  };
}
