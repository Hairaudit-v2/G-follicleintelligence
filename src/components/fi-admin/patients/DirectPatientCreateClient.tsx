"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createDirectPatientAction } from "@/lib/actions/fi-patient-actions";
import { FiCard } from "@/src/components/fi-design/FiCard";
import { FiPageHeader } from "@/src/components/fi-design/FiPageHeader";
import { LabeledTextInput } from "@/src/components/fi-admin/consultations/consultationOsPreviewFields";

export function DirectPatientCreateClient({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const base = `/fi-admin/${tenantId.trim()}`;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await createDirectPatientAction(tenantId, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        mobile: mobile.trim(),
        email: email.trim(),
        dateOfBirth: dateOfBirth.trim(),
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push(`${base}/patients/${encodeURIComponent(r.patientId)}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <FiPageHeader
        title="Add new patient"
        description="Register a patient profile directly. You will be taken to the patient record after save."
      />

      <FiCard>
        <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <LabeledTextInput
              id="direct-patient-first-name"
              label="First name"
              value={firstName}
              onChange={setFirstName}
              disabled={busy}
            />
            <LabeledTextInput
              id="direct-patient-last-name"
              label="Last name"
              value={lastName}
              onChange={setLastName}
              disabled={busy}
            />
          </div>
          <LabeledTextInput
            id="direct-patient-mobile"
            label="Mobile"
            value={mobile}
            onChange={setMobile}
            disabled={busy}
          />
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Email
            </span>
            <input
              id="direct-patient-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              className="block w-full rounded-lg border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md px-3 py-2 text-sm text-slate-100 shadow-lg shadow-black/40"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-300">Date of birth</span>
            <input
              id="direct-patient-dob"
              type="date"
              required
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              disabled={busy}
              className="block w-full rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-100"
            />
          </label>

          {error ? (
            <p
              className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-300"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center justify-center rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
            >
              {busy ? "Creating…" : "Create patient"}
            </button>
            <button
              type="button"
              disabled={busy}
              className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/[0.03] disabled:opacity-60"
              onClick={() => router.push(`${base}/patients`)}
            >
              Cancel
            </button>
          </div>
        </form>
      </FiCard>
    </div>
  );
}
