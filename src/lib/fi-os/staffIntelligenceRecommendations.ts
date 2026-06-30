import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import type { FiOrganisationalIntelligenceSignalKey } from "@/src/config/fiOrganisationalIntelligenceSignals";
import type { FiStaffSignalCountMap } from "@/src/lib/fi-os/staffIntelligenceSignals";
import { severityForSignalCount } from "@/src/lib/fi-os/staffIntelligenceSignals";

export type FiStaffIntelligenceRecommendation = {
  id: string;
  title: string;
  body: string;
  /** Optional link for future deep navigation (Stage 4). */
  href?: string | null;
};

const PUNITIVE_SUBSTRINGS =
  /\b(poor|worst|rank|ranking|failure|failed|bad\s+performer|underperform|lazy|inadequate)\b/i;

export function assertRecommendationCopyIsNonPunitive(text: string): void {
  if (PUNITIVE_SUBSTRINGS.test(text)) {
    throw new Error("Recommendation copy must remain supportive and non-punitive.");
  }
}

function rec(
  id: string,
  title: string,
  body: string,
  href?: string | null
): FiStaffIntelligenceRecommendation {
  assertRecommendationCopyIsNonPunitive(`${title} ${body}`);
  return { id, title, body, href: href ?? null };
}

/**
 * Rule-based, profile-aware suggestions (no LLM, no external APIs).
 */
export function buildStaffIntelligenceRecommendations(opts: {
  counts: FiStaffSignalCountMap;
  workspaceProfileHint: FiWorkspaceProfileKey;
  positionTypeCode: string | null;
}): FiStaffIntelligenceRecommendation[] {
  const { counts, workspaceProfileHint, positionTypeCode } = opts;
  const out: FiStaffIntelligenceRecommendation[] = [];
  const p = workspaceProfileHint;
  const code = (positionTypeCode ?? "").trim().toUpperCase();

  const sev = (k: FiOrganisationalIntelligenceSignalKey) =>
    severityForSignalCount(k, counts[k] ?? 0);

  if (
    (counts.leads_stale ?? 0) > 0 &&
    sev("leads_stale") !== "info" &&
    (p === "consultant" || code === "CONSULTANT")
  ) {
    out.push(
      rec(
        "stale_leads",
        "Prioritise lead follow-up queue",
        "A number of owned leads have been in the same stage for a while. Reviewing the next best action for each lead can help the team support conversions."
      )
    );
  }

  if (
    (counts.consultations_assigned ?? 0) >= 1 &&
    sev("consultations_assigned") !== "info" &&
    (p === "consultant" || p === "doctor")
  ) {
    out.push(
      rec(
        "consult_summaries",
        "Complete consultation summaries",
        "There are consultations still in progress. Finishing structured notes helps handoffs and downstream care."
      )
    );
  }

  if (
    (counts.follow_ups_due ?? 0) > 0 &&
    sev("follow_ups_due") !== "info" &&
    (p === "nurse" || code === "RN")
  ) {
    out.push(
      rec(
        "follow_up_queue",
        "Review patient follow-up queue",
        "Follow-up tasks are waiting. Triage by due date so patients receive timely support."
      )
    );
  }

  if (
    (counts.imaging_uploads_pending ?? 0) > 0 &&
    sev("imaging_uploads_pending") !== "info" &&
    (p === "nurse" || p === "doctor")
  ) {
    out.push(
      rec(
        "imaging_queue",
        "Upload or review patient images",
        "Imaging-related follow-ups are open. Completing uploads or reviews keeps clinical teams aligned."
      )
    );
  }

  if (
    (counts.surgery_readiness_alerts ?? 0) > 0 &&
    sev("surgery_readiness_alerts") !== "info" &&
    (p === "surgeon" || code === "SURGEON")
  ) {
    out.push(
      rec(
        "readiness_blockers",
        "Review surgery readiness blockers",
        "Some cases still have readiness items to confirm. A short review can unblock the procedure day schedule."
      )
    );
  }

  if (
    (counts.audit_reviews_pending ?? 0) > 0 &&
    sev("audit_reviews_pending") !== "info" &&
    (p === "auditor" || p === "director")
  ) {
    out.push(
      rec(
        "audit_queue",
        "Review outcome and audit cases",
        "There are items in the governance review queue. Scheduling time to clear them keeps oversight current."
      )
    );
  }

  if (
    (counts.training_due ?? 0) > 0 &&
    sev("training_due") !== "info" &&
    (p === "academy_trainer" || code === "ACADEMY_TRAINER")
  ) {
    out.push(
      rec(
        "learner_progress",
        "Review learner progress",
        "Training checkpoints are due. A quick pass on learner progress helps academy delivery stay on track."
      )
    );
  }

  if (
    (counts.productivity_attention ?? 0) > 0 &&
    sev("productivity_attention") !== "info" &&
    (p === "clinic_manager" || p === "director")
  ) {
    out.push(
      rec(
        "workload_support",
        "Offer workload support",
        "Queues across CRM and consultations are elevated. Coordinating coverage or triage support can help the team stay ahead."
      )
    );
  }

  return out;
}
