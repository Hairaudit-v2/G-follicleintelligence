"use client";

import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { CrmShellClinicOption, CrmShellUserPickerOption } from "@/src/lib/crm/types";
import type { ClinicalStaffPickerOption } from "@/src/lib/staff/clinicalStaffPicker";
import { BookingOperatorRow } from "./BookingOperatorRow";

export function BookingOperatorTable({
  tenantId,
  bookings,
  clinicalStaffOptions,
  userAssignees,
  clinics,
  adminKey,
  onEdit,
  onChanged,
}: {
  tenantId: string;
  bookings: FiBookingRow[];
  clinicalStaffOptions: ClinicalStaffPickerOption[];
  userAssignees: CrmShellUserPickerOption[];
  clinics: CrmShellClinicOption[];
  adminKey: string;
  onEdit: (b: FiBookingRow) => void;
  onChanged: () => void;
}) {
  if (bookings.length === 0) {
    return (
      <div className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-8 text-center text-sm text-slate-400">
        No bookings in this range for the current filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md shadow-lg shadow-black/40">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-white/[0.08] bg-white/[0.03] text-xs font-semibold uppercase tracking-wide text-slate-400">
            <th className="px-3 py-2">When</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Title</th>
            <th className="px-3 py-2">Linked</th>
            <th className="px-3 py-2">Provider</th>
            <th className="px-3 py-2">Clinic / location</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => (
            <BookingOperatorRow
              key={b.id}
              tenantId={tenantId}
              booking={b}
              clinicalStaffOptions={clinicalStaffOptions}
              userAssignees={userAssignees}
              clinics={clinics}
              adminKey={adminKey}
              onEdit={() => onEdit(b)}
              onChanged={onChanged}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
