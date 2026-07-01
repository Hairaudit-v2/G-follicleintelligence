import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  findNextAvailableBookingSlots,
  type FindNextAvailableBookingSlotsInput,
  type NextAvailableBookingSlot,
} from "@/src/lib/calendar/findNextAvailableBookingSlots.server";
import { rankSurgerySlotSuggestions } from "@/src/lib/calendarIntelligence/calendarIntelligenceCore";

export type FindNextAvailableSurgerySlotsInput = Omit<
  FindNextAvailableBookingSlotsInput,
  "bookingType"
> & {
  /** Default 480 (8h) when omitted. */
  durationMinutes?: number;
  client?: SupabaseClient;
};

export type FindNextAvailableSurgerySlotsResult = {
  slots: NextAvailableBookingSlot[];
};

/**
 * Surgery-aware slot finder — delegates to the shared availability engine with surgery defaults
 * and ranks suggestions for the surgery booking wizard.
 */
export async function findNextAvailableSurgerySlots(
  input: FindNextAvailableSurgerySlotsInput
): Promise<FindNextAvailableSurgerySlotsResult> {
  assertNonEmptyUuid(input.tenantId, "tenantId");
  assertNonEmptyUuid(input.clinicId, "clinicId");

  const result = await findNextAvailableBookingSlots({
    ...input,
    bookingType: "surgery",
    durationMinutes: input.durationMinutes ?? 480,
    limit: input.limit ?? 8,
    maxDaysForward: input.maxDaysForward ?? 21,
  });

  return {
    slots: rankSurgerySlotSuggestions(result.slots),
  };
}