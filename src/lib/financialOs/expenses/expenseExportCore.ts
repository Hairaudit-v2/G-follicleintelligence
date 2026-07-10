/**
 * CSV / QuickBooks export builders for posted expenses (Stage 6).
 */

export type ExpenseExportRow = {
  id: string;
  expense_date: string;
  amount_cents: number;
  currency: string;
  status: string;
  vendor_name: string | null;
  description: string | null;
  category_code: string | null;
  category_label: string | null;
  campaign_key: string | null;
  lead_id: string | null;
  case_id: string | null;
  procedure_type: string | null;
  payment_method: string | null;
  ledger_post_transaction_id?: string | null;
};

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function buildExpensesCsv(rows: readonly ExpenseExportRow[]): string {
  const headers = [
    "expense_id",
    "expense_date",
    "amount",
    "currency",
    "status",
    "vendor_name",
    "description",
    "category_code",
    "category_label",
    "campaign_key",
    "lead_id",
    "case_id",
    "procedure_type",
    "payment_method",
    "ledger_post_transaction_id",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    const amount = (r.amount_cents / 100).toFixed(2);
    lines.push(
      [
        r.id,
        r.expense_date,
        amount,
        r.currency,
        r.status,
        r.vendor_name ?? "",
        r.description ?? "",
        r.category_code ?? "",
        r.category_label ?? "",
        r.campaign_key ?? "",
        r.lead_id ?? "",
        r.case_id ?? "",
        r.procedure_type ?? "",
        r.payment_method ?? "",
        r.ledger_post_transaction_id ?? "",
      ]
        .map((c) => csvEscape(String(c)))
        .join(",")
    );
  }
  return lines.join("\n") + "\n";
}

/**
 * QuickBooks Online-friendly purchase CSV for bulk import tools / IIF bridges.
 * Columns aligned with common QBO "Expense" CSV imports (not a live API push).
 */
export function buildQuickBooksExpenseCsv(rows: readonly ExpenseExportRow[]): string {
  const headers = [
    "Date",
    "Description",
    "Amount",
    "Currency",
    "Vendor",
    "Account",
    "Payment Method",
    "Memo",
    "FI Expense Id",
    "Campaign",
    "Category Code",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    if (r.status !== "posted") continue;
    const amount = (r.amount_cents / 100).toFixed(2);
    const account = r.category_label || r.category_code || "Expenses";
    lines.push(
      [
        r.expense_date,
        r.description ?? r.vendor_name ?? "FI expense",
        amount,
        r.currency || "AUD",
        r.vendor_name ?? "",
        account,
        r.payment_method ?? "",
        [r.campaign_key, r.procedure_type].filter(Boolean).join(" · "),
        r.id,
        r.campaign_key ?? "",
        r.category_code ?? "",
      ]
        .map((c) => csvEscape(String(c)))
        .join(",")
    );
  }
  return lines.join("\n") + "\n";
}

/** JSON payload for a future live QuickBooks Purchase API push (scaffold). */
export type QuickBooksPurchaseDraft = {
  TxnDate: string;
  PrivateNote: string;
  TotalAmt: number;
  CurrencyRef?: { value: string };
  EntityRef?: { name: string };
  Line: Array<{
    Amount: number;
    DetailType: "AccountBasedExpenseLineDetail";
    Description?: string;
    AccountBasedExpenseLineDetail: {
      AccountRef: { name: string };
    };
  }>;
  MetaData?: { CreateTime?: string };
  /** FI correlation */
  fi_expense_id: string;
};

export function buildQuickBooksPurchaseDrafts(
  rows: readonly ExpenseExportRow[]
): QuickBooksPurchaseDraft[] {
  return rows
    .filter((r) => r.status === "posted" && r.amount_cents > 0)
    .map((r) => {
      const total = Math.round(r.amount_cents) / 100;
      const accountName = r.category_label || r.category_code || "Uncategorized Expense";
      return {
        TxnDate: r.expense_date,
        PrivateNote: `FI expense ${r.id}${r.campaign_key ? ` · ${r.campaign_key}` : ""}`,
        TotalAmt: total,
        CurrencyRef: { value: (r.currency || "AUD").toUpperCase() },
        EntityRef: r.vendor_name?.trim() ? { name: r.vendor_name.trim() } : undefined,
        Line: [
          {
            Amount: total,
            DetailType: "AccountBasedExpenseLineDetail" as const,
            Description: r.description ?? undefined,
            AccountBasedExpenseLineDetail: {
              AccountRef: { name: accountName },
            },
          },
        ],
        fi_expense_id: r.id,
      };
    });
}
