"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { submitPatientMedicationReorderAction } from "@/lib/actions/fi-medication-reorder-actions";
import type { MedicationPortalLine } from "@/src/lib/medicationReorder/medicationReorderLoaders.server";
import type { FiMedicationReorderRequestRow } from "@/src/lib/medicationReorder/medicationReorderTypes";
import { MEDICATION_REORDER_STATUS_LABELS } from "@/src/lib/medicationReorder/medicationReorderTypes";
import { validatePatientReorderEligibility } from "@/src/lib/medicationReorder/medicationReorderValidation";
import {
  PRESCRIPTION_STATUS_LABELS,
  type PrescriptionStatus,
} from "@/src/lib/prescribing/fiPrescribingTypes";

export function PatientMedicationsPortalClient({
  tenantId,
  lines,
  requests,
}: {
  tenantId: string;
  lines: MedicationPortalLine[];
  requests: FiMedicationReorderRequestRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [modalItemId, setModalItemId] = useState<string | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [paymentAck, setPaymentAck] = useState(false);

  const prescriptions = useMemo(() => {
    const m = new Map<string, MedicationPortalLine["prescription"]>();
    for (const l of lines) {
      if (!m.has(l.prescription.id)) m.set(l.prescription.id, l.prescription);
    }
    return Array.from(m.values()).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }, [lines]);

  const modalLine = useMemo(
    () => lines.find((l) => l.item.id === modalItemId) ?? null,
    [lines, modalItemId]
  );

  function openReorder(line: MedicationPortalLine) {
    setErr(null);
    setMsg(null);
    setModalItemId(line.item.id);
    setDeliveryAddress(line.prescription.patient_shipping_address?.trim() || "");
    setPaymentAck(false);
  }

  function submitReorder() {
    if (!modalItemId) return;
    setErr(null);
    setMsg(null);
    startTransition(async () => {
      const res = await submitPatientMedicationReorderAction({
        tenantId,
        prescriptionItemId: modalItemId,
        deliveryAddress,
        paymentAcknowledged: paymentAck,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setMsg(`Reorder submitted (${MEDICATION_REORDER_STATUS_LABELS[res.status]}).`);
      setModalItemId(null);
      router.refresh();
    });
  }

  const feeRequired =
    modalLine &&
    modalLine.prescription.reorder_fee_payment_required &&
    modalLine.prescription.patient_reorder_fee_pence != null &&
    modalLine.prescription.patient_reorder_fee_pence > 0;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-lg font-semibold text-slate-100">My medications</h1>
        <p className="mt-1 text-sm text-slate-400">
          Reorder approved repeat medications from prescriptions your doctor has enabled for the
          patient portal.
        </p>
      </header>

      {err ? <p className="text-sm text-rose-300">{err}</p> : null}
      {msg ? <p className="text-sm text-emerald-300">{msg}</p> : null}

      <section className="rounded-xl border border-white/[0.08] bg-[#0F1629]/80 p-4 shadow-lg shadow-black/40 backdrop-blur-md">
        <h2 className="text-sm font-semibold text-slate-100">Medications you may reorder</h2>
        <p className="mt-1 text-xs text-slate-400">
          Eligibility is checked from your signed prescriptions and repeat rules.
        </p>
        {lines.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No prescription lines on file.</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/[0.06]">
            {lines.map(({ prescription: rx, item }) => {
              const v = validatePatientReorderEligibility({
                prescription: rx,
                item,
                now: new Date(),
              });
              return (
                <li key={item.id} className="py-3">
                  <p className="font-medium text-slate-100">
                    {item.medication_name}{" "}
                    <span className="text-slate-400">
                      ({item.quantity_label}) —{" "}
                      {PRESCRIPTION_STATUS_LABELS[rx.status as PrescriptionStatus]}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-slate-400">Dose: {item.dose_instructions}</p>
                  {v.ok ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => openReorder({ prescription: rx, item })}
                      className="mt-2 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"
                    >
                      Reorder
                    </button>
                  ) : (
                    <p className="mt-2 text-xs text-amber-300">{v.reason}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-[#0F1629]/80 p-4 shadow-lg shadow-black/40 backdrop-blur-md">
        <h2 className="text-sm font-semibold text-slate-100">Previous prescriptions</h2>
        {prescriptions.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">No prescriptions yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {prescriptions.map((rx) => (
              <li
                key={rx.id}
                className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2"
              >
                <p className="font-medium text-slate-100">
                  {PRESCRIPTION_STATUS_LABELS[rx.status as PrescriptionStatus]} ·{" "}
                  {new Date(rx.signed_at ?? rx.created_at).toLocaleDateString()}
                </p>
                <p className="text-xs text-slate-400">
                  Repeats allowed: {rx.repeats_allowed ? "Yes" : "No"} · Limit {rx.repeat_limit} ·
                  Used {rx.reorders_used}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-[#0F1629]/80 p-4 shadow-lg shadow-black/40 backdrop-blur-md">
        <h2 className="text-sm font-semibold text-slate-100">Reorder status</h2>
        {requests.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">No reorder requests yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/[0.06]">
            {requests.map((r) => (
              <li key={r.id} className="py-2 text-sm text-slate-200">
                <span className="font-medium text-slate-100">
                  {MEDICATION_REORDER_STATUS_LABELS[r.status]}
                </span>
                <span className="ml-2 text-xs text-slate-400">
                  {new Date(r.created_at).toLocaleString()}
                </span>
                {r.rejection_reason ? (
                  <p className="mt-1 text-xs text-rose-300">Reason: {r.rejection_reason}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {modalLine ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/[0.1] bg-[#0F1629]/95 p-4 shadow-2xl shadow-black/60 backdrop-blur-md">
            <h3 className="text-base font-semibold text-slate-100">Confirm reorder</h3>
            <p className="mt-1 text-sm text-slate-400">{modalLine.item.medication_name}</p>
            <label className="mt-4 block text-xs font-medium text-slate-300">
              Delivery address
              <textarea
                className="mt-1 block w-full rounded-lg border border-slate-700 bg-[#020617] px-2 py-2 text-sm text-white shadow-sm placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/35"
                rows={4}
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
              />
            </label>
            {feeRequired ? (
              <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={paymentAck}
                  onChange={(e) => setPaymentAck(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-500 text-cyan-600 focus:ring-2 focus:ring-cyan-400/35"
                />
                <span>
                  I confirm payment of £
                  {((modalLine.prescription.patient_reorder_fee_pence ?? 0) / 100).toFixed(2)} for
                  this reorder (demo acknowledgement — integrate your payment provider in
                  production).
                </span>
              </label>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={submitReorder}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:opacity-50"
              >
                {pending ? "Submitting…" : "Submit reorder"}
              </button>
              <button
                type="button"
                className="text-sm text-slate-400 transition hover:text-slate-200"
                onClick={() => setModalItemId(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
