import { PROTOCOL_STRONG_CAPTURE_MIN_CONFIDENCE } from "./protocolSessionRules";
import type {
  HliPhotoProtocolSession,
  HliPhotoProtocolSessionSlot,
  HliPhotoProtocolSlot,
  HliPhotoProtocolSourceSystem,
} from "./types";
import {
  clinicalContextFromSession,
  isRequiredSessionSlotMissing,
  isRequiredSessionSlotNeedsRetake,
  isRequiredSessionSlotNeedsReview,
  requiredSlotDefinitionForSessionSlot,
} from "./protocolAnalytics";

export type PhotoProtocolAlertSeverity = "low" | "medium" | "high";

export type PhotoProtocolAlertType =
  | "missing_required_images"
  | "protocol_incomplete_over_24h"
  | "needs_retake"
  | "low_confidence_capture"
  | "hairaudit_not_ready"
  | "follow_up_missing_images";

export type PhotoProtocolAlert = {
  type: PhotoProtocolAlertType;
  severity: PhotoProtocolAlertSeverity;
  source_system: HliPhotoProtocolSourceSystem;
  patient_id: string | null;
  case_id: string | null;
  session_id: string;
  clinical_context: string;
  message: string;
  recommended_action: string;
  detected_at: string;
};

const MS_24H = 24 * 60 * 60 * 1000;

export type BuildPhotoProtocolAlertsInput = {
  sessions: HliPhotoProtocolSession[];
  sessionSlots: HliPhotoProtocolSessionSlot[];
  slotsByTemplateId: Map<string, HliPhotoProtocolSlot[]>;
  /** Defaults to `new Date()` when omitted (ISO output). */
  now?: Date;
};

function severityForHoursOpen(hours: number): PhotoProtocolAlertSeverity {
  if (hours >= 72) return "high";
  if (hours >= 48) return "medium";
  return "low";
}

/**
 * Deterministic computed alerts (no persistence). One session may yield multiple alert rows.
 */
export function buildPhotoProtocolAlerts(
  input: BuildPhotoProtocolAlertsInput
): PhotoProtocolAlert[] {
  const now = input.now ?? new Date();
  const detected_at = now.toISOString();
  const slotsBySession = new Map<string, HliPhotoProtocolSessionSlot[]>();
  for (const ss of input.sessionSlots) {
    const list = slotsBySession.get(ss.session_id) ?? [];
    list.push(ss);
    slotsBySession.set(ss.session_id, list);
  }

  const alerts: PhotoProtocolAlert[] = [];

  for (const session of input.sessions) {
    if (session.status === "cancelled") continue;

    const ctx = clinicalContextFromSession(session);
    const rowSlots = slotsBySession.get(session.id) ?? [];
    const base = {
      source_system: session.source_system,
      patient_id: session.patient_id,
      case_id: session.case_id,
      session_id: session.id,
      clinical_context: ctx,
      detected_at,
    } as const;

    let anyMissing = false;
    let anyRetake = false;
    let anyLowConf = false;

    for (const ss of rowSlots) {
      const def = requiredSlotDefinitionForSessionSlot(session, ss, input.slotsByTemplateId);
      if (isRequiredSessionSlotMissing(ss, def)) anyMissing = true;
      if (isRequiredSessionSlotNeedsRetake(ss, def)) anyRetake = true;
      if (isRequiredSessionSlotNeedsReview(ss, def)) anyLowConf = true;
    }

    if (anyMissing) {
      alerts.push({
        ...base,
        type: "missing_required_images",
        severity: session.status === "complete" ? "medium" : "high",
        message: "One or more required protocol images are still missing or not accepted.",
        recommended_action:
          "Open Patient Twin → Smart Photography Protocol and capture or accept each required view.",
      });
    }

    if (anyRetake) {
      alerts.push({
        ...base,
        type: "needs_retake",
        severity: "high",
        message: "Staff marked at least one required view as needs retake.",
        recommended_action:
          "Re-shoot the flagged angles and link the new images to the protocol checklist.",
      });
    }

    if (anyLowConf) {
      alerts.push({
        ...base,
        type: "low_confidence_capture",
        severity: "medium",
        message: `At least one required slot is captured with AI match confidence below ${PROTOCOL_STRONG_CAPTURE_MIN_CONFIDENCE}.`,
        recommended_action:
          "Review the matched image in Patient Twin and accept or retake before completing the session.",
      });
    }

    const open =
      session.status === "draft" ||
      session.status === "in_progress" ||
      session.status === "incomplete";
    if (open && session.started_at) {
      const started = Date.parse(session.started_at);
      if (Number.isFinite(started) && now.getTime() - started >= MS_24H) {
        const hours = (now.getTime() - started) / (60 * 60 * 1000);
        alerts.push({
          ...base,
          type: "protocol_incomplete_over_24h",
          severity: severityForHoursOpen(hours),
          message: "Protocol session has been open for more than 24 hours without completion.",
          recommended_action:
            "Close out captures, accept strong matches, or cancel the session if abandoned.",
        });
      }
    }

    if (session.source_system === "hairaudit" && session.status !== "complete") {
      alerts.push({
        ...base,
        type: "hairaudit_not_ready",
        severity: anyMissing ? "high" : "medium",
        message: "HairAudit-linked protocol session is not marked complete.",
        recommended_action:
          "Finish required HairAudit photography in the source workflow or complete the FI checklist.",
      });
    }

    if (ctx === "follow_up" && anyMissing) {
      alerts.push({
        ...base,
        type: "follow_up_missing_images",
        severity: "medium",
        message: "Follow-up clinical context protocol still has missing required images.",
        recommended_action:
          "Schedule recapture for follow-up documentation before closing the visit.",
      });
    }
  }

  alerts.sort((a, b) => {
    const rank = (s: PhotoProtocolAlertSeverity) => (s === "high" ? 0 : s === "medium" ? 1 : 2);
    const d = rank(a.severity) - rank(b.severity);
    if (d !== 0) return d;
    return b.detected_at.localeCompare(a.detected_at);
  });

  return alerts;
}
