"use client";

import { useState, useTransition } from "react";

import { createPaymentPathwayAction } from "@/lib/actions/financial-os-payment-pathway-actions";

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
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!props.canMutate) {
    return <p className="text-xs text-slate-600">Finance or manager role required to record payment pathways.</p>;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!caseId.trim() && !invoiceId.trim() && !bookingId.trim() && !patientId.trim()) {
      setMsg("Link at least one of patient, case, invoice, or booking id.");
      return;
    }
    const cents = expectedAmountCents.trim() ? Number(expectedAmountCents) : null;
    if (cents != null && (!Number.isFinite(cents) || cents < 0)) {
      setMsg("Expected amount (cents) must be a non-negative number.");
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
      setMsg(res.ok ? `Pathway recorded (${res.pathway_id.slice(0, 8)}…).` : res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-2 rounded border border-slate-200 bg-white p-3 text-xs">
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-slate-600">Patient id</span>
          <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1 font-mono text-[11px]" value={patientId} onChange={(e) => setPatientId(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-slate-600">Case id</span>
          <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1 font-mono text-[11px]" value={caseId} onChange={(e) => setCaseId(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-slate-600">Invoice id</span>
          <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1 font-mono text-[11px]" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-slate-600">Booking id</span>
          <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1 font-mono text-[11px]" value={bookingId} onChange={(e) => setBookingId(e.target.value)} />
        </label>
      </div>
      <label className="block">
        <span className="text-slate-600">Pathway type</span>
        <select
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
          value={pathwayType}
          onChange={(e) => setPathwayType(e.target.value as typeof pathwayType)}
        >
          {PATHWAY_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-slate-600">Status</span>
        <select className="mt-1 w-full rounded border border-slate-300 px-2 py-1" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-slate-600">Provider (optional)</span>
        <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="e.g. MacCredit, ATO super release" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-slate-600">Expected settlement date (YYYY-MM-DD)</span>
          <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} placeholder="2026-07-01" />
        </label>
        <label className="block">
          <span className="text-slate-600">Expected amount (cents)</span>
          <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1" value={expectedAmountCents} onChange={(e) => setExpectedAmountCents(e.target.value)} />
        </label>
      </div>
      <label className="block">
        <span className="text-slate-600">Notes</span>
        <textarea className="mt-1 w-full rounded border border-slate-300 px-2 py-1" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <button type="submit" disabled={pending} className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50">
        {pending ? "Saving…" : "Record pathway"}
      </button>
      {msg ? <p className="text-slate-800">{msg}</p> : null}
    </form>
  );
}
