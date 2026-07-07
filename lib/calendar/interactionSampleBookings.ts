/**
 * Extra sample rows for CalendarOS V2 interaction e2e (`?sample=1`).
 * IDs use {@link SAMPLE_BOOKING_ID_PREFIX} — client-only reschedule (no server PATCH).
 */

import type { FiBookingRow } from "@/src/lib/bookings/types";

const PREFIX = "sample-";

export const E2E_SAMPLE_BOOKING_IDS = {
  fiConsult: `${PREFIX}e2e-fi-consult`,
  overlapAnchor: `${PREFIX}e2e-overlap-anchor`,
  overlapBlocker: `${PREFIX}e2e-overlap-blocker`,
  googleImport: `${PREFIX}e2e-google-import`,
  timelyImport: `${PREFIX}e2e-timely-import`,
  weekMove: `${PREFIX}e2e-week-move`,
} as const;

type SamplePartial = Pick<
  FiBookingRow,
  "id" | "booking_type" | "booking_status" | "title" | "start_at" | "end_at"
> &
  Partial<
    Pick<
      FiBookingRow,
      | "location"
      | "assigned_staff_id"
      | "assigned_user_id"
      | "room_id"
      | "room_required"
      | "clinic_id"
      | "metadata"
      | "description"
      | "timezone"
    >
  >;

function utcMidnightMs(ymd: string): number {
  const y = Number(ymd.slice(0, 4));
  const mo = Number(ymd.slice(5, 7)) - 1;
  const d = Number(ymd.slice(8, 10));
  return Date.UTC(y, mo, d, 0, 0, 0, 0);
}

function isoAtUtcDayHour(ymd: string, hour: number, minute = 0): string {
  return new Date(utcMidnightMs(ymd) + (hour * 60 + minute) * 60_000).toISOString();
}

function weekMondayYmd(dateAnchor: string): string {
  const ms = utcMidnightMs(dateAnchor);
  const dow = new Date(ms).getUTCDay();
  const offset = (dow + 6) % 7;
  return new Date(ms - offset * 86_400_000).toISOString().slice(0, 10);
}

function addDays(ymd: string, days: number): string {
  return new Date(utcMidnightMs(ymd) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Interaction-focused sample bookings merged when `?sample=1` is active. */
export function generateInteractionSampleBookings(
  tenantId: string,
  dateAnchor: string,
  baseRow: (tenantId: string, partial: SamplePartial) => FiBookingRow
): FiBookingRow[] {
  const mon = weekMondayYmd(dateAnchor);
  const tue = addDays(mon, 1);

  return [
    baseRow(tenantId, {
      id: E2E_SAMPLE_BOOKING_IDS.fiConsult,
      booking_type: "consultation",
      booking_status: "scheduled",
      title: "E2E Patient Alpha — Consultation",
      start_at: isoAtUtcDayHour(mon, 10, 0),
      end_at: isoAtUtcDayHour(mon, 10, 45),
      metadata: {
        display_name: "E2E Patient Alpha",
        procedure_label: "Consultation",
        e2e_interaction: true,
      },
    }),
    baseRow(tenantId, {
      id: E2E_SAMPLE_BOOKING_IDS.overlapAnchor,
      booking_type: "consultation",
      booking_status: "scheduled",
      title: "E2E Overlap Anchor — Consultation",
      start_at: isoAtUtcDayHour(mon, 12, 0),
      end_at: isoAtUtcDayHour(mon, 12, 30),
      metadata: { display_name: "E2E Overlap Anchor", e2e_interaction: true },
    }),
    baseRow(tenantId, {
      id: E2E_SAMPLE_BOOKING_IDS.overlapBlocker,
      booking_type: "consultation",
      booking_status: "scheduled",
      title: "E2E Overlap Blocker — Consultation",
      start_at: isoAtUtcDayHour(mon, 12, 15),
      end_at: isoAtUtcDayHour(mon, 12, 45),
      metadata: { display_name: "E2E Overlap Blocker", e2e_interaction: true },
    }),
    baseRow(tenantId, {
      id: E2E_SAMPLE_BOOKING_IDS.googleImport,
      booking_type: "consultation",
      booking_status: "confirmed",
      title: "E2E External — Google Consult",
      start_at: isoAtUtcDayHour(mon, 11, 0),
      end_at: isoAtUtcDayHour(mon, 11, 30),
      metadata: {
        calendar_os_event: true,
        source: "google",
        display_name: "E2E External",
        e2e_interaction: true,
      },
    }),
    baseRow(tenantId, {
      id: E2E_SAMPLE_BOOKING_IDS.timelyImport,
      booking_type: "consultation",
      booking_status: "confirmed",
      title: "E2E Patient Timely — Consultation",
      start_at: isoAtUtcDayHour(mon, 11, 30),
      end_at: isoAtUtcDayHour(mon, 12, 0),
      metadata: {
        source_system: "timely",
        external_appointment_id: "TA-E2E-1",
        display_name: "E2E Patient Timely",
        e2e_interaction: true,
      },
    }),
    baseRow(tenantId, {
      id: E2E_SAMPLE_BOOKING_IDS.weekMove,
      booking_type: "consultation",
      booking_status: "scheduled",
      title: "E2E Week Move — Consultation",
      start_at: isoAtUtcDayHour(tue, 10, 0),
      end_at: isoAtUtcDayHour(tue, 10, 45),
      metadata: { display_name: "E2E Week Move", e2e_interaction: true },
    }),
  ];
}
