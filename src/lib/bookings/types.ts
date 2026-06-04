export type JsonObject = Record<string, unknown>;

/** Row shape for `fi_bookings` (Stage 3A). */
export type FiBookingRow = {
  id: string;
  tenant_id: string;
  lead_id: string | null;
  person_id: string | null;
  patient_id: string | null;
  case_id: string | null;
  clinic_id: string | null;
  assigned_user_id: string | null;
  booking_type: string;
  booking_status: string;
  title: string | null;
  description: string | null;
  start_at: string;
  end_at: string;
  timezone: string | null;
  location: string | null;
  metadata: JsonObject;
  cancelled_at: string | null;
  cancelled_by_user_id: string | null;
  cancellation_reason: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};
