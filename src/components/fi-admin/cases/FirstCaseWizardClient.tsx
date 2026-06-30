"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { createFirstPatientCaseWizardAction } from "@/lib/actions/fi-first-case-wizard-actions";

export type FirstCaseWizardClinicOption = { id: string; display_name: string };

const fieldClass =
  "mt-0.5 w-full max-w-md rounded border border-slate-700 px-2 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

const WIZARD_STEP_HEADING_IDS = {
  1: "first-case-wizard-step-1-heading",
  2: "first-case-wizard-step-2-heading",
  3: "first-case-wizard-step-3-heading",
} as const;

const WIZARD_FIELDS = {
  clinic: {
    inputId: "first-case-wizard-clinic",
    name: "clinic_id",
    labelId: "first-case-wizard-clinic-label",
  },
  firstName: {
    inputId: "first-case-wizard-first-name",
    name: "first_name",
    labelId: "first-case-wizard-first-name-label",
  },
  lastName: {
    inputId: "first-case-wizard-last-name",
    name: "last_name",
    labelId: "first-case-wizard-last-name-label",
  },
  email: {
    inputId: "first-case-wizard-email",
    name: "email",
    labelId: "first-case-wizard-email-label",
  },
  phone: {
    inputId: "first-case-wizard-phone",
    name: "phone",
    labelId: "first-case-wizard-phone-label",
  },
  dateOfBirth: {
    inputId: "first-case-wizard-dob",
    name: "date_of_birth",
    labelId: "first-case-wizard-dob-label",
  },
  caseType: {
    inputId: "first-case-wizard-case-type",
    name: "case_type",
    labelId: "first-case-wizard-case-type-label",
  },
  treatmentType: {
    inputId: "first-case-wizard-treatment-type",
    name: "treatment_type",
    labelId: "first-case-wizard-treatment-type-label",
  },
  adminKey: {
    inputId: "first-case-wizard-admin-key",
    name: "admin_key",
    labelId: "first-case-wizard-admin-key-label",
  },
} as const;

export function FirstCaseWizardClient({
  tenantId,
  clinics,
}: {
  tenantId: string;
  clinics: FirstCaseWizardClinicOption[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [adminKey, setAdminKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clinicId, setClinicId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [caseType, setCaseType] = useState("test_case");
  const [treatmentType, setTreatmentType] = useState("hair_transplant");

  const canStep1 = useMemo(() => !!clinicId.trim(), [clinicId]);
  const canStep2 = useMemo(
    () =>
      !!firstName.trim() &&
      !!lastName.trim() &&
      !!email.trim().includes("@") &&
      phone.trim().length >= 3,
    [firstName, lastName, email, phone]
  );
  const canSubmit = useMemo(
    () => canStep1 && canStep2 && !!caseType.trim() && !!treatmentType.trim(),
    [canStep1, canStep2, caseType, treatmentType]
  );

  const goNext = useCallback(() => {
    setError(null);
    if (step === 1 && !canStep1) {
      setError("Select a clinic to continue.");
      return;
    }
    if (step === 2 && !canStep2) {
      setError("Enter first name, last name, email, and phone to continue.");
      return;
    }
    setStep((s) => Math.min(3, s + 1));
  }, [step, canStep1, canStep2]);

  const goBack = useCallback(() => {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }, []);

  const onCreate = useCallback(async () => {
    setError(null);
    if (!canSubmit) {
      setError("Complete all steps before creating the patient.");
      return;
    }
    setBusy(true);
    try {
      const adminOverride = adminKey.trim();
      const res = await createFirstPatientCaseWizardAction({
        ...(adminOverride ? { adminKey: adminOverride } : {}),
        tenantId,
        clinic_id: clinicId.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        date_of_birth: dateOfBirth.trim() || undefined,
        case_type: caseType.trim(),
        treatment_type: treatmentType.trim(),
        case_status: "consultation",
        source: "manual_admin_test",
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/fi-admin/${tenantId}/cases/${res.caseId}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }, [
    adminKey,
    tenantId,
    clinicId,
    firstName,
    lastName,
    email,
    phone,
    dateOfBirth,
    caseType,
    treatmentType,
    canSubmit,
    router,
  ]);

  if (clinics.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 rounded border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-200">
        <p className="font-medium">No clinics in this tenant yet</p>
        <p>
          Create an organisation and clinic under{" "}
          <Link href={`/fi-admin/${tenantId}/directory`} className="text-blue-300 underline">
            Directory
          </Link>{" "}
          or{" "}
          <Link href={`/fi-admin/${tenantId}/configuration`} className="text-blue-300 underline">
            Configuration
          </Link>{" "}
          before adding a patient.
        </p>
        <Link href={`/fi-admin/${tenantId}/cases`} className="inline-block text-blue-300 underline">
          Back to patients
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">First patient</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-400">
            Guided setup: one person, one patient record, and one clinical patient. If you are
            signed in with a role that can edit patients (for example{" "}
            <code className="rounded bg-white/[0.06] px-1 text-xs">fi_admin</code>,{" "}
            <code className="rounded bg-white/[0.06] px-1 text-xs">admin</code>, or{" "}
            <code className="rounded bg-white/[0.06] px-1 text-xs">crm_operator</code>), you can
            create the patient without an API key. Optional: use an admin key override below for
            break-glass or automation.
          </p>
        </div>
        <Link
          href={`/fi-admin/${tenantId}/cases`}
          className="text-sm text-blue-300 hover:underline"
        >
          Back to patients
        </Link>
      </div>

      <ol className="flex flex-wrap gap-2 text-xs text-slate-400">
        <li className={step >= 1 ? "font-semibold text-slate-100" : ""}>1. Clinic</li>
        <li aria-hidden="true">·</li>
        <li className={step >= 2 ? "font-semibold text-slate-100" : ""}>2. Person / patient</li>
        <li aria-hidden="true">·</li>
        <li className={step >= 3 ? "font-semibold text-slate-100" : ""}>3. Patient</li>
        <li aria-hidden="true">·</li>
        <li className="text-gray-400">4. Open patient</li>
      </ol>

      {error ? (
        <div
          className="rounded border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-300"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {step === 1 ? (
        <section
          className="space-y-3 rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40"
          aria-labelledby={WIZARD_STEP_HEADING_IDS[1]}
        >
          <h2 id={WIZARD_STEP_HEADING_IDS[1]} className="text-sm font-medium text-slate-100">
            Step 1 — Select clinic
          </h2>
          <label
            id={WIZARD_FIELDS.clinic.labelId}
            htmlFor={WIZARD_FIELDS.clinic.inputId}
            className="block text-sm text-slate-300"
          >
            Clinic
            <select
              id={WIZARD_FIELDS.clinic.inputId}
              name={WIZARD_FIELDS.clinic.name}
              className={fieldClass}
              value={clinicId}
              onChange={(e) => setClinicId(e.target.value)}
              required
            >
              <option value="">Choose a clinic…</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-800"
              onClick={goNext}
            >
              Next
            </button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section
          className="space-y-3 rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40"
          aria-labelledby={WIZARD_STEP_HEADING_IDS[2]}
        >
          <h2 id={WIZARD_STEP_HEADING_IDS[2]} className="text-sm font-medium text-slate-100">
            Step 2 — Person / patient
          </h2>
          <p className="text-xs text-gray-500">
            Contact details are stored on <code className="text-[11px]">fi_persons.metadata</code>{" "}
            for this admin workflow (foundation layer).
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label
              id={WIZARD_FIELDS.firstName.labelId}
              htmlFor={WIZARD_FIELDS.firstName.inputId}
              className="block text-sm text-slate-300"
            >
              First name
              <input
                id={WIZARD_FIELDS.firstName.inputId}
                name={WIZARD_FIELDS.firstName.name}
                className={fieldClass}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
              />
            </label>
            <label
              id={WIZARD_FIELDS.lastName.labelId}
              htmlFor={WIZARD_FIELDS.lastName.inputId}
              className="block text-sm text-slate-300"
            >
              Last name
              <input
                id={WIZARD_FIELDS.lastName.inputId}
                name={WIZARD_FIELDS.lastName.name}
                className={fieldClass}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
              />
            </label>
          </div>
          <label
            id={WIZARD_FIELDS.email.labelId}
            htmlFor={WIZARD_FIELDS.email.inputId}
            className="block text-sm text-slate-300"
          >
            Email
            <input
              id={WIZARD_FIELDS.email.inputId}
              name={WIZARD_FIELDS.email.name}
              className={fieldClass}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label
            id={WIZARD_FIELDS.phone.labelId}
            htmlFor={WIZARD_FIELDS.phone.inputId}
            className="block text-sm text-slate-300"
          >
            Phone
            <input
              id={WIZARD_FIELDS.phone.inputId}
              name={WIZARD_FIELDS.phone.name}
              className={fieldClass}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
          </label>
          <label
            id={WIZARD_FIELDS.dateOfBirth.labelId}
            htmlFor={WIZARD_FIELDS.dateOfBirth.inputId}
            className="block text-sm text-slate-300"
          >
            Date of birth <span className="text-gray-400">(optional)</span>
            <input
              id={WIZARD_FIELDS.dateOfBirth.inputId}
              name={WIZARD_FIELDS.dateOfBirth.name}
              className={fieldClass}
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
          </label>
          <div className="flex justify-between gap-2 pt-2">
            <button type="button" className="text-sm text-slate-300 underline" onClick={goBack}>
              Back
            </button>
            <button
              type="button"
              className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-800"
              onClick={goNext}
            >
              Next
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section
          className="space-y-3 rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40"
          aria-labelledby={WIZARD_STEP_HEADING_IDS[3]}
        >
          <h2 id={WIZARD_STEP_HEADING_IDS[3]} className="text-sm font-medium text-slate-100">
            Step 3 — Patient
          </h2>
          <label
            id={WIZARD_FIELDS.caseType.labelId}
            htmlFor={WIZARD_FIELDS.caseType.inputId}
            className="block text-sm text-slate-300"
          >
            Patient type
            <input
              id={WIZARD_FIELDS.caseType.inputId}
              name={WIZARD_FIELDS.caseType.name}
              className={fieldClass}
              value={caseType}
              onChange={(e) => setCaseType(e.target.value)}
              placeholder="e.g. test_case, fue_consult"
            />
          </label>
          <label
            id={WIZARD_FIELDS.treatmentType.labelId}
            htmlFor={WIZARD_FIELDS.treatmentType.inputId}
            className="block text-sm text-slate-300"
          >
            Treatment type
            <input
              id={WIZARD_FIELDS.treatmentType.inputId}
              name={WIZARD_FIELDS.treatmentType.name}
              className={fieldClass}
              value={treatmentType}
              onChange={(e) => setTreatmentType(e.target.value)}
              placeholder="e.g. hair_transplant, fue"
            />
          </label>
          <div className="rounded border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
            <div>
              <span className="font-medium text-slate-200">Patient status:</span> consultation
              (default)
            </div>
            <div>
              <span className="font-medium text-slate-200">Source:</span> manual_admin_test
              (default)
            </div>
          </div>
          <details className="rounded border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-300">
            <summary className="cursor-pointer font-medium text-slate-200">
              Advanced — admin key override (optional)
            </summary>
            <p className="mt-2 text-xs text-slate-400">
              Paste{" "}
              <code className="rounded bg-white/[0.06] px-0.5 text-[11px]">FI_ADMIN_API_KEY</code>{" "}
              only if you are not using a signed-in CRM/clinical role, or for scripted break-glass
              access. Leave blank for normal staff creation.
            </p>
            <label
              id={WIZARD_FIELDS.adminKey.labelId}
              htmlFor={WIZARD_FIELDS.adminKey.inputId}
              className="mt-2 block text-sm text-slate-300"
            >
              FI admin API key
              <input
                id={WIZARD_FIELDS.adminKey.inputId}
                name={WIZARD_FIELDS.adminKey.name}
                className={fieldClass}
                type="password"
                autoComplete="off"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="Optional — matches server FI_ADMIN_API_KEY"
              />
            </label>
          </details>
          <div className="flex justify-between gap-2 pt-2">
            <button type="button" className="text-sm text-slate-300 underline" onClick={goBack}>
              Back
            </button>
            <button
              type="button"
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={busy || !canSubmit}
              onClick={() => void onCreate()}
            >
              {busy ? "Creating…" : "Create and open patient"}
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Step 4: after a successful create you are redirected to the new patient detail page.
          </p>
        </section>
      ) : null}
    </div>
  );
}
