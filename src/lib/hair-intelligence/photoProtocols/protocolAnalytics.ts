import { PROTOCOL_STRONG_CAPTURE_MIN_CONFIDENCE } from "./protocolSessionRules";
import type { HliPhotoProtocolSession, HliPhotoProtocolSessionSlot, HliPhotoProtocolSlot, HliPhotoProtocolTemplate } from "./types";

/** Plain rows for pure analytics (no DB client). */
export type PhotoProtocolAnalyticsInput = {
  sessions: HliPhotoProtocolSession[];
  sessionSlots: HliPhotoProtocolSessionSlot[];
  templatesById: Map<string, HliPhotoProtocolTemplate>;
  slotsByTemplateId: Map<string, HliPhotoProtocolSlot[]>;
  /** `fi_patients.primary_clinic_id` keyed by patient id when available. */
  patientPrimaryClinicByPatientId?: Map<string, string | null>;
};

export type PhotoProtocolBucketRate = {
  key: string;
  session_count: number;
  completed_count: number;
  completion_rate: number;
};

export type PhotoProtocolAnalyticsSummary = {
  total_sessions: number;
  /** Excludes `cancelled` from denominator. */
  non_cancelled_sessions: number;
  completed_sessions: number;
  /** 0–1; denominator = non_cancelled_sessions. */
  protocol_completion_rate: number;
  incomplete_session_count: number;
  /** Sessions with at least one unsatisfied **required** slot (optional slots ignored). */
  sessions_with_required_gaps: number;
  /** Total required slot rows in `needs_retake` across all sessions (required defs only). */
  needs_retake_count: number;
  /** Required slots in `captured` with AI match below strong threshold (awaiting accept). */
  needs_review_count: number;
  /** Average ms from started_at → completed_at for completed sessions; null if none. */
  average_time_to_complete_ms: number | null;
  /** How often each required slot slug is unsatisfied (required slots only). */
  missing_required_slot_frequency: Record<string, number>;
  /** Slot slug with highest frequency; null if none. */
  most_commonly_missed_slot_slug: string | null;
  completion_rate_by_clinical_context: PhotoProtocolBucketRate[];
  completion_rate_by_clinic_id: PhotoProtocolBucketRate[];
  completion_rate_by_created_by_user_id: PhotoProtocolBucketRate[];
  /** 0–100 composite for HairAudit / audit-style readiness (see runbook). */
  audit_readiness_score: number;
};

export function clinicalContextFromSession(session: HliPhotoProtocolSession): string {
  const raw = session.metadata?.clinical_context;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return "unknown";
}

export function requiredSlotDefinitionForSessionSlot(
  session: HliPhotoProtocolSession,
  ss: HliPhotoProtocolSessionSlot,
  slotsByTemplateId: Map<string, HliPhotoProtocolSlot[]>
): HliPhotoProtocolSlot | undefined {
  const defs = slotsByTemplateId.get(session.protocol_template_id);
  return defs?.find((d) => d.id === ss.slot_id);
}

/** Mirrors Stage 8B completion gate: required slot satisfied when accepted or strongly captured. */
export function isRequiredSessionSlotSatisfied(
  ss: HliPhotoProtocolSessionSlot,
  def: HliPhotoProtocolSlot | undefined
): boolean {
  if (!def?.is_required) return true;
  if (ss.status === "accepted") return true;
  if (ss.status === "captured" && (ss.ai_match_confidence ?? 0) >= PROTOCOL_STRONG_CAPTURE_MIN_CONFIDENCE) return true;
  return false;
}

export function isRequiredSessionSlotNeedsReview(
  ss: HliPhotoProtocolSessionSlot,
  def: HliPhotoProtocolSlot | undefined
): boolean {
  if (!def?.is_required) return false;
  if (ss.status !== "captured") return false;
  return (ss.ai_match_confidence ?? 0) < PROTOCOL_STRONG_CAPTURE_MIN_CONFIDENCE;
}

export function isRequiredSessionSlotNeedsRetake(
  ss: HliPhotoProtocolSessionSlot,
  def: HliPhotoProtocolSlot | undefined
): boolean {
  return Boolean(def?.is_required) && ss.status === "needs_retake";
}

export function isRequiredSessionSlotMissing(
  ss: HliPhotoProtocolSessionSlot,
  def: HliPhotoProtocolSlot | undefined
): boolean {
  if (!def?.is_required) return false;
  if (ss.status === "optional_skipped") return false;
  if (isRequiredSessionSlotSatisfied(ss, def)) return false;
  return true;
}

function bucketCompletionRates(
  sessions: HliPhotoProtocolSession[],
  keyFn: (s: HliPhotoProtocolSession) => string | null
): PhotoProtocolBucketRate[] {
  const buckets = new Map<string, { total: number; done: number }>();
  for (const s of sessions) {
    if (s.status === "cancelled") continue;
    const k = keyFn(s);
    if (k == null || k === "") continue;
    const cur = buckets.get(k) ?? { total: 0, done: 0 };
    cur.total += 1;
    if (s.status === "complete") cur.done += 1;
    buckets.set(k, cur);
  }
  return [...buckets.entries()]
    .map(([key, v]) => ({
      key,
      session_count: v.total,
      completed_count: v.done,
      completion_rate: v.total > 0 ? v.done / v.total : 0,
    }))
    .sort((a, b) => b.session_count - a.session_count);
}

function auditReadinessScoreFromCounts(p: {
  completion_rate: number;
  needs_retake_count: number;
  needs_review_count: number;
  non_cancelled_sessions: number;
}): number {
  if (p.non_cancelled_sessions <= 0) return 100;
  const issue = p.needs_retake_count + p.needs_review_count;
  const issuePressure = Math.min(50, (issue / p.non_cancelled_sessions) * 25);
  const base = p.completion_rate * 100;
  return Math.round(Math.max(0, Math.min(100, base * 0.65 + (100 - issuePressure) * 0.35)));
}

/**
 * Pure rollup over sessions + slot rows + template definitions.
 * Optional slots never affect completion, missing counts, or retake/review tallies.
 */
export function calculatePhotoProtocolAnalytics(input: PhotoProtocolAnalyticsInput): PhotoProtocolAnalyticsSummary {
  const slotsBySession = new Map<string, HliPhotoProtocolSessionSlot[]>();
  for (const ss of input.sessionSlots) {
    const list = slotsBySession.get(ss.session_id) ?? [];
    list.push(ss);
    slotsBySession.set(ss.session_id, list);
  }

  let nonCancelled = 0;
  let completed = 0;
  let incomplete = 0;
  let sessionsWithGaps = 0;
  let needsRetake = 0;
  let needsReview = 0;
  const missingFreq: Record<string, number> = {};
  const completionDurations: number[] = [];

  for (const session of input.sessions) {
    if (session.status === "cancelled") continue;
    nonCancelled += 1;
    if (session.status === "complete") {
      completed += 1;
      if (session.started_at && session.completed_at) {
        const a = Date.parse(session.started_at);
        const b = Date.parse(session.completed_at);
        if (Number.isFinite(a) && Number.isFinite(b) && b >= a) completionDurations.push(b - a);
      }
    } else {
      incomplete += 1;
    }

    const rowSlots = slotsBySession.get(session.id) ?? [];
    let sessionGap = false;
    for (const ss of rowSlots) {
      const def = requiredSlotDefinitionForSessionSlot(session, ss, input.slotsByTemplateId);
      if (isRequiredSessionSlotNeedsRetake(ss, def)) needsRetake += 1;
      if (isRequiredSessionSlotNeedsReview(ss, def)) needsReview += 1;
      if (isRequiredSessionSlotMissing(ss, def)) {
        sessionGap = true;
        const slug = def?.slot_slug ?? ss.slot_id;
        missingFreq[slug] = (missingFreq[slug] ?? 0) + 1;
      }
    }
    if (sessionGap) sessionsWithGaps += 1;
  }

  const protocol_completion_rate = nonCancelled > 0 ? completed / nonCancelled : 0;

  let mostMissed: string | null = null;
  let mostMissedN = 0;
  for (const [slug, n] of Object.entries(missingFreq)) {
    if (n > mostMissedN) {
      mostMissedN = n;
      mostMissed = slug;
    }
  }

  const avgMs =
    completionDurations.length > 0
      ? Math.round(completionDurations.reduce((a, b) => a + b, 0) / completionDurations.length)
      : null;

  const byCtx = bucketCompletionRates(input.sessions, (s) => clinicalContextFromSession(s));
  const byClinic = bucketCompletionRates(input.sessions, (s) => {
    if (!s.patient_id || !input.patientPrimaryClinicByPatientId) return null;
    const cid = input.patientPrimaryClinicByPatientId.get(s.patient_id);
    return cid ?? null;
  });
  const byUser = bucketCompletionRates(input.sessions, (s) => s.created_by_user_id ?? "__unassigned__");

  const audit_readiness_score = auditReadinessScoreFromCounts({
    completion_rate: protocol_completion_rate,
    needs_retake_count: needsRetake,
    needs_review_count: needsReview,
    non_cancelled_sessions: nonCancelled,
  });

  return {
    total_sessions: input.sessions.length,
    non_cancelled_sessions: nonCancelled,
    completed_sessions: completed,
    protocol_completion_rate,
    incomplete_session_count: incomplete,
    sessions_with_required_gaps: sessionsWithGaps,
    needs_retake_count: needsRetake,
    needs_review_count: needsReview,
    average_time_to_complete_ms: avgMs,
    missing_required_slot_frequency: missingFreq,
    most_commonly_missed_slot_slug: mostMissed,
    completion_rate_by_clinical_context: byCtx,
    completion_rate_by_clinic_id: byClinic,
    completion_rate_by_created_by_user_id: byUser,
    audit_readiness_score,
  };
}
