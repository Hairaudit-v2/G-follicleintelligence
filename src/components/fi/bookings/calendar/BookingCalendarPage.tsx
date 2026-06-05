"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import type { CalendarViewData } from "@/src/lib/bookings/calendarLoader";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { utcHourSlotIsoRange } from "@/src/lib/bookings/calendarView";
import { BookingEditDrawer } from "@/src/components/fi/bookings/operator/BookingEditDrawer";
import { BookingQuickCreatePanel } from "@/src/components/fi/bookings/operator/BookingQuickCreatePanel";
import { BookingCalendarDrawer } from "./BookingCalendarDrawer";
import { BookingCalendarFilters } from "./BookingCalendarFilters";
import { BookingCalendarGrid } from "./BookingCalendarGrid";
import { BookingCalendarToolbar } from "./BookingCalendarToolbar";

export function BookingCalendarPage({ data }: { data: CalendarViewData }) {
  const router = useRouter();
  const createRef = useRef<HTMLDivElement | null>(null);
  const [adminKey, setAdminKey] = useState("");
  const [drawer, setDrawer] = useState<FiBookingRow | null>(null);
  const [editing, setEditing] = useState<FiBookingRow | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [slotPrefill, setSlotPrefill] = useState<{ startIso: string; endIso: string } | null>(null);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const { tenantId, query, lanes, buckets, assignees, clinics, listTruncated, rangeTitle } = data;

  function scrollToCreate() {
    createRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 py-6">
      <header className="space-y-2">
        <h1 className="text-lg font-semibold text-gray-900">Calendar</h1>
        <p className="text-sm text-gray-600">
          Scheduling for the selected clinic-local range. Use the operator list for bulk filters and wide exports.
        </p>
        <label className="block max-w-md text-xs text-gray-600">
          FI Admin key (optional — paste when your session role cannot write via service actions alone)
          <input
            type="password"
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 font-mono text-sm"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            autoComplete="off"
          />
        </label>
      </header>

      {listTruncated ? (
        <p className="text-xs text-amber-800">
          The calendar hit the row cap for this range. Narrow filters or use the Bookings operator page for a wider
          window.
        </p>
      ) : null}

      <BookingCalendarToolbar
        tenantId={tenantId}
        query={query}
        rangeTitle={rangeTitle}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters((v) => !v)}
        onQuickCreate={() => {
          setSlotPrefill(null);
          scrollToCreate();
        }}
      />

      {showFilters ? (
        <BookingCalendarFilters tenantId={tenantId} query={query} assignees={assignees} clinics={clinics} />
      ) : null}

      <BookingCalendarGrid
        view={query.view}
        lanes={lanes}
        buckets={buckets}
        assignees={assignees}
        onSelectBooking={(b) => setDrawer(b)}
        onEmptySlot={(dayKey, hour) => {
          const slot = utcHourSlotIsoRange(dayKey, hour, query.calendarTimezone);
          if (slot) {
            setSlotPrefill({ startIso: slot.startIso, endIso: slot.endIso });
            scrollToCreate();
          }
        }}
      />

      <div ref={createRef}>
        <BookingQuickCreatePanel
          tenantId={tenantId}
          assignees={assignees}
          clinics={clinics}
          adminKey={adminKey}
          calendarTimezone={query.calendarTimezone}
          slotPrefill={slotPrefill}
          onCreated={() => {
            setSlotPrefill(null);
            refresh();
          }}
        />
      </div>

      <BookingCalendarDrawer
        tenantId={tenantId}
        booking={drawer}
        assignees={assignees}
        clinics={clinics}
        adminKey={adminKey}
        calendarTimezone={query.calendarTimezone}
        onClose={() => setDrawer(null)}
        onChanged={refresh}
        onEdit={(b) => setEditing(b)}
      />

      <BookingEditDrawer
        tenantId={tenantId}
        booking={editing}
        reminderJobs={editing ? data.reminderJobsByBookingId[editing.id] ?? [] : []}
        assignees={assignees}
        clinics={clinics}
        adminKey={adminKey}
        clinicCalendarTimezone={query.calendarTimezone}
        onClose={() => setEditing(null)}
        onSaved={refresh}
      />
    </div>
  );
}
