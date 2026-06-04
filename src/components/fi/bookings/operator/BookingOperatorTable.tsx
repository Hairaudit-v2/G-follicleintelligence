"use client";

import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { CrmShellClinicOption, CrmShellUserPickerOption } from "@/src/lib/crm/types";
import { BookingOperatorRow } from "./BookingOperatorRow";

export function BookingOperatorTable({
  tenantId,
  bookings,
  assignees,
  clinics,
  adminKey,
  onEdit,
  onChanged,
}: {
  tenantId: string;
  bookings: FiBookingRow[];
  assignees: CrmShellUserPickerOption[];
  clinics: CrmShellClinicOption[];
  adminKey: string;
  onEdit: (b: FiBookingRow) => void;
  onChanged: () => void;
}) {
  if (bookings.length === 0) {
    return (
      <div className="rounded border border-gray-200 bg-white p-8 text-center text-sm text-gray-600">
        No bookings in this range for the current filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-600">
            <th className="px-3 py-2">When</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Title</th>
            <th className="px-3 py-2">Linked</th>
            <th className="px-3 py-2">Assigned</th>
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
              assignees={assignees}
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
