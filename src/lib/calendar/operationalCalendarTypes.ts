import type { ParsedCalendarQuery } from "@/src/lib/bookings/calendarQuery";
import type { CalendarDayLane } from "@/src/lib/bookings/calendarView";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { CrmShellClinicOption, CrmShellUserPickerOption } from "@/src/lib/crm/types";
import type { BusinessGridConfig } from "@/src/lib/calendar/operationalCalendarLayout";
import type { FiReminderJobWithTemplate } from "@/src/lib/reminders/reminderTypes";

export type OperationalCalendarBookingDisplay = {
  anchorLabel: string;
  scalesSummary: string | null;
  durationMin: number;
  /** Next pending/processing reminder for this booking, if any. */
  reminderHint: string | null;
};

export type OperationalCalendarResourceColumn = {
  id: string;
  kind: "fi_user" | "clinic" | "unassigned";
  label: string;
  subtitle: string | null;
};

export type OperationalCalendarPageData = {
  tenantId: string;
  query: ParsedCalendarQuery;
  rangeStartIso: string;
  rangeEndIso: string;
  rangeTitle: string;
  lanes: CalendarDayLane[];
  buckets: Record<string, FiBookingRow[]>;
  bookings: FiBookingRow[];
  bookingDisplay: Record<string, OperationalCalendarBookingDisplay>;
  assignees: CrmShellUserPickerOption[];
  clinics: CrmShellClinicOption[];
  resourceColumns: OperationalCalendarResourceColumn[];
  gridConfig: BusinessGridConfig;
  listTruncated: boolean;
  canMutateBookings: boolean;
  /** Serialized map for edit drawer + calendar hints. */
  reminderJobsByBookingId: Record<string, FiReminderJobWithTemplate[]>;
};
