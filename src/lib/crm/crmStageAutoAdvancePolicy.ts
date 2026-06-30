/**
 * Pure policy for FI-internal CRM stage auto-advance (Timely / ConsultationOS).
 */

import { isBookingCancelled } from "@/src/lib/bookings/bookingPolicy";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { isConsultationLikeBookingType } from "@/src/lib/consultations/consultationBookingLink";

export type CrmStageAutoAdvanceAction = "advanced" | "unchanged" | "skipped";

export const CRM_TERMINAL_LEAD_STATUSES = ["archived", "lost", "converted"] as const;

/** Consultation row statuses that trigger consult_completed CRM advance. */
export const CONSULTATION_CRM_COMPLETE_STATUSES = ["completed", "submitted", "locked"] as const;

export function isTerminalCrmLeadStatus(status: string | null | undefined): boolean {
  const s = String(status ?? "")
    .trim()
    .toLowerCase();
  return (CRM_TERMINAL_LEAD_STATUSES as readonly string[]).includes(s);
}

export function isConsultationCrmCompleteStatus(status: string | null | undefined): boolean {
  const s = String(status ?? "")
    .trim()
    .toLowerCase();
  return (CONSULTATION_CRM_COMPLETE_STATUSES as readonly string[]).includes(s);
}

export function findPipelineStageBySlug<T extends { slug: string }>(
  stages: readonly T[],
  slug: string
): T | null {
  const needle = slug.trim().toLowerCase();
  return stages.find((s) => s.slug.trim().toLowerCase() === needle) ?? null;
}

export function findPipelineStageById<T extends { id: string }>(
  stages: readonly T[],
  stageId: string | null | undefined
): T | null {
  const id = stageId?.trim();
  if (!id) return null;
  return stages.find((s) => s.id === id) ?? null;
}

/**
 * Returns whether the lead should advance toward `targetSortOrder`.
 * Null current order is treated as earlier than any target.
 */
export function shouldAdvanceCrmLeadToTargetSortOrder(
  currentSortOrder: number | null,
  targetSortOrder: number
): boolean {
  if (currentSortOrder === null || !Number.isFinite(currentSortOrder)) return true;
  return currentSortOrder < targetSortOrder;
}

export function timelyConsultationBookingEligibleForCrmAdvance(
  booking: Pick<FiBookingRow, "booking_type" | "booking_status" | "cancelled_at">
): boolean {
  if (!isConsultationLikeBookingType(booking.booking_type)) return false;
  if (isBookingCancelled(booking)) return false;
  if (booking.booking_status.trim() === "no_show") return false;
  return true;
}

export function consultationEligibleForCrmCompleteAdvance(consultation: {
  lead_id: string | null | undefined;
  status: string;
}): boolean {
  if (!consultation.lead_id?.trim()) return false;
  return isConsultationCrmCompleteStatus(consultation.status);
}
