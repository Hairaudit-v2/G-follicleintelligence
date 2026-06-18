"use client";

import { useState, useTransition } from "react";

import { createInstallmentPlanAction } from "@/lib/actions/financial-os-actions";
import { financialOsClasses, FinancialOsFeedbackText, financialOsActionFeedback, type FinancialOsFeedback } from "@/src/components/fi-admin/financial-os/financialOsUi";

export function FinancialOsInstallmentForm(props: { tenantId: string; canMutate: boolean }) {
  const [invoiceId, setInvoiceId] = useState("");
  const [frequency, setFrequency] = useState<"weekly" | "biweekly" | "monthly">("monthly");
  const [installmentCents, setInstallmentCents] = useState("10000");
  const [nextDate, setNextDate] = useState("");
  const [feedback, setFeedback] = useState<FinancialOsFeedback | null>(null);
  const [pending, start] = useTransition();

  if (!props.canMutate) {
    return <p className={financialOsClasses.mutedMeta}>Finance or manager role required to create installment plans.</p>;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    const cents = Number(installmentCents);
    if (!invoiceId.trim()) {
      setFeedback({ message: "Invoice id is required.", tone: "warning" });
      return;
    }
    if (!Number.isFinite(cents) || cents <= 0) {
      setFeedback({ message: "Installment amount (cents) must be positive.", tone: "warning" });
      return;
    }
    start(async () => {
      const res = await createInstallmentPlanAction(props.tenantId, {
        invoice_id: invoiceId.trim(),
        frequency,
        installment_amount_cents: Math.floor(cents),
        next_payment_date_ymd: nextDate.trim() || null,
      });
      setFeedback(
        res.ok
          ? { message: `Plan created (${res.plan_id.slice(0, 8)}…).`, tone: "success" }
          : { message: res.error, tone: "error" },
      );
    });
  }

  return (
    <form onSubmit={onSubmit} className={`max-w-md space-y-3 text-xs ${financialOsClasses.formPanel}`}>
      <label className={financialOsClasses.formLabel}>
        Invoice id
        <input className={`${financialOsClasses.input} font-mono text-[11px]`} value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} />
      </label>
      <label className={financialOsClasses.formLabel}>
        Frequency
        <select className={financialOsClasses.select} value={frequency} onChange={(e) => setFrequency(e.target.value as typeof frequency)}>
          <option value="weekly">weekly</option>
          <option value="biweekly">biweekly</option>
          <option value="monthly">monthly</option>
        </select>
      </label>
      <label className={financialOsClasses.formLabel}>
        Installment (cents)
        <input className={financialOsClasses.input} value={installmentCents} onChange={(e) => setInstallmentCents(e.target.value)} />
      </label>
      <label className={financialOsClasses.formLabel}>
        Next payment date (YYYY-MM-DD, optional)
        <input className={financialOsClasses.input} value={nextDate} onChange={(e) => setNextDate(e.target.value)} placeholder="2026-07-01" />
      </label>
      <button type="submit" disabled={pending} className={financialOsClasses.primaryButton}>
        {pending ? "Saving…" : "Create plan"}
      </button>
      <FinancialOsFeedbackText message={feedback?.message ?? null} tone={feedback?.tone} className="mt-2" />
    </form>
  );
}
