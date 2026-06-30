"use client";

import type { FormEvent } from "react";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { AppointmentInstructionsSentMetadata } from "@/src/lib/bookings/appointmentMetadata";
import type { FiCrmLeadRow } from "@/src/lib/crm/types";
import { appointmentCardClass } from "./appointmentSharedStyles";

export function AppointmentAnchorFlowsSection({
  booking,
  lead,
  instructionsSent,
  canMutate,
  linkBusy,
  linkErr,
  convBusy,
  convErr,
  seedCase,
  onSeedCaseChange,
  onLinkPatient,
  onConvert,
}: {
  booking: FiBookingRow;
  lead: FiCrmLeadRow | null;
  instructionsSent: AppointmentInstructionsSentMetadata;
  canMutate: boolean;
  linkBusy: boolean;
  linkErr: string | null;
  convBusy: boolean;
  convErr: string | null;
  seedCase: boolean;
  onSeedCaseChange: (v: boolean) => void;
  onLinkPatient: () => void;
  onConvert: (e: FormEvent) => void;
}) {
  if (!lead) return null;

  const showConvert = !lead.converted_at;
  const showLink = !!lead.patient_id && booking.patient_id !== lead.patient_id;

  return (
    <section className={appointmentCardClass}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Lead & patient
      </h3>

      {showConvert && canMutate ? (
        <div className="mb-3 space-y-2">
          <p className="text-xs text-slate-400">
            Convert this lead to a foundation patient, then link the appointment.
          </p>
          <form className="space-y-2" onSubmit={onConvert}>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={seedCase}
                onChange={(e) => onSeedCaseChange(e.target.checked)}
              />
              Seed a case when converting
            </label>
            {convErr ? <p className="text-xs text-rose-300">{convErr}</p> : null}
            <button
              type="submit"
              disabled={convBusy}
              className="rounded bg-emerald-700 px-3 py-1.5 text-xs text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {convBusy ? "Converting…" : "Convert from lead"}
            </button>
          </form>
        </div>
      ) : null}

      {showLink && canMutate ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">
            Lead has a patient record that is not yet on this appointment.
          </p>
          {linkErr ? <p className="text-xs text-rose-300">{linkErr}</p> : null}
          <button
            type="button"
            disabled={linkBusy}
            className="rounded border border-blue-600 px-3 py-1.5 text-xs text-blue-300 hover:bg-blue-500/10 disabled:opacity-50"
            onClick={() => void onLinkPatient()}
          >
            {linkBusy ? "Linking…" : "Link to patient"}
          </button>
        </div>
      ) : null}

      {!showConvert && lead.patient_id && booking.patient_id === lead.patient_id ? (
        <p className="text-xs text-slate-400">Patient is linked on this appointment and lead.</p>
      ) : null}

      {instructionsSent.pre_op_at || instructionsSent.post_op_at ? (
        <p className="mt-2 text-xs text-gray-500">
          {instructionsSent.pre_op_at ? `Pre-op pack logged ${instructionsSent.pre_op_at}. ` : ""}
          {instructionsSent.post_op_at ? `Post-op pack logged ${instructionsSent.post_op_at}.` : ""}
        </p>
      ) : null}
    </section>
  );
}
