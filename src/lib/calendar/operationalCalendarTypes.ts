import type { FiClinicRoomRow } from "@/src/lib/rooms/roomTypes";
import type { ParsedCalendarQuery } from "@/src/lib/bookings/calendarQuery";
import type { CalendarDayLane } from "@/src/lib/bookings/calendarView";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { CrmShellClinicOption, CrmShellUserPickerOption } from "@/src/lib/crm/types";
import type { ClinicalStaffPickerOption } from "@/src/lib/staff/clinicalStaffPicker";
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
  /** From `fi_patients.metadata` when the booking is anchored to a patient. */
  patientEmail?: string | null;
  patientPhone?: string | null;
  /** Assigned room display name when `room_id` is set. */
  roomLabel?: string | null;
  /** Compact multi-room line from `fi_booking_resource_assignments` (includes primary label). */
  resourceRoomLine?: string | null;
  /** Compact team line (primary + assignment staff). */
  resourceTeamLine?: string | null;
};

export type OperationalCalendarResourceColumn = {
  id: string;
  kind: "fi_staff" | "fi_user" | "clinic" | "room" | "unassigned";
  label: string;
  subtitle: string | null;
  /** Present on `fi_staff` columns. */
  staffId?: string;
  /** Present on legacy `fi_user` owner columns. */
  legacyUserId?: string;
  clinicallyAvailable?: boolean;
  readinessWarning?: string | null;
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
  /** Active `fi_staff` with readiness — day columns, staff URL filter, clinical pickers. */
  staffDirectory: ClinicalStaffPickerOption[];
  clinics: CrmShellClinicOption[];
  rooms: FiClinicRoomRow[];
  roomDisplayById: Record<string, string>;
  resourceColumns: OperationalCalendarResourceColumn[];
  gridConfig: BusinessGridConfig;
  listTruncated: boolean;
  canMutateBookings: boolean;
  /**
   * When {@link canMutateBookings} is false, human-readable reason (sign-in, membership, or role).
   * Shown next to the calendar “Read-only” badge so operators know what to fix.
   */
  bookingMutationBlockedReason: string | null;
  /** Serialized map for edit drawer + calendar hints. */
  reminderJobsByBookingId: Record<string, FiReminderJobWithTemplate[]>;
  /** Tenant procedure catalog — durations, prices, colours for booking UI. */
  services: FiServiceRow[];
  /**
   * Non-blocking setup hints (empty services, staff hours, timezone).
   * Bookings can still be created when these are present.
   */
  setupRecommendations: string[];
  /** When set, the server page should redirect to canonical `staffId` (legacy `assignedUserId` resolved). */
  canonicalRedirectHref?: string | null;
  /**
   * Signed-in user's linked `fi_staff.working_hours._profile.primary_clinic_id` when valid for this tenant.
   * Used by Quick Book to auto-resolve clinic when the calendar URL has no `clinicId` filter.
   */
  calendarOperatorPrimaryClinicId?: string | null;
};
