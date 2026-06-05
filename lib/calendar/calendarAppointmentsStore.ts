"use client";

import { create } from "zustand";

import type { OperationalCalendarBookingDisplay } from "@/src/lib/calendar/operationalCalendarTypes";
import { DEFAULT_CALENDAR_TIMEZONE } from "@/src/lib/calendar/calendarTimezone";
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
  assigned_user_id?: string | null;
  clinic_id?: string | null;
  metadata?: FiBookingRow["metadata"];
};

type CalendarAppointmentsState = {
  tenantId: string | null;
  syncKey: string | null;
  calendarTimezone: string;
  bookings: FiBookingRow[];
  bookingDisplay: Record<string, OperationalCalendarBookingDisplay>;
  /** Booking ids currently awaiting server confirmation after optimistic move. */
  pendingIds: Set<string>;

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

  hydrate: ({ tenantId, syncKey, calendarTimezone, bookings, bookingDisplay }) => {
    const current = get();
    const navigatedAway = current.syncKey != null && current.syncKey !== syncKey;
    if (navigatedAway) {
      set({
        tenantId,
        syncKey,
        calendarTimezone,
        bookings,
        bookingDisplay,
        pendingIds: new Set(),
      });
      return;
    }
    if (current.pendingIds.size > 0) {
      return;
    }
    set({
      tenantId,
      syncKey,
      calendarTimezone,
      bookings,
      bookingDisplay,
      pendingIds: new Set(),
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
              assigned_user_id:
                patch.assigned_user_id !== undefined ? patch.assigned_user_id : b.assigned_user_id,
              clinic_id: patch.clinic_id !== undefined ? patch.clinic_id : b.clinic_id,
              metadata: patch.metadata ?? b.metadata,
              updated_at: new Date().toISOString(),
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
      const bookings = has ? state.bookings.map((b) => (b.id === row.id ? row : b)) : [...state.bookings, row];
      const startMs = Date.parse(row.start_at);
      const endMs = Date.parse(row.end_at);
      const durationMin =
        Number.isFinite(startMs) && Number.isFinite(endMs)
          ? Math.max(1, Math.round((endMs - startMs) / 60_000))
          : 30;
      const hint: OperationalCalendarBookingDisplay =
        display ??
        ({
          anchorLabel: row.title?.trim() || row.booking_type || "Booking",
          scalesSummary: null,
          durationMin,
          reminderHint: null,
        } satisfies OperationalCalendarBookingDisplay);
      return {
        bookings,
        bookingDisplay: { ...state.bookingDisplay, [row.id]: hint },
      };
    });
  },

  markPending: (id, pending) => {
    set((state) => {
      const next = new Set(state.pendingIds);
      if (pending) next.add(id);
      else next.delete(id);
      return { pendingIds: next };
    });
  },

  getBooking: (id) => get().bookings.find((b) => b.id === id),
}));

/** Build a stable key when server range / view changes. */
export function calendarAppointmentsSyncKey(data: {
  tenantId: string;
  rangeStartIso: string;
  rangeEndIso: string;
  calendarTimezone: string;
  query: { view: string; dateAnchor: string };
}): string {
  return [
    data.tenantId,
    data.calendarTimezone,
    data.rangeStartIso,
    data.rangeEndIso,
    data.query.view,
    data.query.dateAnchor,
  ].join("|");
}
