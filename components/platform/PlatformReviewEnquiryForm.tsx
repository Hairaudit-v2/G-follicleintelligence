"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { DEMO_INTEREST_QUERY_MAP } from "@/lib/marketing/hubspotMigrationPageContent";
import {
  emptyPlatformReviewFormValues,
  PLATFORM_REVIEW_ADOPTION_OPTIONS,
  PLATFORM_REVIEW_CONTACT_METHOD_OPTIONS,
  PLATFORM_REVIEW_INTEREST_OPTIONS,
  PLATFORM_REVIEW_LOCATION_OPTIONS,
  PLATFORM_REVIEW_STAFF_OPTIONS,
  PLATFORM_REVIEW_SYSTEM_OPTIONS,
  PLATFORM_REVIEW_VOLUME_OPTIONS,
  validatePlatformReviewForm,
  type PlatformReviewFieldErrors,
  type PlatformReviewFormValues,
} from "@/lib/marketing/platformReviewFormSchema";
import { PLATFORM_REVIEW_PAGE_CONTENT } from "@/lib/marketing/platformReviewPageContent";
import { MARKETING_CTA_PRIMARY_CLASS } from "@/lib/marketing/marketingCtaClasses";
import { cn } from "@/lib/utils";

const c = PLATFORM_REVIEW_PAGE_CONTENT.form;

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-white/[0.1] bg-black/30 px-3.5 py-2.5 text-sm text-foreground shadow-[inset_0_1px_0_rgb(255_255_255_/0.04)] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus-visible:border-amber-400/40 focus-visible:ring-2 focus-visible:ring-amber-400/25";

const labelClass = "text-sm font-medium text-foreground/95";
const helpClass = "mt-1 text-xs leading-relaxed text-muted-foreground";
const errorClass = "mt-1.5 text-xs font-medium text-red-300";
const sectionClass =
  "rounded-[1.35rem] border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-transparent p-5 sm:p-7";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className={errorClass} role="alert">
      {message}
    </p>
  );
}

function RequiredMark() {
  return (
    <span className="text-amber-200/80" aria-hidden>
      {" "}
      *
    </span>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  error,
  required,
  emptyLabel = "Select…",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  error?: string;
  required?: boolean;
  emptyLabel?: string;
}) {
  const errId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
        {required ? <RequiredMark /> : null}
      </label>
      <select
        id={id}
        name={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errId : undefined}
        className={cn(fieldClass, error && "border-red-400/40")}
      >
        <option value="">{emptyLabel}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      <FieldError id={errId} message={error} />
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  error,
  required,
  type = "text",
  autoComplete,
  help,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  required?: boolean;
  type?: string;
  autoComplete?: string;
  help?: string;
}) {
  const errId = `${id}-error`;
  const helpId = `${id}-help`;
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
        {required ? <RequiredMark /> : null}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={[help ? helpId : null, error ? errId : null].filter(Boolean).join(" ") || undefined}
        className={cn(fieldClass, error && "border-red-400/40")}
      />
      {help ? (
        <p id={helpId} className={helpClass}>
          {help}
        </p>
      ) : null}
      <FieldError id={errId} message={error} />
    </div>
  );
}

function TextAreaField({
  id,
  label,
  value,
  onChange,
  error,
  required,
  help,
  rows = 4,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  required?: boolean;
  help?: string;
  rows?: number;
}) {
  const errId = `${id}-error`;
  const helpId = `${id}-help`;
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
        {required ? <RequiredMark /> : null}
      </label>
      <textarea
        id={id}
        name={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        rows={rows}
        aria-invalid={Boolean(error)}
        aria-describedby={[help ? helpId : null, error ? errId : null].filter(Boolean).join(" ") || undefined}
        className={cn(fieldClass, "min-h-[6.5rem] resize-y", error && "border-red-400/40")}
      />
      {help ? (
        <p id={helpId} className={helpClass}>
          {help}
        </p>
      ) : null}
      <FieldError id={errId} message={error} />
    </div>
  );
}

function readUtm(param: string): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(param) ?? "";
}

export function PlatformReviewEnquiryForm() {
  const formId = useId();
  const statusRef = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<PlatformReviewFormValues>(() =>
    emptyPlatformReviewFormValues()
  );
  const [errors, setErrors] = useState<PlatformReviewFieldErrors>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error" | "duplicate">(
    "idle"
  );
  const [serverMessage, setServerMessage] = useState<string>("");

  useEffect(() => {
    const interestParam = readUtm("interest").toLowerCase();
    const mappedInterest = DEMO_INTEREST_QUERY_MAP[interestParam];
    const interestFromQuery =
      mappedInterest &&
      (PLATFORM_REVIEW_INTEREST_OPTIONS as readonly string[]).includes(mappedInterest)
        ? mappedInterest
        : "";

    setValues((prev) => ({
      ...prev,
      submissionKey: prev.submissionKey || crypto.randomUUID(),
      landingPage: window.location.href,
      referrer: document.referrer || "",
      utmSource: readUtm("utm_source"),
      utmMedium: readUtm("utm_medium"),
      utmCampaign: readUtm("utm_campaign"),
      utmContent: readUtm("utm_content"),
      utmTerm: readUtm("utm_term"),
      primaryInterest: interestFromQuery || prev.primaryInterest,
    }));
  }, []);

  useEffect(() => {
    if (status === "success" || status === "error" || status === "duplicate") {
      statusRef.current?.focus();
    }
  }, [status]);

  const set =
    (key: keyof PlatformReviewFormValues) =>
    (value: string | boolean) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    };

  const firstErrorKey = useMemo(() => {
    const keys = Object.keys(errors) as (keyof PlatformReviewFormValues)[];
    return keys[0];
  }, [errors]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerMessage("");

    const result = validatePlatformReviewForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      setStatus("error");
      setServerMessage("Please correct the highlighted fields.");
      // Focus first invalid control
      const key = Object.keys(result.errors)[0];
      if (key) {
        const el = document.getElementById(key);
        el?.focus();
      }
      return;
    }

    setStatus("submitting");
    setErrors({});

    try {
      const res = await fetch("/api/public/platform-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.values),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        code?: string;
        errors?: PlatformReviewFieldErrors;
      };

      if (res.status === 409 || data.code === "duplicate") {
        setStatus("duplicate");
        setServerMessage(data.error || c.duplicateBody);
        return;
      }

      if (!res.ok || !data.ok) {
        if (data.errors) setErrors(data.errors);
        setStatus("error");
        setServerMessage(data.error || c.failureBody);
        return;
      }

      setStatus("success");
      setServerMessage("");
      // New key so a genuine second enquiry later is allowed after window.
      setValues((prev) => ({
        ...emptyPlatformReviewFormValues({
          preferredContactMethod: "Either",
          submissionKey: crypto.randomUUID(),
          landingPage: prev.landingPage,
          referrer: prev.referrer,
          utmSource: prev.utmSource,
          utmMedium: prev.utmMedium,
          utmCampaign: prev.utmCampaign,
          utmContent: prev.utmContent,
          utmTerm: prev.utmTerm,
        }),
      }));
    } catch {
      setStatus("error");
      setServerMessage(c.failureBody);
    }
  }

  if (status === "success") {
    return (
      <div
        ref={statusRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className="rounded-[1.35rem] border border-emerald-400/25 bg-emerald-950/25 p-6 sm:p-8"
      >
        <h3 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          {c.successTitle}
        </h3>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {c.successBody}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/platform">Explore the Platform</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/platform/progress">View Platform Progress</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      id={formId}
      noValidate
      onSubmit={onSubmit}
      className="space-y-8"
      aria-describedby={status !== "idle" && status !== "submitting" ? "form-status" : undefined}
    >
      {/* Honeypot */}
      <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden>
        <label htmlFor="companyWebsite">Company website</label>
        <input
          id="companyWebsite"
          name="companyWebsite"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={values.companyWebsite}
          onChange={(e) => set("companyWebsite")(e.target.value)}
        />
      </div>

      <div className={sectionClass}>
        <h3 className="font-display text-xl font-semibold tracking-tight text-foreground">
          {c.sections.aboutYou}
        </h3>
        <p className={cn(helpClass, "mt-2")}>Required fields are marked with an asterisk.</p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <TextField
            id="firstName"
            label="First name"
            value={values.firstName}
            onChange={set("firstName")}
            error={errors.firstName}
            required
            autoComplete="given-name"
          />
          <TextField
            id="lastName"
            label="Last name"
            value={values.lastName}
            onChange={set("lastName")}
            error={errors.lastName}
            required
            autoComplete="family-name"
          />
          <TextField
            id="workEmail"
            label="Work email"
            type="email"
            value={values.workEmail}
            onChange={set("workEmail")}
            error={errors.workEmail}
            required
            autoComplete="email"
          />
          <TextField
            id="phone"
            label="Phone number"
            type="tel"
            value={values.phone}
            onChange={set("phone")}
            error={errors.phone}
            required
            autoComplete="tel"
          />
          <TextField
            id="role"
            label="Role or position"
            value={values.role}
            onChange={set("role")}
            error={errors.role}
            required
            autoComplete="organization-title"
          />
          <TextField
            id="organisation"
            label="Clinic or organisation name"
            value={values.organisation}
            onChange={set("organisation")}
            error={errors.organisation}
            required
            autoComplete="organization"
          />
          <TextField
            id="country"
            label="Country"
            value={values.country}
            onChange={set("country")}
            error={errors.country}
            required
            autoComplete="country-name"
          />
          <TextField
            id="cityRegion"
            label="City or region"
            value={values.cityRegion}
            onChange={set("cityRegion")}
            error={errors.cityRegion}
            required
            autoComplete="address-level2"
          />
          <TextField
            id="preferredTimezone"
            label="Preferred meeting timezone"
            value={values.preferredTimezone}
            onChange={set("preferredTimezone")}
            error={errors.preferredTimezone}
            help="Optional — e.g. Australia/Perth or GMT+8."
          />
          <SelectField
            id="preferredContactMethod"
            label="Preferred contact method"
            value={values.preferredContactMethod}
            onChange={set("preferredContactMethod")}
            options={PLATFORM_REVIEW_CONTACT_METHOD_OPTIONS}
            error={errors.preferredContactMethod}
          />
        </div>
      </div>

      <div className={sectionClass}>
        <h3 className="font-display text-xl font-semibold tracking-tight text-foreground">
          {c.sections.aboutClinic}
        </h3>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <SelectField
            id="locations"
            label="Number of clinic locations"
            value={values.locations}
            onChange={set("locations")}
            options={PLATFORM_REVIEW_LOCATION_OPTIONS}
            error={errors.locations}
            required
          />
          <SelectField
            id="staffCount"
            label="Approximate number of staff"
            value={values.staffCount}
            onChange={set("staffCount")}
            options={PLATFORM_REVIEW_STAFF_OPTIONS}
            error={errors.staffCount}
            required
          />
          <SelectField
            id="monthlyEnquiries"
            label="Approximate monthly enquiries"
            value={values.monthlyEnquiries}
            onChange={set("monthlyEnquiries")}
            options={PLATFORM_REVIEW_VOLUME_OPTIONS}
            error={errors.monthlyEnquiries}
            required
          />
          <SelectField
            id="monthlyConsultations"
            label="Approximate monthly consultations"
            value={values.monthlyConsultations}
            onChange={set("monthlyConsultations")}
            options={PLATFORM_REVIEW_VOLUME_OPTIONS}
            error={errors.monthlyConsultations}
            required
          />
          <SelectField
            id="monthlyProcedures"
            label="Approximate monthly procedures or treatments"
            value={values.monthlyProcedures}
            onChange={set("monthlyProcedures")}
            options={PLATFORM_REVIEW_VOLUME_OPTIONS}
            error={errors.monthlyProcedures}
            required
          />
        </div>
      </div>

      <div className={sectionClass}>
        <h3 className="font-display text-xl font-semibold tracking-tight text-foreground">
          {c.sections.systems}
        </h3>
        <p className={cn(helpClass, "mt-2")}>
          Select the closest match. Use Other and the free-text field for systems not listed.
        </p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <SelectField
            id="crmSystem"
            label="CRM"
            value={values.crmSystem}
            onChange={set("crmSystem")}
            options={PLATFORM_REVIEW_SYSTEM_OPTIONS}
            error={errors.crmSystem}
            required
          />
          <SelectField
            id="bookingSystem"
            label="Booking or calendar system"
            value={values.bookingSystem}
            onChange={set("bookingSystem")}
            options={PLATFORM_REVIEW_SYSTEM_OPTIONS}
            error={errors.bookingSystem}
            required
          />
          <SelectField
            id="patientRecordSystem"
            label="Patient or clinical record system"
            value={values.patientRecordSystem}
            onChange={set("patientRecordSystem")}
            options={PLATFORM_REVIEW_SYSTEM_OPTIONS}
            error={errors.patientRecordSystem}
            required
          />
          <SelectField
            id="imagingSystem"
            label="Imaging or photography system"
            value={values.imagingSystem}
            onChange={set("imagingSystem")}
            options={PLATFORM_REVIEW_SYSTEM_OPTIONS}
            error={errors.imagingSystem}
            required
          />
          <SelectField
            id="trainingSystem"
            label="Training or learning system"
            value={values.trainingSystem}
            onChange={set("trainingSystem")}
            options={PLATFORM_REVIEW_SYSTEM_OPTIONS}
            error={errors.trainingSystem}
            required
          />
          <TextField
            id="otherSystems"
            label="Other important systems"
            value={values.otherSystems}
            onChange={set("otherSystems")}
            error={errors.otherSystems}
            help="Optional — list any other tools your team relies on."
          />
        </div>
      </div>

      <div className={sectionClass}>
        <h3 className="font-display text-xl font-semibold tracking-tight text-foreground">
          {c.sections.priorities}
        </h3>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <SelectField
            id="primaryInterest"
            label="Primary interest"
            value={values.primaryInterest}
            onChange={set("primaryInterest")}
            options={PLATFORM_REVIEW_INTEREST_OPTIONS}
            error={errors.primaryInterest}
            required
          />
          <SelectField
            id="adoptionStage"
            label="Adoption stage"
            value={values.adoptionStage}
            onChange={set("adoptionStage")}
            options={PLATFORM_REVIEW_ADOPTION_OPTIONS}
            error={errors.adoptionStage}
            required
          />
        </div>
        <div className="mt-5 space-y-5">
          <TextAreaField
            id="mainProblems"
            label="What are the main problems you want to solve?"
            value={values.mainProblems}
            onChange={set("mainProblems")}
            error={errors.mainProblems}
            required
            help="Do not include patient names, medical records or credentials."
          />
          <TextAreaField
            id="priorityWorkflows"
            label="Which workflows or systems are highest priority?"
            value={values.priorityWorkflows}
            onChange={set("priorityWorkflows")}
            error={errors.priorityWorkflows}
            required
          />
        </div>
      </div>

      <div className={sectionClass}>
        <h3 className="font-display text-xl font-semibold tracking-tight text-foreground">
          {c.sections.context}
        </h3>
        <div className="mt-6">
          <TextAreaField
            id="additionalContext"
            label="Is there anything we should understand before the discussion?"
            value={values.additionalContext}
            onChange={set("additionalContext")}
            error={errors.additionalContext}
            help="Optional. Please do not include patient information or sensitive technical secrets."
          />
        </div>
      </div>

      <div className={sectionClass}>
        <h3 className="font-display text-xl font-semibold tracking-tight text-foreground">
          {c.sections.consent}
        </h3>
        <div className="mt-6">
          <label className="flex items-start gap-3 text-sm leading-relaxed text-foreground/90">
            <input
              id="consentContact"
              name="consentContact"
              type="checkbox"
              checked={values.consentContact}
              onChange={(e) => set("consentContact")(e.target.checked)}
              required
              aria-invalid={Boolean(errors.consentContact)}
              aria-describedby={errors.consentContact ? "consentContact-error" : "consentContact-help"}
              className="mt-1 h-4 w-4 rounded border-white/20 bg-black/40 text-amber-400 focus-visible:ring-2 focus-visible:ring-amber-400/40"
            />
            <span>
              I agree to be contacted about this enquiry. See our{" "}
              <Link
                href="/privacy"
                className="font-semibold text-amber-100/90 underline decoration-amber-400/40 underline-offset-2 hover:text-amber-50"
              >
                privacy policy
              </Link>
              .
              <RequiredMark />
            </span>
          </label>
          <p id="consentContact-help" className={helpClass}>
            We use this information to prepare the discussion — not to request patient data.
          </p>
          <FieldError id="consentContact-error" message={errors.consentContact} />
        </div>
      </div>

      {(status === "error" || status === "duplicate") && serverMessage ? (
        <div
          id="form-status"
          ref={statusRef}
          tabIndex={-1}
          role="alert"
          aria-live="assertive"
          className={cn(
            "rounded-2xl border px-5 py-4 text-sm leading-relaxed",
            status === "duplicate"
              ? "border-amber-400/30 bg-amber-950/25 text-amber-50/95"
              : "border-red-400/30 bg-red-950/30 text-red-100/95"
          )}
        >
          <p className="font-semibold">
            {status === "duplicate" ? c.duplicateTitle : c.failureTitle}
          </p>
          <p className="mt-2">{serverMessage}</p>
          {firstErrorKey ? (
            <p className="mt-2 text-xs opacity-90">Please review the fields marked above.</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          type="submit"
          size="lg"
          disabled={status === "submitting"}
          className={cn(MARKETING_CTA_PRIMARY_CLASS, "min-w-[14rem]")}
          aria-busy={status === "submitting"}
        >
          {status === "submitting" ? c.submittingLabel : c.submitLabel}
        </Button>
        <p className="text-xs leading-relaxed text-muted-foreground sm:max-w-md">
          Please do not include patient information, medical records, credentials or sensitive data
          in this form.
        </p>
      </div>
    </form>
  );
}
