import "server-only";

import type { ProcedureDayBoardPayload } from "@/src/lib/surgery/procedureDayBoardLoader.server";

import { buildProcedureDayLiveCardState } from "./procedureDayLiveCore";
import { loadProcedureDaySessionsForBookings } from "./procedureDaySessionLoaders.server";
import type { ProcedureDayLiveBoardPayload } from "./procedureDayWorkflowTypes";

export { buildProcedureDayLiveCardState } from "./procedureDayLiveCore";

export async function enrichProcedureDayBoardWithLiveWorkflow(
  payload: ProcedureDayBoardPayload
): Promise<ProcedureDayLiveBoardPayload> {
  const bookingIds = payload.scheduleGroups.flatMap((g) => g.cards.map((c) => c.bookingId));
  const sessions = await loadProcedureDaySessionsForBookings(payload.tenantId, bookingIds);
  const flatCards = payload.scheduleGroups.flatMap((g) => g.cards);
  const liveByBooking = new Map<string, ReturnType<typeof buildProcedureDayLiveCardState>>();
  for (const card of flatCards) {
    liveByBooking.set(
      card.bookingId,
      buildProcedureDayLiveCardState(card, sessions.get(card.bookingId) ?? null)
    );
  }

  const activeSessions = [...liveByBooking.values()].filter(
    (s) => s.isLive && s.currentStage !== "completed" && s.currentStage !== "discharged"
  ).length;

  return {
    ...payload,
    liveWorkflowEnabled: true,
    liveByBooking: Object.fromEntries(liveByBooking),
    liveSummary: {
      activeSessions,
      completedToday: [...liveByBooking.values()].filter((s) => s.currentStage === "completed").length,
      dischargedToday: [...liveByBooking.values()].filter((s) => s.currentStage === "discharged")
        .length,
    },
  };
}