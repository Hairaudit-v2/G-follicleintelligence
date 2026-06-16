"use client";

import { useState, useTransition } from "react";

import { startConsultationQuoteDepositPaymentRequestAction } from "@/lib/actions/financial-os-actions";

export function FinancialOsDashboardDepositForm(props: { tenantId: string; canMutate: boolean }) {
  const [invoiceId, setInvoiceId] = useState("");
  const [depositCents, setDepositCents] = useState("5000");
  const [sendCheckout, setSendCheckout] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!props.canMutate) {
    return <p className="text-xs text-slate-600">Finance or manager role required for deposit workflow actions.</p>;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const cents = Number(depositCents);
    if (!invoiceId.trim()) {
      setMsg("Invoice id is required.");
      return;
    }
    if (!Number.isFinite(cents) || cents <= 0) {
      setMsg("Deposit amount (cents) must be a positive number.");
      return;
    }
    start(async () => {
      const res = await startConsultationQuoteDepositPaymentRequestAction(props.tenantId, {
        invoice_id: invoiceId.trim(),
        deposit_amount_cents: Math.floor(cents),
        send_checkout: sendCheckout,
      });
      setMsg(res.ok ? `Created payment request ${res.payment_request_id.slice(0, 8)}…` : res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-2 rounded border border-slate-200 bg-white p-3 text-xs">
      <label className="block">
        <span className="text-slate-600">Consultation quote invoice id (UUID)</span>
        <input
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1 font-mono text-[11px]"
          value={invoiceId}
          onChange={(e) => setInvoiceId(e.target.value)}
          autoComplete="off"
        />
      </label>
      <label className="block">
        <span className="text-slate-600">Deposit amount (cents)</span>
        <input
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
          value={depositCents}
          onChange={(e) => setDepositCents(e.target.value)}
          inputMode="numeric"
        />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={sendCheckout} onChange={(e) => setSendCheckout(e.target.checked)} />
        <span>Send Stripe checkout (when payments module enabled)</span>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {pending ? "Working…" : "Create deposit payment request"}
      </button>
      {msg ? <p className="text-slate-800">{msg}</p> : null}
    </form>
  );
}
