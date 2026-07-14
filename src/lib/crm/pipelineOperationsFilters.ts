/**
 * FI-PIPELINE-OPERATIONS-1 — pure card predicates (age, activity, inactive review).
 * Presentation-driven; does not mint/merge cards or mutate lead status.
 */

import type { PipelineLeadCard } from "@/src/lib/crm/pipelinePresentation.types";
import type {
  PipelineOpsActivityFilter,
  PipelineOpsAgeBucket,
  PipelineOpsQueryState,
} from "@/src/lib/crm/pipelineOperationsQuery";
import type { PipelineStaffColumnId } from "@/src/lib/crm/pipelineStaffModel";

const MS_DAY = 86_400_000;

function parseMs(iso: string | null | undefined): number | null {
  if (iso == null || !String(iso).trim()) return null;
  const ms = Date.parse(String(iso).trim());
  return Number.isFinite(ms) ? ms : null;
}

/** Whole calendar days since created_at (UTC day floor). */
export function pipelineLeadAgeDays(
  createdAtIso: string | null | undefined,
  nowMs: number
): number | null {
  const created = parseMs(createdAtIso);
  if (created == null) return null;
  if (created > nowMs) return 0;
  return Math.floor((nowMs - created) / MS_DAY);
}

/**
 * Age bucket boundaries (inclusive of min day, exclusive of max where noted):
 * - today: 0 days
 * - last_7_days: 0–7 inclusive
 * - 8_30_days: 8–30 inclusive
 * - 31_60_days: 31–60 inclusive
 * - 61_90_days: 61–90 inclusive
 * - over_90_days: ≥ 91
 */
export function pipelineAgeBucketMatches(
  ageDays: number | null,
  bucket: PipelineOpsAgeBucket
): boolean {
  if (ageDays == null || ageDays < 0) return false;
  switch (bucket) {
    case "today":
      return ageDays === 0;
    case "last_7_days":
      return ageDays >= 0 && ageDays <= 7;
    case "8_30_days":
      return ageDays >= 8 && ageDays <= 30;
    case "31_60_days":
      return ageDays >= 31 && ageDays <= 60;
    case "61_90_days":
      return ageDays >= 61 && ageDays <= 90;
    case "over_90_days":
      return ageDays >= 91;
    default:
      return false;
  }
}

export function cardMatchesAgeBucket(
  card: PipelineLeadCard,
  bucket: PipelineOpsAgeBucket,
  nowMs: number
): boolean {
  const age = pipelineLeadAgeDays(card.timestamps?.createdAtIso ?? null, nowMs);
  return pipelineAgeBucketMatches(age, bucket);
}

export function cardMatchesActivityFilter(
  card: PipelineLeadCard,
  activity: PipelineOpsActivityFilter,
  nowMs: number
): boolean {
  switch (activity) {
    case "has_overdue_follow_up":
      return card.followUps.overdueCount > 0 || card.nextAction.overdue;
    case "has_upcoming_follow_up": {
      if (card.followUps.overdueCount > 0) return false;
      if (card.nextAction.overdue) return false;
      const due = parseMs(card.nextAction.dueAtIso);
      if (due == null) return card.followUps.openCount > 0 && card.followUps.dueTodayCount === 0;
      return due >= nowMs;
    }
    case "no_follow_up":
      return card.followUps.openCount === 0 && card.nextAction.kind === "none";
    case "no_recent_contact": {
      // No meaningful activity in last 14 days (presentation field only)
      const act = parseMs(
        card.timestamps?.meaningfulActivityAtIso ?? card.timestamps?.updatedAtIso
      );
      if (act == null) return true;
      return nowMs - act >= 14 * MS_DAY;
    }
    case "has_consultation":
      return card.consultation.state !== "none";
    case "no_consultation":
      return card.consultation.state === "none";
    case "unassigned":
      return card.owner.unassigned || !card.owner.userId;
    default:
      return true;
  }
}

export function cardMatchesLifecycleColumn(
  card: PipelineLeadCard,
  columnId: PipelineStaffColumnId
): boolean {
  return card.stage.staffColumnId === columnId;
}

export function cardMatchesOwner(card: PipelineLeadCard, ownerId: string): boolean {
  return (card.owner.userId ?? "") === ownerId.trim();
}

export function cardMatchesSource(card: PipelineLeadCard, sourceKey: string): boolean {
  const key = (card.source.key ?? "").trim().toLowerCase();
  return key === sourceKey.trim().toLowerCase();
}

/**
 * Inactive review inclusion — all must be true:
 * - not Converted
 * - not Closed / lost
 * - older than age threshold (default 30 days)
 * - no future consultation
 * - no open upcoming task
 * - no meaningful activity within inactivity window
 *
 * Does not alter lead status.
 */
export function isPipelineInactiveReviewLead(
  card: PipelineLeadCard,
  nowMs: number,
  inactiveAgeDays: number = 30
): boolean {
  if (card.lifecycle.state === "converted" || card.stage.staffColumnId === "converted") {
    return false;
  }
  if (card.lifecycle.state === "lost" || card.stage.staffColumnId === "closed_lost") {
    return false;
  }
  if (card.lifecycle.state === "archived") return false;

  const age = pipelineLeadAgeDays(card.timestamps?.createdAtIso ?? null, nowMs);
  if (age == null || age < inactiveAgeDays) return false;

  // Future consultation excludes
  const nextConsult = parseMs(card.consultation.nextBookingAtIso);
  if (
    nextConsult != null &&
    nextConsult >= nowMs &&
    card.consultation.state !== "cancelled" &&
    card.consultation.state !== "no_show" &&
    card.consultation.state !== "completed"
  ) {
    return false;
  }
  if (card.consultation.state === "booked" || card.consultation.state === "due_today") {
    return false;
  }

  // Open upcoming task excludes (due in future or due today with open count)
  if (card.followUps.openCount > 0) {
    const due = parseMs(card.nextAction.dueAtIso);
    if (due == null || due >= nowMs - MS_DAY) {
      // open task without past-only due → exclude (upcoming / no date / recent)
      // Allow only if all open tasks are clearly overdue beyond window? Spec: no open upcoming task
      if (!card.nextAction.overdue || (due != null && due >= nowMs)) {
        return false;
      }
      // overdue-only open tasks: still "open" — treat as activity; exclude from inactive
      return false;
    }
  }

  // Meaningful activity within inactivity window excludes
  const act = parseMs(card.timestamps?.meaningfulActivityAtIso ?? card.timestamps?.updatedAtIso);
  if (act != null) {
    const inactiveWindowMs = inactiveAgeDays * MS_DAY;
    if (nowMs - act < inactiveWindowMs) return false;
  }

  return true;
}

/** Apply ops query filters to a single card (presentation layer). */
export function cardMatchesOpsQuery(
  card: PipelineLeadCard,
  query: PipelineOpsQueryState,
  nowMs: number
): boolean {
  if (query.view === "inactive_review") {
    if (!isPipelineInactiveReviewLead(card, nowMs, query.inactiveAgeDays)) {
      return false;
    }
  }

  if (query.lifecycle && !cardMatchesLifecycleColumn(card, query.lifecycle)) {
    return false;
  }

  if (query.stageSlug) {
    const slug = (card.stage.backendSlug ?? "").toLowerCase();
    if (slug !== query.stageSlug.toLowerCase()) return false;
  }

  if (query.age && !cardMatchesAgeBucket(card, query.age, nowMs)) {
    return false;
  }

  if (query.ownerId && !cardMatchesOwner(card, query.ownerId)) {
    return false;
  }

  if (query.sourceKey && !cardMatchesSource(card, query.sourceKey)) {
    return false;
  }

  if (query.activity && !cardMatchesActivityFilter(card, query.activity, nowMs)) {
    return false;
  }

  return true;
}
