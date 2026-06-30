"use client";

import Link from "next/link";
import { useAppointmentSlideOverOptional } from "@/src/components/fi/appointments/AppointmentSlideOver";
import { bookingTypeLabel } from "@/src/lib/bookings/operatorBookingLabels";
import type { PatientProfileFoundationData } from "@/src/lib/patients/patientProfileLoader";
import { crmLeadCardClass } from "@/src/components/fi/crm/shared/crmSharedStyles";

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function PatientAppointmentsTab({
  tenantId,
  patientId,
  data,
}: {
  tenantId: string;
  patientId: string;
  data: PatientProfileFoundationData;
}) {
  const slide = useAppointmentSlideOverOptional();
  const { upcoming, past } = data.bookings;
  const all = [...upcoming, ...past];

  return (
    <div className="space-y-4">
      <section className={crmLeadCardClass}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-100">Appointments & bookings</h2>
          <Link
            href={`/fi-admin/${tenantId}/appointments`}
            className="text-xs text-blue-300 hover:underline"
          >
            Calendar →
          </Link>
        </div>
        {all.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">No appointments for this patient.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-white/[0.08] text-sm">
              <thead className="bg-white/[0.03] text-xs font-semibold uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2 text-left">When</th>
                  <th className="px-3 py-2 text-left">Appointment</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {all.map((b) => {
                  const title = b.title?.trim() || bookingTypeLabel(b.booking_type);
                  const href = `/fi-admin/${tenantId}/appointments/${b.id}`;
                  return (
                    <tr key={b.id} className="hover:bg-white/[0.03]">
                      <td className="whitespace-nowrap px-3 py-2 text-slate-400">{fmt(b.start_at)}</td>
                      <td className="px-3 py-2">
                        {slide ? (
                          <button
                            type="button"
                            className="font-medium text-blue-300 hover:underline"
                            onClick={() => slide.openAppointment(b.id)}
                          >
                            {title}
                          </button>
                        ) : (
                          <Link href={href} className="font-medium text-blue-300 hover:underline">
                            {title}
                          </Link>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-300">{bookingTypeLabel(b.booking_type)}</td>
                      <td className="px-3 py-2 text-slate-300">{b.booking_status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-gray-500">
        <Link href={`/fi-admin/${tenantId}/bookings/new?patientId=${encodeURIComponent(patientId)}`} className="text-blue-300 hover:underline">
          Book a new appointment
        </Link>
        {" · "}
        Tip: click a row title to open the appointment slide-over when available.
      </p>
    </div>
  );
}
