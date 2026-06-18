"use client";

import { useState, useTransition } from "react";

import { updateFinanceProviderAction } from "@/lib/actions/financial-os-finance-actions";
import {
  FinancialOsFeedbackText,
  FinancialOsTable,
  FinancialOsTh,
  financialOsActionFeedback,
  financialOsClasses,
  type FinancialOsFeedback,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import { financialOsStatusBadgeBase, financialOsStatusBadgeTones } from "@/src/components/fi-admin/financial-os/financialOsStatusBadgeStyles";
import type { FinanceProviderRecord } from "@/src/lib/financialOs/financialFinanceProviders.server";

export function FinancialProviderTable(props: {
  tenantId: string;
  rows: FinanceProviderRecord[];
  canMutate: boolean;
}) {
  const [feedback, setFeedback] = useState<FinancialOsFeedback | null>(null);
  const [pending, start] = useTransition();

  function toggleActive(row: FinanceProviderRecord) {
    if (!props.canMutate) return;
    setFeedback(null);
    start(async () => {
      const res = await updateFinanceProviderAction(props.tenantId, {
        provider_id: row.id,
        is_active: !row.is_active,
      });
      setFeedback(financialOsActionFeedback(res, "Provider updated."));
    });
  }

  return (
    <div>
      <FinancialOsFeedbackText message={feedback?.message ?? null} tone={feedback?.tone} className="mb-2" />
      <FinancialOsTable
        isEmpty={props.rows.length === 0}
        emptyMessage="No providers configured."
        head={
          <>
            <FinancialOsTh>Name</FinancialOsTh>
            <FinancialOsTh>Type</FinancialOsTh>
            <FinancialOsTh>Scope</FinancialOsTh>
            <FinancialOsTh>Country</FinancialOsTh>
            <FinancialOsTh>Active</FinancialOsTh>
            <FinancialOsTh>Actions</FinancialOsTh>
          </>
        }
      >
        {props.rows.map((row) => (
          <tr key={row.id} className={financialOsClasses.tableRow}>
            <td className={financialOsClasses.tableCellStrong}>{row.name}</td>
            <td className={financialOsClasses.tableCell}>{row.provider_type}</td>
            <td className={financialOsClasses.tableCell}>{row.tenant_id ? "Tenant" : "Global catalog"}</td>
            <td className={financialOsClasses.tableCellMono}>{row.country_code ?? "—"}</td>
            <td className={financialOsClasses.tableCell}>
              <span
                className={`${financialOsStatusBadgeBase} ${row.is_active ? financialOsStatusBadgeTones.success : financialOsStatusBadgeTones.neutral}`}
              >
                {row.is_active ? "Yes" : "No"}
              </span>
            </td>
            <td className={financialOsClasses.tableCell}>
              {props.canMutate ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => toggleActive(row)}
                  className={`${financialOsClasses.textButton} disabled:opacity-50`}
                >
                  {row.is_active ? "Deactivate" : "Activate"}
                </button>
              ) : (
                "—"
              )}
            </td>
          </tr>
        ))}
      </FinancialOsTable>
    </div>
  );
}
