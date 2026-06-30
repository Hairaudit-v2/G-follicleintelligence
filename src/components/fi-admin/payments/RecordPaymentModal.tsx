"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  createPaymentRecordAction,
  recordManualPaymentAction,
  updatePaymentRecordStatusAction,
} from "@/lib/actions/fi-payment-record-actions";
import type {
  PaymentContext,
  PaymentRecordRow,
  PaymentStatus,
} from "@/src/lib/payments/paymentRecordModel";
import { PAYMENT_STATUSES } from "@/src/lib/payments/paymentRecordModel";

export function RecordPaymentModal(props: {
  tenantId: string;
  optionalFiAdminKey?: string;
  open: boolean;
  onClose: () => void;
  paymentContext: PaymentContext;
  consultationId?: string | null;
  caseId?: string | null;
  bookingId?: string | null;
  patientId?: string | null;
  leadId?: string | null;
  existingRecords: PaymentRecordRow[];
  todayYmd: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"create" | "pay" | "status">("create");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [amountExpected, setAmountExpected] = useState("");
  const [currency, setCurrency] = useState("AUD");
  const [dueDate, setDueDate] = useState("");

  const [recordId, setRecordId] = useState(() => props.existingRecords[0]?.id ?? "");
  const [payAmount, setPayAmount] = useState("");
  const [status, setStatus] = useState<PaymentStatus>("paid");
  const [notes, setNotes] = useState("");

  if (!props.open) return null;

  async function onCreate() {
    setBusy(true);
    setError(null);
    const exp = Number(amountExpected);
    if (!Number.isFinite(exp) || exp < 0) {
      setError("Enter a valid expected amount.");
      setBusy(false);
      return;
    }
    const res = await createPaymentRecordAction(props.tenantId, {
      adminKey: props.optionalFiAdminKey?.trim() || undefined,
      payment_context: props.paymentContext,
      consultation_id: props.consultationId ?? undefined,
      case_id: props.caseId ?? undefined,
      booking_id: props.bookingId ?? undefined,
      patient_id: props.patientId ?? undefined,
      lead_id: props.leadId ?? undefined,
      amount_expected: exp,
      currency,
      due_date: dueDate.trim() || null,
      status: "pending",
      notes: notes.trim() || null,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    props.onClose();
    router.refresh();
  }

  async function onManualPay() {
    setBusy(true);
    setError(null);
    const amt = Number(payAmount);
    if (!recordId?.trim() || !Number.isFinite(amt) || amt <= 0) {
      setError("Select a record and enter a positive payment amount.");
      setBusy(false);
      return;
    }
    const res = await recordManualPaymentAction(props.tenantId, {
      adminKey: props.optionalFiAdminKey?.trim() || undefined,
      payment_record_id: recordId.trim(),
      payment_amount: amt,
      notes: notes.trim() || null,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    props.onClose();
    router.refresh();
  }

  async function onStatus() {
    setBusy(true);
    setError(null);
    if (!recordId?.trim()) {
      setError("Select a record.");
      setBusy(false);
      return;
    }
    const res = await updatePaymentRecordStatusAction(props.tenantId, {
      adminKey: props.optionalFiAdminKey?.trim() || undefined,
      payment_record_id: recordId.trim(),
      status,
      notes: notes.trim() || null,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    props.onClose();
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Record payment</h2>
            <p className="mt-1 text-xs text-slate-400">
              Manual payment tracking only — updates recorded status; not integrated billing or POS.
            </p>
          </div>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-white/[0.06]"
            onClick={() => props.onClose()}
          >
            Close
          </button>
        </div>

        <div className="mt-4 flex gap-2 border-b border-white/[0.06] pb-3 text-xs font-semibold">
          <button
            type="button"
            className={tab === "create" ? "text-cyan-300" : "text-slate-500"}
            onClick={() => setTab("create")}
          >
            New tracking row
          </button>
          <button
            type="button"
            className={tab === "pay" ? "text-cyan-300" : "text-slate-500"}
            onClick={() => setTab("pay")}
            disabled={props.existingRecords.length === 0}
          >
            Add payment
          </button>
          <button
            type="button"
            className={tab === "status" ? "text-cyan-300" : "text-slate-500"}
            onClick={() => setTab("status")}
            disabled={props.existingRecords.length === 0}
          >
            Set status
          </button>
        </div>

        {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

        {tab === "create" ? (
          <div className="mt-4 space-y-3 text-sm">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Amount expected
              </span>
              <input
                className="mt-1 w-full rounded border border-white/[0.08] px-2 py-1.5"
                value={amountExpected}
                onChange={(e) => setAmountExpected(e.target.value)}
                inputMode="decimal"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Currency (ISO)
              </span>
              <input
                className="mt-1 w-full rounded border border-white/[0.08] px-2 py-1.5"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                maxLength={3}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Due date (optional)
              </span>
              <input
                className="mt-1 w-full rounded border border-white/[0.08] px-2 py-1.5"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Notes (optional)
              </span>
              <textarea
                className="mt-1 w-full rounded border border-white/[0.08] px-2 py-1.5"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onCreate()}
              className="w-full rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
            >
              Create tracking row
            </button>
          </div>
        ) : null}

        {tab === "pay" ? (
          <div className="mt-4 space-y-3 text-sm">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Record
              </span>
              <select
                className="mt-1 w-full rounded border border-white/[0.08] px-2 py-1.5"
                value={recordId}
                onChange={(e) => setRecordId(e.target.value)}
              >
                {props.existingRecords.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id.slice(0, 8)}… · {r.status} · {r.currency} {r.amount_paid}/
                    {r.amount_expected}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Payment amount received
              </span>
              <input
                className="mt-1 w-full rounded border border-white/[0.08] px-2 py-1.5"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                inputMode="decimal"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Notes (optional)
              </span>
              <textarea
                className="mt-1 w-full rounded border border-white/[0.08] px-2 py-1.5"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onManualPay()}
              className="w-full rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
            >
              Record manual payment
            </button>
          </div>
        ) : null}

        {tab === "status" ? (
          <div className="mt-4 space-y-3 text-sm">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Record
              </span>
              <select
                className="mt-1 w-full rounded border border-white/[0.08] px-2 py-1.5"
                value={recordId}
                onChange={(e) => setRecordId(e.target.value)}
              >
                {props.existingRecords.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id.slice(0, 8)}… · {r.status}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </span>
              <select
                className="mt-1 w-full rounded border border-white/[0.08] px-2 py-1.5"
                value={status}
                onChange={(e) => setStatus(e.target.value as PaymentStatus)}
              >
                {PAYMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Notes (optional)
              </span>
              <textarea
                className="mt-1 w-full rounded border border-white/[0.08] px-2 py-1.5"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onStatus()}
              className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Update status
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
