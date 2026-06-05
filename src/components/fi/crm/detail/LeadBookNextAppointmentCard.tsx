"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAppointmentSlideOverOptional } from "@/src/components/fi/appointments/AppointmentSlideOver";
import { buildAppointmentCreatePrefillFromLead } from "@/src/lib/bookings/bookingLeadPrefillShared";
import {
  deriveRecommendedBookingTypeForLead,
  formatUpcomingBookingLabel,
  pickNextUpcomingLeadBooking,
} from "@/src/lib/bookings/bookingLeadSummary";
import { buildBookAppointmentFromLeadHref } from "@/src/lib/bookings/appointmentsQuery";
import { bookingTypeLabel } from "@/src/lib/bookings/operatorBookingLabels";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { FiCrmLeadRow } from "@/src/lib/crm/types";
import { crmLeadCardClass } from "../shared";

export function LeadBookNextAppointmentCard({
  tenantId,
  lead,
  bookings,
  groupingNowIso,
}: {
  tenantId: string;
  lead: FiCrmLeadRow;
  bookings: FiBookingRow[];
  groupingNowIso: string;
}) {
  const slide = useAppointmentSlideOverOptional();
  const now = useMemo(() => new Date(groupingNowIso), [groupingNowIso]);
  const nextUpcoming = useMemo(() => pickNextUpcomingLeadBooking(bookings, now), [bookings, now]);
  const recommended = useMemo(
    () => deriveRecommendedBookingTypeForLead({ lead, bookings, now }),
    [lead, bookings, now]
  );

  function openCreate() {
    const prefill = buildAppointmentCreatePrefillFromLead({
      lead,
      bookings,
      bookingType: recommended.bookingType,
    });
    if (slide) {
      slide.openCreateAppointment(prefill);
      return;
    }
    window.location.href = buildBookAppointmentFromLeadHref(tenantId, lead.id, recommended.bookingType);
  }

  return (
    <section className={crmLeadCardClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Book next appointment</h2>
          <p className="mt-1 text-xs text-gray-600">
            Opens the appointment slide-over with lead, patient, and clinic context pre-filled.
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
          onClick={openCreate}
        >
          Book next appointment
        </button>
      </div>

      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Recommended type</dt>
          <dd className="font-medium text-gray-900">{bookingTypeLabel(recommended.bookingType)}</dd>
          <dd className="text-xs text-gray-500">{recommended.reason}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Next scheduled</dt>
          <dd className="text-gray-900">
            {nextUpcoming ? formatUpcomingBookingLabel(nextUpcoming) : "No upcoming visits"}
          </dd>
        </div>
      </dl>

      {!slide ? (
        <p className="mt-2 text-xs text-gray-500">
          <Link
            href={buildBookAppointmentFromLeadHref(tenantId, lead.id, recommended.bookingType)}
            className="text-blue-600 hover:underline"
          >
            Open in full calendar
          </Link>{" "}
          if the slide-over is unavailable on this page.
        </p>
      ) : null}
    </section>
  );
}
