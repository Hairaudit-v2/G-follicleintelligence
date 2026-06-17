"use client";

import { Fragment, useMemo, useState, useTransition } from "react";

import { createInternationalTransferApplicationAction } from "@/lib/actions/financial-os-international-transfer-actions";
import { FinancialInternationalTransferProofs } from "@/src/components/fi/financial/FinancialInternationalTransferProofs";
import { FinancialInternationalTransferSettlementPanel } from "@/src/components/fi/financial/FinancialInternationalTransferSettlementPanel";
import { FinancialInternationalTransferStatusBadge } from "@/src/components/fi/financial/FinancialInternationalTransferStatusBadge";
import type { InternationalTransferApplicationRecord } from "@/src/lib/financialOs/financialInternationalTransfer.server";
import type { FinancialPaymentPathwayRecord } from "@/src/lib/financialOs/financialPaymentPathways.server";

const TRANSFER_METHODS = ["bank_transfer", "wise", "swift", "paypal", "other"] as const;

const STATUS_FILTER_OPTIONS = [
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

export function FinancialInternationalTransferTable(props: {
  tenantId: string;
  rows: InternationalTransferApplicationRecord[];
  pathways: FinancialPaymentPathwayRecord[];
  canMutate: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pathwayId, setPathwayId] = useState("");
  const [transferMethod, setTransferMethod] = useState<(typeof TRANSFER_METHODS)[number]>("bank_transfer");
  const [sourceCountry, setSourceCountry] = useState("");
  const [sourceCurrency, setSourceCurrency] = useState("");
  const [expectedCents, setExpectedCents] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const internationalPathways = useMemo(
    () => props.pathways.filter((p) => p.pathway_type === "international_transfer"),
    [props.pathways]
  );

  const filtered = useMemo(() => {
    if (statusFilter === "all") return props.rows;
    return props.rows.filter((r) => r.transfer_status === statusFilter);
  }, [props.rows, statusFilter]);

  function createApplication(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!pathwayId) {
      setMsg("Select an international_transfer payment pathway.");
      return;
    }
    const cents = expectedCents.trim() ? Number(expectedCents) : null;
    start(async () => {
      const pathway = internationalPathways.find((p) => p.id === pathwayId);
      const res = await createInternationalTransferApplicationAction(props.tenantId, {
        payment_pathway_id: pathwayId,
        patient_id: pathway?.patient_id ?? null,
        case_id: pathway?.case_id ?? null,
        booking_id: pathway?.booking_id ?? null,
        transfer_method: transferMethod,
        source_country_code: sourceCountry.trim() || null,
        source_currency_code: sourceCurrency.trim() || null,
        expected_settlement_amount_cents: cents,
      });
      setMsg(res.ok ? "International transfer application created." : res.error);
    });
  }

  return (
    <div className="space-y-4">
      {props.canMutate ? (
        <form onSubmit={createApplication} className="rounded border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">New international transfer application</h3>
          <p className="mt-1 text-xs text-slate-600">
            Linked to an <code className="rounded bg-slate-100 px-1">international_transfer</code> payment pathway. Provider-neutral workflow — no live Wise/bank/SWIFT APIs.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-xs text-slate-600">
              Payment pathway
              <select
                value={pathwayId}
                onChange={(e) => setPathwayId(e.target.value)}
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                required
              >
                <option value="">Select pathway…</option>
                {internationalPathways.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id.slice(0, 8)}… · {p.status}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-slate-600">
              Transfer method
              <select
                value={transferMethod}
                onChange={(e) => setTransferMethod(e.target.value as (typeof TRANSFER_METHODS)[number])}
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
              >
                {TRANSFER_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-slate-600">
              Source country
              <input
                value={sourceCountry}
                onChange={(e) => setSourceCountry(e.target.value)}
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                placeholder="GB"
              />
            </label>
            <label className="block text-xs text-slate-600">
              Source currency
              <input
                value={sourceCurrency}
                onChange={(e) => setSourceCurrency(e.target.value)}
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                placeholder="GBP"
              />
            </label>
            <label className="block text-xs text-slate-600">
              Expected settlement (cents)
              <input
                value={expectedCents}
                onChange={(e) => setExpectedCents(e.target.value)}
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                inputMode="numeric"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={pending}
            className="mt-3 rounded bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create application"}
          </button>
          {msg ? <p className="mt-2 text-xs text-slate-600">{msg}</p> : null}
        </form>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-slate-600">
          Filter status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="ml-2 rounded border border-slate-200 px-2 py-1 text-sm"
          >
            <option value="all">All</option>
            {STATUS_FILTER_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="min-w-full text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">Method</th>
              <th className="px-3 py-2 font-medium">Route</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Expected</th>
              <th className="px-3 py-2 font-medium">Received</th>
              <th className="px-3 py-2 font-medium">Settlement date</th>
              <th className="px-3 py-2 font-medium">Updated</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <Fragment key={row.id}>
                <tr className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-900">{row.transfer_method.replace(/_/g, " ")}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {row.source_country_code ?? "—"} / {row.source_currency_code ?? "—"} → {row.settlement_currency_code}
                  </td>
                  <td className="px-3 py-2">
                    <FinancialInternationalTransferStatusBadge status={row.transfer_status} />
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-700">
                    {fmtMoney(row.expected_settlement_amount_cents, row.settlement_currency_code)}
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-700">
                    {fmtMoney(row.received_amount_cents, row.settlement_currency_code)}
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-700">{row.expected_settlement_date ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-600">{row.updated_at.slice(0, 10)}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                      className="text-sky-700 hover:underline"
                    >
                      {expandedId === row.id ? "Hide" : "Details"}
                    </button>
                  </td>
                </tr>
                {expandedId === row.id ? (
                  <tr>
                    <td colSpan={8} className="space-y-3 px-3 py-3">
                      <FinancialInternationalTransferSettlementPanel
                        tenantId={props.tenantId}
                        application={row}
                        canMutate={props.canMutate}
                      />
                      <FinancialInternationalTransferProofs
                        tenantId={props.tenantId}
                        application={row}
                        canMutate={props.canMutate}
                      />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
        {!filtered.length ? (
          <p className="px-3 py-4 text-xs text-slate-500">No international transfer applications yet.</p>
        ) : null}
      </div>
    </div>
  );
}
