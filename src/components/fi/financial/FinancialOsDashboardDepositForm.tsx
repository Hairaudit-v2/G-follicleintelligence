"use client";

import { useState, useTransition } from "react";

import { startConsultationQuoteDepositPaymentRequestAction } from "@/lib/actions/financial-os-actions";
import { financialOsClasses, FinancialOsFeedbackText, type FinancialOsFeedback } from "@/src/components/fi-admin/financial-os/financialOsUi";

export function FinancialOsDashboardDepositForm(props: { tenantId: string; canMutate: boolean }) {
  const [invoiceId, setInvoiceId] = useState("");
  const [depositCents, setDepositCents] = useState("5000");
  const [sendCheckout, setSendCheckout] = useState(true);
  const [feedback, setFeedback] = useState<FinancialOsFeedback | null>(null);
  const [pending, start] = useTransition();

  if (!props.canMutate) {
    return <p className={financialOsClasses.mutedMeta}>Finance or manager role required for deposit workflow actions.</p>;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    const cents = Number(depositCents);
    if (!invoiceId.trim()) {
      setFeedback({ message: "Invoice id is required.", tone: "warning" });
      return;
    }
    if (!Number.isFinite(cents) || cents <= 0) {
      setFeedback({ message: "Deposit amount (cents) must be a positive number.", tone: "warning" });
      return;
    }
    start(async () => {
      const res = await startConsultationQuoteDepositPaymentRequestAction(props.tenantId, {
        invoice_id: invoiceId.trim(),
        deposit_amount_cents: Math.floor(cents),
        send_checkout: sendCheckout,
      });
      setFeedback(
        res.ok
          ? { message: `Created payment request ${res.payment_request_id.slice(0, 8)}…`, tone: "success" }
          : { message: res.error, tone: "error" },
      );
    });
  }

  return (
    <form onSubmit={onSubmit} className={`max-w-md space-y-3 text-xs ${financialOsClasses.formPanel}`}>
      <label className={financialOsClasses.formLabel}>
        Consultation quote invoice id (UUID)
        <input
          className={`${financialOsClasses.input} font-mono text-[11px]`}
          value={invoiceId}
          onChange={(e) => setInvoiceId(e.target.value)}
          autoComplete="off"
        />
      </label>
      <label className={financialOsClasses.formLabel}>
        Deposit amount (cents)
        <input className={financialOsClasses.input} value={depositCents} onChange={(e) => setDepositCents(e.target.value)} inputMode="numeric" />
      </label>
      <label className={financialOsClasses.checkboxLabel}>
        <input type="checkbox" checked={sendCheckout} onChange={(e) => setSendCheckout(e.target.checked)} />
        <span>Send Stripe checkout (when payments module enabled)</span>
      </label>
      <button type="submit" disabled={pending} className={financialOsClasses.primaryButton}>
        {pending ? "Working…" : "Create deposit payment request"}
      </button>
      <FinancialOsFeedbackText message={feedback?.message ?? null} tone={feedback?.tone} className="mt-2" />
    </form>
  );
}
