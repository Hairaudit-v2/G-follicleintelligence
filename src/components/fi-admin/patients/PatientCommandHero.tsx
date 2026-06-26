import Link from "next/link";
import { Camera, Upload, Brain, Activity, FlaskConical, ScanLine } from "lucide-react";

import type { PatientProfileFoundationData } from "@/src/lib/patients/patientProfileLoader";
import type { PatientDetailNextAppointment } from "@/src/lib/patients/patientDetailLoader";
import { derivePatientIdentityContact } from "@/src/lib/patients/patientIdentityContact";
import { PatientStatusBadge } from "@/src/components/fi/patients/PatientStatusBadge";
import { VoiceNoteEntryButton } from "@/src/components/fi/clinical-notes/VoiceNoteEntryButton";
import { buildPatientImagingCaptureHref } from "@/src/lib/patientImages/patientImagingCaptureRoutes";
import { bookingTypeLabel } from "@/src/lib/bookings/operatorBookingLabels";

function fmtAppt(appt: PatientDetailNextAppointment): string {
  try {
    return `${bookingTypeLabel(appt.bookingType)} · ${new Date(appt.startAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`;
  } catch {
    return appt.startAt;
  }
}

const chipBase =
  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors";
const chipNeutral = `${chipBase} bg-white/[0.06] text-slate-300 ring-1 ring-white/[0.08] hover:bg-white/[0.10]`;
const chipIndigo = `${chipBase} bg-indigo-950/70 text-indigo-300 ring-1 ring-indigo-500/30 hover:bg-indigo-900/70`;
const chipCyan = `${chipBase} bg-cyan-950/70 text-cyan-300 ring-1 ring-cyan-500/30 hover:bg-cyan-900/70`;

export function PatientCommandHero({
  tenantId,
  patientId,
  data,
  nextAppointment,
  treatmentPlanSummary,
  canCapturePhotos = false,
}: {
  tenantId: string;
  patientId: string;
  data: PatientProfileFoundationData;
  nextAppointment: PatientDetailNextAppointment | null;
  treatmentPlanSummary: string | null;
  canCapturePhotos?: boolean;
}) {
  const idc = derivePatientIdentityContact({
    personMetadata: data.person.metadata,
    patientMetadata: data.patient.metadata,
    preferredContactMethod: data.patient.preferred_contact_method,
    reminderConsent: data.patient.reminder_consent,
  });

  const base = `/fi-admin/${tenantId}/patients/${patientId}`;
  const takePhotoHref = buildPatientImagingCaptureHref(tenantId, patientId, "camera", "patient_profile");
  const uploadPhotoHref = buildPatientImagingCaptureHref(tenantId, patientId, "library", "patient_profile");

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0F1629]/90 p-5 shadow-xl shadow-black/50 backdrop-blur-md sm:p-6">
      {/* Identity + operational summary */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-[#F8FAFC] sm:text-2xl">{idc.fullName}</h1>
            <PatientStatusBadge status={data.patient.patient_status} />
          </div>
          {(idc.ageYears != null || idc.dateOfBirth) && (
            <p className="text-sm text-slate-400">
              {idc.ageYears != null ? `${idc.ageYears} yrs` : null}
              {idc.ageYears != null && idc.dateOfBirth ? " · " : null}
              {idc.dateOfBirth ? `DOB ${idc.dateOfBirth}` : null}
            </p>
          )}
          <p className="text-sm text-slate-400">
            {idc.primaryEmail ?? "No email"}&ensp;·&ensp;{idc.primaryPhone ?? "No phone"}
          </p>
          <p className="text-xs text-slate-500">
            Patient since{" "}
            <time dateTime={data.patient.created_at}>{data.patient.created_at.slice(0, 10)}</time>
          </p>
        </div>

        {/* Quick operational blurbs */}
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="sm:text-right">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-slate-500">Next appointment</p>
            <p className="mt-0.5 text-sm font-medium text-[#F8FAFC]">
              {nextAppointment ? fmtAppt(nextAppointment) : "No appointment scheduled"}
            </p>
          </div>
          <div className="sm:text-right">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-slate-500">Treatment plan</p>
            <p className="mt-0.5 max-w-xs text-sm text-slate-300">
              {treatmentPlanSummary ?? "Not documented yet"}
            </p>
          </div>
        </div>
      </div>

      {/* Grouped action strip */}
      <div className="mt-5 space-y-2.5 border-t border-white/[0.06] pt-4">
        {/* Clinical */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-20 shrink-0 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-slate-600">
            Clinical
          </span>
          <VoiceNoteEntryButton
            tenantId={tenantId}
            patientId={patientId}
            className="inline-flex items-center gap-1.5 rounded-md bg-violet-950/70 px-2.5 py-1.5 text-xs font-medium text-violet-300 ring-1 ring-violet-500/30 transition-colors hover:bg-violet-900/70"
          />
          <Link href={`${base}/blood-request`} className={chipNeutral}>
            <FlaskConical className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Request blood tests
          </Link>
          <Link href={`${base}/blood-results/new`} className={chipNeutral}>
            <Activity className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Upload blood results
          </Link>
        </div>

        {/* Imaging */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-20 shrink-0 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-slate-600">
            Imaging
          </span>
          <Link href={`${base}/imaging`} className={chipIndigo}>
            <ScanLine className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ImagingOS
          </Link>
          {canCapturePhotos && (
            <>
              <Link href={uploadPhotoHref} className={chipNeutral}>
                <Upload className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Upload photo
              </Link>
              <Link href={takePhotoHref} className={chipNeutral}>
                <Camera className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Take photo
              </Link>
            </>
          )}
        </div>

        {/* Intelligence */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-20 shrink-0 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-slate-600">
            Intelligence
          </span>
          <Link href={`${base}/twin`} className={chipCyan}>
            <Brain className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Patient Twin
          </Link>
          <Link href={`/fi-admin/${tenantId}/surgery-readiness`} className={chipNeutral}>
            Surgery readiness
          </Link>
        </div>
      </div>
    </div>
  );
}
