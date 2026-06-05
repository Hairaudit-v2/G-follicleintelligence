"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

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
import type { OperationalCalendarPageData } from "@/src/lib/calendar/operationalCalendarTypes";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { BookingCalendarDrawer } from "@/src/components/fi/bookings/calendar/BookingCalendarDrawer";
import { BookingEditDrawer } from "@/src/components/fi/bookings/operator/BookingEditDrawer";
import { useCalendarAppointments } from "@/hooks/useCalendarAppointments";

const viewMotion = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: calendarEaseOut },
  exit: { opacity: 0, y: -6, transition: { duration: 0.12 } },
};

export type CalendarPageProps = {
  data: OperationalCalendarPageData;
  route?: CalendarRoute;
  /** Append demo consult / PRP / transplant rows (`?sample=1`). */
  useSampleData?: boolean;
};

export function CalendarPage({ data, route = "fi-admin", useSampleData = false }: CalendarPageProps) {
  const router = useRouter();
  const [drawer, setDrawer] = useState<FiBookingRow | null>(null);
  const [editing, setEditing] = useState<FiBookingRow | null>(null);

  const { bookings, bookingDisplay, buckets, rescheduleBooking, refresh } = useCalendarAppointments(
    data,
    { useSampleData }
  );

  const base = `/fi-admin/${data.tenantId.trim()}`;
  const isMonthView = data.query.view === "month";

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
      bookingDisplay={bookingDisplay}
      addAppointmentHref={`${base}/bookings/new`}
      onSelectBooking={(b) => setDrawer(b)}
      draggableWaitlist={data.canMutateBookings}
      className="border-r-0 dark:border-[#1e2937]"
    />
  );

  const rightPanel = (
    <CalendarRightPanel
      bookings={bookings}
      bookingDisplay={bookingDisplay}
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

      {useSampleData ? (
        <p
          className="border-b border-sky-500/25 bg-sky-950/35 px-4 py-2 text-xs font-medium text-sky-200"
          role="status"
        >
          Demo mode — sample consults, PRP, and transplant appointments merged. Drag-and-drop updates locally.
        </p>
      ) : null}

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
                bookingDisplay={bookingDisplay}
                resourceColumns={data.resourceColumns}
                gridConfig={data.gridConfig}
                canMutateBookings={data.canMutateBookings}
                onSelectBooking={(b) => setDrawer(b)}
                onRescheduleBooking={rescheduleBooking}
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
                bookingDisplay={bookingDisplay}
                resourceColumns={data.resourceColumns}
                canMutateBookings={data.canMutateBookings}
                bookings={bookings}
                highlightedColumnId={
                  data.query.assignedUserId ? `u:${data.query.assignedUserId}` : null
                }
                onSelectBooking={(b) => setDrawer(b)}
                onRescheduleBooking={rescheduleBooking}
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
        clinicCalendarTimezone={data.calendarTimezone}
        onClose={() => setEditing(null)}
        onSaved={refresh}
      />
    </div>
  );
}
