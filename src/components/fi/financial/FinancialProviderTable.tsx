"use client";

import { useState, useTransition } from "react";

import { updateFinanceProviderAction } from "@/lib/actions/financial-os-finance-actions";
import type { FinanceProviderRecord } from "@/src/lib/financialOs/financialFinanceProviders.server";

export function FinancialProviderTable(props: {
  tenantId: string;
  rows: FinanceProviderRecord[];
  canMutate: boolean;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggleActive(row: FinanceProviderRecord) {
    if (!props.canMutate) return;
    setMsg(null);
    start(async () => {
      const res = await updateFinanceProviderAction(props.tenantId, {
        provider_id: row.id,
        is_active: !row.is_active,
      });
      setMsg(res.ok ? "Provider updated." : res.error);
    });
  }

  return (
    <div className="overflow-x-auto rounded border border-slate-200 bg-white">
      {msg ? <p className="border-b border-slate-100 px-3 py-2 text-xs text-slate-600">{msg}</p> : null}
      <table className="min-w-full text-xs">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Scope</th>
            <th className="px-3 py-2 font-medium">Country</th>
            <th className="px-3 py-2 font-medium">Active</th>
            <th className="px-3 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-100">
              <td className="px-3 py-2 font-medium text-slate-900">{row.name}</td>
              <td className="px-3 py-2 text-slate-700">{row.provider_type}</td>
              <td className="px-3 py-2 text-slate-600">{row.tenant_id ? "Tenant" : "Global catalog"}</td>
              <td className="px-3 py-2 font-mono text-slate-700">{row.country_code ?? "—"}</td>
              <td className="px-3 py-2">
                <span
                  className={`rounded px-1.5 py-0.5 font-semibold ${row.is_active ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}
                >
                  {row.is_active ? "Yes" : "No"}
                </span>
              </td>
              <td className="px-3 py-2">
                {props.canMutate ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => toggleActive(row)}
                    className="text-sky-700 hover:underline disabled:opacity-50"
                  >
                    {row.is_active ? "Deactivate" : "Activate"}
                  </button>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
