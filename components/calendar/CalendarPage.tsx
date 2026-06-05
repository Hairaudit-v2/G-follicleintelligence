"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

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
import { QuickCallInBookingModal } from "@/src/components/fi/appointments/QuickCallInBookingModal";
import { useAppointmentSlideOverOptional } from "@/src/components/fi/appointments/AppointmentSlideOver";
import { useCalendarAppointments } from "@/hooks/useCalendarAppointments";
import type { CrmShellSession } from "@/src/lib/crm/crmShellAccess";

const viewMotion = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: calendarEaseOut },
  exit: { opacity: 0, y: -6, transition: { duration: 0.12 } },
};

export type CalendarPageProps = {
  data: OperationalCalendarPageData;
  route?: CalendarRoute;
  /**
   * Force-merge demo appointments (overrides URL).
   * Normally use `?sample=1` on the calendar URL — parsed into {@link OperationalCalendarPageData.query.sampleMode}.
   */
  useSampleData?: boolean;
  /** When set, enables call-in FAB + appointment slide-over from the operational calendar. */
  crmShellSession?: CrmShellSession | null;
};

export function CalendarPage({
  data,
  route = "fi-admin",
  useSampleData = false,
  crmShellSession = null,
}: CalendarPageProps) {
  const router = useRouter();
  const [drawer, setDrawer] = useState<FiBookingRow | null>(null);
  const [editing, setEditing] = useState<FiBookingRow | null>(null);
  const [callInOpen, setCallInOpen] = useState(false);
  const [callInPrefill, setCallInPrefill] = useState<{
    localStart?: string;
    clinicId?: string;
    assignedUserId?: string;
  }>({});
  const slide = useAppointmentSlideOverOptional();

  const sampleMode = Boolean(useSampleData || data.query.sampleMode);

  const { bookings, bookingDisplay, buckets, rescheduleBooking, refresh, pendingIds, upsertBooking } = useCalendarAppointments(
    data,
    { useSampleData: sampleMode }
  );

  const slotPrefillLocal = useMemo(() => `${data.query.dateAnchor.trim()}T09:00`, [data.query.dateAnchor]);

  const quickCallInEnabled = Boolean(data.canMutateBookings && crmShellSession);

  const openCallInFromSlot = useCallback(
    (p: { dayKey: string; columnId: string; localStart: string }) => {
      const next: { localStart: string; clinicId?: string; assignedUserId?: string } = {
        localStart: p.localStart.trim(),
      };
      if (p.columnId.startsWith("c:")) {
        next.clinicId = p.columnId.slice(2);
      } else if (p.columnId.startsWith("s:")) {
        const sid = p.columnId.slice(2);
        const uid = data.staffDirectory.find((s) => s.id === sid)?.fi_user_id?.trim();
        if (uid) next.assignedUserId = uid;
      }
      setCallInPrefill(next);
      setCallInOpen(true);
    },
    [data.staffDirectory]
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
      calendarTimezone={data.calendarTimezone}
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
      dayKey={data.query.dateAnchor}
      calendarTimezone={data.calendarTimezone}
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
        staffDirectory={data.staffDirectory}
        clinics={data.clinics}
        canMutateBookings={data.canMutateBookings}
        route={route}
      />

      {sampleMode ? (
        <p
          className="border-b border-sky-500/25 bg-sky-950/35 px-4 py-2 text-xs font-medium text-sky-200"
          role="status"
        >
          Demo mode — sample consults, PRP, and transplant appointments merged. Drag-and-drop updates locally; real
          bookings PATCH to the server with optimistic UI and rollback on error.
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
                pendingAppointmentIds={pendingIds}
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
                  data.query.staffId
                    ? `s:${data.query.staffId}`
                    : data.query.assignedUserId
                      ? `u:${data.query.assignedUserId}`
                      : null
                }
                onSelectBooking={(b) => setDrawer(b)}
                onRescheduleBooking={rescheduleBooking}
                pendingAppointmentIds={pendingIds}
                shortcuts={{
                  tenantId: data.tenantId,
                  query: data.query,
                  addAppointmentHref: `${base}/bookings/new`,
                }}
                onEmptySlotClick={quickCallInEnabled ? openCallInFromSlot : undefined}
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
        calendarTimezone={data.calendarTimezone}
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

      {data.canMutateBookings && crmShellSession ? (
        <>
          <button
            type="button"
            onClick={() => {
              setCallInPrefill({ localStart: slotPrefillLocal });
              setCallInOpen(true);
            }}
            className="fixed bottom-20 right-4 z-[110] inline-flex h-14 w-14 items-center justify-center rounded-full bg-sky-500 text-white shadow-lg shadow-sky-950/40 ring-2 ring-sky-300/50 transition hover:bg-sky-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 sm:bottom-24 sm:right-6"
            aria-label="New call-in booking"
            title="New call-in booking"
          >
            <Phone className="h-6 w-6" aria-hidden />
          </button>
          <QuickCallInBookingModal
            tenantId={data.tenantId}
            open={callInOpen}
            onClose={() => {
              setCallInOpen(false);
              setCallInPrefill({});
            }}
            calendarTimezone={data.calendarTimezone}
            initialLocalStart={callInPrefill.localStart ?? slotPrefillLocal}
            initialClinicId={callInPrefill.clinicId ?? null}
            initialAssignedUserId={callInPrefill.assignedUserId ?? null}
            clinics={data.clinics}
            assignees={data.assignees}
            onCreated={({ booking }) => {
              upsertBooking(booking);
              refresh();
            }}
            onOpenBooking={(id) => slide?.openAppointment(id)}
          />
        </>
      ) : null}
    </div>
  );
}
