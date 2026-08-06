/**
 * FI-CALENDAR-CONVERSION-UX-1B — guided Patient → Clinic → Staff → Details → Create flow.
 */
"use client";

import { useEffect, useMemo, useId, useState } from "react";

import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { CrmShellClinicOption, CrmShellUserPickerOption } from "@/src/lib/crm/types";
import type { CalendarAppointmentCapability } from "@/src/lib/calendar/calendarAppointmentCapabilities";
import { calendarCapabilitiesFromSerialized } from "@/src/lib/calendar/calendarAppointmentCapabilities";
import {
  convertExternalCalendarEventRequest,
  createPatientFromGoogleHydrationRequest,
  linkCalendarOsPatientRequest,
  searchCalendarIdentityLinkRequest,
} from "@/lib/calendar/appointmentsApiClient";
import {
  EXTERNAL_CONVERSION_WIZARD_STEPS,
  EXTERNAL_IDENTITY_RESULT_LABELS,
  PATIENT_IDENTITY_ACTION_LABELS,
  applyStaffUnassigned,
  assessStaffClinicCompatibility,
  buildConversionSummary,
  listActiveTenantStaffForConversion,
  resolveConversionWizardPermissions,
  resolveExternalIdentityResultState,
  revalidateRoomForClinic,
  roomsForSelectedClinic,
  type ConversionRoomOption,
  type PatientIdentityAction,
} from "@/src/lib/calendar/externalEventConversionUx";
import {
  resolveConfirmedClinicId,
  suggestClinicFromGoogleLocation,
} from "@/src/lib/calendar/suggestClinicFromGoogleLocation";
import { normalizeCalendarTimezone } from "@/src/lib/calendar/calendarTimezone";
import { cn } from "@/lib/utils";

type IdentityHit = {
  kind: "patient" | "consultation" | "enquiry";
  id: string;
  displayName?: string | null;
  label?: string | null;
  patientId?: string | null;
  consultationId?: string | null;
  enquiryId?: string | null;
};

function formatLocalDateLabel(iso: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-AU", {
      timeZone: tz,
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function formatLocalTimeLabel(iso: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-AU", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return iso.slice(11, 16);
  }
}

function toLocalInputValue(iso: string, tz: string): string {
  try {
    const d = new Date(iso);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
  } catch {
    return iso.slice(0, 16);
  }
}

export function ExternalEventConversionWizard({
  tenantId,
  booking,
  clinics,
  staffDirectory,
  rooms = [],
  calendarTimezone,
  displayName,
  googleHydratedEmail,
  googleHydratedPhone,
  googleHydratedLocation,
  googleHydratedAppointmentType,
  identityState,
  identityKindLabel,
  identityStatusLabel,
  fiosAppointmentId,
  calendarCapabilities,
  allowClinicUnassigned = true,
  onClose,
  onConverted,
}: {
  tenantId: string;
  booking: FiBookingRow;
  clinics: CrmShellClinicOption[];
  staffDirectory: CrmShellUserPickerOption[];
  rooms?: ConversionRoomOption[];
  calendarTimezone?: string | null;
  displayName?: string | null;
  googleHydratedEmail?: string | null;
  googleHydratedPhone?: string | null;
  googleHydratedLocation?: string | null;
  googleHydratedAppointmentType?: string | null;
  identityState?: string | null;
  identityKindLabel?: string | null;
  identityStatusLabel?: string | null;
  fiosAppointmentId?: string | null;
  calendarCapabilities?: readonly CalendarAppointmentCapability[] | null;
  allowClinicUnassigned?: boolean;
  onClose: () => void;
  onConverted: () => void;
}) {
  const titleId = useId();
  const caps = useMemo(
    () => calendarCapabilitiesFromSerialized(calendarCapabilities),
    [calendarCapabilities]
  );
  const permissions = useMemo(() => resolveConversionWizardPermissions(caps), [caps]);

  const tz = normalizeCalendarTimezone(calendarTimezone ?? booking.timezone);
  const personName =
    displayName?.trim() || booking.title?.trim() || googleHydratedEmail?.trim() || "this person";

  const startMs = Date.parse(booking.start_at);
  const endMs = Date.parse(booking.end_at);
  const durationMin =
    Number.isFinite(startMs) && Number.isFinite(endMs)
      ? Math.max(5, Math.round((endMs - startMs) / 60000))
      : 30;

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [identityAction, setIdentityAction] = useState<PatientIdentityAction | null>(null);
  const [patientSearch, setPatientSearch] = useState("");
  const [hits, setHits] = useState<IdentityHit[]>([]);
  const [selectedHit, setSelectedHit] = useState<IdentityHit | null>(null);
  const [patientResolved, setPatientResolved] = useState(Boolean(booking.patient_id));
  const [linkedPatientId, setLinkedPatientId] = useState(booking.patient_id ?? "");
  const [linkedConsultationId, setLinkedConsultationId] = useState(
    typeof booking.metadata?.consultation_id === "string"
      ? booking.metadata.consultation_id
      : ""
  );
  const [searchDone, setSearchDone] = useState(false);

  const clinicSuggestion = useMemo(
    () =>
      suggestClinicFromGoogleLocation({
        googleLocation: googleHydratedLocation,
        clinics,
      }),
    [googleHydratedLocation, clinics]
  );

  const [clinicId, setClinicId] = useState("");
  const [clinicConfirmed, setClinicConfirmed] = useState(false);
  const [clinicUnassigned, setClinicUnassigned] = useState(false);

  const [staffId, setStaffId] = useState("");
  const [staffAssignLater, setStaffAssignLater] = useState(true);
  const [staffSearch, setStaffSearch] = useState("");
  const [crossClinicConfirmed, setCrossClinicConfirmed] = useState(false);

  const [roomId, setRoomId] = useState("");
  const [appointmentType, setAppointmentType] = useState(
    googleHydratedAppointmentType?.trim() || booking.booking_type || "consultation"
  );
  const [startLocal, setStartLocal] = useState(toLocalInputValue(booking.start_at, tz));
  const [duration, setDuration] = useState(String(durationMin));
  const [notes, setNotes] = useState(booking.description ?? "");

  const activeStaff = useMemo(
    () => listActiveTenantStaffForConversion(staffDirectory),
    [staffDirectory]
  );

  const filteredStaff = useMemo(() => {
    const q = staffSearch.trim().toLowerCase();
    if (!q) return activeStaff;
    return activeStaff.filter((s) => {
      const name = (s.full_name ?? "").toLowerCase();
      const role = (s.staff_role ?? "").toLowerCase();
      const email = (s.email ?? "").toLowerCase();
      return name.includes(q) || role.includes(q) || email.includes(q);
    });
  }, [activeStaff, staffSearch]);

  const clinicRooms = useMemo(
    () => roomsForSelectedClinic(rooms, clinicUnassigned ? null : clinicId),
    [rooms, clinicId, clinicUnassigned]
  );

  const identityResult = useMemo(
    () =>
      resolveExternalIdentityResultState({
        identityState,
        patientHitCount: hits.filter((h) => h.kind === "patient").length,
        consultationHitCount: hits.filter((h) => h.kind === "consultation").length,
        enquiryHitCount: hits.filter((h) => h.kind === "enquiry").length,
        hasVerifiedMatch: hits.length > 0,
      }),
    [identityState, hits]
  );

  useEffect(() => {
    if (clinicSuggestion.ok && !clinicId && !clinicUnassigned) {
      setClinicId(clinicSuggestion.suggestedClinicId);
      setClinicConfirmed(false);
    }
  }, [clinicSuggestion, clinicId, clinicUnassigned]);

  useEffect(() => {
    if (fiosAppointmentId) return;
    if (!permissions["patient.link"].allowed && !permissions["patient.create"].allowed) return;
    const q = patientSearch.trim();
    const handle = window.setTimeout(() => {
      void (async () => {
        const r = await searchCalendarIdentityLinkRequest({
          tenantId,
          eventId: booking.id,
          query: q,
        });
        if (!r.ok) {
          setSearchDone(true);
          return;
        }
        const next: IdentityHit[] = [
          ...r.consultations.map((c) => ({
            kind: "consultation" as const,
            id: c.id,
            displayName: c.displayName,
            label: c.label,
            consultationId: c.consultationId ?? c.id,
            enquiryId: c.enquiryId,
            patientId: c.patientId,
          })),
          ...r.patients.map((p) => ({
            kind: "patient" as const,
            id: p.id,
            displayName: p.displayName,
            patientId: p.patientId ?? p.id,
          })),
          ...r.enquiries.map((e) => ({
            kind: "enquiry" as const,
            id: e.id,
            displayName: e.displayName,
            enquiryId: e.enquiryId ?? e.id,
            patientId: e.patientId,
          })),
        ];
        setHits(next);
        setSearchDone(true);
      })();
    }, 200);
    return () => window.clearTimeout(handle);
  }, [patientSearch, tenantId, booking.id, fiosAppointmentId, permissions]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fieldClass =
    "mt-1 w-full rounded-md border border-white/[0.12] bg-white/[0.04] px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/30";
  const labelClass = "text-[10px] font-medium uppercase tracking-wide text-slate-500";
  const btnClass =
    "inline-flex w-full items-center justify-center rounded-md border border-white/[0.12] bg-white/[0.05] px-2 py-2 text-xs font-medium text-slate-100 transition hover:bg-white/[0.09] disabled:opacity-40";
  const primaryBtnClass =
    "inline-flex w-full items-center justify-center rounded-md border border-cyan-400/40 bg-cyan-950/50 px-2 py-2 text-xs font-semibold text-cyan-50 transition hover:bg-cyan-900/55 disabled:opacity-40";

  const selectedClinicName =
    clinics.find((c) => c.id === clinicId)?.display_name?.trim() || null;
  const selectedStaff = activeStaff.find((s) => s.id === staffId);
  const selectedStaffName =
    selectedStaff?.full_name?.trim() || selectedStaff?.email?.trim() || null;

  const dateLabel = formatLocalDateLabel(booking.start_at, tz);
  const timeRangeLabel = `${formatLocalTimeLabel(booking.start_at, tz)}–${formatLocalTimeLabel(booking.end_at, tz)}`;

  const summary = buildConversionSummary({
    patientDisplayName: personName,
    identityAction: identityAction ?? "create_new_patient",
    clinicName: selectedClinicName,
    clinicUnassigned,
    staffName: selectedStaffName,
    staffAssignLater: staffAssignLater || !staffId,
    appointmentType,
    dateLabel,
    timeRangeLabel,
  });

  function onClinicChange(nextId: string) {
    setClinicId(nextId);
    setClinicUnassigned(false);
    const suggestedId = clinicSuggestion.ok ? clinicSuggestion.suggestedClinicId : null;
    setClinicConfirmed(Boolean(nextId) && nextId !== suggestedId);
    setRoomId((prev) => revalidateRoomForClinic({ clinicId: nextId, roomId: prev, rooms }) ?? "");
    setCrossClinicConfirmed(false);
  }

  function onSelectAssignLater() {
    const next = applyStaffUnassigned(clinicUnassigned ? null : clinicId || null);
    setStaffId("");
    setStaffAssignLater(true);
    if (next.clinicId) setClinicId(next.clinicId);
    setCrossClinicConfirmed(false);
  }

  async function resolvePatientAndContinue() {
    setFeedback(null);
    if (!identityAction) {
      setFeedback("Choose how to add this person to FiOS.");
      return;
    }

    if (identityAction === "create_new_patient") {
      if (!permissions["patient.create"].allowed) {
        setFeedback(permissions["patient.create"].explanation);
        return;
      }
      setBusy(true);
      try {
        const r = await createPatientFromGoogleHydrationRequest({
          tenantId,
          eventId: booking.id,
          confirmed: true,
        });
        if (!r.ok) {
          setFeedback(r.error);
          return;
        }
        setLinkedPatientId(r.patientId);
        setPatientResolved(true);
        setStep(2);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!permissions["patient.link"].allowed) {
      setFeedback(permissions["patient.link"].explanation);
      return;
    }

    if (!selectedHit) {
      setFeedback("Select a match from the search results.");
      return;
    }

    setBusy(true);
    try {
      const promote =
        identityAction === "link_existing_enquiry_or_consultation" &&
        selectedHit.kind === "consultation";
      const r = await linkCalendarOsPatientRequest({
        tenantId,
        eventId: booking.id,
        patientId:
          identityAction === "link_existing_patient"
            ? (selectedHit.patientId ?? selectedHit.id)
            : (selectedHit.patientId ?? null),
        consultationId:
          selectedHit.kind === "consultation"
            ? (selectedHit.consultationId ?? selectedHit.id)
            : null,
        enquiryId: selectedHit.enquiryId ?? null,
        confirmed: true,
        promoteToPatient: promote,
      });
      if (!r.ok) {
        setFeedback(r.error);
        return;
      }
      if (selectedHit.patientId) setLinkedPatientId(selectedHit.patientId);
      if (selectedHit.consultationId) setLinkedConsultationId(selectedHit.consultationId);
      setPatientResolved(true);
      setStep(2);
    } finally {
      setBusy(false);
    }
  }

  function continueFromClinic() {
    setFeedback(null);
    if (!permissions["appointment.assign_clinic"].allowed && clinicId) {
      setFeedback(permissions["appointment.assign_clinic"].explanation);
      return;
    }
    const resolved = resolveConfirmedClinicId({
      selectedClinicId: clinicUnassigned ? null : clinicId,
      suggestedClinicId: clinicSuggestion.ok ? clinicSuggestion.suggestedClinicId : null,
      clinicConfirmed,
      allowUnassigned: allowClinicUnassigned,
    });
    if (!resolved.ok) {
      setFeedback(resolved.error);
      return;
    }
    setStep(3);
  }

  function continueFromStaffRoom() {
    setFeedback(null);
    if (staffId && !permissions["appointment.assign_staff"].allowed) {
      setFeedback(permissions["appointment.assign_staff"].explanation);
      return;
    }
    if (roomId && !permissions["appointment.assign_room"].allowed) {
      setFeedback(permissions["appointment.assign_room"].explanation);
      return;
    }
    const staffCheck = assessStaffClinicCompatibility({
      staffId: staffAssignLater ? null : staffId,
      clinicId: clinicUnassigned ? null : clinicId,
      staff: activeStaff,
      crossClinicConfirmed,
    });
    if (!staffCheck.ok) {
      setFeedback(staffCheck.error);
      return;
    }
    const validRoom = revalidateRoomForClinic({
      clinicId: clinicUnassigned ? null : clinicId,
      roomId,
      rooms,
    });
    if (roomId && !validRoom) {
      setFeedback("Selected room is not at this clinic. Choose another room or clear it.");
      setRoomId("");
      return;
    }
    setStep(4);
  }

  async function createFiosAppointment() {
    setFeedback(null);
    if (!permissions["appointment.convert_external"].allowed) {
      setFeedback(permissions["appointment.convert_external"].explanation);
      return;
    }
    if (summary.missingRequired.length > 0) {
      setFeedback(`Missing required: ${summary.missingRequired.join(", ")}`);
      return;
    }
    const clinicResolved = resolveConfirmedClinicId({
      selectedClinicId: clinicUnassigned ? null : clinicId,
      suggestedClinicId: clinicSuggestion.ok ? clinicSuggestion.suggestedClinicId : null,
      clinicConfirmed,
      allowUnassigned: allowClinicUnassigned,
    });
    if (!clinicResolved.ok) {
      setFeedback(clinicResolved.error);
      setStep(2);
      return;
    }

    setBusy(true);
    try {
      const r = await convertExternalCalendarEventRequest({
        tenantId,
        eventId: booking.id,
        clinicId: clinicResolved.clinicId,
        assignedStaffId: staffAssignLater ? null : staffId || null,
        roomId: roomId || null,
      });
      if (!r.ok) {
        setFeedback(r.error);
        return;
      }
      onConverted();
    } finally {
      setBusy(false);
    }
  }

  if (fiosAppointmentId) {
    return (
      <div
        className="space-y-3"
        data-testid="external-conversion-already-linked"
        role="status"
        aria-live="polite"
      >
        <p className="rounded-md border border-emerald-500/30 bg-emerald-950/35 px-2.5 py-2 text-[11px] text-emerald-100">
          Already linked to FiOS
        </p>
        <dl className="space-y-1.5 text-[11px] text-slate-300">
          <div>
            <dt className={labelClass}>Patient</dt>
            <dd>{personName}</dd>
          </div>
          <div>
            <dt className={labelClass}>Clinic</dt>
            <dd>
              {clinics.find((c) => c.id === booking.clinic_id)?.display_name ||
                (booking.clinic_id ? "Assigned" : "Unassigned")}
            </dd>
          </div>
          <div>
            <dt className={labelClass}>Staff</dt>
            <dd>
              {staffDirectory.find((s) => s.id === booking.assigned_staff_id)?.full_name ||
                (booking.assigned_staff_id ? "Assigned" : "Unassigned")}
            </dd>
          </div>
        </dl>
        <button type="button" className={btnClass} onClick={onClose}>
          Close
        </button>
      </div>
    );
  }

  return (
    <div
      className="space-y-3"
      data-testid="external-event-conversion-wizard"
      aria-labelledby={titleId}
    >
      <div>
        <h2 id={titleId} className="text-[13px] font-semibold text-slate-50">
          Convert Google event to FiOS
        </h2>
        <p className="mt-0.5 text-[11px] text-slate-400">
          Step {step} of {EXTERNAL_CONVERSION_WIZARD_STEPS.length} —{" "}
          {EXTERNAL_CONVERSION_WIZARD_STEPS[step - 1]?.label}
        </p>
        <ol className="mt-2 flex flex-wrap gap-1" aria-label="Conversion steps">
          {EXTERNAL_CONVERSION_WIZARD_STEPS.map((s) => (
            <li key={s.id}>
              <span
                className={cn(
                  "inline-flex rounded px-1.5 py-0.5 text-[10px]",
                  s.id === step
                    ? "bg-cyan-950/50 text-cyan-100"
                    : s.id < step
                      ? "text-slate-400"
                      : "text-slate-600"
                )}
                aria-current={s.id === step ? "step" : undefined}
              >
                {s.id}. {s.label}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[11px] text-slate-400">
        <p className="font-medium text-slate-200">{personName}</p>
        {googleHydratedEmail ? <p>{googleHydratedEmail}</p> : null}
        {googleHydratedPhone ? <p>{googleHydratedPhone}</p> : null}
        {googleHydratedLocation ? <p>Google location: {googleHydratedLocation}</p> : null}
      </div>

      {step === 1 ? (
        <section className="space-y-2" aria-labelledby="conv-patient-heading">
          <h3 id="conv-patient-heading" className="text-[12px] font-semibold text-slate-100">
            Add this person to FiOS
          </h3>

          <p
            className="rounded-md border border-white/[0.08] px-2 py-1.5 text-[11px] text-slate-300"
            role="status"
            data-testid="identity-result-state"
          >
            {searchDone
              ? EXTERNAL_IDENTITY_RESULT_LABELS[identityResult]
              : "Searching FiOS records…"}
          </p>

          <fieldset className="space-y-1.5">
            <legend className="sr-only">Patient options</legend>
            {(Object.keys(PATIENT_IDENTITY_ACTION_LABELS) as PatientIdentityAction[]).map(
              (action) => {
                const disabled =
                  (action === "create_new_patient" && !permissions["patient.create"].allowed) ||
                  (action !== "create_new_patient" && !permissions["patient.link"].allowed);
                return (
                  <label
                    key={action}
                    className={cn(
                      "flex cursor-pointer items-start gap-2 rounded-md border border-white/[0.08] px-2 py-2 text-[11px] text-slate-200",
                      identityAction === action && "border-cyan-400/35 bg-cyan-950/25",
                      disabled && "opacity-40"
                    )}
                  >
                    <input
                      type="radio"
                      name="identity-action"
                      className="mt-0.5"
                      checked={identityAction === action}
                      disabled={disabled}
                      onChange={() => setIdentityAction(action)}
                    />
                    <span>{PATIENT_IDENTITY_ACTION_LABELS[action]}</span>
                  </label>
                );
              }
            )}
          </fieldset>

          {identityAction === "create_new_patient" ? (
            <div className="space-y-2 rounded-md border border-cyan-500/25 bg-cyan-950/20 px-2.5 py-2">
              <p className="text-[11px] text-cyan-50">
                Create {personName} in FiOS using the Google contact details?
              </p>
              <dl className="space-y-1 text-[11px] text-slate-300">
                <div>
                  <dt className={labelClass}>Name</dt>
                  <dd>{personName}</dd>
                </div>
                <div>
                  <dt className={labelClass}>Email</dt>
                  <dd>{googleHydratedEmail?.trim() || "—"}</dd>
                </div>
                <div>
                  <dt className={labelClass}>Phone</dt>
                  <dd>{googleHydratedPhone?.trim() || "—"}</dd>
                </div>
              </dl>
              <button
                type="button"
                className={primaryBtnClass}
                disabled={busy || !permissions["patient.create"].allowed}
                onClick={() => void resolvePatientAndContinue()}
              >
                Create patient and continue
              </button>
              {!permissions["patient.create"].allowed ? (
                <p className="text-[10px] text-amber-200/90">
                  {permissions["patient.create"].explanation}
                </p>
              ) : null}
            </div>
          ) : null}

          {identityAction === "link_existing_patient" ||
          identityAction === "link_existing_enquiry_or_consultation" ? (
            <div className="space-y-2">
              <label className="block">
                <span className={labelClass}>Search</span>
                <input
                  className={fieldClass}
                  placeholder="Search by name, email, or phone…"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  aria-label="Search FiOS patients, consultations, and enquiries"
                />
              </label>
              {hits.length > 0 ? (
                <ul
                  className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-white/[0.06] p-1"
                  role="listbox"
                  aria-label="Possible matches"
                >
                  {hits
                    .filter((hit) =>
                      identityAction === "link_existing_patient"
                        ? hit.kind === "patient"
                        : hit.kind === "consultation" || hit.kind === "enquiry"
                    )
                    .map((hit) => {
                      const label =
                        hit.label?.trim() ||
                        hit.displayName?.trim() ||
                        (hit.kind === "consultation"
                          ? "Consultation"
                          : hit.kind === "enquiry"
                            ? "Enquiry"
                            : "Patient");
                      const selected =
                        selectedHit?.id === hit.id && selectedHit?.kind === hit.kind;
                      return (
                        <li key={`${hit.kind}:${hit.id}`}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={selected}
                            className={cn(
                              "w-full rounded px-2 py-1.5 text-left text-[11px] text-slate-200 hover:bg-white/[0.06]",
                              selected && "bg-cyan-950/40 text-cyan-100"
                            )}
                            onClick={() => setSelectedHit(hit)}
                          >
                            <span className="block font-medium">{label}</span>
                            <span className="text-[10px] text-slate-500">
                              {hit.kind === "patient"
                                ? "Patient"
                                : hit.kind === "consultation"
                                  ? "Consultation"
                                  : "Enquiry"}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                </ul>
              ) : searchDone ? (
                <p className="text-[11px] text-slate-500">No matches for this search.</p>
              ) : null}
              <button
                type="button"
                className={primaryBtnClass}
                disabled={busy || !selectedHit}
                onClick={() => void resolvePatientAndContinue()}
              >
                Link and continue
              </button>
            </div>
          ) : null}

          <details className="rounded-md border border-white/[0.06] px-2 py-1.5 text-[10px] text-slate-500">
            <summary className="cursor-pointer text-slate-400">Identity diagnostics</summary>
            <dl className="mt-1 space-y-0.5">
              <div>
                <dt className="inline">State: </dt>
                <dd className="inline">{identityState ?? "—"}</dd>
              </div>
              {identityKindLabel ? (
                <div>
                  <dt className="inline">Kind: </dt>
                  <dd className="inline">{identityKindLabel}</dd>
                </div>
              ) : null}
              {identityStatusLabel ? (
                <div>
                  <dt className="inline">Status: </dt>
                  <dd className="inline">{identityStatusLabel}</dd>
                </div>
              ) : null}
              {linkedPatientId ? (
                <div>
                  <dt className="inline">Patient id: </dt>
                  <dd className="inline font-mono">{linkedPatientId}</dd>
                </div>
              ) : null}
              {linkedConsultationId ? (
                <div>
                  <dt className="inline">Consultation id: </dt>
                  <dd className="inline font-mono">{linkedConsultationId}</dd>
                </div>
              ) : null}
            </dl>
          </details>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-2" aria-labelledby="conv-clinic-heading">
          <h3 id="conv-clinic-heading" className="text-[12px] font-semibold text-slate-100">
            Clinic
          </h3>
          {googleHydratedLocation ? (
            <p className="text-[11px] text-slate-400">
              Google location: <span className="text-slate-300">{googleHydratedLocation}</span>
            </p>
          ) : null}
          {clinicSuggestion.ok ? (
            <p
              className="rounded-md border border-violet-500/25 bg-violet-950/30 px-2 py-1.5 text-[11px] text-violet-100"
              data-testid="clinic-suggestion-banner"
            >
              Suggested FiOS clinic:{" "}
              <span className="font-medium">{clinicSuggestion.suggestedClinicName}</span>
              <span className="mt-0.5 block text-[10px] text-violet-200/80">
                {clinicSuggestion.suggestionLabel}
              </span>
            </p>
          ) : null}
          <label className="block">
            <span className={labelClass}>FiOS clinic</span>
            <select
              className={fieldClass}
              value={clinicUnassigned ? "" : clinicId}
              disabled={!permissions["appointment.assign_clinic"].allowed}
              onChange={(e) => {
                if (!e.target.value) return;
                onClinicChange(e.target.value);
              }}
            >
              <option value="">Select clinic…</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name}
                </option>
              ))}
            </select>
          </label>
          {clinicSuggestion.ok && clinicId === clinicSuggestion.suggestedClinicId ? (
            <label className="flex items-center gap-2 text-[11px] text-slate-300">
              <input
                type="checkbox"
                checked={clinicConfirmed}
                onChange={(e) => setClinicConfirmed(e.target.checked)}
              />
              Confirm clinic assignment (Google location is not the FiOS clinic)
            </label>
          ) : null}
          {allowClinicUnassigned ? (
            <label className="flex items-center gap-2 text-[11px] text-slate-300">
              <input
                type="checkbox"
                checked={clinicUnassigned}
                onChange={(e) => {
                  setClinicUnassigned(e.target.checked);
                  if (e.target.checked) {
                    setClinicId("");
                    setClinicConfirmed(false);
                    setRoomId("");
                  }
                }}
              />
              Clinic unassigned
            </label>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={btnClass} disabled={busy} onClick={() => setStep(1)}>
              Back
            </button>
            <button
              type="button"
              className={primaryBtnClass}
              disabled={busy}
              onClick={continueFromClinic}
            >
              Continue
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-2" aria-labelledby="conv-staff-heading">
          <h3 id="conv-staff-heading" className="text-[12px] font-semibold text-slate-100">
            Staff and room
          </h3>
          <label className="block">
            <span className={labelClass}>Assigned staff</span>
            <input
              className={fieldClass}
              placeholder="Search active staff…"
              value={staffSearch}
              onChange={(e) => setStaffSearch(e.target.value)}
              aria-label="Search staff"
            />
          </label>
          <ul
            className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-white/[0.06] p-1"
            role="listbox"
            aria-label="Staff"
          >
            <li>
              <button
                type="button"
                role="option"
                aria-selected={staffAssignLater}
                className={cn(
                  "w-full rounded px-2 py-1.5 text-left text-[11px] text-slate-200 hover:bg-white/[0.06]",
                  staffAssignLater && "bg-cyan-950/40 text-cyan-100"
                )}
                onClick={onSelectAssignLater}
              >
                Assign later
                <span className="mt-0.5 block text-[10px] text-slate-500">
                  Clinician unassigned — clinic stays set
                </span>
              </button>
            </li>
            {filteredStaff.map((s) => {
              const name = s.full_name?.trim() || s.email?.trim() || s.id.slice(0, 8);
              const selected = !staffAssignLater && staffId === s.id;
              const compat = assessStaffClinicCompatibility({
                staffId: s.id,
                clinicId: clinicUnassigned ? null : clinicId,
                staff: activeStaff,
                crossClinicConfirmed: true,
              });
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={!permissions["appointment.assign_staff"].allowed}
                    className={cn(
                      "w-full rounded px-2 py-1.5 text-left text-[11px] text-slate-200 hover:bg-white/[0.06] disabled:opacity-40",
                      selected && "bg-cyan-950/40 text-cyan-100"
                    )}
                    onClick={() => {
                      setStaffId(s.id);
                      setStaffAssignLater(false);
                      setCrossClinicConfirmed(false);
                    }}
                  >
                    <span className="block font-medium">{name}</span>
                    <span className="text-[10px] text-slate-500">
                      {s.staff_role?.trim() || "Staff"}
                      {compat.ok && compat.status === "confirmed_cross_clinic"
                        ? " · different usual clinic"
                        : " · clinic compatible"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {staffId && !staffAssignLater
            ? (() => {
                const check = assessStaffClinicCompatibility({
                  staffId,
                  clinicId: clinicUnassigned ? null : clinicId,
                  staff: activeStaff,
                  crossClinicConfirmed,
                });
                if (check.ok || !check.requiresConfirmation) return null;
                return (
                  <label className="flex items-center gap-2 text-[11px] text-amber-100">
                    <input
                      type="checkbox"
                      checked={crossClinicConfirmed}
                      onChange={(e) => setCrossClinicConfirmed(e.target.checked)}
                    />
                    Confirm cross-clinic staff assignment
                  </label>
                );
              })()
            : null}

          {clinicRooms.length > 0 || rooms.length > 0 ? (
            <label className="block">
              <span className={labelClass}>Room (optional)</span>
              <select
                className={fieldClass}
                value={roomId}
                disabled={
                  !permissions["appointment.assign_room"].allowed || clinicUnassigned || !clinicId
                }
                onChange={(e) => setRoomId(e.target.value)}
              >
                <option value="">No room</option>
                {clinicRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-[10px] text-slate-500">
              Room can be assigned after conversion when clinic rooms are available.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={btnClass} disabled={busy} onClick={() => setStep(2)}>
              Back
            </button>
            <button
              type="button"
              className={primaryBtnClass}
              disabled={busy}
              onClick={continueFromStaffRoom}
            >
              Continue
            </button>
          </div>
        </section>
      ) : null}

      {step === 4 ? (
        <section className="space-y-2" aria-labelledby="conv-details-heading">
          <h3 id="conv-details-heading" className="text-[12px] font-semibold text-slate-100">
            Appointment details
          </h3>
          <label className="block">
            <span className={labelClass}>Appointment type</span>
            <input
              className={fieldClass}
              value={appointmentType}
              onChange={(e) => setAppointmentType(e.target.value)}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Date &amp; start time</span>
            <input
              type="datetime-local"
              className={fieldClass}
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Duration (minutes)</span>
            <input
              type="number"
              min={5}
              className={fieldClass}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </label>
          <dl className="space-y-1 text-[11px] text-slate-400">
            <div>
              <dt className={labelClass}>Clinic</dt>
              <dd className="text-slate-200">
                {clinicUnassigned ? "Unassigned" : selectedClinicName || "—"}
              </dd>
            </div>
            <div>
              <dt className={labelClass}>Assigned staff</dt>
              <dd className="text-slate-200">
                {staffAssignLater || !staffId ? "Assign later" : selectedStaffName || "—"}
              </dd>
            </div>
            <div>
              <dt className={labelClass}>Room</dt>
              <dd className="text-slate-200">
                {clinicRooms.find((r) => r.id === roomId)?.name || "None"}
              </dd>
            </div>
          </dl>
          <label className="block">
            <span className={labelClass}>Notes</span>
            <textarea
              className={cn(fieldClass, "min-h-[64px]")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={btnClass} disabled={busy} onClick={() => setStep(3)}>
              Back
            </button>
            <button
              type="button"
              className={primaryBtnClass}
              disabled={busy}
              onClick={() => setStep(5)}
            >
              Review
            </button>
          </div>
        </section>
      ) : null}

      {step === 5 ? (
        <section className="space-y-2" aria-labelledby="conv-review-heading">
          <h3 id="conv-review-heading" className="text-[12px] font-semibold text-slate-100">
            Review and create
          </h3>
          <dl
            className="space-y-2 rounded-md border border-white/[0.08] px-2.5 py-2 text-[11px] text-slate-300"
            data-testid="conversion-summary"
          >
            <div>
              <dt className={labelClass}>Patient</dt>
              <dd className="text-slate-100">{summary.patient}</dd>
            </div>
            <div>
              <dt className={labelClass}>Identity action</dt>
              <dd>{summary.identityAction}</dd>
            </div>
            <div>
              <dt className={labelClass}>Clinic</dt>
              <dd>{summary.clinic}</dd>
            </div>
            <div>
              <dt className={labelClass}>Staff</dt>
              <dd>{summary.staff}</dd>
            </div>
            <div>
              <dt className={labelClass}>Appointment</dt>
              <dd>
                {summary.appointment.type}
                <br />
                {summary.appointment.date}
                <br />
                {summary.appointment.timeRange}
              </dd>
            </div>
            <div>
              <dt className={labelClass}>Source</dt>
              <dd>{summary.source}</dd>
            </div>
          </dl>
          {summary.missingRequired.length > 0 ? (
            <p
              className="rounded-md border border-amber-500/30 bg-amber-950/35 px-2 py-1.5 text-[11px] text-amber-100"
              role="alert"
            >
              Missing required: {summary.missingRequired.join(", ")}
            </p>
          ) : null}
          {!permissions["appointment.convert_external"].allowed ? (
            <p className="text-[11px] text-amber-200" role="alert">
              {permissions["appointment.convert_external"].explanation}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={btnClass} disabled={busy} onClick={() => setStep(4)}>
              Back
            </button>
            <button
              type="button"
              className={primaryBtnClass}
              disabled={
                busy ||
                !permissions["appointment.convert_external"].allowed ||
                summary.missingRequired.length > 0
              }
              onClick={() => void createFiosAppointment()}
            >
              Create FiOS appointment
            </button>
          </div>
          {patientResolved ? (
            <p className="text-[10px] text-slate-500">
              Patient link prepared — conversion is idempotent.
            </p>
          ) : null}
        </section>
      ) : null}

      {feedback ? (
        <p className="text-xs text-red-300" role="alert">
          {feedback}
        </p>
      ) : null}

      <button type="button" className={btnClass} onClick={onClose}>
        Cancel
      </button>
    </div>
  );
}
