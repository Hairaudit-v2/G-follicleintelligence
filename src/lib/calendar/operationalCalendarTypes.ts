import type { ParsedCalendarQuery } from "@/src/lib/bookings/calendarQuery";
import type { CalendarDayLane } from "@/src/lib/bookings/calendarView";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { CrmShellClinicOption, CrmShellUserPickerOption } from "@/src/lib/crm/types";
import type { BusinessGridConfig } from "@/src/lib/calendar/operationalCalendarLayout";
import type { FiReminderJobWithTemplate } from "@/src/lib/reminders/reminderTypes";
import type { FiServiceRow } from "@/src/lib/services/fiServiceTypes";

export type OperationalCalendarBookingDisplay = {
  anchorLabel: string;
  scalesSummary: string | null;
  durationMin: number;
  /** Next pending/processing reminder for this booking, if any. */
  reminderHint: string | null;
  /** Display name from `fi_services` when the row maps to this booking's `booking_type`. */
  procedureCatalogName?: string | null;
  procedureCatalogHex?: string | null;
  suggestedPrice?: number | null;
};

export type OperationalCalendarResourceColumn = {
  id: string;
  kind: "fi_staff" | "fi_user" | "clinic" | "unassigned";
  label: string;
  subtitle: string | null;
};

export type OperationalCalendarPageData = {
  tenantId: string;
  query: ParsedCalendarQuery;
  /** Effective IANA timezone for this calendar view. */
  calendarTimezone: string;
  rangeStartIso: string;
  rangeEndIso: string;
  rangeTitle: string;
  lanes: CalendarDayLane[];
  buckets: Record<string, FiBookingRow[]>;
  bookings: FiBookingRow[];
  bookingDisplay: Record<string, OperationalCalendarBookingDisplay>;
  /** `fi_users` — booking drawers, quick call-in, and legacy user pickers. */
  assignees: CrmShellUserPickerOption[];
  /** Active `fi_staff` — day columns, staff URL filter, overlap map (`staffId` → `fi_user_id`). */
  staffDirectory: CrmShellUserPickerOption[];
  clinics: CrmShellClinicOption[];
  resourceColumns: OperationalCalendarResourceColumn[];
  gridConfig: BusinessGridConfig;
  listTruncated: boolean;
  canMutateBookings: boolean;
  /** Serialized map for edit drawer + calendar hints. */
  reminderJobsByBookingId: Record<string, FiReminderJobWithTemplate[]>;
  /** Tenant procedure catalog — durations, prices, colours for booking UI. */
  services: FiServiceRow[];
};
