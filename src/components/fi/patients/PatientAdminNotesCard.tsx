"use client";

import { useMemo, useState, useTransition } from "react";
import { updatePatientAdminDetailsAction } from "@/lib/actions/fi-patient-actions";
import type { PatientProfileFoundationData } from "@/src/lib/patients/patientProfileLoader";
import { PATIENT_STATUS_VALUES, type PatientStatusValue } from "@/src/lib/patients/patientPolicy";

export function PatientAdminNotesCard({ tenantId, data }: { tenantId: string; data: PatientProfileFoundationData }) {
  const [note, setNote] = useState(data.patient.admin_note ?? "");
  const [status, setStatus] = useState<PatientStatusValue>(data.patient.patient_status);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = useMemo(() => {
    return note !== (data.patient.admin_note ?? "") || status !== data.patient.patient_status;
  }, [note, status, data.patient.admin_note, data.patient.patient_status]);

  return (
    <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">Admin details</h2>
      <p className="mt-1 text-xs text-gray-500">
        Staff admin fields only — not for clinical notes, diagnoses, imaging, or surgery planning.
      </p>
      <label className="mt-3 block text-xs font-medium text-gray-700">
        Patient status
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as PatientStatusValue)}
          className="mt-1 block w-full max-w-xs rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
        >
          {PATIENT_STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 block text-xs font-medium text-gray-700">
        Admin note
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          placeholder="Operational context for staff (non-clinical)."
        />
      </label>
      {msg ? <p className="mt-2 text-xs text-gray-700">{msg}</p> : null}
      <button
        type="button"
        disabled={pending || !dirty}
        onClick={() => {
          setMsg(null);
          startTransition(async () => {
            const res = await updatePatientAdminDetailsAction(tenantId, data.foundationPatientId, {
              patient_status: status,
              admin_note: note,
            });
            if (!res.ok) {
              setMsg(res.error);
              return;
            }
            setMsg("Saved.");
          });
        }}
        className="mt-3 rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </section>
  );
}
