"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  advanceMedicationReorderStatusAction,
  approveMedicationReorderRequestAction,
  rejectMedicationReorderRequestAction,
} from "@/lib/actions/fi-medication-reorder-actions";
import type { FiMedicationReorderRequestRow } from "@/src/lib/medicationReorder/medicationReorderTypes";
import { MEDICATION_REORDER_STATUS_LABELS } from "@/src/lib/medicationReorder/medicationReorderTypes";

export function MedicationReorderQueueClient({
  tenantId,
  rows,
}: {
  tenantId: string;
  rows: (FiMedicationReorderRequestRow & { medication_name: string })[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  function refresh() {
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      {rows.length === 0 ? (
        <p className="text-sm text-slate-600">No medication reorder requests yet.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {rows.map((r) => (
            <li key={r.id} className="space-y-2 px-3 py-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">{r.medication_name}</p>
                  <p className="text-xs text-slate-500">
                    Patient <span className="font-mono">{r.patient_id.slice(0, 8)}…</span> ·{" "}
                    {MEDICATION_REORDER_STATUS_LABELS[r.status]} · {new Date(r.created_at).toLocaleString()}
                  </p>
                  {r.fee_pence != null && r.fee_pence > 0 ? (
                    <p className="text-xs text-slate-600">
                      Fee £{(r.fee_pence / 100).toFixed(2)} · Payment: {r.payment_status}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1">
                  {r.status === "requested" || r.status === "doctor_review_required" ? (
                    <>
                      <button
                        type="button"
                        disabled={pending}
                        className="rounded bg-emerald-700 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                        onClick={() => {
                          setErr(null);
                          startTransition(async () => {
                            const res = await approveMedicationReorderRequestAction({
                              tenantId,
                              requestId: r.id,
                            });
                            if (!res.ok) setErr(res.error);
                            else refresh();
                          });
                        }}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        className="rounded border border-red-300 px-2 py-1 text-xs text-red-800 disabled:opacity-50"
                        onClick={() => setRejectId(r.id)}
                      >
                        Reject
                      </button>
                    </>
                  ) : null}
                  {r.status === "approved" ? (
                    <button
                      type="button"
                      disabled={pending}
                      className="rounded bg-sky-700 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                      onClick={() => {
                        setErr(null);
                        startTransition(async () => {
                          const res = await advanceMedicationReorderStatusAction({
                            tenantId,
                            requestId: r.id,
                            nextStatus: "sent_to_pharmacy",
                          });
                          if (!res.ok) setErr(res.error);
                          else refresh();
                        });
                      }}
                    >
                      Mark sent to pharmacy
                    </button>
                  ) : null}
                  {r.status === "sent_to_pharmacy" ? (
                    <button
                      type="button"
                      disabled={pending}
                      className="rounded bg-slate-800 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                      onClick={() => {
                        setErr(null);
                        startTransition(async () => {
                          const res = await advanceMedicationReorderStatusAction({
                            tenantId,
                            requestId: r.id,
                            nextStatus: "posted",
                          });
                          if (!res.ok) setErr(res.error);
                          else refresh();
                        });
                      }}
                    >
                      Mark posted
                    </button>
                  ) : null}
                  {r.status === "posted" ? (
                    <button
                      type="button"
                      disabled={pending}
                      className="rounded bg-slate-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                      onClick={() => {
                        setErr(null);
                        startTransition(async () => {
                          const res = await advanceMedicationReorderStatusAction({
                            tenantId,
                            requestId: r.id,
                            nextStatus: "completed",
                          });
                          if (!res.ok) setErr(res.error);
                          else refresh();
                        });
                      }}
                    >
                      Mark completed
                    </button>
                  ) : null}
                </div>
              </div>
              <p className="text-xs text-slate-700">
                <span className="font-semibold">Delivery:</span> {r.delivery_address}
              </p>
              {rejectId === r.id ? (
                <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-2">
                  <label className="block flex-1 text-xs">
                    Rejection reason
                    <input
                      className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="rounded bg-red-700 px-3 py-1.5 text-xs text-white"
                    disabled={pending}
                    onClick={() => {
                      setErr(null);
                      startTransition(async () => {
                        const res = await rejectMedicationReorderRequestAction({
                          tenantId,
                          requestId: r.id,
                          rejectionReason: rejectReason.trim() || undefined,
                        });
                        if (!res.ok) setErr(res.error);
                        else {
                          setRejectId(null);
                          setRejectReason("");
                          refresh();
                        }
                      });
                    }}
                  >
                    Confirm reject
                  </button>
                  <button type="button" className="text-xs text-slate-600" onClick={() => setRejectId(null)}>
                    Cancel
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
