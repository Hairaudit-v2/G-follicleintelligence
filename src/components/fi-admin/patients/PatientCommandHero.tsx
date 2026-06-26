import Link from "next/link";
import { Brain, Activity, FlaskConical, ScanLine } from "lucide-react";

import type { PatientProfileFoundationData } from "@/src/lib/patients/patientProfileLoader";
import type { PatientDetailNextAppointment } from "@/src/lib/patients/patientDetailLoader";
import { derivePatientIdentityContact } from "@/src/lib/patients/patientIdentityContact";
import { PatientStatusBadge } from "@/src/components/fi/patients/PatientStatusBadge";
import { VoiceNoteEntryButton } from "@/src/components/fi/clinical-notes/VoiceNoteEntryButton";
import { StartCaptureProtocolButton } from "@/src/components/fi/vie/StartCaptureProtocolButton";
import { PatientImagingCompletenessSummary } from "@/src/components/fi/vie/PatientImagingCompletenessSummary";
import { bookingTypeLabel } from "@/src/lib/bookings/operatorBookingLabels";
import type { PatientJourneyStatus } from "@/src/lib/fiAdmin/patientJourneyStatus";
import { pwsLabel } from "./patientWorkspaceStyles";

const JOURNEY_TONE_CLASSES: Record<PatientJourneyStatus["tone"], string> = {
  neutral: "border-slate-700/40 bg-slate-800/60 text-slate-400",
  info: "border-indigo-500/25 bg-indigo-950/60 text-indigo-300",
  warning: "border-amber-500/25 bg-amber-950/60 text-amber-300",
  success: "border-emerald-500/25 bg-emerald-950/60 text-emerald-300",
};

function fmtAppt(appt: PatientDetailNextAppointment): string {
  try {
    return `${bookingTypeLabel(appt.bookingType)} · ${new Date(appt.startAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`;
  } catch {
    return appt.startAt;
  }
}

const chip =
  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors";
const chipGhost = `${chip} bg-white/[0.05] text-slate-400 ring-1 ring-white/[0.08] hover:bg-white/[0.09] hover:text-slate-200`;
const chipIndigo = `${chip} bg-indigo-950/60 text-indigo-300 ring-1 ring-indigo-500/25 hover:bg-indigo-900/70`;
const chipViolet = `${chip} bg-violet-950/60 text-violet-300 ring-1 ring-violet-500/25 hover:bg-violet-900/70`;
const chipCyanPrimary =
  `${chip} bg-cyan-600/20 text-cyan-300 ring-1 ring-cyan-400/40 hover:bg-cyan-600/30 font-semibold`;

export function PatientCommandHero({
  tenantId,
  patientId,
  data,
  nextAppointment,
  treatmentPlanSummary,
  journeyStatus,
  canCapturePhotos = false,
}: {
  tenantId: string;
  patientId: string;
  data: PatientProfileFoundationData;
  nextAppointment: PatientDetailNextAppointment | null;
  treatmentPlanSummary: string | null;
  journeyStatus: PatientJourneyStatus;
  canCapturePhotos?: boolean;
}) {
  const idc = derivePatientIdentityContact({
    personMetadata: data.person.metadata,
    patientMetadata: data.patient.metadata,
    preferredContactMethod: data.patient.preferred_contact_method,
    reminderConsent: data.patient.reminder_consent,
  });

  const base = `/fi-admin/${tenantId}/patients/${patientId}`;

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0F1629]/90 p-5 shadow-xl shadow-black/50 backdrop-blur-md sm:p-6">

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-[#F8FAFC] sm:text-2xl">
              {idc.fullName}
            </h1>
            <PatientStatusBadge status={data.patient.patient_status} />
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold ${JOURNEY_TONE_CLASSES[journeyStatus.tone]}`}
            >
              {journeyStatus.label}
            </span>
          </div>
          {(idc.ageYears != null || idc.dateOfBirth) && (
            <p className="text-sm text-slate-400">
              {idc.ageYears != null ? `${idc.ageYears} yrs` : null}
              {idc.ageYears != null && idc.dateOfBirth ? " · " : null}
              {idc.dateOfBirth ? `DOB ${idc.dateOfBirth}` : null}
            </p>
          )}
          <p className="text-sm text-slate-400">
            {idc.primaryEmail ?? "No email on record"}&ensp;·&ensp;
            {idc.primaryPhone ?? "No phone on record"}
          </p>
          <p className="text-xs text-slate-600">
            Patient since{" "}
            <time dateTime={data.patient.created_at}>{data.patient.created_at.slice(0, 10)}</time>
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <div className="sm:text-right">
            <p className={pwsLabel}>Next appointment</p>
            <p className="mt-0.5 text-sm font-medium text-[#F8FAFC]">
              {nextAppointment ? fmtAppt(nextAppointment) : "No appointment scheduled yet."}
            </p>
          </div>
          <div className="sm:text-right">
            <p className={pwsLabel}>Treatment plan</p>
            <p className="mt-0.5 max-w-xs text-sm text-slate-400">
              {treatmentPlanSummary ?? "Not documented yet."}
            </p>
          </div>
          <div className="w-full min-w-[12rem] sm:w-56">
            <PatientImagingCompletenessSummary completeness={data.vieImagingCompleteness} variant="dark" />
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-2 border-t border-white/[0.06] pt-4">

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-[4.5rem] shrink-0 text-[0.55rem] font-semibold uppercase tracking-[0.15em] text-slate-600">
            Clinical
          </span>
          <VoiceNoteEntryButton
            tenantId={tenantId}
            patientId={patientId}
            className={chipViolet}
          />
          <StartCaptureProtocolButton
            tenantId={tenantId}
            patientId={patientId}
            canCapture={canCapturePhotos}
            className={chipGhost}
          />
          <Link href={`${base}/blood-request`} className={chipGhost}>
            <FlaskConical className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Request blood tests
          </Link>
          <Link href={`${base}/blood-results/new`} className={chipGhost}>
            <Activity className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Upload blood results
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-[4.5rem] shrink-0 text-[0.55rem] font-semibold uppercase tracking-[0.15em] text-slate-600">
            Imaging
          </span>
          <Link href={`${base}/imaging`} className={chipIndigo}>
            <ScanLine className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ImagingOS
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-[4.5rem] shrink-0 text-[0.55rem] font-semibold uppercase tracking-[0.15em] text-slate-600">
            Intelligence
          </span>
          <Link href={`${base}/twin`} className={chipCyanPrimary}>
            <Brain className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Patient Twin
          </Link>
          <Link href={`/fi-admin/${tenantId}/surgery-readiness`} className={chipGhost}>
            Surgery readiness
          </Link>
        </div>

      </div>
    </div>
  );
}
