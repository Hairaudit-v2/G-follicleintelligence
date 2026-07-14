import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ExpenseBankReconPanel } from "@/src/components/fi-admin/financial-os/expenses/ExpenseBankReconPanel";
import { ExpenseCostPerGraftPanel } from "@/src/components/fi-admin/financial-os/expenses/ExpenseCostPerGraftPanel";
import { ExpenseCplPanel } from "@/src/components/fi-admin/financial-os/expenses/ExpenseCplPanel";
import { ExpenseCsvImportForm } from "@/src/components/fi-admin/financial-os/expenses/ExpenseCsvImportForm";
import { ExpenseDocumentsTable } from "@/src/components/fi-admin/financial-os/expenses/ExpenseDocumentsTable";
import { ExpenseExportPanel } from "@/src/components/fi-admin/financial-os/expenses/ExpenseExportPanel";
import { ExpenseManualEntryForm } from "@/src/components/fi-admin/financial-os/expenses/ExpenseManualEntryForm";
import { ExpenseMultiClinicPlPanel } from "@/src/components/fi-admin/financial-os/expenses/ExpenseMultiClinicPlPanel";
import { ExpenseOperatingPlPanel } from "@/src/components/fi-admin/financial-os/expenses/ExpenseOperatingPlPanel";
import { ExpensePeriodFilterBar } from "@/src/components/fi-admin/financial-os/expenses/ExpensePeriodFilterBar";
import { ExpenseReceiptUploadForm } from "@/src/components/fi-admin/financial-os/expenses/ExpenseReceiptUploadForm";
import { ExpenseSpendByCategoryPanel } from "@/src/components/fi-admin/financial-os/expenses/ExpenseSpendByCategoryPanel";
import { ExpensesListTable } from "@/src/components/fi-admin/financial-os/expenses/ExpensesListTable";
import {
  FinancialOsSubPageHeader,
  FinancialOsTable,
  FinancialOsTh,
  financialOsClasses,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import { FinancialOsRecordStatusBadge } from "@/src/components/fi-admin/financial-os/FinancialOsRecordStatusBadge";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadBankReconMatches } from "@/src/lib/financialOs/expenses/expenseBankRecon.server";
import type { ClinicPlSummary } from "@/src/lib/financialOs/expenses/expenseChartOfAccountsCore";
import {
  ensureGlAccountsForTenant,
  loadMultiClinicOperatingPl,
} from "@/src/lib/financialOs/expenses/expenseChartOfAccounts.server";
import { loadExpenseDocumentsForTenant } from "@/src/lib/financialOs/expenses/expenseDocumentMutations.server";
import { loadRecentExpenseCampaignKeys } from "@/src/lib/financialOs/expenses/expenseEntitySearch.server";
import {
  attachExpenseEntityLabels,
  loadExpenseIntelligenceBundle,
  type ExpenseIntelligenceBundle,
} from "@/src/lib/financialOs/expenses/expenseIntelligence.server";
import {
  ensureExpenseCategoriesForTenant,
  loadExpenseImportsForTenant,
  loadExpensesForTenant,
} from "@/src/lib/financialOs/expenses/expenseLoaders.server";
import { normalizeExpensePeriod } from "@/src/lib/financialOs/expenses/expensePeriodCore";
import type { ExpensePlSummary } from "@/src/lib/financialOs/expenses/expensePlCore";
import {
  loadBankReconciliationPreview,
  loadOperatingPlSummary,
} from "@/src/lib/financialOs/expenses/expenseStage6.server";
import type { FiExpenseRow } from "@/src/lib/financialOs/expenses/expenseTypes";
import { getPaymentRecordMutationCapability } from "@/src/lib/payments/paymentRecordAccess.server";

export const metadata: Metadata = {
  title: "Finances · Expenses",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FinancialOsExpensesPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantId } = await params;
  const sp = (await searchParams) ?? {};
  const tid = tenantId?.trim();
  if (!tid) notFound();

  await assertFiTenantPortalAccess(tid);

  const one = (key: string) => {
    const v = sp[key];
    if (typeof v === "string") return v.trim() || null;
    return null;
  };
  const { period_start, period_end } = normalizeExpensePeriod({
    periodStart: one("from"),
    periodEnd: one("to"),
  });

  let categories: Awaited<ReturnType<typeof ensureExpenseCategoriesForTenant>> = [];
  let expenses: FiExpenseRow[] = [];
  let imports: Awaited<ReturnType<typeof loadExpenseImportsForTenant>> = [];
  let documents: Awaited<ReturnType<typeof loadExpenseDocumentsForTenant>> = [];
  let campaignSuggestions: string[] = [];
  let intelligence: ExpenseIntelligenceBundle | null = null;
  let plSummary: ExpensePlSummary | null = null;
  let multiClinicPl: ClinicPlSummary | null = null;
  let bankRecon: Awaited<ReturnType<typeof loadBankReconciliationPreview>> | null = null;
  let persistedMatches: Awaited<ReturnType<typeof loadBankReconMatches>> = [];
  let loadError: string | null = null;

  try {
    categories = await ensureExpenseCategoriesForTenant(tid);
    await ensureGlAccountsForTenant(tid);
    const rawExpenses = await loadExpensesForTenant(tid, { limit: 200 });
    expenses = await attachExpenseEntityLabels(tid, rawExpenses);
    imports = await loadExpenseImportsForTenant(tid, 20);
    documents = await loadExpenseDocumentsForTenant(tid, 30);
    campaignSuggestions = await loadRecentExpenseCampaignKeys(tid, 30);
    intelligence = await loadExpenseIntelligenceBundle(tid, {
      periodStart: period_start,
      periodEnd: period_end,
    });
    plSummary = await loadOperatingPlSummary(tid, {
      periodStart: period_start,
      periodEnd: period_end,
    });
    multiClinicPl = await loadMultiClinicOperatingPl(tid, {
      periodStart: period_start,
      periodEnd: period_end,
    });
    bankRecon = await loadBankReconciliationPreview(tid, {
      periodStart: period_start,
      periodEnd: period_end,
    });
    persistedMatches = await loadBankReconMatches(tid, "all");
  } catch (e) {
    loadError =
      e instanceof Error
        ? e.message
        : "Could not load expenses. Ensure the expenses migration has been applied.";
  }

  const capability = await getPaymentRecordMutationCapability(tid);
  const canMutate = capability.canMutate;
  // Export uses financial_os read gate in action; mutators and portal readers both reach this page.
  const canExport = true;

  return (
    <div className={financialOsClasses.pageSection}>
      <FinancialOsSubPageHeader
        kicker="Opex capture"
        title="Expenses"
        description="Capture clinic costs, post to the ledger, multi-clinic P&L, bank recon confirm, and export to FI / QuickBooks / Xero for the selected period."
      />

      {loadError ? (
        <p className={financialOsClasses.errorText} role="alert">
          {loadError}
        </p>
      ) : null}

      <ExpensePeriodFilterBar tenantId={tid} periodStart={period_start} periodEnd={period_end} />

      <div className="grid gap-6 xl:grid-cols-2 2xl:grid-cols-3">
        <ExpenseManualEntryForm
          tenantId={tid}
          categories={categories}
          canMutate={canMutate}
          campaignSuggestions={campaignSuggestions}
        />
        <ExpenseCsvImportForm tenantId={tid} canMutate={canMutate} />
        <ExpenseReceiptUploadForm tenantId={tid} canMutate={canMutate} expenses={expenses} />
      </div>

      <ExpenseExportPanel
        tenantId={tid}
        periodStart={period_start}
        periodEnd={period_end}
        canExport={canExport}
      />

      {plSummary ? <ExpenseOperatingPlPanel summary={plSummary} /> : null}
      {multiClinicPl ? <ExpenseMultiClinicPlPanel summary={multiClinicPl} /> : null}

      {bankRecon ? (
        <ExpenseBankReconPanel
          tenantId={tid}
          periodStart={bankRecon.period_start}
          periodEnd={bankRecon.period_end}
          lineCount={bankRecon.line_count}
          expenseCount={bankRecon.expense_count}
          heuristicMatchCount={bankRecon.matches.length}
          unmatchedLines={bankRecon.unmatched_line_ids.length}
          unmatchedExpenses={bankRecon.unmatched_expense_ids.length}
          persistedMatches={persistedMatches}
          canMutate={canMutate}
        />
      ) : null}

      {intelligence ? (
        <div className="grid gap-6 2xl:grid-cols-1">
          <ExpenseCplPanel summary={intelligence.cpl} />
          <div className="grid gap-6 xl:grid-cols-2">
            <ExpenseSpendByCategoryPanel summary={intelligence.spend} />
            <ExpenseCostPerGraftPanel summary={intelligence.costPerGraft} />
          </div>
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-100">Recent expenses</h2>
        <ExpensesListTable
          tenantId={tid}
          expenses={expenses}
          canMutate={canMutate}
          campaignSuggestions={campaignSuggestions}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-100">Recent documents</h2>
        <ExpenseDocumentsTable tenantId={tid} documents={documents} canMutate={canMutate} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-100">Recent imports</h2>
        <FinancialOsTable
          isEmpty={imports.length === 0}
          emptyMessage="No CSV imports yet."
          head={
            <>
              <FinancialOsTh>Created</FinancialOsTh>
              <FinancialOsTh>Source</FinancialOsTh>
              <FinancialOsTh>File</FinancialOsTh>
              <FinancialOsTh>Rows</FinancialOsTh>
              <FinancialOsTh>Status</FinancialOsTh>
              <FinancialOsTh>Open</FinancialOsTh>
            </>
          }
        >
          {imports.map((row) => (
            <tr key={row.id} className={financialOsClasses.tableRow}>
              <td className={financialOsClasses.tableCellMono}>
                {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
              </td>
              <td className={financialOsClasses.tableCell}>{row.source_type}</td>
              <td className={financialOsClasses.tableCell}>{row.original_filename || "—"}</td>
              <td className={financialOsClasses.tableCell}>{row.row_count}</td>
              <td className={financialOsClasses.tableCell}>
                <FinancialOsRecordStatusBadge status={row.status} />
              </td>
              <td className={financialOsClasses.tableCell}>
                <Link
                  className={financialOsClasses.inlineLink}
                  href={`/fi-admin/${tid}/financial/expenses/imports/${encodeURIComponent(row.id)}`}
                >
                  Review
                </Link>
              </td>
            </tr>
          ))}
        </FinancialOsTable>
      </section>
    </div>
  );
}
