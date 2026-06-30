"use client";

import { utcDayBoundsMs } from "@/src/lib/bookings/operatorBookingQuery";
import { sortBookingsByStartAt } from "@/src/lib/bookings";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { CrmShellClinicOption, CrmShellUserPickerOption } from "@/src/lib/crm/types";
import type { ClinicalStaffPickerOption } from "@/src/lib/staff/clinicalStaffPicker";
import { useMemo } from "react";
import { AppointmentListTable } from "./AppointmentListTable";

export function AppointmentTodayView({
  tenantId,
  bookings,
  clinicalStaffOptions,
  userAssignees,
  clinics,
  nowIso,
}: {
  tenantId: string;
  bookings: FiBookingRow[];
  clinicalStaffOptions: ClinicalStaffPickerOption[];
  userAssignees: CrmShellUserPickerOption[];
  clinics: CrmShellClinicOption[];
  nowIso: string;
}) {
  const todayRows = useMemo(() => {
    const now = new Date(nowIso);
    const { dayStartMs, dayEndMs } = utcDayBoundsMs(now);
    const filtered = bookings.filter((b) => {
      const s = Date.parse(b.start_at);
      return Number.isFinite(s) && s >= dayStartMs && s < dayEndMs;
    });
    return sortBookingsByStartAt(filtered);
  }, [bookings, nowIso]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">
        Appointments starting today (UTC). Use Calendar for drag-and-drop scheduling or List for a
        wider date range.
      </p>
      <AppointmentListTable
        tenantId={tenantId}
        bookings={todayRows}
        clinicalStaffOptions={clinicalStaffOptions}
        userAssignees={userAssignees}
        clinics={clinics}
      />
    </div>
  );
}
