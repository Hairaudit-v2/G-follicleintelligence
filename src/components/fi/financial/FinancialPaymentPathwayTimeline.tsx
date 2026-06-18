"use client";

import { useState, useTransition } from "react";

import {
  cancelPaymentPathwayAction,
  updatePaymentPathwayStatusAction,
} from "@/lib/actions/financial-os-payment-pathway-actions";
import { pathwayStatusLabel, pathwayTypeLabel } from "@/src/components/fi/financial/FinancialPaymentPathwayBadge";
import {
  FinancialOsEmptyState,
  FinancialOsFeedbackText,
  FinancialOsTable,
  FinancialOsTh,
  financialOsActionFeedback,
  financialOsClasses,
  type FinancialOsFeedback,
} from "@/src/components/fi-admin/financial-os/financialOsUi";

export type FinancialPaymentPathwayTimelineRow = {
  id: string;
  pathway_type: string;
  status: string;
  source: string | null;
  provider: string | null;
  expected_settlement_date: string | null;
  actual_settlement_date: string | null;
  expected_amount_cents: number | null;
  settled_amount_cents: number | null;
  currency_code: string | null;
  case_id: string | null;
  invoice_id: string | null;
  booking_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

const STATUS_OPTIONS = [
  "draft",
  "selected",
  "pending_patient_action",
  "pending_clinic_action",
  "pending_provider",
  "approved",
  "rejected",
  "settlement_pending",
  "settled",
  "cancelled",
] as const;

const SOURCE_LABELS: Record<string, string> = {
  staff: "Staff",
  patient_public_token: "Patient (pay link)",
  system: "System",
};

function sourceLabel(source: string | null): string {
  if (!source) return "Staff";
  return SOURCE_LABELS[source] ?? source;
}

function fmtMoney(cents: number | null, currency: string | null): string {
  if (cents == null) return "—";
  const v = cents / 100;
  return `${currency ?? "AUD"} ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Shows the recorded payment pathways for a tenant (or a single case/invoice/booking context)
 * with status, provider, settlement, linked entities, and metadata notes — plus inline status
 * transitions for staff with finance/payment write access.
 */
export function FinancialPaymentPathwayTimeline(props: {
  tenantId: string;
  rows: FinancialPaymentPathwayTimelineRow[];
  canMutate: boolean;
}) {
  const { tenantId, rows, canMutate } = props;
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<FinancialOsFeedback | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function onChangeStatus(pathwayId: string, status: string) {
    setFeedback(null);
    setBusyId(pathwayId);
    start(async () => {
      const res = await updatePaymentPathwayStatusAction(tenantId, { pathway_id: pathwayId, status });
      setFeedback(financialOsActionFeedback(res, "Status updated."));
      setBusyId(null);
    });
  }

  function onCancel(pathwayId: string) {
    setFeedback(null);
    setBusyId(pathwayId);
    start(async () => {
      const res = await cancelPaymentPathwayAction(tenantId, { pathway_id: pathwayId });
      setFeedback(financialOsActionFeedback(res, "Pathway cancelled."));
      setBusyId(null);
    });
  }

  if (!rows.length) {
    return <FinancialOsEmptyState message="No payment pathways recorded yet." />;
  }

  return (
    <div className="space-y-3">
      <FinancialOsFeedbackText message={feedback?.message ?? null} tone={feedback?.tone} />
      <FinancialOsTable
        head={
          <>
            <FinancialOsTh>Type</FinancialOsTh>
            <FinancialOsTh>Status</FinancialOsTh>
            <FinancialOsTh>Source</FinancialOsTh>
            <FinancialOsTh>Provider</FinancialOsTh>
            <FinancialOsTh>Expected settlement</FinancialOsTh>
            <FinancialOsTh>Expected amount</FinancialOsTh>
            <FinancialOsTh>Linked</FinancialOsTh>
            <FinancialOsTh>Notes</FinancialOsTh>
            {canMutate ? <FinancialOsTh>Actions</FinancialOsTh> : null}
          </>
        }
      >
        {rows.map((p) => {
          const notes = typeof p.metadata?.notes === "string" ? (p.metadata.notes as string) : null;
          const isBusy = pending && busyId === p.id;
          return (
            <tr key={p.id} className={financialOsClasses.tableRow}>
              <td className={financialOsClasses.tableCell}>{pathwayTypeLabel(p.pathway_type)}</td>
              <td className={financialOsClasses.tableCell}>{pathwayStatusLabel(p.status)}</td>
              <td className={financialOsClasses.tableCell}>{sourceLabel(p.source)}</td>
              <td className={financialOsClasses.tableCell}>{p.provider ?? "—"}</td>
              <td className={financialOsClasses.tableCell}>{p.expected_settlement_date ?? "—"}</td>
              <td className={financialOsClasses.tableCellMono}>{fmtMoney(p.expected_amount_cents, p.currency_code)}</td>
              <td className={`${financialOsClasses.tableCellMono} text-[10px]`}>
                {p.case_id ? `case:${p.case_id.slice(0, 8)}… ` : ""}
                {p.invoice_id ? `inv:${p.invoice_id.slice(0, 8)}… ` : ""}
                {p.booking_id ? `bk:${p.booking_id.slice(0, 8)}…` : ""}
                {!p.case_id && !p.invoice_id && !p.booking_id ? "—" : ""}
              </td>
              <td className={`${financialOsClasses.tableCell} max-w-[16rem] truncate`} title={notes ?? undefined}>
                {notes ?? "—"}
              </td>
              {canMutate ? (
                <td className={financialOsClasses.tableCell}>
                  <div className="flex items-center gap-1">
                    <select
                      className={financialOsClasses.inlineSelect}
                      defaultValue={p.status}
                      disabled={isBusy || p.status === "cancelled"}
                      onChange={(e) => onChangeStatus(p.id, e.target.value)}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={isBusy || p.status === "cancelled"}
                      onClick={() => onCancel(p.id)}
                      className={`${financialOsClasses.secondaryButton} text-rose-300 hover:text-rose-200`}
                    >
                      Cancel
                    </button>
                  </div>
                </td>
              ) : null}
            </tr>
          );
        })}
      </FinancialOsTable>
    </div>
  );
}
