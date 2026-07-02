import "server-only";

import type { TodayEntityAttentionSignal } from "@/src/lib/fiOs/todayFeedEntityAttention";
import type { ReceptionBoardCard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";
import { parseArrivalIntentAt } from "@/src/lib/fiOs/todaySignal/bookingArrivalIntentCore";

import {
  buildWorkspaceSignalTargetRefs,
  extractEntityFromFeedItemId,
  getWorkspaceSignalReason,
  type WorkspaceSignalKind,
  type WorkspaceSignalPayload,
} from "./workspaceSignalRegistry";

function entityAttentionToWorkspaceSignalKind(
  signal: TodayEntityAttentionSignal
): WorkspaceSignalKind | null {
  const id = signal.id;
  if (id.startsWith("entity-pathology-")) return "pathology_review_pending";
  if (id.startsWith("entity-payment-overdue-")) return "payment_blocker";
  if (id.startsWith("entity-financial-clearance-")) return "payment_received";
  if (id.startsWith("entity-surgery-readiness-")) return "surgery_readiness_blocker";
  if (id.startsWith("entity-surgery-payment-")) return "payment_blocker";
  if (id.startsWith("entity-staff-")) return "staff_compliance_alert";
  if (id.startsWith("entity-consultation-")) return "consultation_completed";
  return null;
}

function receptionCardToWorkspaceSignal(
  card: ReceptionBoardCard,
  signalType: WorkspaceSignalKind,
  timestamp: string
): WorkspaceSignalPayload {
  const targetRefs = buildWorkspaceSignalTargetRefs({
    entityKind: "booking",
    entityId: card.id,
    patientId: card.patientId,
  });

  return {
    signalType,
    entityKind: "booking",
    entityId: card.id,
    targetRefs,
    timestamp,
    reasonLabel: getWorkspaceSignalReason(signalType, "appointment"),
  };
}

/** Lightweight derivation from operational dashboard — no PHI in output. */
export function deriveWorkspaceSignalsFromOperationalDashboard(input: {
  receptionBoard: { cards: readonly ReceptionBoardCard[] };
  staleLeads: readonly { leadId: string }[];
  entityAttention: readonly TodayEntityAttentionSignal[];
  timestamp?: string;
}): WorkspaceSignalPayload[] {
  const timestamp = input.timestamp ?? new Date().toISOString();
  const signals: WorkspaceSignalPayload[] = [];

  for (const card of input.receptionBoard.cards) {
    if (parseArrivalIntentAt(card.metadata)) {
      signals.push(receptionCardToWorkspaceSignal(card, "arrival_intent", timestamp));
    }
    if (
      card.receptionColumn === "arrived" ||
      card.receptionColumn === "in_consultation" ||
      card.receptionColumn === "in_treatment"
    ) {
      signals.push(receptionCardToWorkspaceSignal(card, "reception_check_in", timestamp));
    }
  }

  for (const lead of input.staleLeads) {
    const leadId = lead.leadId.trim();
    if (!leadId) continue;
    signals.push({
      signalType: "lead_stale",
      entityKind: "lead",
      entityId: leadId,
      targetRefs: [{ kind: "lead", id: leadId }],
      timestamp,
      reasonLabel: getWorkspaceSignalReason("lead_stale", "lead"),
    });
  }

  for (const entity of input.entityAttention) {
    const signalType = entityAttentionToWorkspaceSignalKind(entity);
    if (!signalType) continue;
    const { entityKind, entityId } = extractEntityFromFeedItemId(entity.id);
    const targetRefs = buildWorkspaceSignalTargetRefs({ href: entity.href, entityKind, entityId });
    signals.push({
      signalType,
      entityKind,
      entityId,
      targetRefs,
      timestamp,
      reasonLabel: getWorkspaceSignalReason(signalType, targetRefs[0]?.kind ?? "patient"),
    });
  }

  return signals;
}
