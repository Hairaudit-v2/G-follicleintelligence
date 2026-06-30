"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAppointmentSlideOverOptional } from "@/src/components/fi/appointments/AppointmentSlideOver";
import { buildAppointmentCreatePrefillFromPatient } from "@/src/lib/bookings/bookingPatientPrefillShared";
import {
  deriveRecommendedBookingTypeForPatient,
  formatUpcomingBookingLabel,
  pickNextUpcomingPatientBooking,
} from "@/src/lib/bookings/bookingPatientSummary";
import { buildBookAppointmentFromPatientHref } from "@/src/lib/bookings/appointmentsQuery";
import { bookingTypeLabel } from "@/src/lib/bookings/operatorBookingLabels";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { FiCrmLeadRow } from "@/src/lib/crm/types";
import { crmLeadCardClass } from "@/src/components/fi/crm/shared/crmSharedStyles";

export function PatientBookNextAppointmentCard({
  tenantId,
  patientId,
  personId,
  displayName,
  primaryLead,
  bookings,
  groupingNowIso,
  compact,
}: {
  tenantId: string;
  patientId: string;
  personId: string;
  displayName?: string | null;
  primaryLead?: FiCrmLeadRow | null;
  bookings: FiBookingRow[];
  groupingNowIso: string;
  compact?: boolean;
}) {
  const slide = useAppointmentSlideOverOptional();
  const now = useMemo(() => new Date(groupingNowIso), [groupingNowIso]);
  const nextUpcoming = useMemo(() => pickNextUpcomingPatientBooking(bookings, now), [bookings, now]);
  const recommended = useMemo(
    () => deriveRecommendedBookingTypeForPatient({ bookings, primaryLead: primaryLead ?? null }),
    [bookings, primaryLead]
  );

  function openCreate() {
    const prefill = buildAppointmentCreatePrefillFromPatient({
      patientId,
      personId,
      displayName,
      primaryLead: primaryLead ?? null,
      bookings,
      bookingType: recommended.bookingType,
      clinicId: primaryLead?.clinic_id ?? null,
      assignedUserId: primaryLead?.primary_owner_user_id ?? null,
    });
    if (slide) {
      slide.openCreateAppointment(prefill);
      return;
    }
    window.location.href = buildBookAppointmentFromPatientHref(
      tenantId,
      patientId,
      recommended.bookingType,
      primaryLead?.id ?? null
    );
  }

  return (
    <section className={crmLeadCardClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={`font-semibold text-slate-100 ${compact ? "text-xs uppercase tracking-wide" : "text-sm"}`}>
            Book next appointment
          </h2>
          {!compact ? (
            <p className="mt-1 text-xs text-slate-400">
              Opens the appointment slide-over with patient, person, and lead context pre-filled.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className={`shrink-0 rounded bg-gray-900 font-medium text-white hover:bg-gray-800 ${
            compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"
          }`}
          onClick={openCreate}
        >
          Book appointment
        </button>
      </div>

      <dl className={`grid gap-2 text-sm ${compact ? "mt-2 sm:grid-cols-1" : "mt-3 sm:grid-cols-2"}`}>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Recommended type</dt>
          <dd className="font-medium text-slate-100">{bookingTypeLabel(recommended.bookingType)}</dd>
          {!compact ? <dd className="text-xs text-gray-500">{recommended.reason}</dd> : null}
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Next scheduled</dt>
          <dd className="text-slate-100">
            {nextUpcoming ? formatUpcomingBookingLabel(nextUpcoming) : "No upcoming visits"}
          </dd>
        </div>
      </dl>

      {!slide && !compact ? (
        <p className="mt-2 text-xs text-gray-500">
          <Link
            href={buildBookAppointmentFromPatientHref(
              tenantId,
              patientId,
              recommended.bookingType,
              primaryLead?.id ?? null
            )}
            className="text-blue-300 hover:underline"
          >
            Open in full calendar
          </Link>{" "}
          if the slide-over is unavailable on this page.
        </p>
      ) : null}
    </section>
  );
}
