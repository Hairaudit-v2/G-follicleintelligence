"use client";

import { useState, useTransition } from "react";

import {
  cancelPaymentPathwayAction,
  updatePaymentPathwayStatusAction,
} from "@/lib/actions/financial-os-payment-pathway-actions";
import { pathwayStatusLabel, pathwayTypeLabel } from "@/src/components/fi/financial/FinancialPaymentPathwayBadge";

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
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function onChangeStatus(pathwayId: string, status: string) {
    setMsg(null);
    setBusyId(pathwayId);
    start(async () => {
      const res = await updatePaymentPathwayStatusAction(tenantId, { pathway_id: pathwayId, status });
      setMsg(res.ok ? "Status updated." : res.error);
      setBusyId(null);
    });
  }

  function onCancel(pathwayId: string) {
    setMsg(null);
    setBusyId(pathwayId);
    start(async () => {
      const res = await cancelPaymentPathwayAction(tenantId, { pathway_id: pathwayId });
      setMsg(res.ok ? "Pathway cancelled." : res.error);
      setBusyId(null);
    });
  }

  if (!rows.length) {
    return <p className="text-xs text-slate-600">No payment pathways recorded yet.</p>;
  }

  return (
    <div className="space-y-3">
      {msg ? <p className="text-xs text-slate-800">{msg}</p> : null}
      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-2 py-2">Type</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Source</th>
              <th className="px-2 py-2">Provider</th>
              <th className="px-2 py-2">Expected settlement</th>
              <th className="px-2 py-2">Expected amount</th>
              <th className="px-2 py-2">Linked</th>
              <th className="px-2 py-2">Notes</th>
              {canMutate ? <th className="px-2 py-2">Actions</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((p) => {
              const notes = typeof p.metadata?.notes === "string" ? (p.metadata.notes as string) : null;
              const isBusy = pending && busyId === p.id;
              return (
                <tr key={p.id}>
                  <td className="px-2 py-2">{pathwayTypeLabel(p.pathway_type)}</td>
                  <td className="px-2 py-2">{pathwayStatusLabel(p.status)}</td>
                  <td className="px-2 py-2">{sourceLabel(p.source)}</td>
                  <td className="px-2 py-2">{p.provider ?? "—"}</td>
                  <td className="px-2 py-2">{p.expected_settlement_date ?? "—"}</td>
                  <td className="px-2 py-2 font-mono">{fmtMoney(p.expected_amount_cents, p.currency_code)}</td>
                  <td className="px-2 py-2 font-mono text-[10px]">
                    {p.case_id ? `case:${p.case_id.slice(0, 8)}… ` : ""}
                    {p.invoice_id ? `inv:${p.invoice_id.slice(0, 8)}… ` : ""}
                    {p.booking_id ? `bk:${p.booking_id.slice(0, 8)}…` : ""}
                    {!p.case_id && !p.invoice_id && !p.booking_id ? "—" : ""}
                  </td>
                  <td className="px-2 py-2 max-w-[16rem] truncate" title={notes ?? undefined}>
                    {notes ?? "—"}
                  </td>
                  {canMutate ? (
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        <select
                          className="rounded border border-slate-300 px-1 py-0.5 text-[11px]"
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
                          className="rounded border border-rose-300 px-1.5 py-0.5 text-[11px] text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
