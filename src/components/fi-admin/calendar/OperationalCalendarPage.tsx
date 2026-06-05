"use client";

import { useRouter } from "next/navigation";
import { Calendar as CalendarIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { updateBookingAction } from "@/lib/actions/fi-booking-actions";
import { bucketBookingsIntoCalendar } from "@/src/lib/bookings/calendarView";
import { bookingConflictsForOperationalCalendar } from "@/src/lib/calendar/operationalCalendarLayout";
import type { OperationalCalendarPageData } from "@/src/lib/calendar/operationalCalendarTypes";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { FiCard } from "@/src/components/fi-design/FiCard";
import { FiPageHeader } from "@/src/components/fi-design/FiPageHeader";
import { FiQuickActionCard } from "@/src/components/fi-design/FiQuickActionCard";
import { FiSection } from "@/src/components/fi-design/FiSection";
import { FiStatusBadge } from "@/src/components/fi-design/FiStatusBadge";
import { BookingCalendarDrawer } from "@/src/components/fi/bookings/calendar/BookingCalendarDrawer";
import { BookingEditDrawer } from "@/src/components/fi/bookings/operator/BookingEditDrawer";

import { CalendarWeekView } from "./CalendarWeekView";
import { OperationalCalendarFilters } from "./OperationalCalendarFilters";
import { OperationalCalendarMobileList } from "./OperationalCalendarMobileList";
import { OperationalCalendarToolbar } from "./OperationalCalendarToolbar";

export function OperationalCalendarPage({
  data,
  showCrmNav,
}: {
  data: OperationalCalendarPageData;
  showCrmNav: boolean;
}) {
  const router = useRouter();
  const [showFilters, setShowFilters] = useState(false);
  const [drawer, setDrawer] = useState<FiBookingRow | null>(null);
  const [editing, setEditing] = useState<FiBookingRow | null>(null);
  const [bookings, setBookings] = useState(data.bookings);
  const [dragFeedback, setDragFeedback] = useState<string | null>(null);

  useEffect(() => {
    setBookings(data.bookings);
  }, [data.bookings, data.rangeStartIso, data.rangeEndIso, data.query.dateAnchor, data.query.view]);

  useEffect(() => {
    if (!dragFeedback) return;
    const t = window.setTimeout(() => setDragFeedback(null), 6000);
    return () => window.clearTimeout(t);
  }, [dragFeedback]);

  const buckets = useMemo(
    () => {
      const m = bucketBookingsIntoCalendar(bookings, data.lanes);
      const out: Record<string, FiBookingRow[]> = {};
      for (const lane of data.lanes) {
        out[lane.dayKey] = m.get(lane.dayKey) ?? [];
      }
      return out;
    },
    [bookings, data.lanes]
  );

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const base = `/fi-admin/${data.tenantId.trim()}`;

  const onRescheduleBooking = useCallback(
    async (b: FiBookingRow, startIso: string, endIso: string) => {
      const conflicts = bookingConflictsForOperationalCalendar(
        {
          id: b.id,
          start_at: startIso,
          end_at: endIso,
          assigned_user_id: b.assigned_user_id,
          clinic_id: b.clinic_id,
        },
        bookings,
        { ignoreBookingId: b.id }
      );
      if (conflicts.length) {
        const msg = `Scheduling conflict: overlaps ${conflicts.length} booking(s) for the same clinician or site.`;
        setDragFeedback(msg);
        return { ok: false as const, error: msg };
      }

      const snapshot = { ...b };
      setBookings((rows) => rows.map((x) => (x.id === b.id ? { ...x, start_at: startIso, end_at: endIso } : x)));

      const r = await updateBookingAction(data.tenantId, b.id, {
        leadId: b.lead_id,
        personId: b.person_id,
        patientId: b.patient_id,
        caseId: b.case_id,
        clinicId: b.clinic_id,
        assignedUserId: b.assigned_user_id,
        bookingType: b.booking_type,
        bookingStatus: b.booking_status,
        title: b.title,
        description: b.description,
        startAt: startIso,
        endAt: endIso,
        timezone: b.timezone,
        location: b.location,
        metadata: b.metadata ?? {},
      });

      if (!r.ok) {
        setBookings((rows) => rows.map((x) => (x.id === b.id ? snapshot : x)));
        setDragFeedback(r.error);
        return { ok: false as const, error: r.error };
      }

      setDragFeedback(null);
      refresh();
      return { ok: true as const };
    },
    [bookings, data.tenantId, refresh]
  );

  return (
    <div className="space-y-4">
      <FiCard className="sm:p-5">
        <FiPageHeader
          title="Calendar"
          description="Week and day schedules with staff and site columns. Drag bookings to reschedule when you have CRM write access."
          leading={
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-sky-400">
              <CalendarIcon className="h-5 w-5" aria-hidden />
            </div>
          }
          className="lg:items-start"
        />
      </FiCard>

      <OperationalCalendarToolbar
        tenantId={data.tenantId}
        query={data.query}
        rangeTitle={data.rangeTitle}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters((v) => !v)}
      />

      {data.listTruncated ? (
        <p className="text-xs font-medium text-amber-800 dark:text-amber-300" role="status">
          Results truncated at {bookings.length} rows for this UTC window. Narrow filters or shorten the range.
        </p>
      ) : null}

      {dragFeedback ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100" role="alert">
          {dragFeedback}
        </p>
      ) : null}

      {showFilters ? (
        <OperationalCalendarFilters
          tenantId={data.tenantId}
          query={data.query}
          assignees={data.assignees}
          clinics={data.clinics}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
        <FiStatusBadge tone={data.canMutateBookings ? "success" : "neutral"}>
          {data.canMutateBookings ? "Drag & drop enabled" : "Read-only (CRM write role required)"}
        </FiStatusBadge>
        <span>
          Slots: {data.gridConfig.slotMinutes} min · UTC {data.gridConfig.dayStartHourUtc}:00–{data.gridConfig.dayEndHourUtc}:00
        </span>
      </div>

      <div className="hidden lg:block">
        {bookings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-12 text-center dark:border-slate-700 dark:bg-slate-900/40">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">No bookings in this view</p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Adjust filters, pick another week, or create a booking from quick actions.
            </p>
          </div>
        ) : (
          <CalendarWeekView
            view={data.query.view}
            lanes={data.lanes}
            buckets={buckets}
            gridConfig={data.gridConfig}
            bookingDisplay={data.bookingDisplay}
            resourceColumns={data.resourceColumns}
            canMutateBookings={data.canMutateBookings}
            bookings={bookings}
            onSelectBooking={(b) => setDrawer(b)}
            onRescheduleBooking={onRescheduleBooking}
          />
        )}
      </div>

      <OperationalCalendarMobileList
        lanes={data.lanes}
        buckets={buckets}
        bookingDisplay={data.bookingDisplay}
        onSelectBooking={(b) => setDrawer(b)}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <FiSection title="Workspace" description="Jump to related areas" headingId="operational-calendar-workspace-heading">
          <div className="grid gap-2 sm:grid-cols-2">
            <FiQuickActionCard
              title="New booking"
              description="Create a booking"
              href={`${base}/bookings/new`}
              disabled={!showCrmNav}
              disabledReason="Requires CRM workspace access."
              showOpenAffordance={false}
            />
            <FiQuickActionCard
              title="Tenant home"
              description="Operational dashboard"
              href={base}
              showOpenAffordance={false}
            />
            <FiQuickActionCard
              title="CRM leads"
              description="Pipeline"
              href={`${base}/crm`}
              disabled={!showCrmNav}
              disabledReason="CRM workspace access required."
              showOpenAffordance={false}
            />
            <FiQuickActionCard title="Cases" description="Clinical worklists" href={`${base}/cases`} showOpenAffordance={false} />
          </div>
        </FiSection>
        <FiSection title="Details" description="Booking actions" headingId="operational-calendar-details-heading">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Select a booking on the grid or list to view anchors, status, and shortcuts. Use{" "}
            <span className="font-medium">Full edit</span> for type, assignee, and site changes.
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
            Bookings use the same overlap load as the tenant dashboard agenda (<code className="rounded bg-slate-100 px-1 dark:bg-slate-800">loadBookingsForTenantRange</code>).
          </p>
        </FiSection>
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
