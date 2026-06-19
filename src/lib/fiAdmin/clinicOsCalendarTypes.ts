/** Matches `ClinicOsCalendarHome` grid columns (Stage 1J). */
export type ClinicOsCalendarColumnId = "doctor" | "consultant" | "nursePrp" | "surgeryRoom";

/** Serializable live row for the read-only Clinic OS day grid (Stage 2A). */
export type ClinicOsCalendarLiveBookingDTO = {
  id: string;
  title: string;
  patientName: string;
  appointmentType: string;
  startTime: string;
  endTime: string;
  staffName: string | null;
  roomName: string | null;
  status: string | null;
  /** No dedicated booking detail route today — left null so cards stay non-navigating. */
  href: string | null;
  /** Minutes from business-day start on the clinic-local grid (clamped). */
  startMin: number;
  durationMin: number;
  column: ClinicOsCalendarColumnId;
};

export type ClinicOsCalendarReadOnlyPayload = {
  tenantId: string;
  /** IANA timezone for the day window and grid placement. */
  calendarTimezone: string;
  /** Clinic-local `YYYY-MM-DD` used for the overlap query. */
  dayYmd: string;
  /** Clinic-local business grid start hour (wall clock). */
  dayStartHour: number;
  /** Clinic-local business grid end hour (exclusive). */
  dayEndHour: number;
  liveBookings: ClinicOsCalendarLiveBookingDTO[];
  listTruncated: boolean;
};