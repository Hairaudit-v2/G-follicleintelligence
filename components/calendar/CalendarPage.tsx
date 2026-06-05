"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { updateBookingAction } from "@/lib/actions/fi-booking-actions";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import { CalendarRightPanel } from "@/components/calendar/CalendarRightPanel";
import { CalendarTopControls } from "@/components/calendar/CalendarTopControls";
import { MonthView } from "@/components/calendar/MonthView";
import { SidebarAgenda } from "@/components/calendar/SidebarAgenda";
import { calendarEaseOut } from "@/lib/calendar/calendarMotion";
import {
  buildCalendarHref,
  mergeCalendarHrefQuery,
  type CalendarRoute,
} from "@/src/lib/bookings/calendarQuery";
import { bucketBookingsIntoCalendar } from "@/src/lib/bookings/calendarView";
import { bookingConflictsForOperationalCalendar } from "@/src/lib/calendar/operationalCalendarLayout";
import type { OperationalCalendarPageData } from "@/src/lib/calendar/operationalCalendarTypes";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { BookingCalendarDrawer } from "@/src/components/fi/bookings/calendar/BookingCalendarDrawer";
import { BookingEditDrawer } from "@/src/components/fi/bookings/operator/BookingEditDrawer";

const viewMotion = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: calendarEaseOut },
  exit: { opacity: 0, y: -6, transition: { duration: 0.12 } },
};

export type CalendarPageProps = {
  data: OperationalCalendarPageData;
  route?: CalendarRoute;
};

export function CalendarPage({ data, route = "fi-admin" }: CalendarPageProps) {
  const router = useRouter();
  const [drawer, setDrawer] = useState<FiBookingRow | null>(null);
  const [editing, setEditing] = useState<FiBookingRow | null>(null);
  const [bookings, setBookings] = useState(data.bookings);

  useEffect(() => {
    setBookings(data.bookings);
  }, [data.bookings, data.rangeStartIso, data.rangeEndIso, data.query.dateAnchor, data.query.view]);

  const buckets = useMemo(() => {
    const m = bucketBookingsIntoCalendar(bookings, data.lanes);
    const out: Record<string, FiBookingRow[]> = {};
    for (const lane of data.lanes) {
      out[lane.dayKey] = m.get(lane.dayKey) ?? [];
    }
    return out;
  }, [bookings, data.lanes]);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const base = `/fi-admin/${data.tenantId.trim()}`;
  const isMonthView = data.query.view === "month";

  const onRescheduleBooking = useCallback(
    async (
      b: FiBookingRow,
      startIso: string,
      endIso: string,
      meta?: { assignedUserId?: string | null; clinicId?: string | null; clearWaitlist?: boolean }
    ) => {
      const assignedUserId =
        meta && "assignedUserId" in meta ? (meta.assignedUserId ?? null) : b.assigned_user_id;
      const clinicId = meta && "clinicId" in meta ? (meta.clinicId ?? null) : b.clinic_id;

      const conflicts = bookingConflictsForOperationalCalendar(
        {
          id: b.id,
          start_at: startIso,
          end_at: endIso,
          assigned_user_id: assignedUserId,
          clinic_id: clinicId,
        },
        bookings,
        { ignoreBookingId: b.id }
      );
      if (conflicts.length) {
        const msg = `Scheduling conflict: overlaps ${conflicts.length} booking(s) for the same clinician or site.`;
        return { ok: false as const, error: msg };
      }

      const snapshot = { ...b };
      setBookings((rows) =>
        rows.map((x) =>
          x.id === b.id
            ? { ...x, start_at: startIso, end_at: endIso, assigned_user_id: assignedUserId, clinic_id: clinicId }
            : x
        )
      );

      const nextMetadata = { ...(b.metadata ?? {}) };
      if (meta?.clearWaitlist) {
        delete nextMetadata.waitlist;
        delete nextMetadata.on_waitlist;
        delete nextMetadata.waitlist_notes;
      }

      const r = await updateBookingAction(data.tenantId, b.id, {
        leadId: b.lead_id,
        personId: b.person_id,
        patientId: b.patient_id,
        caseId: b.case_id,
        clinicId: clinicId,
        assignedUserId: assignedUserId,
        bookingType: b.booking_type,
        bookingStatus: b.booking_status,
        title: b.title,
        description: b.description,
        startAt: startIso,
        endAt: endIso,
        timezone: b.timezone,
        location: b.location,
        metadata: nextMetadata,
      });

      if (!r.ok) {
        setBookings((rows) => rows.map((x) => (x.id === b.id ? snapshot : x)));
        return { ok: false as const, error: r.error };
      }

      refresh();
      return { ok: true as const };
    },
    [bookings, data.tenantId, refresh]
  );

  const onSearchSubmit = useCallback(
    (q: string) => {
      router.push(
        buildCalendarHref(
          data.tenantId,
          mergeCalendarHrefQuery(data.query, { q: q || undefined }),
          { route }
        )
      );
    },
    [data.query, data.tenantId, route, router]
  );

  const sidebar = (
    <SidebarAgenda
      bookings={bookings}
      bookingDisplay={data.bookingDisplay}
      addAppointmentHref={`${base}/bookings/new`}
      onSelectBooking={(b) => setDrawer(b)}
      draggableWaitlist={data.canMutateBookings}
      className="border-r-0 dark:border-[#1e2937]"
    />
  );

  const rightPanel = (
    <CalendarRightPanel
      bookings={bookings}
      bookingDisplay={data.bookingDisplay}
      dayKeyUtc={data.query.dateAnchor}
      searchQuery={data.query.search ?? ""}
      onSearchSubmit={onSearchSubmit}
    />
  );

  return (
    <div className="-mx-3 flex min-h-[calc(100dvh-8rem)] flex-col bg-[#0f172a] sm:-mx-4 lg:-mx-6">
      <CalendarTopControls
        tenantId={data.tenantId}
        query={data.query}
        rangeTitle={data.rangeTitle}
        assignees={data.assignees}
        clinics={data.clinics}
        canMutateBookings={data.canMutateBookings}
        route={route}
      />

      {data.listTruncated ? (
        <p
          className="border-b border-amber-500/30 bg-amber-950/40 px-4 py-2 text-xs font-medium text-amber-100"
          role="status"
        >
          Results truncated at {bookings.length} rows. Narrow staff, location, or date range.
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col">
        <AnimatePresence mode="wait">
          {isMonthView ? (
            <motion.div key="month" className="flex min-h-0 flex-1 flex-col" {...viewMotion}>
              <MonthView
                sidebar={sidebar}
                rightPanel={rightPanel}
                monthAnchor={data.query.dateAnchor}
                bookings={bookings}
                bookingDisplay={data.bookingDisplay}
                resourceColumns={data.resourceColumns}
                gridConfig={data.gridConfig}
                canMutateBookings={data.canMutateBookings}
                onSelectBooking={(b) => setDrawer(b)}
                onRescheduleBooking={onRescheduleBooking}
                tenantId={data.tenantId}
                query={data.query}
                calendarRoute={route}
              />
            </motion.div>
          ) : (
            <motion.div key={data.query.view} className="flex min-h-0 flex-1 flex-col" {...viewMotion}>
              <CalendarGrid
                sidebar={sidebar}
                rightPanel={rightPanel}
                view={data.query.view as "day" | "3day" | "week"}
                lanes={data.lanes}
                buckets={buckets}
                gridConfig={data.gridConfig}
                bookingDisplay={data.bookingDisplay}
                resourceColumns={data.resourceColumns}
                canMutateBookings={data.canMutateBookings}
                bookings={bookings}
                highlightedColumnId={
                  data.query.assignedUserId ? `u:${data.query.assignedUserId}` : null
                }
                onSelectBooking={(b) => setDrawer(b)}
                onRescheduleBooking={onRescheduleBooking}
                shortcuts={{
                  tenantId: data.tenantId,
                  query: data.query,
                  addAppointmentHref: `${base}/bookings/new`,
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BookingCalendarDrawer
        tenantId={data.tenantId}
        booking={drawer}
        assignees={data.assignees}
        clinics={data.clinics}
        adminKey=""
        onClose={() => setDrawer(null)}
        onChanged={refresh}
        onEdit={(b) => setEditing(b)}
      />

      <BookingEditDrawer
        tenantId={data.tenantId}
        booking={editing}
        reminderJobs={editing ? data.reminderJobsByBookingId[editing.id] ?? [] : []}
        assignees={data.assignees}
        clinics={data.clinics}
        adminKey=""
        onClose={() => setEditing(null)}
        onSaved={refresh}
      />
    </div>
  );
}
