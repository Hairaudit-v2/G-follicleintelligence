"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { isBookingUpcoming, sortBookingsByStartAt } from "@/src/lib/bookings";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { CrmShellClinicOption, CrmShellUserPickerOption, FiCrmLeadRow } from "@/src/lib/crm/types";
import type { FiServiceRow } from "@/src/lib/services/fiServiceTypes";
import { BookingCreatePanel } from "./BookingCreatePanel";
import { BookingSummaryCard } from "./BookingSummaryCard";

const card = "rounded border border-gray-200 bg-white p-4 shadow-sm";

export function LeadBookingPanel({
  tenantId,
  lead,
  bookings,
  assigneeOptions,
  clinicOptions,
  groupingNowIso,
  calendarTimezone,
  services = [],
}: {
  tenantId: string;
  lead: FiCrmLeadRow;
  bookings: FiBookingRow[];
  assigneeOptions: CrmShellUserPickerOption[];
  clinicOptions: CrmShellClinicOption[];
  groupingNowIso: string;
  calendarTimezone?: string | null;
  services?: FiServiceRow[];
}) {
  const router = useRouter();
  const [adminKey, setAdminKey] = useState("");
  const [editing, setEditing] = useState<FiBookingRow | null>(null);

  const now = useMemo(() => new Date(groupingNowIso), [groupingNowIso]);
  const sorted = useMemo(() => sortBookingsByStartAt(bookings), [bookings]);

  const upcoming = useMemo(
    () =>
      sorted.filter((b) => {
        const upcomingStart = isBookingUpcoming(b, now);
        const terminal = b.booking_status === "cancelled" || b.booking_status === "completed";
        return upcomingStart && !terminal;
      }),
    [sorted, now]
  );

  const past = useMemo(
    () => sorted.filter((b) => !upcoming.some((u) => u.id === b.id)),
    [sorted, upcoming]
  );

  function refresh() {
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className={card}>
        <h2 className="text-sm font-semibold text-gray-900">Bookings</h2>
        <p className="mt-1 text-xs text-gray-600">
          Simple lead-scoped schedule (full calendar in a later stage). Optional FI Admin key for service-style writes
          when not using a CRM-capable session role.
        </p>
        <label className="mt-2 block text-xs text-gray-600">
          FI Admin key (optional)
          <input
            type="password"
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm font-mono"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            autoComplete="off"
          />
        </label>
      </div>

      <BookingCreatePanel
        key={editing?.id ?? "create"}
        tenantId={tenantId}
        lead={lead}
        mode={editing ? "edit" : "create"}
        initialBooking={editing}
        assigneeOptions={assigneeOptions}
        clinicOptions={clinicOptions}
        adminKey={adminKey}
        calendarTimezone={calendarTimezone}
        services={services}
        onCancelEdit={() => setEditing(null)}
        onSuccess={() => {
          setEditing(null);
          refresh();
        }}
      />

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Upcoming</h3>
        {upcoming.length === 0 ? <p className="text-sm text-gray-500">No upcoming bookings.</p> : null}
        <div className="space-y-2">
          {upcoming.map((b) => (
            <BookingSummaryCard
              key={b.id}
              tenantId={tenantId}
              booking={b}
              assigneeOptions={assigneeOptions}
              adminKey={adminKey}
              onEdit={() => setEditing(b)}
              onChanged={refresh}
            />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Past & cancelled</h3>
        <details className="rounded border border-gray-100 bg-gray-50 p-2">
          <summary className="cursor-pointer text-sm text-gray-700">Show ({past.length})</summary>
          <div className="mt-2 space-y-2">
            {past.map((b) => (
              <BookingSummaryCard
                key={b.id}
                tenantId={tenantId}
                booking={b}
                assigneeOptions={assigneeOptions}
                adminKey={adminKey}
                onEdit={() => setEditing(b)}
                onChanged={refresh}
              />
            ))}
          </div>
        </details>
      </section>
    </div>
  );
}
