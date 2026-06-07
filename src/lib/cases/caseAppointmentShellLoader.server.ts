import "server-only";

import { loadBookingsForCase, loadBookingsForPatient } from "@/src/lib/bookings/bookings";
import { sortBookingsByStartAt } from "@/src/lib/bookings/bookingTime";
import type { FiBookingRow } from "@/src/lib/bookings/types";

/**
 * Bookings for {@link AppointmentSlideOverProvider}: all rows anchored to the case, merged with
 * the linked {@code fi_patients.id} patient's bookings (when present) so availability checks see
 * the same overlap surface as PatientOS — without duplicating calendar query logic.
 */
export async function loadCaseAppointmentBookingsForShell(
  tenantId: string,
  caseId: string,
  /** {@code fi_patients.id} when the case has a resolved patient link (see {@link CasePatientLink}). */
  linkedFiPatientId: string | null
): Promise<FiBookingRow[]> {
  const tid = tenantId.trim();
  const cid = caseId.trim();
  const byId = new Map<string, FiBookingRow>();
  for (const b of await loadBookingsForCase(tid, cid)) {
    byId.set(b.id, b);
  }
  const pid = linkedFiPatientId?.trim() || null;
  if (pid) {
    for (const b of await loadBookingsForPatient(tid, pid)) {
      byId.set(b.id, b);
    }
  }
  return sortBookingsByStartAt(Array.from(byId.values()));
}
