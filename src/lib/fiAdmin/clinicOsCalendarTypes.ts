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
  /** Minutes from 8:00 UTC within the visible grid (clamped). */
  startMin: number;
  durationMin: number;
  column: ClinicOsCalendarColumnId;
};

export type ClinicOsCalendarReadOnlyPayload = {
  tenantId: string;
  /** UTC `YYYY-MM-DD` used for the overlap query (matches booking calendar conventions). */
  dayUtcYmd: string;
  liveBookings: ClinicOsCalendarLiveBookingDTO[];
  listTruncated: boolean;
};
