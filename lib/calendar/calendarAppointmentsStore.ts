"use client";

import { create } from "zustand";

import {
  mergeCalendarBookingDisplayOnHydrate,
  mergeCalendarBookingsOnHydrate,
} from "@/lib/calendar/calendarAppointmentsMerge";
import type { OperationalCalendarBookingDisplay } from "@/src/lib/calendar/operationalCalendarTypes";
import { optimisticBookingAnchorLabel } from "@/src/lib/bookings/bookingDisplayName";
import {
  bookingDurationMinutesUtc,
  DEFAULT_CALENDAR_TIMEZONE,
  utcNowIso,
} from "@/src/lib/calendar/calendarTimezone";
import type { FiBookingRow } from "@/src/lib/bookings/types";

export type CalendarAppointmentsHydrateInput = {
  tenantId: string;
  syncKey: string;
  calendarTimezone: string;
  bookings: FiBookingRow[];
  bookingDisplay: Record<string, OperationalCalendarBookingDisplay>;
};

export type CalendarReschedulePatch = {
  start_at: string;
  end_at: string;
  assigned_staff_id?: string | null;
  assigned_user_id?: string | null;
  clinic_id?: string | null;
  metadata?: FiBookingRow["metadata"];
};

/** Expire stale optimistic pending ids so server hydrates are not blocked forever. */
export const CALENDAR_PENDING_IDS_EXPIRE_MS = 30_000;

type PendingEntry = { markedAt: number };

type CalendarAppointmentsState = {
  tenantId: string | null;
  syncKey: string | null;
  calendarTimezone: string;
  bookings: FiBookingRow[];
  bookingDisplay: Record<string, OperationalCalendarBookingDisplay>;
  /** Booking ids currently awaiting server confirmation after optimistic move. */
  pendingIds: Set<string>;
  pendingMeta: Map<string, PendingEntry>;

  hydrate: (input: CalendarAppointmentsHydrateInput) => void;
  patchBooking: (id: string, patch: CalendarReschedulePatch) => void;
  replaceBooking: (id: string, snapshot: FiBookingRow) => void;
  /** Append or replace a row after server create (phone call-in, etc.). */
  upsertBooking: (row: FiBookingRow, display?: OperationalCalendarBookingDisplay) => void;
  markPending: (id: string, pending: boolean) => void;
  getBooking: (id: string) => FiBookingRow | undefined;
};

export const useCalendarAppointmentsStore = create<CalendarAppointmentsState>((set, get) => ({
  tenantId: null,
  syncKey: null,
  calendarTimezone: DEFAULT_CALENDAR_TIMEZONE,
  bookings: [],
  bookingDisplay: {},
  pendingIds: new Set(),
  pendingMeta: new Map(),

  hydrate: ({ tenantId, syncKey, calendarTimezone, bookings, bookingDisplay }) => {
    const current = get();
    const now = Date.now();
    const activePending = new Set<string>();
    const activeMeta = new Map<string, PendingEntry>();
    for (const id of current.pendingIds) {
      const meta = current.pendingMeta.get(id);
      if (meta && now - meta.markedAt < CALENDAR_PENDING_IDS_EXPIRE_MS) {
        activePending.add(id);
        activeMeta.set(id, meta);
      }
    }

    const navigatedAway = current.syncKey != null && current.syncKey !== syncKey;
    if (navigatedAway) {
      set({
        tenantId,
        syncKey,
        calendarTimezone,
        bookings,
        bookingDisplay,
        pendingIds: new Set(),
        pendingMeta: new Map(),
      });
      return;
    }

    const mergedBookings = mergeCalendarBookingsOnHydrate(bookings, current.bookings);
    const mergedDisplay = mergeCalendarBookingDisplayOnHydrate(
      bookingDisplay,
      current.bookingDisplay,
      mergedBookings
    );

    if (activePending.size > 0) {
      for (const id of activePending) {
        const serverRow = bookings.find((b) => b.id === id);
        const clientRow = current.bookings.find((b) => b.id === id);
        if (serverRow && clientRow && serverRow.updated_at !== clientRow.updated_at) {
          activePending.delete(id);
          activeMeta.delete(id);
        }
      }
    }

    if (activePending.size > 0) {
      const pendingBookings = mergedBookings.map((b) => {
        if (!activePending.has(b.id)) return b;
        const local = current.bookings.find((x) => x.id === b.id);
        return local ?? b;
      });
      set({
        tenantId,
        syncKey,
        calendarTimezone,
        bookings: pendingBookings,
        bookingDisplay: mergedDisplay,
        pendingIds: activePending,
        pendingMeta: activeMeta,
      });
      return;
    }

    set({
      tenantId,
      syncKey,
      calendarTimezone,
      bookings: mergedBookings,
      bookingDisplay: mergedDisplay,
      pendingIds: new Set(),
      pendingMeta: new Map(),
    });
  },

  patchBooking: (id, patch) => {
    set((state) => ({
      bookings: state.bookings.map((b) =>
        b.id === id
          ? {
              ...b,
              start_at: patch.start_at,
              end_at: patch.end_at,
              assigned_staff_id:
                patch.assigned_staff_id !== undefined
                  ? patch.assigned_staff_id
                  : b.assigned_staff_id,
              assigned_user_id:
                patch.assigned_user_id !== undefined ? patch.assigned_user_id : b.assigned_user_id,
              clinic_id: patch.clinic_id !== undefined ? patch.clinic_id : b.clinic_id,
              metadata: patch.metadata ?? b.metadata,
              updated_at: utcNowIso(),
            }
          : b
      ),
    }));
  },

  replaceBooking: (id, snapshot) => {
    set((state) => ({
      bookings: state.bookings.map((b) => (b.id === id ? snapshot : b)),
    }));
  },

  upsertBooking: (row, display) => {
    set((state) => {
      const has = state.bookings.some((b) => b.id === row.id);
      const bookings = has
        ? state.bookings.map((b) => (b.id === row.id ? row : b))
        : [...state.bookings, row];
      const durationMin = bookingDurationMinutesUtc(row.start_at, row.end_at) ?? 30;
      const existing = state.bookingDisplay[row.id];
      const hint: OperationalCalendarBookingDisplay =
        display ??
        (existing
          ? { ...existing, durationMin }
          : {
              anchorLabel: optimisticBookingAnchorLabel(row),
              scalesSummary: null,
              durationMin,
              reminderHint: null,
            });
      return {
        bookings,
        bookingDisplay: { ...state.bookingDisplay, [row.id]: hint },
      };
    });
  },

  markPending: (id, pending) => {
    set((state) => {
      const next = new Set(state.pendingIds);
      const nextMeta = new Map(state.pendingMeta);
      if (pending) {
        next.add(id);
        nextMeta.set(id, { markedAt: Date.now() });
      } else {
        next.delete(id);
        nextMeta.delete(id);
      }
      return { pendingIds: next, pendingMeta: nextMeta };
    });
  },

  getBooking: (id) => get().bookings.find((b) => b.id === id),
}));

/** Build a stable key when server range / view changes (includes demo sample flag — it changes merged rows). */
export function calendarAppointmentsSyncKey(data: {
  tenantId: string;
  rangeStartIso: string;
  rangeEndIso: string;
  calendarTimezone: string;
  query: { view: string; dateAnchor: string; sampleMode?: boolean };
}): string {
  return [
    data.tenantId,
    data.calendarTimezone,
    data.rangeStartIso,
    data.rangeEndIso,
    data.query.view,
    data.query.dateAnchor,
    data.query.sampleMode ? "sample:1" : "sample:0",
  ].join("|");
}
