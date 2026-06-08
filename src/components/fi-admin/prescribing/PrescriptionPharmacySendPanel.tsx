"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  acknowledgePharmacyTransmissionAction,
  confirmManualPharmacyTransmissionAction,
  resendFailedPharmacyTransmissionAction,
  sendPrescriptionToPharmacyAction,
} from "@/lib/actions/fi-pharmacy-transmission-actions";
import { FiCard } from "@/src/components/fi-design/FiCard";
import { FiPageHeader } from "@/src/components/fi-design/FiPageHeader";
import type { FiCompoundPharmacyRow, FiPharmacyTransmissionRow } from "@/src/lib/prescribing/fiPharmacyLoaders.server";
import type { PrescriptionStatus } from "@/src/lib/prescribing/fiPrescribingTypes";

const METHOD_LABELS = { email: "Email + PDF", api: "API (JSON)", manual_export: "Manual export" } as const;

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  sent: "Sent",
  failed: "Failed",
  acknowledged: "Acknowledged",
};

export function PrescriptionPharmacySendPanel({
  tenantId,
  patientId,
  prescriptionId,
  prescriptionStatus,
  pharmacies,
  transmissions,
}: {
  tenantId: string;
  patientId: string;
  prescriptionId: string;
  prescriptionStatus: PrescriptionStatus;
  pharmacies: FiCompoundPharmacyRow[];
  transmissions: FiPharmacyTransmissionRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pharmacyId, setPharmacyId] = useState(pharmacies[0]?.id ?? "");
  const [method, setMethod] = useState<"email" | "api" | "manual_export">("email");

  const isDraft = prescriptionStatus === "draft";
  const canAttemptSend =
    !isDraft &&
    (prescriptionStatus === "signed" ||
      (prescriptionStatus === "sent_to_pharmacy" && transmissions[0]?.status === "failed"));

  const pdfBase = `/api/tenants/${encodeURIComponent(tenantId)}/patients/${encodeURIComponent(
    patientId
  )}/prescriptions/${encodeURIComponent(prescriptionId)}/pharmacy-order-pdf`;

  function send() {
    setErr(null);
    setMsg(null);
    if (!pharmacyId.trim()) {
      setErr("Select a pharmacy.");
      return;
    }
    startTransition(async () => {
      const res = await sendPrescriptionToPharmacyAction({
        tenantId,
        prescriptionId,
        pharmacyId: pharmacyId.trim(),
        method,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      if (res.mode === "manual_pending") {
        setMsg("Manual export prepared — download the PDF, deliver offline, then confirm below.");
      } else {
        setMsg("Pharmacy send completed.");
      }
      router.refresh();
    });
  }

  function confirmManual(tid: string) {
    setErr(null);
    setMsg(null);
    startTransition(async () => {
      const res = await confirmManualPharmacyTransmissionAction({ tenantId, transmissionId: tid });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setMsg("Manual send recorded.");
      router.refresh();
    });
  }

  function acknowledge(tid: string) {
    setErr(null);
    setMsg(null);
    startTransition(async () => {
      const res = await acknowledgePharmacyTransmissionAction({ tenantId, transmissionId: tid });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setMsg("Marked acknowledged.");
      router.refresh();
    });
  }

  function resend(tid: string) {
    setErr(null);
    setMsg(null);
    startTransition(async () => {
      const res = await resendFailedPharmacyTransmissionAction({ tenantId, transmissionId: tid });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setMsg("Resend initiated.");
      router.refresh();
    });
  }

  if (isDraft) {
    return (
      <FiCard>
        <FiPageHeader
          titleId="rx-pharmacy-send-na"
          eyebrow="DoctorOS 1B"
          title="Pharmacy send"
          description="Sign the prescription before it can be sent to a compound pharmacy."
        />
      </FiCard>
    );
  }

  return (
    <FiCard>
      <FiPageHeader
        titleId="rx-pharmacy-send-heading"
        eyebrow="DoctorOS 1B"
        title="Pharmacy send"
        description="Transmit a signed order by email (PDF + structured body), pharmacy API (JSON snapshot), or manual export with attestation. Draft prescriptions cannot be sent."
      />
      {err ? <p className="mt-2 text-sm text-red-600">{err}</p> : null}
      {msg ? <p className="mt-2 text-sm text-emerald-800">{msg}</p> : null}

      {canAttemptSend && pharmacies.length > 0 ? (
        <div className="mt-4 space-y-3 rounded border border-slate-200 bg-slate-50/80 p-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-xs font-medium text-slate-700">
              Compound pharmacy
              <select
                className="mt-1 block w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm"
                value={pharmacyId}
                onChange={(e) => setPharmacyId(e.target.value)}
                disabled={pending}
              >
                {pharmacies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.pharmacy_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-700">
              Method
              <select
                className="mt-1 block w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm"
                value={method}
                onChange={(e) => setMethod(e.target.value as typeof method)}
                disabled={pending}
              >
                <option value="email">{METHOD_LABELS.email}</option>
                <option value="api">{METHOD_LABELS.api}</option>
                <option value="manual_export">{METHOD_LABELS.manual_export}</option>
              </select>
            </label>
          </div>
          <p className="text-xs text-slate-600">
            Preview PDF:{" "}
            <a
              className="font-medium text-sky-700 hover:underline"
              href={`${pdfBase}?pharmacyId=${encodeURIComponent(pharmacyId)}`}
              target="_blank"
              rel="noreferrer"
            >
              Download draft order PDF
            </a>
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={send}
            className="rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:bg-slate-400"
          >
            {pending ? "Working…" : "Send to pharmacy"}
          </button>
        </div>
      ) : canAttemptSend && pharmacies.length === 0 ? (
        <p className="mt-3 text-sm text-amber-800">
          No active compound pharmacies configured. Add rows in `fi_compound_pharmacies` (migration seeds a default placeholder).
        </p>
      ) : (
        <p className="mt-3 text-sm text-slate-600">
          This prescription is not in a state that allows a new pharmacy transmission from this screen.
        </p>
      )}

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-slate-900">Transmission log</h3>
        {transmissions.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No pharmacy transmissions yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-200 border border-slate-200 rounded-lg bg-white">
            {transmissions.map((tx) => (
              <li key={tx.id} className="px-3 py-2.5 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">
                      {METHOD_LABELS[tx.method]} · {STATUS_LABELS[tx.status] ?? tx.status}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(tx.created_at).toLocaleString()}
                      {tx.sent_at ? ` · Sent ${new Date(tx.sent_at).toLocaleString()}` : null}
                    </p>
                    {tx.error_message ? <p className="mt-1 text-xs text-red-700">{tx.error_message}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      className="text-xs font-medium text-sky-700 hover:underline"
                      href={`${pdfBase}?transmissionId=${encodeURIComponent(tx.id)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      PDF
                    </a>
                    {tx.status === "failed" ? (
                      <button
                        type="button"
                        disabled={pending}
                        className="text-xs font-medium text-sky-800 hover:underline disabled:opacity-50"
                        onClick={() => resend(tx.id)}
                      >
                        Resend
                      </button>
                    ) : null}
                    {tx.status === "pending" && tx.method === "manual_export" ? (
                      <button
                        type="button"
                        disabled={pending}
                        className="text-xs font-medium text-emerald-800 hover:underline disabled:opacity-50"
                        onClick={() => confirmManual(tx.id)}
                      >
                        Record manual send
                      </button>
                    ) : null}
                    {tx.status === "sent" ? (
                      <button
                        type="button"
                        disabled={pending}
                        className="text-xs font-medium text-slate-800 hover:underline disabled:opacity-50"
                        onClick={() => acknowledge(tx.id)}
                      >
                        Mark acknowledged
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FiCard>
  );
}
