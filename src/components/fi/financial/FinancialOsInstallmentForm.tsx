"use client";

import { useState, useTransition } from "react";

import { createInstallmentPlanAction } from "@/lib/actions/financial-os-actions";

export function FinancialOsInstallmentForm(props: { tenantId: string; canMutate: boolean }) {
  const [invoiceId, setInvoiceId] = useState("");
  const [frequency, setFrequency] = useState<"weekly" | "biweekly" | "monthly">("monthly");
  const [installmentCents, setInstallmentCents] = useState("10000");
  const [nextDate, setNextDate] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!props.canMutate) {
    return <p className="text-xs text-slate-600">Finance or manager role required to create installment plans.</p>;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const cents = Number(installmentCents);
    if (!invoiceId.trim()) {
      setMsg("Invoice id is required.");
      return;
    }
    if (!Number.isFinite(cents) || cents <= 0) {
      setMsg("Installment amount (cents) must be positive.");
      return;
    }
    start(async () => {
      const res = await createInstallmentPlanAction(props.tenantId, {
        invoice_id: invoiceId.trim(),
        frequency,
        installment_amount_cents: Math.floor(cents),
        next_payment_date_ymd: nextDate.trim() || null,
      });
      setMsg(res.ok ? `Plan created (${res.plan_id.slice(0, 8)}…).` : res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-2 rounded border border-slate-200 bg-white p-3 text-xs">
      <label className="block">
        <span className="text-slate-600">Invoice id</span>
        <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1 font-mono text-[11px]" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} />
      </label>
      <label className="block">
        <span className="text-slate-600">Frequency</span>
        <select className="mt-1 w-full rounded border border-slate-300 px-2 py-1" value={frequency} onChange={(e) => setFrequency(e.target.value as typeof frequency)}>
          <option value="weekly">weekly</option>
          <option value="biweekly">biweekly</option>
          <option value="monthly">monthly</option>
        </select>
      </label>
      <label className="block">
        <span className="text-slate-600">Installment (cents)</span>
        <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1" value={installmentCents} onChange={(e) => setInstallmentCents(e.target.value)} />
      </label>
      <label className="block">
        <span className="text-slate-600">Next payment date (YYYY-MM-DD, optional)</span>
        <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1" value={nextDate} onChange={(e) => setNextDate(e.target.value)} placeholder="2026-07-01" />
      </label>
      <button type="submit" disabled={pending} className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50">
        {pending ? "Saving…" : "Create plan"}
      </button>
      {msg ? <p className="text-slate-800">{msg}</p> : null}
    </form>
  );
}
