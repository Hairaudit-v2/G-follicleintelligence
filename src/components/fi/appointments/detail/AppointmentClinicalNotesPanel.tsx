"use client";

import type { FormEvent } from "react";
import { LeadClinicalDetailsPanel } from "@/src/components/fi/crm/detail/LeadClinicalDetailsPanel";
import type { PatientClinicalDetailsRow } from "@/src/lib/patients/clinicalDetailsServer";
import { appointmentCardClass } from "../shared";

export function AppointmentClinicalNotesPanel({
  tenantId,
  patientId,
  clinicalDetails,
  clinicalScalesSummary,
  description,
  canMutate,
  busy,
  error,
  onDescriptionChange,
  onSaveDescription,
}: {
  tenantId: string;
  patientId: string | null;
  clinicalDetails: PatientClinicalDetailsRow | null;
  clinicalScalesSummary: string | null;
  description: string;
  canMutate: boolean;
  busy: boolean;
  error: string | null;
  onDescriptionChange: (v: string) => void;
  onSaveDescription: (e: FormEvent) => void;
}) {
  return (
    <div className="space-y-4">
      <LeadClinicalDetailsPanel
        tenantId={tenantId}
        patientId={patientId}
        clinicalDetails={clinicalDetails}
        clinicalScalesSummary={clinicalScalesSummary}
      />
      <section className={appointmentCardClass}>
        <h2 className="text-sm font-semibold text-gray-900">Appointment clinical notes</h2>
        <p className="mt-1 text-xs text-gray-600">
          Free-text notes stored on this booking (consultation findings, intra-op observations, plan for next visit).
        </p>
        {canMutate ? (
          <form className="mt-3 space-y-2" onSubmit={onSaveDescription}>
            <textarea
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              rows={8}
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Clinical notes for this appointment…"
            />
            {error ? <p className="text-xs text-red-700">{error}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save notes"}
            </button>
          </form>
        ) : (
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{description.trim() || "—"}</p>
        )}
      </section>
    </div>
  );
}
