"use client";

import Link from "next/link";
import { BookingTypeBadge } from "@/src/components/fi/bookings/operator/BookingTypeBadge";
import { BookingStatusBadge } from "@/src/components/fi/bookings/operator/BookingStatusBadge";
import { bookingTypeLabel } from "@/src/lib/bookings/operatorBookingLabels";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { leadTitleFromRow } from "@/src/lib/crm/crmLeadListDisplay";
import type { FiCrmLeadRow } from "@/src/lib/crm/types";
import { appointmentCardClass } from "./appointmentSharedStyles";

export function AppointmentHeader({
  tenantId,
  booking,
  lead,
  personName,
  clinicalScalesSummary,
}: {
  tenantId: string;
  booking: FiBookingRow;
  lead: FiCrmLeadRow | null;
  personName: string | null;
  clinicalScalesSummary: string | null;
}) {
  const title = booking.title?.trim() || "Untitled appointment";

  return (
    <section className={appointmentCardClass}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-medium text-slate-100">{title}</h3>
          {personName ? <p className="mt-1 text-sm text-slate-200">{personName}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <BookingTypeBadge type={booking.booking_type} />
          <BookingStatusBadge status={booking.booking_status} />
        </div>
      </div>
      <p className="mt-1 text-xs text-gray-500">{bookingTypeLabel(booking.booking_type)}</p>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {lead ? (
          <Link
            href={`/fi-admin/${tenantId}/crm/leads/${lead.id}`}
            className="font-medium text-blue-300 hover:underline"
          >
            Lead: {leadTitleFromRow(lead.summary, lead.id)}
          </Link>
        ) : null}
        {booking.patient_id ? (
          <>
            <Link href={`/fi-admin/${tenantId}/patients`} className="text-blue-300 hover:underline">
              Patient directory
            </Link>
            <Link
              href={`/fi-admin/${tenantId}/patients/${booking.patient_id}`}
              className="font-medium text-blue-300 hover:underline"
            >
              Patient record →
            </Link>
          </>
        ) : lead && !lead.patient_id ? (
          <span className="text-gray-500">No patient linked yet</span>
        ) : null}
        {booking.case_id ? (
          <Link
            href={`/fi-admin/${tenantId}/cases/${booking.case_id}`}
            className="text-blue-300 hover:underline"
          >
            Case →
          </Link>
        ) : null}
      </div>

      {clinicalScalesSummary ? (
        <p className="mt-2 text-xs text-slate-200">{clinicalScalesSummary}</p>
      ) : (
        <p className="mt-2 text-xs text-gray-500">No Norwood / hair summary on file yet.</p>
      )}
    </section>
  );
}
