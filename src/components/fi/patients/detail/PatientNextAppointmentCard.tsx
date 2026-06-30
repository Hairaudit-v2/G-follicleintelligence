"use client";

import Link from "next/link";
import { useAppointmentSlideOverOptional } from "@/src/components/fi/appointments/AppointmentSlideOver";
import { bookingTypeLabel } from "@/src/lib/bookings/operatorBookingLabels";
import type { PatientDetailPayload } from "@/src/lib/patients/patientDetailLoader";
import { PatientBookNextAppointmentCard } from "../shared/PatientBookNextAppointmentCard";
import { crmLeadCardClass } from "@/src/components/fi/crm/shared/crmSharedStyles";

function fmtWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function PatientNextAppointmentCard({
  tenantId,
  patientId,
  payload,
}: {
  tenantId: string;
  patientId: string;
  payload: Pick<
    PatientDetailPayload,
    | "nextAppointment"
    | "treatmentPlanSummary"
    | "lifetimeValueLabel"
    | "personId"
    | "displayName"
    | "primaryLead"
    | "bookingRows"
    | "groupingNowIso"
  >;
}) {
  const slide = useAppointmentSlideOverOptional();
  const { nextAppointment, treatmentPlanSummary, lifetimeValueLabel } = payload;

  return (
    <div className="space-y-4">
      <PatientBookNextAppointmentCard
        tenantId={tenantId}
        patientId={patientId}
        personId={payload.personId}
        displayName={payload.displayName}
        primaryLead={payload.primaryLead}
        bookings={payload.bookingRows}
        groupingNowIso={payload.groupingNowIso}
      />

      <section className={crmLeadCardClass}>
        <h2 className="text-sm font-semibold text-slate-100">Next appointment & plan</h2>
        <p className="mt-1 text-xs text-slate-400">Operational summary for front-desk and clinical coordinators.</p>

        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Next appointment</dt>
            <dd className="mt-1 font-medium text-slate-100">
              {nextAppointment ? (
                slide ? (
                  <button
                    type="button"
                    className="text-left text-blue-300 hover:underline"
                    onClick={() => slide.openAppointment(nextAppointment.id)}
                  >
                    {bookingTypeLabel(nextAppointment.bookingType)} · {fmtWhen(nextAppointment.startAt)}
                  </button>
                ) : (
                  <Link
                    href={`/fi-admin/${tenantId}/appointments/${nextAppointment.id}`}
                    className="text-blue-300 hover:underline"
                  >
                    {bookingTypeLabel(nextAppointment.bookingType)} · {fmtWhen(nextAppointment.startAt)}
                  </Link>
                )
              ) : (
                "No upcoming visits"
              )}
            </dd>
            {nextAppointment?.title ? <dd className="text-xs text-gray-500">{nextAppointment.title}</dd> : null}
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Treatment plan</dt>
            <dd className="mt-1 text-slate-200">{treatmentPlanSummary ?? "Not documented yet"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Lifetime value (CRM)</dt>
            <dd className="mt-1 font-medium tabular-nums text-slate-100">{lifetimeValueLabel}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
