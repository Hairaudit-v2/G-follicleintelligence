"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";

import { updateBookingAction } from "@/lib/actions/fi-booking-actions";
import {
  calendarAppointmentsSyncKey,
  useCalendarAppointmentsStore,
  type CalendarReschedulePatch,
} from "@/lib/calendar/calendarAppointmentsStore";
import {
  isSampleBookingId,
  mergeBookingsWithSamples,
  mergeDisplayWithSamples,
} from "@/lib/calendar/sampleAppointments";
import { bucketBookingsIntoCalendar } from "@/src/lib/bookings/calendarView";
import { bookingConflictsForOperationalCalendar } from "@/src/lib/calendar/operationalCalendarLayout";
import type {
  OperationalCalendarBookingDisplay,
  OperationalCalendarPageData,
} from "@/src/lib/calendar/operationalCalendarTypes";
import type { FiBookingRow } from "@/src/lib/bookings/types";

export type CalendarRescheduleMeta = {
  assignedUserId?: string | null;
  clinicId?: string | null;
  clearWaitlist?: boolean;
};

export type UseCalendarAppointmentsOptions = {
  /** Merge demo PRP / transplant / consult sample rows for testing. */
  useSampleData?: boolean;
};

export type UseCalendarAppointmentsResult = {
  bookings: FiBookingRow[];
  bookingDisplay: Record<string, OperationalCalendarBookingDisplay>;
  buckets: Record<string, FiBookingRow[]>;
  pendingIds: Set<string>;
  rescheduleBooking: (
    booking: FiBookingRow,
    startIso: string,
    endIso: string,
    meta?: CalendarRescheduleMeta
  ) => Promise<{ ok: boolean; error?: string }>;
  refresh: () => void;
};

/**
 * Client calendar data layer — Zustand store with optimistic drag-and-drop reschedule.
 *
 * - Hydrates from server {@link OperationalCalendarPageData} on range/view changes
 * - Optional sample appointments via `useSampleData` or `?sample=1`
 * - Optimistic patch on drag; rolls back on server failure
 */
export function useCalendarAppointments(
  data: OperationalCalendarPageData,
  options: UseCalendarAppointmentsOptions = {}
): UseCalendarAppointmentsResult {
  const router = useRouter();
  const syncKey = calendarAppointmentsSyncKey(data);

  const bookings = useCalendarAppointmentsStore((s) => s.bookings);
  const bookingDisplay = useCalendarAppointmentsStore((s) => s.bookingDisplay);
  const pendingIds = useCalendarAppointmentsStore((s) => s.pendingIds);
  const hydrate = useCalendarAppointmentsStore((s) => s.hydrate);
  const patchBooking = useCalendarAppointmentsStore((s) => s.patchBooking);
  const replaceBooking = useCalendarAppointmentsStore((s) => s.replaceBooking);
  const markPending = useCalendarAppointmentsStore((s) => s.markPending);
  const storeSyncKey = useCalendarAppointmentsStore((s) => s.syncKey);

  useEffect(() => {
    const useSamples = options.useSampleData ?? false;
    const mergedBookings = useSamples
      ? mergeBookingsWithSamples(data.bookings, data.tenantId, data.query.dateAnchor)
      : data.bookings;
    const mergedDisplay = useSamples
      ? mergeDisplayWithSamples(data.bookingDisplay, mergedBookings)
      : data.bookingDisplay;

    hydrate({
      tenantId: data.tenantId,
      syncKey,
      bookings: mergedBookings,
      bookingDisplay: mergedDisplay,
    });
  }, [
    data.bookingDisplay,
    data.bookings,
    data.query.dateAnchor,
    data.tenantId,
    hydrate,
    options.useSampleData,
    syncKey,
  ]);

  const activeBookings = storeSyncKey === syncKey ? bookings : data.bookings;
  const activeDisplay = storeSyncKey === syncKey ? bookingDisplay : data.bookingDisplay;

  const buckets = useMemo(() => {
    const m = bucketBookingsIntoCalendar(activeBookings, data.lanes);
    const out: Record<string, FiBookingRow[]> = {};
    for (const lane of data.lanes) {
      out[lane.dayKey] = m.get(lane.dayKey) ?? [];
    }
    return out;
  }, [activeBookings, data.lanes]);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const rescheduleBooking = useCallback(
    async (
      b: FiBookingRow,
      startIso: string,
      endIso: string,
      meta?: CalendarRescheduleMeta
    ): Promise<{ ok: boolean; error?: string }> => {
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
        activeBookings,
        { ignoreBookingId: b.id }
      );
      if (conflicts.length) {
        return {
          ok: false,
          error: `Scheduling conflict: overlaps ${conflicts.length} booking(s) for the same clinician or site.`,
        };
      }

      const snapshot = { ...b };
      const nextMetadata = { ...(b.metadata ?? {}) };
      if (meta?.clearWaitlist) {
        delete nextMetadata.waitlist;
        delete nextMetadata.on_waitlist;
        delete nextMetadata.waitlist_notes;
      }

      const patch: CalendarReschedulePatch = {
        start_at: startIso,
        end_at: endIso,
        assigned_user_id: assignedUserId,
        clinic_id: clinicId,
        metadata: nextMetadata,
      };

      patchBooking(b.id, patch);
      markPending(b.id, true);

      if (isSampleBookingId(b.id)) {
        markPending(b.id, false);
        return { ok: true };
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

      markPending(b.id, false);

      if (!r.ok) {
        replaceBooking(b.id, snapshot);
        return { ok: false, error: r.error };
      }

      refresh();
      return { ok: true };
    },
    [activeBookings, data.tenantId, markPending, patchBooking, refresh, replaceBooking]
  );

  return {
    bookings: activeBookings,
    bookingDisplay: activeDisplay,
    buckets,
    pendingIds,
    rescheduleBooking,
    refresh,
  };
}
