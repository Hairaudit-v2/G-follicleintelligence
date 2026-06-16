"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";

import { rescheduleCalendarAppointmentRequest } from "@/lib/calendar/appointmentsApiClient";
import { logCalendarClientPerf } from "@/src/lib/calendar/calendarPerfDev";
import {
  calendarAppointmentsSyncKey,
  useCalendarAppointmentsStore,
  type CalendarReschedulePatch,
} from "@/lib/calendar/calendarAppointmentsStore";
import {
  calendarBookingsHydrationFingerprint,
  calendarBookingDisplayHydrationFingerprint,
} from "@/src/lib/calendar/calendarHydrationFingerprint";
import { mapCalendarAppointmentToBookingRow } from "@/src/lib/bookings/appointmentDto";
import {
  isSampleBookingId,
  mergeBookingsWithSamples,
  mergeDisplayWithSamples,
} from "@/lib/calendar/sampleAppointments";
import { staffPickerUserMap } from "@/src/components/fi/appointments/staffPickerMap";
import { bucketBookingsIntoCalendar } from "@/src/lib/bookings/calendarView";
import { bookingConflictsForOperationalCalendar } from "@/src/lib/calendar/operationalCalendarLayout";
import type {
  OperationalCalendarBookingDisplay,
  OperationalCalendarPageData,
} from "@/src/lib/calendar/operationalCalendarTypes";
import type { FiBookingRow } from "@/src/lib/bookings/types";

export type CalendarRescheduleMeta = {
  assignedUserId?: string | null;
  assignedStaffId?: string | null;
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
  upsertBooking: (row: FiBookingRow, display?: OperationalCalendarBookingDisplay) => void;
};

/**
 * Client calendar data layer — Zustand store with optimistic drag-and-drop reschedule.
 *
 * - Hydrates from server {@link OperationalCalendarPageData} when the visible booking payload changes
 *   (fingerprinted) or the calendar range key changes — avoids Zustand re-hydration storms on unrelated re-renders.
 * - Optional sample appointments via `useSampleData` or `?sample=1`
 * - Optimistic patch on drag; rolls back on server failure
 */
export function useCalendarAppointments(
  data: OperationalCalendarPageData,
  options: UseCalendarAppointmentsOptions = {}
): UseCalendarAppointmentsResult {
  const router = useRouter();
  const syncKey = [
    calendarAppointmentsSyncKey(data),
    options.useSampleData ? "clientSample:1" : "clientSample:0",
  ].join("|");

  const bookingsHydrationFp = calendarBookingsHydrationFingerprint(data.bookings);
  const displayHydrationFp = calendarBookingDisplayHydrationFingerprint(data.bookingDisplay);

  const bookings = useCalendarAppointmentsStore((s) => s.bookings);
  const bookingDisplay = useCalendarAppointmentsStore((s) => s.bookingDisplay);
  const pendingIds = useCalendarAppointmentsStore((s) => s.pendingIds);
  const hydrate = useCalendarAppointmentsStore((s) => s.hydrate);
  const patchBooking = useCalendarAppointmentsStore((s) => s.patchBooking);
  const replaceBooking = useCalendarAppointmentsStore((s) => s.replaceBooking);
  const markPending = useCalendarAppointmentsStore((s) => s.markPending);
  const upsertBooking = useCalendarAppointmentsStore((s) => s.upsertBooking);
  const storeSyncKey = useCalendarAppointmentsStore((s) => s.syncKey);

  /**
   * Hydrate when the logical server payload changes (fingerprints), not when RSC re-instantiates
   * the same `data.bookings` / `data.bookingDisplay` object identities — see calendarHydrationFingerprint tests.
   */
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
    logCalendarClientPerf("calendar-hydrate", {
      bookingCount: mergedBookings.length,
      displayCount: Object.keys(mergedDisplay).length,
      syncKeyTail: syncKey.slice(-64),
    });
  }, [
    bookingsHydrationFp,
    data.calendarTimezone,
    data.query.dateAnchor,
    data.tenantId,
    displayHydrationFp,
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

  const staffIdToUserId = useMemo(() => staffPickerUserMap(data.staffDirectory), [data.staffDirectory]);

  const rescheduleBooking = useCallback(
    async (
      b: FiBookingRow,
      startIso: string,
      endIso: string,
      meta?: CalendarRescheduleMeta
    ): Promise<CalendarRescheduleResult> => {
      let nextStaffId = b.assigned_staff_id;
      let nextUserId = b.assigned_user_id;
      let nextClinicId = b.clinic_id;

      if (meta) {
        if (Object.prototype.hasOwnProperty.call(meta, "assignedStaffId")) {
          const sid = meta.assignedStaffId?.trim() || null;
          nextStaffId = sid;
          nextUserId = sid ? staffIdToUserId.get(sid) ?? null : null;
        } else if (Object.prototype.hasOwnProperty.call(meta, "assignedUserId")) {
          nextUserId = meta.assignedUserId?.trim() || null;
          nextStaffId = null;
        }
        if (Object.prototype.hasOwnProperty.call(meta, "clinicId")) {
          nextClinicId = meta.clinicId?.trim() || null;
        }
      }

      const useSamples = Boolean(options.useSampleData || data.query.sampleMode);
      const conflicts = bookingConflictsForOperationalCalendar(
        {
          id: b.id,
          start_at: startIso,
          end_at: endIso,
          assigned_staff_id: nextStaffId,
          assigned_user_id: nextUserId,
          clinic_id: nextClinicId,
        },
        activeBookings,
        {
          ignoreBookingId: b.id,
          sameResourceColumnOverlapConflicts: useSamples,
          staffIdToUserId,
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
        assigned_staff_id: nextStaffId,
        assigned_user_id: nextUserId,
        clinic_id: nextClinicId,
        metadata: nextMetadata,
      };

      patchBooking(b.id, patch);
      markPending(b.id, true);

      if (isSampleBookingId(b.id)) {
        markPending(b.id, false);
        return { ok: true };
      }

      const req: Parameters<typeof rescheduleCalendarAppointmentRequest>[0] = {
        tenantId: data.tenantId,
        appointmentId: b.id,
        startAt: startIso,
        endAt: endIso,
        metadata: meta?.clearWaitlist ? nextMetadata : undefined,
      };
      if (meta && Object.prototype.hasOwnProperty.call(meta, "assignedStaffId")) {
        req.staffId = nextStaffId;
      }
      if (
        meta &&
        Object.prototype.hasOwnProperty.call(meta, "assignedUserId") &&
        !Object.prototype.hasOwnProperty.call(meta, "assignedStaffId")
      ) {
        req.providerId = nextUserId ?? null;
      }
      if (meta && Object.prototype.hasOwnProperty.call(meta, "clinicId")) {
        req.clinicId = nextClinicId ?? undefined;
      }

      const r = await rescheduleCalendarAppointmentRequest(req);

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
    [
      activeBookings,
      data.staffDirectory,
      data.query.sampleMode,
      data.tenantId,
      markPending,
      options.useSampleData,
      patchBooking,
      refresh,
      replaceBooking,
      staffIdToUserId,
    ]
  );

  return {
    bookings: activeBookings,
    bookingDisplay: activeDisplay,
    buckets,
    pendingIds,
    rescheduleBooking,
    refresh,
    upsertBooking,
  };
}
