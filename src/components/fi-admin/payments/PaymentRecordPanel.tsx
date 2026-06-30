"use client";

import { useState } from "react";

import { FiSection } from "@/src/components/fi-design/FiSection";
import type { PaymentContext, PaymentRecordRow } from "@/src/lib/payments/paymentRecordModel";
import { PaymentStatusBadge } from "@/src/components/fi-admin/payments/PaymentStatusBadge";
import { RecordPaymentModal } from "@/src/components/fi-admin/payments/RecordPaymentModal";

function formatRecordedYmd(iso: string): string {
  const s = iso.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const t = Date.parse(s);
  if (Number.isFinite(t)) return new Date(t).toISOString().slice(0, 10);
  return s.slice(0, 10);
}

const DEFAULT_EMPTY_COPY =
  "No manual payment records yet. When finance adds a row, status appears on operational boards.";

export function PaymentRecordPanel(props: {
  tenantId: string;
  /** Optional `FI_ADMIN_API_KEY` override — only pass when the parent surface already collects it (e.g. ConsultationOS workspace card). */
  optionalFiAdminKey?: string;
  todayYmd: string;
  paymentContext: PaymentContext;
  consultationId?: string | null;
  caseId?: string | null;
  bookingId?: string | null;
  patientId?: string | null;
  leadId?: string | null;
  initialRows: PaymentRecordRow[];
  canMutate: boolean;
  /** Empty-state line when `initialRows` is empty (consultation vs surgery vs patient-specific copy). */
  noManualPaymentRecordsCopy?: string;
}) {
  const [open, setOpen] = useState(false);
  const emptyCopy = props.noManualPaymentRecordsCopy?.trim() || DEFAULT_EMPTY_COPY;

  return (
    <FiSection
      title="Recorded payment status"
      description="Manual payment tracking for this workspace — not integrated billing, POS, or accounting."
      headingId="fi-payment-record-panel-heading"
    >
      <div className="space-y-3 text-sm text-slate-300">
        {props.initialRows.length === 0 ? (
          <p className="rounded border border-dashed border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-400">{emptyCopy}</p>
        ) : (
          <ul className="divide-y divide-white/[0.06] rounded border border-white/[0.08]">
            {props.initialRows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-slate-500">{r.id}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {r.currency}{" "}
                    <span className="font-semibold text-slate-100">{r.amount_paid}</span> paid of{" "}
                    <span className="font-semibold">{r.amount_expected}</span> expected
                    {r.due_date ? <span className="text-slate-500"> · due {r.due_date}</span> : null}
                  </p>
                  {r.recorded_at ? (
                    <p className="mt-1 text-[0.65rem] text-slate-500">
                      Recorded {formatRecordedYmd(r.recorded_at)}
                      {r.recorded_by ? (
                        <>
                          {" "}
                          · <span className="font-mono">staff {r.recorded_by.slice(0, 8)}…</span>
                        </>
                      ) : null}
                    </p>
                  ) : null}
                </div>
                <PaymentStatusBadge status={r.status} dueDate={r.due_date} todayYmd={props.todayYmd} />
              </li>
            ))}
          </ul>
        )}

        {props.canMutate ? (
          <>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/15"
            >
              Record payment…
            </button>
            <RecordPaymentModal
              tenantId={props.tenantId}
              optionalFiAdminKey={props.optionalFiAdminKey}
              open={open}
              onClose={() => setOpen(false)}
              paymentContext={props.paymentContext}
              consultationId={props.consultationId}
              caseId={props.caseId}
              bookingId={props.bookingId}
              patientId={props.patientId}
              leadId={props.leadId}
              existingRecords={props.initialRows}
              todayYmd={props.todayYmd}
            />
          </>
        ) : (
          <p className="text-xs text-slate-500">You can view recorded payment status; finance or a manager must sign in to edit.</p>
        )}
      </div>
    </FiSection>
  );
}
