"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Camera, Calendar, UserPlus } from "lucide-react";

import {
  createFollowUpEncounterAction,
  createLegacyReturningPatientAction,
  loadBookingFollowUpContextAction,
  searchReturningPatientsAction,
} from "@/lib/actions/fi-follow-up-encounter-actions";
import { ConsultationPatientLinkField } from "@/src/components/fi-admin/consultations/ConsultationPatientLinkField";
import { BookingFollowUpContinuityBadge } from "@/src/components/fi-admin/followUp/BookingFollowUpContinuityBadge";
import type { ConsultationLinkSearchPatientHit } from "@/src/lib/consultations/consultationLinkSearchLoader.server";
import { FiCard } from "@/src/components/fi-design/FiCard";
import { FiPageHeader } from "@/src/components/fi-design/FiPageHeader";
import { LabeledTextInput } from "@/src/components/fi-admin/consultations/consultationOsPreviewFields";
import {
  FOLLOW_UP_ENCOUNTER_TYPE_LABELS,
  type FollowUpEncounterType,
} from "@/src/lib/followUpEncounters/followUpEncounterTypes";
import type { BookingContinuityStatus } from "@/src/lib/followUpEncounters/bookingFollowUpContextCore";
import { FollowUpEncounterAiReviewPanel } from "./FollowUpEncounterAiReviewPanel";

const ENCOUNTER_TYPE_OPTIONS: FollowUpEncounterType[] = [
  "legacy_follow_up",
  "follow_up",
  "photos_only",
  "treatment_review",
  "post_op_review",
  "donor_review",
  "concern_review",
];

type Step = "search" | "create_patient" | "encounter";

function intentToEncounterType(intent: string | null): FollowUpEncounterType | null {
  if (intent === "photos") return "photos_only";
  if (intent === "legacy") return "legacy_follow_up";
  if (intent === "follow_up") return "follow_up";
  return null;
}

export function ReturningPatientFollowUpClient({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const base = `/fi-admin/${tenantId.trim()}`;

  const initialPatientId = searchParams.get("patientId");
  const initialBookingId = searchParams.get("bookingId");
  const urlEncounterType = searchParams.get("encounterType");
  const urlIntent = searchParams.get("intent");

  const [step, setStep] = useState<Step>(
    initialPatientId || initialBookingId ? "encounter" : "search"
  );
  const [patientId, setPatientId] = useState<string | null>(initialPatientId);
  const [patientLabel, setPatientLabel] = useState<string | null>(null);
  const [isLegacyTimely, setIsLegacyTimely] = useState(true);
  const [encounterType, setEncounterType] = useState<FollowUpEncounterType>(() => {
    if (
      urlEncounterType &&
      ENCOUNTER_TYPE_OPTIONS.includes(urlEncounterType as FollowUpEncounterType)
    ) {
      return urlEncounterType as FollowUpEncounterType;
    }
    const fromIntent = intentToEncounterType(urlIntent);
    if (fromIntent) return fromIntent;
    return "legacy_follow_up";
  });
  const [visitReason, setVisitReason] = useState("");
  const [clinicalNote, setClinicalNote] = useState("");
  const [treatmentUpdate, setTreatmentUpdate] = useState("");
  const [followUpPlan, setFollowUpPlan] = useState("");
  const [bookingId] = useState(initialBookingId);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [appointmentWhenLabel, setAppointmentWhenLabel] = useState<string | null>(null);
  const [continuityStatus, setContinuityStatus] = useState<BookingContinuityStatus | null>(null);
  const [continuityLabel, setContinuityLabel] = useState<string | null>(null);
  const [bookingContextLoading, setBookingContextLoading] = useState(Boolean(initialBookingId));

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [legacyExternalId, setLegacyExternalId] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const applyBookingPrefill = useCallback(
    (prefill: {
      patientId: string | null;
      patientLabel: string | null;
      firstName: string;
      lastName: string;
      mobile: string;
      email: string;
      dateOfBirth: string;
      legacyExternalId: string;
      isLegacyTimely: boolean;
      encounterType: FollowUpEncounterType;
      visitReason: string;
      clinicId: string | null;
      staffId: string | null;
      appointmentWhenLabel: string;
    }) => {
      if (prefill.patientId) {
        setPatientId(prefill.patientId);
        setPatientLabel(prefill.patientLabel);
        setStep("encounter");
      } else if (prefill.firstName || prefill.email || prefill.mobile) {
        setFirstName(prefill.firstName);
        setLastName(prefill.lastName);
        setMobile(prefill.mobile);
        setEmail(prefill.email);
        setDateOfBirth(prefill.dateOfBirth);
        setLegacyExternalId(prefill.legacyExternalId);
        setStep("create_patient");
      }
      setIsLegacyTimely(prefill.isLegacyTimely);
      if (!urlEncounterType && !urlIntent) {
        setEncounterType(prefill.encounterType);
      }
      setVisitReason(prefill.visitReason);
      setClinicId(prefill.clinicId);
      setStaffId(prefill.staffId);
      setAppointmentWhenLabel(prefill.appointmentWhenLabel);
    },
    [urlEncounterType, urlIntent]
  );

  useEffect(() => {
    if (!initialBookingId) return;
    let cancelled = false;
    void (async () => {
      setBookingContextLoading(true);
      const r = await loadBookingFollowUpContextAction(tenantId, initialBookingId);
      if (cancelled) return;
      if (r.ok) {
        applyBookingPrefill(r.context.prefill);
        setContinuityStatus(r.context.continuityStatus);
        setContinuityLabel(r.context.continuityLabel);
        if (r.context.duplicatePrevented && r.context.duplicateSummary) {
          setInfo(r.context.duplicateSummary);
        }
      } else {
        setError(r.error);
      }
      setBookingContextLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, initialBookingId, applyBookingPrefill]);

  useEffect(() => {
    if (!initialPatientId || initialBookingId) return;
    void (async () => {
      const r = await searchReturningPatientsAction(tenantId, {
        query: initialPatientId.slice(0, 8),
      });
      if (r.ok) {
        const hit = r.patients.find((p) => p.patientId === initialPatientId);
        if (hit) setPatientLabel(hit.displayName);
      }
    })();
  }, [tenantId, initialPatientId, initialBookingId]);

  function onLinkPatient(hit: ConsultationLinkSearchPatientHit) {
    setPatientId(hit.id);
    setPatientLabel(hit.name);
    setStep("encounter");
    setError(null);
  }

  async function onCreateLegacyPatient(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const r = await createLegacyReturningPatientAction(tenantId, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        mobile: mobile.trim(),
        email: email.trim(),
        dateOfBirth: dateOfBirth.trim() || undefined,
        legacySource: "timely",
        legacyExternalId: legacyExternalId.trim() || undefined,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      if (r.duplicatePrevented) {
        setInfo(
          r.duplicateSummary ??
            "Existing patient matched — continuing with their record to avoid duplicates."
        );
      }
      setPatientId(r.patientId);
      setPatientLabel(`${firstName.trim()} ${lastName.trim()}`.trim());
      setStep("encounter");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveEncounter(e: React.FormEvent) {
    e.preventDefault();
    if (!patientId) {
      setError("Select or create a patient first.");
      return;
    }
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const resolvedType =
        isLegacyTimely && encounterType !== "photos_only" ? "legacy_follow_up" : encounterType;
      const r = await createFollowUpEncounterAction(tenantId, {
        patientId,
        encounterType: resolvedType,
        legacySource: isLegacyTimely ? "timely" : undefined,
        legacyExternalId: legacyExternalId.trim() || undefined,
        visitReason: visitReason.trim() || undefined,
        clinicalNote: clinicalNote.trim() || undefined,
        treatmentUpdate: treatmentUpdate.trim() || undefined,
        followUpPlan: followUpPlan.trim() || undefined,
        bookingId: bookingId ?? undefined,
        clinicId: clinicId ?? undefined,
        staffId: staffId ?? undefined,
        status: "completed",
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      if (r.imagingCaptureHref) {
        router.push(r.imagingCaptureHref);
        router.refresh();
        return;
      }
      router.push(r.returnHref);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const backHref = bookingId
    ? `${base}/calendar?bookingId=${encodeURIComponent(bookingId)}`
    : `${base}/patients`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-cyan-300 hover:text-cyan-200"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {bookingId ? "Back to appointment" : "Back to patients"}
      </Link>

      <FiPageHeader
        title="Returning patient from Timely"
        description="Continue care in FI OS — add today's follow-up or capture photos only. Historical record not fully imported yet."
      />

      {bookingId ? (
        <FiCard className="space-y-2 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Calendar className="h-4 w-4 text-cyan-400" aria-hidden />
              <span>{appointmentWhenLabel ?? "Linked appointment"}</span>
            </div>
            {continuityStatus && continuityLabel ? (
              <BookingFollowUpContinuityBadge status={continuityStatus} label={continuityLabel} />
            ) : null}
          </div>
          {bookingContextLoading ? (
            <p className="text-xs text-slate-500">Loading appointment context…</p>
          ) : null}
        </FiCard>
      ) : null}

      {step === "search" && !bookingContextLoading && (
        <FiCard className="space-y-4 p-5">
          <p className="text-sm text-slate-400">Search for an existing patient record first.</p>
          <ConsultationPatientLinkField
            tenantId={tenantId}
            patientId={patientId}
            patientLabel={patientLabel}
            onLinkPatient={onLinkPatient}
            onClearPatient={() => {
              setPatientId(null);
              setPatientLabel(null);
            }}
          />
          <div className="border-t border-white/[0.06] pt-4">
            <p className="mb-3 text-sm text-slate-400">Patient not found?</p>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800"
              onClick={() => setStep("create_patient")}
            >
              <UserPlus className="h-4 w-4" aria-hidden />
              Quick-create minimal patient
            </button>
          </div>
        </FiCard>
      )}

      {step === "create_patient" && !bookingContextLoading && (
        <FiCard>
          <form className="space-y-4 p-5" onSubmit={(e) => void onCreateLegacyPatient(e)}>
            <p className="text-sm text-slate-400">
              Register a returning patient with minimal details. Marked as sourced from Timely for
              later import/merge.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <LabeledTextInput
                id="legacy-first-name"
                label="First name"
                value={firstName}
                onChange={setFirstName}
                disabled={busy}
              />
              <LabeledTextInput
                id="legacy-last-name"
                label="Last name"
                value={lastName}
                onChange={setLastName}
                disabled={busy}
              />
            </div>
            <LabeledTextInput
              id="legacy-mobile"
              label="Mobile"
              value={mobile}
              onChange={setMobile}
              disabled={busy}
            />
            <LabeledTextInput
              id="legacy-email"
              label="Email"
              value={email}
              onChange={setEmail}
              disabled={busy}
            />
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-300">
                Date of birth (optional)
              </span>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                disabled={busy}
                className="block w-full rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-100"
              />
            </label>
            <LabeledTextInput
              id="legacy-external-id"
              label="Timely patient ID (optional)"
              value={legacyExternalId}
              onChange={setLegacyExternalId}
              disabled={busy}
            />
            {error ? (
              <p
                className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-300"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
              >
                {busy ? "Creating…" : "Create & continue"}
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200"
                onClick={() => setStep("search")}
              >
                Back to search
              </button>
            </div>
          </form>
        </FiCard>
      )}

      {step === "encounter" && patientId && !bookingContextLoading && (
        <>
          <FiCard className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Patient
                </p>
                <p className="text-sm font-medium text-slate-100">{patientLabel ?? patientId}</p>
              </div>
              <button
                type="button"
                className="text-sm text-cyan-300 hover:text-cyan-200"
                onClick={() => {
                  setStep("search");
                  setPatientId(null);
                  setPatientLabel(null);
                }}
              >
                Change patient
              </button>
            </div>

            <form className="space-y-4" onSubmit={(e) => void onSaveEncounter(e)}>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={isLegacyTimely}
                  onChange={(e) => setIsLegacyTimely(e.target.checked)}
                  disabled={busy}
                />
                Returning patient from Timely
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-300">Visit type</span>
                <select
                  value={encounterType}
                  onChange={(e) => setEncounterType(e.target.value as FollowUpEncounterType)}
                  disabled={busy}
                  className="block w-full rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-100"
                >
                  {ENCOUNTER_TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {FOLLOW_UP_ENCOUNTER_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-300">Visit reason</span>
                <input
                  value={visitReason}
                  onChange={(e) => setVisitReason(e.target.value)}
                  disabled={busy}
                  placeholder="e.g. 3-month post-op review"
                  className="block w-full rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-100"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-300">Quick clinical note</span>
                <textarea
                  value={clinicalNote}
                  onChange={(e) => setClinicalNote(e.target.value)}
                  disabled={busy}
                  rows={3}
                  className="block w-full rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-100"
                />
              </label>

              <LabeledTextInput
                id="treatment-update"
                label="Treatment update (optional)"
                value={treatmentUpdate}
                onChange={setTreatmentUpdate}
                disabled={busy}
              />

              <LabeledTextInput
                id="follow-up-plan"
                label="Follow-up plan (optional)"
                value={followUpPlan}
                onChange={setFollowUpPlan}
                disabled={busy}
              />

              {info ? (
                <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                  {info}
                </p>
              ) : null}
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
                  className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
                >
                  <Camera className="h-4 w-4" aria-hidden />
                  {busy
                    ? "Saving…"
                    : encounterType === "photos_only"
                      ? "Capture photos only"
                      : "Add today's follow-up"}
                </button>
                <Link
                  href={`${base}/patients/${encodeURIComponent(patientId)}`}
                  className="inline-flex items-center rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200"
                >
                  View profile
                </Link>
              </div>
            </form>
          </FiCard>

          <FollowUpEncounterAiReviewPanel tenantId={tenantId} patientId={patientId} />
        </>
      )}
    </div>
  );
}
