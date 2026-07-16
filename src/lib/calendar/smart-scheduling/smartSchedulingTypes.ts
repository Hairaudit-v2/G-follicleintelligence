/**
 * Smart Scheduling Assistant — types (operational productivity only).
 */

export type SchedulingConflictKind =
  | "doctor_double_booked"
  | "room_double_booked"
  | "staff_double_booked"
  | "patient_double_booked"
  | "high_prep_overlap"
  | "outside_clinic_hours"
  | "surgery_missing_staff"
  | "other";

export type SchedulingConflictSeverity = "info" | "warning" | "error";

export type SchedulingConflictItem = {
  kind: SchedulingConflictKind;
  severity: SchedulingConflictSeverity;
  /** Warm, actionable message for staff. */
  message: string;
  conflictingBookingId: string | null;
  conflictingLabel: string | null;
};

export type SchedulingConflictStatus = "clear" | "warning" | "blocked";

export type PrepReminderSeverity = "info" | "attention";

export type PrepReminderItem = {
  code: string;
  label: string;
  detail: string;
  severity: PrepReminderSeverity;
  /** Optional deep link suffix after /fi-admin/[tenantId]/ */
  hrefSuffix: string | null;
  /** Minutes before appointment when this typically matters. */
  leadMinutes: number;
};

export type SmartSuggestedSlot = {
  startAt: string;
  endAt: string;
  roomId: string | null;
  roomLabel: string | null;
  staffId: string | null;
  staffLabel: string | null;
  reason: string;
  score: number;
};

export type SmartSchedulingSnapshot = {
  status: SchedulingConflictStatus;
  summary: string;
  conflicts: readonly SchedulingConflictItem[];
  prepReminders: readonly PrepReminderItem[];
  suggestions: readonly SmartSuggestedSlot[];
  /** Typical prep buffer minutes for this booking type. */
  prepBufferMinutes: number;
};

export type DetectSchedulingConflictsInput = {
  candidate: {
    id?: string | null;
    startAt: string;
    endAt: string;
    assignedStaffId?: string | null;
    assignedUserId?: string | null;
    roomId?: string | null;
    patientId?: string | null;
    bookingType?: string | null;
    bookingStatus?: string | null;
    roomRequired?: boolean;
  };
  existing: readonly {
    id: string;
    start_at: string;
    end_at: string;
    assigned_staff_id?: string | null;
    assigned_user_id?: string | null;
    room_id?: string | null;
    patient_id?: string | null;
    booking_type?: string | null;
    booking_status?: string | null;
    title?: string | null;
    cancelled_at?: string | null;
  }[];
  /** Optional display labels for warmer messages. */
  staffLabel?: string | null;
  roomLabel?: string | null;
  bufferMinutes?: number;
  businessHours?: { dayStartHour: number; dayEndHour: number; timeZone: string } | null;
};
