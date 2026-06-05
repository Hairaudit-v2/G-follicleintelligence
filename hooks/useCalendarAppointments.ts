"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";

import { rescheduleCalendarAppointmentRequest } from "@/lib/calendar/appointmentsApiClient";
import {
  calendarAppointmentsSyncKey,
  useCalendarAppointmentsStore,
  type CalendarReschedulePatch,
} from "@/lib/calendar/calendarAppointmentsStore";
import { mapCalendarAppointmentToBookingRow } from "@/src/lib/bookings/appointmentDto";
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

export type CalendarRescheduleResult = {
  ok: boolean;
  error?: string;
  conflictingAppointmentId?: string | null;
  /** Server returned HTTP 409 (double-book / overlap). */
  isConflict?: boolean;
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
  ) => Promise<CalendarRescheduleResult>;
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
    const useSamples = Boolean(options.useSampleData || data.query.sampleMode);
    const mergedBookings = useSamples
      ? mergeBookingsWithSamples(data.bookings, data.tenantId, data.query.dateAnchor)
      : data.bookings;
    const mergedDisplay = useSamples
      ? mergeDisplayWithSamples(data.bookingDisplay, mergedBookings)
      : data.bookingDisplay;

    hydrate({
      tenantId: data.tenantId,
      syncKey,
      calendarTimezone: data.calendarTimezone,
      bookings: mergedBookings,
      bookingDisplay: mergedDisplay,
    });
  }, [
    data.bookingDisplay,
    data.bookings,
    data.calendarTimezone,
    data.query.dateAnchor,
    data.tenantId,
    hydrate,
    data.query.sampleMode,
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
    ): Promise<CalendarRescheduleResult> => {
      const assignedUserId =
        meta && "assignedUserId" in meta ? (meta.assignedUserId ?? null) : b.assigned_user_id;
      const clinicId = meta && "clinicId" in meta ? (meta.clinicId ?? null) : b.clinic_id;

      const useSamples = Boolean(options.useSampleData || data.query.sampleMode);
      const conflicts = bookingConflictsForOperationalCalendar(
        {
          id: b.id,
          start_at: startIso,
          end_at: endIso,
          assigned_user_id: assignedUserId,
          clinic_id: clinicId,
        },
        activeBookings,
        {
          ignoreBookingId: b.id,
          sameResourceColumnOverlapConflicts: useSamples,
        }
      );
      if (conflicts.length) {
        const first = conflicts[0];
        const label = first.title?.trim() || first.id.slice(0, 8);
        return {
          ok: false,
          error: `Scheduling conflict — overlaps "${label}" in this column or site.`,
          conflictingAppointmentId: first.id,
          isConflict: true,
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

      const r = await rescheduleCalendarAppointmentRequest({
        tenantId: data.tenantId,
        appointmentId: b.id,
        startAt: startIso,
        endAt: endIso,
        providerId: assignedUserId,
        clinicId: clinicId,
        metadata: meta?.clearWaitlist ? nextMetadata : undefined,
      });

      markPending(b.id, false);

      if (!r.ok) {
        replaceBooking(b.id, snapshot);
        return {
          ok: false,
          error: r.error,
          conflictingAppointmentId: r.conflictingAppointmentId ?? null,
          isConflict: Boolean(r.isConflict),
        };
      }

      replaceBooking(b.id, mapCalendarAppointmentToBookingRow(r.appointment, snapshot));
      refresh();
      return { ok: true };
    },
    [activeBookings, data.query.sampleMode, data.tenantId, markPending, options.useSampleData, patchBooking, refresh, replaceBooking]
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
