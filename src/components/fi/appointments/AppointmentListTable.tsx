"use client";

import { BookingStatusBadge } from "@/src/components/fi/bookings/operator/BookingStatusBadge";
import { BookingTypeBadge } from "@/src/components/fi/bookings/operator/BookingTypeBadge";
import { bookingTypeLabel } from "@/src/lib/bookings/operatorBookingLabels";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { CrmShellClinicOption, CrmShellUserPickerOption } from "@/src/lib/crm/types";
import { bookingAssignmentDisplay } from "@/src/lib/staff/staffAssigneeDisplay";
import type { ClinicalStaffPickerOption } from "@/src/lib/staff/clinicalStaffPicker";
import { useAppointmentSlideOverOptional } from "./AppointmentSlideOver";
import { AppointmentSlideOverTrigger } from "./AppointmentSlideOverTrigger";

function fmtTs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

function assigneeLabel(
  clinicalStaffOptions: ClinicalStaffPickerOption[],
  userAssignees: CrmShellUserPickerOption[],
  row: FiBookingRow
): string {
  return bookingAssignmentDisplay(clinicalStaffOptions, userAssignees, row).summaryLine;
}

function clinicLabel(clinics: CrmShellClinicOption[], row: FiBookingRow): string {
  if (row.clinic_id) {
    const c = clinics.find((x) => x.id === row.clinic_id);
    return c?.display_name ?? row.clinic_id.slice(0, 8);
  }
  return row.location?.trim() || "—";
}

export function AppointmentListTable({
  tenantId,
  bookings,
  clinicalStaffOptions,
  userAssignees,
  clinics,
}: {
  tenantId: string;
  bookings: FiBookingRow[];
  clinicalStaffOptions: ClinicalStaffPickerOption[];
  userAssignees: CrmShellUserPickerOption[];
  clinics: CrmShellClinicOption[];
}) {
  const slide = useAppointmentSlideOverOptional();

  if (bookings.length === 0) {
    return (
      <div className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-8 text-center text-sm text-slate-400">
        No appointments in this range for the current filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md shadow-lg shadow-black/40">
      <table className="min-w-full divide-y divide-white/[0.08] text-sm">
        <thead className="bg-white/[0.03]">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              When
            </th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              Appointment
            </th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              Type
            </th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              Status
            </th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              Provider
            </th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              Clinic
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06]">
          {bookings.map((row) => {
            const href = `/fi-admin/${tenantId}/appointments/${row.id}`;
            const title = row.title?.trim() || bookingTypeLabel(row.booking_type);
            const when = `${fmtTs(row.start_at)} → ${fmtTs(row.end_at)}`;
            const titleCell = slide ? (
              <AppointmentSlideOverTrigger
                appointmentId={row.id}
                className="text-left font-medium text-blue-300 hover:underline"
              >
                {title}
              </AppointmentSlideOverTrigger>
            ) : (
              <a href={href} className="font-medium text-blue-300 hover:underline">
                {title}
              </a>
            );
            return (
              <tr
                key={row.id}
                className="hover:bg-white/[0.03]"
                onClick={(e) => {
                  if (!slide) return;
                  const t = e.target as HTMLElement;
                  if (t.closest("button, a")) return;
                  slide.openAppointment(row.id);
                }}
              >
                <td className="whitespace-nowrap px-3 py-2 text-slate-400">{when}</td>
                <td className="px-3 py-2">{titleCell}</td>
                <td className="px-3 py-2">
                  <BookingTypeBadge type={row.booking_type} />
                </td>
                <td className="px-3 py-2">
                  <BookingStatusBadge status={row.booking_status} />
                </td>
                <td className="px-3 py-2 text-slate-300">
                  {assigneeLabel(clinicalStaffOptions, userAssignees, row)}
                </td>
                <td className="px-3 py-2 text-slate-300">{clinicLabel(clinics, row)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
