"use client";

import { useState, useTransition } from "react";

import { createPaymentPathwayAction } from "@/lib/actions/financial-os-payment-pathway-actions";
import { financialOsClasses, FinancialOsFeedbackText, type FinancialOsFeedback } from "@/src/components/fi-admin/financial-os/financialOsUi";

const PATHWAY_TYPE_OPTIONS = [
  { value: "pay_in_full", label: "Pay in full" },
  { value: "deposit_balance", label: "Deposit + balance" },
  { value: "installment_plan", label: "Installment plan" },
  { value: "medical_finance", label: "Medical finance" },
  { value: "super_release", label: "Super release" },
  { value: "international_transfer", label: "International transfer" },
  { value: "manual", label: "Manual / other" },
] as const;

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

export function FinancialPaymentPathwayForm(props: { tenantId: string; canMutate: boolean }) {
  const [caseId, setCaseId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [pathwayType, setPathwayType] = useState<(typeof PATHWAY_TYPE_OPTIONS)[number]["value"]>("pay_in_full");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("selected");
  const [provider, setProvider] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [expectedAmountCents, setExpectedAmountCents] = useState("");
  const [notes, setNotes] = useState("");
  const [feedback, setFeedback] = useState<FinancialOsFeedback | null>(null);
  const [pending, start] = useTransition();

  if (!props.canMutate) {
    return <p className={financialOsClasses.mutedMeta}>Finance or manager role required to record payment pathways.</p>;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (!caseId.trim() && !invoiceId.trim() && !bookingId.trim() && !patientId.trim()) {
      setFeedback({ message: "Link at least one of patient, case, invoice, or booking id.", tone: "warning" });
      return;
    }
    const cents = expectedAmountCents.trim() ? Number(expectedAmountCents) : null;
    if (cents != null && (!Number.isFinite(cents) || cents < 0)) {
      setFeedback({ message: "Expected amount (cents) must be a non-negative number.", tone: "warning" });
      return;
    }
    start(async () => {
      const res = await createPaymentPathwayAction(props.tenantId, {
        patient_id: patientId.trim() || null,
        case_id: caseId.trim() || null,
        invoice_id: invoiceId.trim() || null,
        booking_id: bookingId.trim() || null,
        pathway_type: pathwayType,
        status,
        provider: provider.trim() || null,
        expected_settlement_date_ymd: expectedDate.trim() || null,
        expected_amount_cents: cents,
        notes: notes.trim() || null,
      });
      setFeedback(
        res.ok
          ? { message: `Pathway recorded (${res.pathway_id.slice(0, 8)}…).`, tone: "success" }
          : { message: res.error, tone: "error" },
      );
    });
  }

  return (
    <form onSubmit={onSubmit} className={`max-w-lg space-y-3 text-xs ${financialOsClasses.formPanel}`}>
      <div className="grid grid-cols-2 gap-2">
        <label className={financialOsClasses.formLabel}>
          Patient id
          <input className={`${financialOsClasses.input} font-mono text-[11px]`} value={patientId} onChange={(e) => setPatientId(e.target.value)} />
        </label>
        <label className={financialOsClasses.formLabel}>
          Case id
          <input className={`${financialOsClasses.input} font-mono text-[11px]`} value={caseId} onChange={(e) => setCaseId(e.target.value)} />
        </label>
        <label className={financialOsClasses.formLabel}>
          Invoice id
          <input className={`${financialOsClasses.input} font-mono text-[11px]`} value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} />
        </label>
        <label className={financialOsClasses.formLabel}>
          Booking id
          <input className={`${financialOsClasses.input} font-mono text-[11px]`} value={bookingId} onChange={(e) => setBookingId(e.target.value)} />
        </label>
      </div>
      <label className={financialOsClasses.formLabel}>
        Pathway type
        <select className={financialOsClasses.select} value={pathwayType} onChange={(e) => setPathwayType(e.target.value as typeof pathwayType)}>
          {PATHWAY_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className={financialOsClasses.formLabel}>
        Status
        <select className={financialOsClasses.select} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className={financialOsClasses.formLabel}>
        Provider (optional)
        <input
          className={financialOsClasses.input}
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          placeholder="e.g. MacCredit, ATO super release"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className={financialOsClasses.formLabel}>
          Expected settlement date (YYYY-MM-DD)
          <input className={financialOsClasses.input} value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} placeholder="2026-07-01" />
        </label>
        <label className={financialOsClasses.formLabel}>
          Expected amount (cents)
          <input className={financialOsClasses.input} value={expectedAmountCents} onChange={(e) => setExpectedAmountCents(e.target.value)} />
        </label>
      </div>
      <label className={financialOsClasses.formLabel}>
        Notes
        <textarea className={`${financialOsClasses.input} min-h-[4rem]`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <button type="submit" disabled={pending} className={financialOsClasses.primaryButton}>
        {pending ? "Saving…" : "Record pathway"}
      </button>
      <FinancialOsFeedbackText message={feedback?.message ?? null} tone={feedback?.tone} className="mt-2" />
    </form>
  );
}
