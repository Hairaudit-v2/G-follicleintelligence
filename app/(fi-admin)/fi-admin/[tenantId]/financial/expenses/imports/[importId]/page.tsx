import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ExpenseImportReviewTable } from "@/src/components/fi-admin/financial-os/expenses/ExpenseImportReviewTable";
import {
  FinancialOsSubPageHeader,
  financialOsClasses,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import {
  ensureExpenseCategoriesForTenant,
  loadExpenseImportById,
  loadExpenseImportLines,
} from "@/src/lib/financialOs/expenses/expenseLoaders.server";
import { getPaymentRecordMutationCapability } from "@/src/lib/payments/paymentRecordAccess.server";

export const metadata: Metadata = {
  title: "Finances · Expense import review",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FinancialOsExpenseImportReviewPage({
  params,
}: {
  params: Promise<{ tenantId: string; importId: string }>;
}) {
  const { tenantId, importId } = await params;
  const tid = tenantId?.trim();
  const iid = importId?.trim();
  if (!tid || !iid) notFound();

  await assertFiTenantPortalAccess(tid);

  let importRow: Awaited<ReturnType<typeof loadExpenseImportById>> = null;
  let lines: Awaited<ReturnType<typeof loadExpenseImportLines>> = [];
  let categories: Awaited<ReturnType<typeof ensureExpenseCategoriesForTenant>> = [];
  let loadError: string | null = null;

  try {
    importRow = await loadExpenseImportById(tid, iid);
    if (importRow) {
      lines = await loadExpenseImportLines(tid, iid);
      categories = await ensureExpenseCategoriesForTenant(tid);
    }
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load import.";
  }

  if (!importRow && !loadError) notFound();

  const capability = await getPaymentRecordMutationCapability(tid);
  const canMutate = capability.canMutate;

  return (
    <div className={financialOsClasses.pageSection}>
      <FinancialOsSubPageHeader
        kicker="Opex capture"
        title="Import review"
        description={
          importRow
            ? `${importRow.source_type} · ${importRow.original_filename ?? "untitled"} · ${importRow.row_count} rows`
            : "Review draft expense lines before commit."
        }
      />
      <p className={financialOsClasses.bodyTextXs}>
        <Link
          href={`/fi-admin/${tid}/financial/expenses`}
          className={financialOsClasses.inlineLink}
        >
          ← Back to expenses
        </Link>
      </p>

      {loadError ? (
        <p className={financialOsClasses.errorText} role="alert">
          {loadError}
        </p>
      ) : null}

      {importRow ? (
        <ExpenseImportReviewTable
          tenantId={tid}
          importRow={importRow}
          lines={lines}
          categories={categories}
          canMutate={canMutate}
        />
      ) : null}
    </div>
  );
}
