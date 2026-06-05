"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { createFirstPatientCaseWizardAction } from "@/lib/actions/fi-first-case-wizard-actions";

export type FirstCaseWizardClinicOption = { id: string; display_name: string };

const fieldClass =
  "mt-0.5 w-full max-w-md rounded border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

const WIZARD_STEP_HEADING_IDS = {
  1: "first-case-wizard-step-1-heading",
  2: "first-case-wizard-step-2-heading",
  3: "first-case-wizard-step-3-heading",
} as const;

const WIZARD_FIELDS = {
  clinic: { inputId: "first-case-wizard-clinic", labelId: "first-case-wizard-clinic-label" },
  firstName: { inputId: "first-case-wizard-first-name", labelId: "first-case-wizard-first-name-label" },
  lastName: { inputId: "first-case-wizard-last-name", labelId: "first-case-wizard-last-name-label" },
  email: { inputId: "first-case-wizard-email", labelId: "first-case-wizard-email-label" },
  phone: { inputId: "first-case-wizard-phone", labelId: "first-case-wizard-phone-label" },
  dateOfBirth: { inputId: "first-case-wizard-dob", labelId: "first-case-wizard-dob-label" },
  caseType: { inputId: "first-case-wizard-case-type", labelId: "first-case-wizard-case-type-label" },
  treatmentType: { inputId: "first-case-wizard-treatment-type", labelId: "first-case-wizard-treatment-type-label" },
  adminKey: { inputId: "first-case-wizard-admin-key", labelId: "first-case-wizard-admin-key-label" },
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
      setError("Complete all steps before creating the case.");
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
      <div className="mx-auto max-w-2xl space-y-4 rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <p className="font-medium">No clinics in this tenant yet</p>
        <p>
          Create an organisation and clinic under{" "}
          <Link href={`/fi-admin/${tenantId}/directory`} className="text-blue-700 underline">
            Directory
          </Link>{" "}
          or{" "}
          <Link href={`/fi-admin/${tenantId}/configuration`} className="text-blue-700 underline">
            Configuration
          </Link>{" "}
          before adding a patient and case.
        </p>
        <Link href={`/fi-admin/${tenantId}/cases`} className="inline-block text-blue-700 underline">
          Back to cases
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">First patient / first case</h1>
          <p className="mt-1 max-w-xl text-sm text-gray-600">
            Guided setup: one person, one patient record, and one case. If you are signed in with a role that can edit
            cases (for example <code className="rounded bg-gray-100 px-1 text-xs">fi_admin</code>,{" "}
            <code className="rounded bg-gray-100 px-1 text-xs">admin</code>, or{" "}
            <code className="rounded bg-gray-100 px-1 text-xs">crm_operator</code>), you can create the case without an
            API key. Optional: use an admin key override below for break-glass or automation.
          </p>
        </div>
        <Link href={`/fi-admin/${tenantId}/cases`} className="text-sm text-blue-600 hover:underline">
          Back to cases
        </Link>
      </div>

      <ol className="flex flex-wrap gap-2 text-xs text-gray-600">
        <li className={step >= 1 ? "font-semibold text-gray-900" : ""}>1. Clinic</li>
        <li aria-hidden="true">
          ·
        </li>
        <li className={step >= 2 ? "font-semibold text-gray-900" : ""}>2. Person / patient</li>
        <li aria-hidden="true">
          ·
        </li>
        <li className={step >= 3 ? "font-semibold text-gray-900" : ""}>3. Case</li>
        <li aria-hidden="true">
          ·
        </li>
        <li className="text-gray-400">4. Open case</li>
      </ol>

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </div>
      ) : null}

      {step === 1 ? (
        <section
          className="space-y-3 rounded border border-gray-200 bg-white p-4 shadow-sm"
          aria-labelledby={WIZARD_STEP_HEADING_IDS[1]}
        >
          <h2 id={WIZARD_STEP_HEADING_IDS[1]} className="text-sm font-medium text-gray-900">
            Step 1 — Select clinic
          </h2>
          <label id={WIZARD_FIELDS.clinic.labelId} htmlFor={WIZARD_FIELDS.clinic.inputId} className="block text-sm text-gray-700">
            Clinic
            <select
              id={WIZARD_FIELDS.clinic.inputId}
              className={fieldClass}
              value={clinicId}
              onChange={(e) => setClinicId(e.target.value)}
              aria-labelledby={WIZARD_FIELDS.clinic.labelId}
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
            <button type="button" className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-800" onClick={goNext}>
              Next
            </button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section
          className="space-y-3 rounded border border-gray-200 bg-white p-4 shadow-sm"
          aria-labelledby={WIZARD_STEP_HEADING_IDS[2]}
        >
          <h2 id={WIZARD_STEP_HEADING_IDS[2]} className="text-sm font-medium text-gray-900">
            Step 2 — Person / patient
          </h2>
          <p className="text-xs text-gray-500">
            Contact details are stored on <code className="text-[11px]">fi_persons.metadata</code> for this admin
            workflow (foundation layer).
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label
              id={WIZARD_FIELDS.firstName.labelId}
              htmlFor={WIZARD_FIELDS.firstName.inputId}
              className="block text-sm text-gray-700"
            >
              First name
              <input
                id={WIZARD_FIELDS.firstName.inputId}
                className={fieldClass}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                aria-labelledby={WIZARD_FIELDS.firstName.labelId}
                autoComplete="given-name"
              />
            </label>
            <label
              id={WIZARD_FIELDS.lastName.labelId}
              htmlFor={WIZARD_FIELDS.lastName.inputId}
              className="block text-sm text-gray-700"
            >
              Last name
              <input
                id={WIZARD_FIELDS.lastName.inputId}
                className={fieldClass}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                aria-labelledby={WIZARD_FIELDS.lastName.labelId}
                autoComplete="family-name"
              />
            </label>
          </div>
          <label id={WIZARD_FIELDS.email.labelId} htmlFor={WIZARD_FIELDS.email.inputId} className="block text-sm text-gray-700">
            Email
            <input
              id={WIZARD_FIELDS.email.inputId}
              className={fieldClass}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-labelledby={WIZARD_FIELDS.email.labelId}
              autoComplete="email"
            />
          </label>
          <label id={WIZARD_FIELDS.phone.labelId} htmlFor={WIZARD_FIELDS.phone.inputId} className="block text-sm text-gray-700">
            Phone
            <input
              id={WIZARD_FIELDS.phone.inputId}
              className={fieldClass}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-labelledby={WIZARD_FIELDS.phone.labelId}
              autoComplete="tel"
            />
          </label>
          <label
            id={WIZARD_FIELDS.dateOfBirth.labelId}
            htmlFor={WIZARD_FIELDS.dateOfBirth.inputId}
            className="block text-sm text-gray-700"
          >
            Date of birth <span className="text-gray-400">(optional)</span>
            <input
              id={WIZARD_FIELDS.dateOfBirth.inputId}
              className={fieldClass}
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              aria-labelledby={WIZARD_FIELDS.dateOfBirth.labelId}
            />
          </label>
          <div className="flex justify-between gap-2 pt-2">
            <button type="button" className="text-sm text-gray-700 underline" onClick={goBack}>
              Back
            </button>
            <button type="button" className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-800" onClick={goNext}>
              Next
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section
          className="space-y-3 rounded border border-gray-200 bg-white p-4 shadow-sm"
          aria-labelledby={WIZARD_STEP_HEADING_IDS[3]}
        >
          <h2 id={WIZARD_STEP_HEADING_IDS[3]} className="text-sm font-medium text-gray-900">
            Step 3 — Case
          </h2>
          <label
            id={WIZARD_FIELDS.caseType.labelId}
            htmlFor={WIZARD_FIELDS.caseType.inputId}
            className="block text-sm text-gray-700"
          >
            Case type
            <input
              id={WIZARD_FIELDS.caseType.inputId}
              className={fieldClass}
              value={caseType}
              onChange={(e) => setCaseType(e.target.value)}
              aria-labelledby={WIZARD_FIELDS.caseType.labelId}
              placeholder="e.g. test_case, fue_consult"
            />
          </label>
          <label
            id={WIZARD_FIELDS.treatmentType.labelId}
            htmlFor={WIZARD_FIELDS.treatmentType.inputId}
            className="block text-sm text-gray-700"
          >
            Treatment type
            <input
              id={WIZARD_FIELDS.treatmentType.inputId}
              className={fieldClass}
              value={treatmentType}
              onChange={(e) => setTreatmentType(e.target.value)}
              aria-labelledby={WIZARD_FIELDS.treatmentType.labelId}
              placeholder="e.g. hair_transplant, fue"
            />
          </label>
          <div className="rounded border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <div>
              <span className="font-medium text-gray-800">Case status:</span> consultation (default)
            </div>
            <div>
              <span className="font-medium text-gray-800">Source:</span> manual_admin_test (default)
            </div>
          </div>
          <details className="rounded border border-gray-200 bg-gray-50/80 px-3 py-2 text-sm text-gray-700">
            <summary className="cursor-pointer font-medium text-gray-800">Advanced — admin key override (optional)</summary>
            <p className="mt-2 text-xs text-gray-600">
              Paste <code className="rounded bg-gray-100 px-0.5 text-[11px]">FI_ADMIN_API_KEY</code> only if you are
              not using a signed-in CRM/clinical role, or for scripted break-glass access. Leave blank for normal staff
              creation.
            </p>
            <label
              id={WIZARD_FIELDS.adminKey.labelId}
              htmlFor={WIZARD_FIELDS.adminKey.inputId}
              className="mt-2 block text-sm text-gray-700"
            >
              FI admin API key
              <input
                id={WIZARD_FIELDS.adminKey.inputId}
                className={fieldClass}
                type="password"
                autoComplete="off"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                aria-labelledby={WIZARD_FIELDS.adminKey.labelId}
                placeholder="Optional — matches server FI_ADMIN_API_KEY"
              />
            </label>
          </details>
          <div className="flex justify-between gap-2 pt-2">
            <button type="button" className="text-sm text-gray-700 underline" onClick={goBack}>
              Back
            </button>
            <button
              type="button"
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={busy || !canSubmit}
              onClick={() => void onCreate()}
            >
              {busy ? "Creating…" : "Create and open case"}
            </button>
          </div>
          <p className="text-xs text-gray-500">Step 4: after a successful create you are redirected to the new case detail page.</p>
        </section>
      ) : null}
    </div>
  );
}
