"use client";

import { useMemo, useState, useTransition } from "react";
import { updatePatientAdminDetailsAction } from "@/lib/actions/fi-patient-actions";
import type { PatientProfileFoundationData } from "@/src/lib/patients/patientProfileLoader";
import { PATIENT_STATUS_VALUES, type PatientStatusValue } from "@/src/lib/patients/patientPolicy";

export function PatientAdminNotesCard({
  tenantId,
  data,
}: {
  tenantId: string;
  data: PatientProfileFoundationData;
}) {
  const [note, setNote] = useState(data.patient.admin_note ?? "");
  const [status, setStatus] = useState<PatientStatusValue>(data.patient.patient_status);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [reminderConsent, setReminderConsent] = useState(Boolean(data.patient.reminder_consent));
  const [preferredContact, setPreferredContact] = useState<string>(
    data.patient.preferred_contact_method ?? ""
  );

  const dirty = useMemo(() => {
    return (
      note !== (data.patient.admin_note ?? "") ||
      status !== data.patient.patient_status ||
      reminderConsent !== Boolean(data.patient.reminder_consent) ||
      (preferredContact || "") !== (data.patient.preferred_contact_method ?? "")
    );
  }, [
    note,
    status,
    reminderConsent,
    preferredContact,
    data.patient.admin_note,
    data.patient.patient_status,
    data.patient.reminder_consent,
    data.patient.preferred_contact_method,
  ]);

  return (
    <section className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40">
      <h2 className="text-sm font-semibold text-slate-100">Admin details</h2>
      <p className="mt-1 text-xs text-gray-500">
        Staff admin fields only — not for clinical notes, diagnoses, imaging, or surgery planning.
      </p>
      <label className="mt-3 block text-xs font-medium text-slate-300">
        Patient status
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as PatientStatusValue)}
          className="mt-1 block w-full max-w-xs rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
        >
          {PATIENT_STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 flex items-start gap-2 text-xs font-medium text-slate-300">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={reminderConsent}
          onChange={(e) => setReminderConsent(e.target.checked)}
        />
        <span>
          Reminder consent — allow automated booking reminders (email/SMS) when templates exist and
          the booking has a patient anchor.
        </span>
      </label>
      <label className="mt-3 block text-xs font-medium text-slate-300">
        Preferred reminder channel
        <select
          className="mt-1 block w-full max-w-xs rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          value={preferredContact}
          onChange={(e) => setPreferredContact(e.target.value)}
        >
          <option value="">No preference (all channels)</option>
          <option value="email">Email only</option>
          <option value="sms">SMS only</option>
          <option value="both">Email and SMS</option>
        </select>
      </label>
      <label className="mt-3 block text-xs font-medium text-slate-300">
        Admin note
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          placeholder="Operational context for staff (non-clinical)."
        />
      </label>
      {msg ? <p className="mt-2 text-xs text-slate-300">{msg}</p> : null}
      <button
        type="button"
        disabled={pending || !dirty}
        onClick={() => {
          setMsg(null);
          startTransition(async () => {
            const res = await updatePatientAdminDetailsAction(tenantId, data.foundationPatientId, {
              patient_status: status,
              admin_note: note,
              reminder_consent: reminderConsent,
              preferred_contact_method:
                preferredContact === "" ? null : (preferredContact as "email" | "sms" | "both"),
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
