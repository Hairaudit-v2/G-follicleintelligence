"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { submitPatientMedicationReorderAction } from "@/lib/actions/fi-medication-reorder-actions";
import type { MedicationPortalLine } from "@/src/lib/medicationReorder/medicationReorderLoaders.server";
import type { FiMedicationReorderRequestRow } from "@/src/lib/medicationReorder/medicationReorderTypes";
import { MEDICATION_REORDER_STATUS_LABELS } from "@/src/lib/medicationReorder/medicationReorderTypes";
import { validatePatientReorderEligibility } from "@/src/lib/medicationReorder/medicationReorderValidation";
import { PRESCRIPTION_STATUS_LABELS, type PrescriptionStatus } from "@/src/lib/prescribing/fiPrescribingTypes";

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

  const modalLine = useMemo(() => lines.find((l) => l.item.id === modalItemId) ?? null, [lines, modalItemId]);

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
        <h1 className="text-lg font-semibold text-slate-900">My medications</h1>
        <p className="mt-1 text-sm text-slate-600">
          Reorder approved repeat medications from prescriptions your doctor has enabled for the patient portal.
        </p>
      </header>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      {msg ? <p className="text-sm text-emerald-800">{msg}</p> : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Medications you may reorder</h2>
        <p className="mt-1 text-xs text-slate-500">Eligibility is checked from your signed prescriptions and repeat rules.</p>
        {lines.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No prescription lines on file.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {lines.map(({ prescription: rx, item }) => {
              const v = validatePatientReorderEligibility({ prescription: rx, item, now: new Date() });
              return (
                <li key={item.id} className="py-3">
                  <p className="font-medium text-slate-900">
                    {item.medication_name}{" "}
                    <span className="text-slate-500">
                      ({item.quantity_label}) — {PRESCRIPTION_STATUS_LABELS[rx.status as PrescriptionStatus]}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-slate-600">Dose: {item.dose_instructions}</p>
                  {v.ok ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => openReorder({ prescription: rx, item })}
                      className="mt-2 rounded bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
                    >
                      Reorder
                    </button>
                  ) : (
                    <p className="mt-2 text-xs text-amber-900">{v.reason}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Previous prescriptions</h2>
        {prescriptions.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No prescriptions yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {prescriptions.map((rx) => (
              <li key={rx.id} className="rounded border border-slate-100 bg-slate-50/80 px-3 py-2">
                <p className="font-medium">
                  {PRESCRIPTION_STATUS_LABELS[rx.status as PrescriptionStatus]} · {new Date(rx.signed_at ?? rx.created_at).toLocaleDateString()}
                </p>
                <p className="text-xs text-slate-500">
                  Repeats allowed: {rx.repeats_allowed ? "Yes" : "No"} · Limit {rx.repeat_limit} · Used {rx.reorders_used}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Reorder status</h2>
        {requests.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No reorder requests yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {requests.map((r) => (
              <li key={r.id} className="py-2 text-sm">
                <span className="font-medium">{MEDICATION_REORDER_STATUS_LABELS[r.status]}</span>
                <span className="ml-2 text-xs text-slate-500">{new Date(r.created_at).toLocaleString()}</span>
                {r.rejection_reason ? (
                  <p className="mt-1 text-xs text-red-700">Reason: {r.rejection_reason}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {modalLine ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Confirm reorder</h3>
            <p className="mt-1 text-sm text-slate-600">{modalLine.item.medication_name}</p>
            <label className="mt-4 block text-xs font-medium text-slate-700">
              Delivery address
              <textarea
                className="mt-1 block w-full rounded border border-slate-300 px-2 py-2 text-sm"
                rows={4}
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
              />
            </label>
            {feeRequired ? (
              <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-slate-800">
                <input type="checkbox" checked={paymentAck} onChange={(e) => setPaymentAck(e.target.checked)} className="mt-0.5" />
                <span>
                  I confirm payment of £{((modalLine.prescription.patient_reorder_fee_pence ?? 0) / 100).toFixed(2)} for
                  this reorder (demo acknowledgement — integrate your payment provider in production).
                </span>
              </label>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={submitReorder}
                className="rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {pending ? "Submitting…" : "Submit reorder"}
              </button>
              <button type="button" className="text-sm text-slate-600" onClick={() => setModalItemId(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
