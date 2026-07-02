"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { bookingStatusLabel, bookingTypeLabel } from "@/src/lib/bookings/operatorBookingLabels";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { ClinicalStaffingSummaryDto } from "@/src/lib/workforce-os/clinicalStaffingSummary.types";
import { calendarBookingTypeAccentClass } from "@/src/lib/fiOs/staffUxPresentation";

export function AppointmentOperationalSummary({
  tenantId,
  booking,
  personName,
  clinicalStaffing,
  journeyStateLabel,
  readinessPercent,
  blockerLabel,
}: {
  tenantId: string;
  booking: FiBookingRow;
  personName: string | null;
  clinicalStaffing?: ClinicalStaffingSummaryDto | null;
  journeyStateLabel?: string | null;
  readinessPercent?: number | null;
  blockerLabel?: string | null;
}) {
  const base = `/fi-admin/${tenantId}`;
  const isSurgery = booking.booking_type.trim().toLowerCase() === "surgery";
  const staffingReady = clinicalStaffing?.ready === true;
  const staffingBlocked = clinicalStaffing?.displayStatus === "blocked";
  const staffingHeadline =
    clinicalStaffing?.warnings[0] ??
    (staffingReady
      ? "Clinical team ready"
      : staffingBlocked
        ? "Team assignment blocked"
        : clinicalStaffing?.missingRoles[0]
          ? `Missing ${clinicalStaffing.missingRoles[0].role}`
          : "Review team assignment");

  const nextHref =
    staffingBlocked || blockerLabel
      ? `${base}/calendar?booking=${booking.id}`
      : isSurgery
        ? `${base}/surgery-readiness`
        : booking.patient_id
          ? `${base}/patients/${booking.patient_id}`
          : `${base}/calendar?booking=${booking.id}`;

  const nextLabel = blockerLabel
    ? "Resolve blocker"
    : staffingBlocked
      ? "Assign clinical team"
      : isSurgery
        ? "Review surgery readiness"
        : "Open patient profile";

  return (
    <section
      className={cn(
        "rounded-xl border border-l-4 p-4 sm:p-5",
        calendarBookingTypeAccentClass(booking.booking_type)
      )}
      aria-label="Appointment overview"
    >
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
        At a glance
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-slate-500">Patient</p>
          <p className="mt-0.5 text-lg font-semibold text-slate-50">
            {personName?.trim() || "No patient linked"}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Procedure</p>
          <p className="mt-0.5 text-lg font-semibold text-slate-50">
            {bookingTypeLabel(booking.booking_type)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Status</p>
          <p className="mt-0.5 text-base font-medium text-slate-200">
            {bookingStatusLabel(booking.booking_status)}
          </p>
        </div>
        {journeyStateLabel ? (
          <div>
            <p className="text-xs text-slate-500">Journey stage</p>
            <p className="mt-0.5 text-base font-medium text-violet-200">{journeyStateLabel}</p>
          </div>
        ) : null}
        {readinessPercent != null && isSurgery ? (
          <div>
            <p className="text-xs text-slate-500">Readiness</p>
            <p
              className={cn(
                "mt-0.5 text-2xl font-bold tabular-nums",
                readinessPercent >= 85
                  ? "text-emerald-300"
                  : readinessPercent >= 60
                    ? "text-amber-300"
                    : "text-rose-300"
              )}
            >
              {readinessPercent}%
            </p>
          </div>
        ) : null}
        {clinicalStaffing ? (
          <div>
            <p className="text-xs text-slate-500">Team staffing</p>
            <p
              className={cn(
                "mt-0.5 text-base font-medium",
                staffingReady ? "text-emerald-300" : staffingBlocked ? "text-rose-300" : "text-amber-300"
              )}
            >
              {staffingHeadline}
            </p>
          </div>
        ) : null}
      </div>

      {blockerLabel ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" aria-hidden />
          <p className="text-sm text-rose-100">{blockerLabel}</p>
        </div>
      ) : null}

      <Link
        href={nextHref}
        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
      >
        {nextLabel}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </section>
  );
}