import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ExpenseCsvImportForm } from "@/src/components/fi-admin/financial-os/expenses/ExpenseCsvImportForm";
import { ExpenseDocumentsTable } from "@/src/components/fi-admin/financial-os/expenses/ExpenseDocumentsTable";
import { ExpenseManualEntryForm } from "@/src/components/fi-admin/financial-os/expenses/ExpenseManualEntryForm";
import { ExpenseReceiptUploadForm } from "@/src/components/fi-admin/financial-os/expenses/ExpenseReceiptUploadForm";
import { ExpensesListTable } from "@/src/components/fi-admin/financial-os/expenses/ExpensesListTable";
import {
  FinancialOsSubPageHeader,
  FinancialOsTable,
  FinancialOsTh,
  financialOsClasses,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import { FinancialOsRecordStatusBadge } from "@/src/components/fi-admin/financial-os/FinancialOsRecordStatusBadge";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadExpenseDocumentsForTenant } from "@/src/lib/financialOs/expenses/expenseDocumentMutations.server";
import {
  ensureExpenseCategoriesForTenant,
  loadExpenseImportsForTenant,
  loadExpensesForTenant,
} from "@/src/lib/financialOs/expenses/expenseLoaders.server";
import { getPaymentRecordMutationCapability } from "@/src/lib/payments/paymentRecordAccess.server";

export const metadata: Metadata = {
  title: "Finances · Expenses",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FinancialOsExpensesPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();

  await assertFiTenantPortalAccess(tid);

  let categories: Awaited<ReturnType<typeof ensureExpenseCategoriesForTenant>> = [];
  let expenses: Awaited<ReturnType<typeof loadExpensesForTenant>> = [];
  let imports: Awaited<ReturnType<typeof loadExpenseImportsForTenant>> = [];
  let documents: Awaited<ReturnType<typeof loadExpenseDocumentsForTenant>> = [];
  let loadError: string | null = null;

  try {
    categories = await ensureExpenseCategoriesForTenant(tid);
    expenses = await loadExpensesForTenant(tid, { limit: 200 });
    imports = await loadExpenseImportsForTenant(tid, 20);
    documents = await loadExpenseDocumentsForTenant(tid, 30);
  } catch (e) {
    loadError =
      e instanceof Error
        ? e.message
        : "Could not load expenses. Ensure the expenses migration has been applied.";
  }

  const capability = await getPaymentRecordMutationCapability(tid);
  const canMutate = capability.canMutate;

  return (
    <div className={financialOsClasses.pageSection}>
      <FinancialOsSubPageHeader
        kicker="Opex capture"
        title="Expenses"
        description="Capture clinic costs via manual entry, bank/card CSV, or receipt/invoice upload with OCR. Review before posting. Does not write to the revenue ledger."
      />

      {loadError ? (
        <p className={financialOsClasses.errorText} role="alert">
          {loadError}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2 2xl:grid-cols-3">
        <ExpenseManualEntryForm tenantId={tid} categories={categories} canMutate={canMutate} />
        <ExpenseCsvImportForm tenantId={tid} canMutate={canMutate} />
        <ExpenseReceiptUploadForm tenantId={tid} canMutate={canMutate} />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-100">Recent expenses</h2>
        <ExpensesListTable tenantId={tid} expenses={expenses} canMutate={canMutate} />
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
              <td className={financialOsClasses.tableCell}>
                {row.original_filename || "—"}
              </td>
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
