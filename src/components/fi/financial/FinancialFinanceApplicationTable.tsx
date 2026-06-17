"use client";

import { Fragment, useMemo, useState, useTransition } from "react";

import { createFinanceApplicationAction } from "@/lib/actions/financial-os-finance-actions";
import { FinancialFinanceApplicationDocuments } from "@/src/components/fi/financial/FinancialFinanceApplicationDocuments";
import { FinancialFinanceApplicationStatusBadge } from "@/src/components/fi/financial/FinancialFinanceApplicationStatusBadge";
import type { FinanceApplicationRecord } from "@/src/lib/financialOs/financialFinanceApplications.server";
import type { FinanceProviderRecord } from "@/src/lib/financialOs/financialFinanceProviders.server";
import type { FinancialPaymentPathwayRecord } from "@/src/lib/financialOs/financialPaymentPathways.server";

function fmtMoney(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export function FinancialFinanceApplicationTable(props: {
  tenantId: string;
  rows: FinanceApplicationRecord[];
  providers: FinanceProviderRecord[];
  pathways: FinancialPaymentPathwayRecord[];
  canMutate: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pathwayId, setPathwayId] = useState("");
  const [providerId, setProviderId] = useState("");
  const [requestedCents, setRequestedCents] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const medicalFinancePathways = useMemo(
    () => props.pathways.filter((p) => p.pathway_type === "medical_finance"),
    [props.pathways]
  );
  const activeProviders = useMemo(() => props.providers.filter((p) => p.is_active), [props.providers]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return props.rows;
    return props.rows.filter((r) => r.application_status === statusFilter);
  }, [props.rows, statusFilter]);

  function createApplication(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!pathwayId || !providerId) {
      setMsg("Select a medical finance pathway and provider.");
      return;
    }
    const cents = requestedCents.trim() ? Number(requestedCents) : null;
    start(async () => {
      const pathway = medicalFinancePathways.find((p) => p.id === pathwayId);
      const res = await createFinanceApplicationAction(props.tenantId, {
        payment_pathway_id: pathwayId,
        finance_provider_id: providerId,
        patient_id: pathway?.patient_id ?? null,
        case_id: pathway?.case_id ?? null,
        booking_id: pathway?.booking_id ?? null,
        requested_amount_cents: cents,
      });
      setMsg(res.ok ? "Finance application created." : res.error);
    });
  }

  return (
    <div className="space-y-4">
      {props.canMutate ? (
        <form onSubmit={createApplication} className="rounded border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">New finance application</h3>
          <p className="mt-1 text-xs text-slate-600">Linked to a medical_finance payment pathway. No live provider API calls in Phase 3.</p>
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
                {medicalFinancePathways.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id.slice(0, 8)}… · {p.status}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-slate-600">
              Finance provider
              <select
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                required
              >
                <option value="">Select provider…</option>
                {activeProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-slate-600">
              Requested amount (cents)
              <input
                value={requestedCents}
                onChange={(e) => setRequestedCents(e.target.value)}
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
            {[
              "draft",
              "documents_pending",
              "submitted",
              "under_review",
              "approved",
              "rejected",
              "settlement_pending",
              "settled",
              "cancelled",
            ].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="min-w-full text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">Provider</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Requested</th>
              <th className="px-3 py-2 font-medium">Approved</th>
              <th className="px-3 py-2 font-medium">Expected settlement</th>
              <th className="px-3 py-2 font-medium">Updated</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <Fragment key={row.id}>
                <tr className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-900">{row.provider_name ?? row.finance_provider_id.slice(0, 8)}</td>
                  <td className="px-3 py-2">
                    <FinancialFinanceApplicationStatusBadge status={row.application_status} />
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-700">{fmtMoney(row.requested_amount_cents)}</td>
                  <td className="px-3 py-2 font-mono text-slate-700">{fmtMoney(row.approved_amount_cents)}</td>
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
                    <td colSpan={7} className="px-3 py-3">
                      <FinancialFinanceApplicationDocuments tenantId={props.tenantId} application={row} canMutate={props.canMutate} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
        {!filtered.length ? <p className="px-3 py-4 text-xs text-slate-500">No finance applications yet.</p> : null}
      </div>
    </div>
  );
}
