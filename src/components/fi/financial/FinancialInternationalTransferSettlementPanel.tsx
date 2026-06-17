"use client";

import { useState, useTransition } from "react";

import {
  resolveInternationalTransferAttentionAction,
  updateInternationalTransferSettlementAction,
  updateInternationalTransferStatusAction,
} from "@/lib/actions/financial-os-international-transfer-actions";
import { FinancialInternationalTransferStatusBadge } from "@/src/components/fi/financial/FinancialInternationalTransferStatusBadge";
import type { InternationalTransferApplicationRecord } from "@/src/lib/financialOs/financialInternationalTransfer.server";

const TRANSFER_STATUSES = [
  "instructions_required",
  "instructions_sent",
  "awaiting_transfer",
  "proof_received",
  "under_reconciliation",
  "settlement_pending",
  "partially_settled",
  "settled",
  "variance_review",
  "rejected",
  "cancelled",
] as const;

function fmtMoney(cents: number | null, currency = "AUD"): string {
  if (cents == null) return "—";
  return `${currency} ${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export function FinancialInternationalTransferSettlementPanel(props: {
  tenantId: string;
  application: InternationalTransferApplicationRecord;
  canMutate: boolean;
}) {
  const { application, canMutate } = props;
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const currency = application.settlement_currency_code || "AUD";

  function updateStatus(status: (typeof TRANSFER_STATUSES)[number]) {
    setMsg(null);
    start(async () => {
      const res = await updateInternationalTransferStatusAction(props.tenantId, {
        application_id: application.id,
        status,
      });
      setMsg(res.ok ? "Status updated." : res.error);
    });
  }

  function saveSettlement(form: FormData) {
    setMsg(null);
    start(async () => {
      const parseCents = (key: string) => {
        const raw = String(form.get(key) ?? "").trim();
        return raw ? Number(raw) : null;
      };
      const parseRate = (key: string) => {
        const raw = String(form.get(key) ?? "").trim();
        return raw ? Number(raw) : null;
      };
      const res = await updateInternationalTransferSettlementAction(props.tenantId, {
        application_id: application.id,
        received_amount_cents: parseCents("received_amount_cents"),
        expected_settlement_amount_cents: parseCents("expected_settlement_amount_cents"),
        expected_exchange_rate: parseRate("expected_exchange_rate"),
        actual_exchange_rate: parseRate("actual_exchange_rate"),
        fx_fee_cents: parseCents("fx_fee_cents"),
        expected_settlement_date: String(form.get("expected_settlement_date") ?? "").trim() || null,
        actual_settlement_date: String(form.get("actual_settlement_date") ?? "").trim() || null,
        source_country_code: String(form.get("source_country_code") ?? "").trim() || null,
        source_currency_code: String(form.get("source_currency_code") ?? "").trim() || null,
      });
      setMsg(res.ok ? "Settlement details saved." : res.error);
    });
  }

  function markSettled() {
    setMsg(null);
    start(async () => {
      const res = await resolveInternationalTransferAttentionAction(props.tenantId, {
        application_id: application.id,
      });
      setMsg(res.ok ? "Marked as settled — financial clearance granted." : res.error);
    });
  }

  return (
    <div className="space-y-4 rounded border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">Settlement &amp; FX</p>
          <p className="text-xs text-slate-600">
            {application.source_country_code ?? "—"} · {application.source_currency_code ?? "—"} → {currency}
            {application.payment_reference ? ` · Ref ${application.payment_reference}` : null}
          </p>
        </div>
        <FinancialInternationalTransferStatusBadge status={application.transfer_status} />
      </div>

      <dl className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-slate-500">Expected settlement</dt>
          <dd className="font-mono text-slate-900">{fmtMoney(application.expected_settlement_amount_cents, currency)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Received</dt>
          <dd className="font-mono text-slate-900">{fmtMoney(application.received_amount_cents, currency)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Variance</dt>
          <dd className="font-mono text-slate-900">{fmtMoney(application.settlement_variance_cents, currency)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">FX rates</dt>
          <dd className="font-mono text-slate-900">
            {application.expected_exchange_rate ?? "—"} → {application.actual_exchange_rate ?? "—"}
          </dd>
        </div>
      </dl>

      {application.transfer_instructions ? (
        <div className="rounded border border-slate-200 bg-white p-3 text-xs text-slate-700">
          <p className="font-semibold text-slate-900">Transfer instructions</p>
          <p className="mt-1 whitespace-pre-wrap">{application.transfer_instructions}</p>
        </div>
      ) : null}

      {canMutate ? (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-slate-600">
              Workflow status
              <select
                defaultValue={application.transfer_status}
                onChange={(e) => updateStatus(e.target.value as (typeof TRANSFER_STATUSES)[number])}
                disabled={pending}
                className="mt-1 block rounded border border-slate-200 px-2 py-1 text-sm"
              >
                {TRANSFER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={pending || application.transfer_status === "settled"}
              onClick={markSettled}
              className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              Mark settled
            </button>
          </div>

          <form
            action={(fd) => saveSettlement(fd)}
            className="grid gap-3 border-t border-slate-200 pt-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            <label className="text-xs text-slate-600">
              Source country
              <input
                name="source_country_code"
                defaultValue={application.source_country_code ?? ""}
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm"
                placeholder="GB"
              />
            </label>
            <label className="text-xs text-slate-600">
              Source currency
              <input
                name="source_currency_code"
                defaultValue={application.source_currency_code ?? ""}
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm"
                placeholder="GBP"
              />
            </label>
            <label className="text-xs text-slate-600">
              Expected settlement (cents)
              <input
                name="expected_settlement_amount_cents"
                defaultValue={application.expected_settlement_amount_cents ?? ""}
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm"
                inputMode="numeric"
              />
            </label>
            <label className="text-xs text-slate-600">
              Received (cents)
              <input
                name="received_amount_cents"
                defaultValue={application.received_amount_cents ?? ""}
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm"
                inputMode="numeric"
              />
            </label>
            <label className="text-xs text-slate-600">
              Expected FX rate
              <input
                name="expected_exchange_rate"
                defaultValue={application.expected_exchange_rate ?? ""}
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              Actual FX rate
              <input
                name="actual_exchange_rate"
                defaultValue={application.actual_exchange_rate ?? ""}
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              FX fee (cents)
              <input
                name="fx_fee_cents"
                defaultValue={application.fx_fee_cents ?? ""}
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm"
                inputMode="numeric"
              />
            </label>
            <label className="text-xs text-slate-600">
              Expected settlement date
              <input
                name="expected_settlement_date"
                type="date"
                defaultValue={application.expected_settlement_date ?? ""}
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              Actual settlement date
              <input
                name="actual_settlement_date"
                type="date"
                defaultValue={application.actual_settlement_date ?? ""}
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm"
              />
            </label>
            <div className="flex items-end sm:col-span-2 lg:col-span-3">
              <button
                type="submit"
                disabled={pending}
                className="rounded bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
              >
                Save settlement details
              </button>
            </div>
          </form>
        </>
      ) : null}

      {msg ? <p className="text-xs text-slate-600">{msg}</p> : null}
    </div>
  );
}
