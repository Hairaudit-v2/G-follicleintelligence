/**
 * FI-PIPELINE-OPERATIONS-1 — pure lead card ordering for Pipeline columns.
 *
 * Uses canonical fi_crm_leads timestamps + derived meaningful activity.
 * Does not use card render time, task mint time, or person creation time alone.
 */

import type { PipelineLeadCard } from "@/src/lib/crm/pipelinePresentation.types";
import type { PipelineOpsSortMode } from "@/src/lib/crm/pipelineOperationsQuery";
import { comparePipelineSortableLeads } from "@/src/lib/crm/pipelineStaffModel";

export type PipelineOpsSortableCard = {
  leadId: string;
  createdAtIso: string | null;
  updatedAtIso: string | null;
  /** max(updated_at, latest communication, task activity, consultation) */
  meaningfulActivityAtIso: string | null;
  /** Explicit lost timestamp when known; else stage enter / updated fallback. */
  lostAtIso: string | null;
  stageEnteredAtIso: string | null;
  urgencyFlags: readonly string[];
  nextFollowUpAtIso: string | null;
  score: number | null;
};

function parseMs(iso: string | null | undefined): number | null {
  if (iso == null || !String(iso).trim()) return null;
  const ms = Date.parse(String(iso).trim());
  return Number.isFinite(ms) ? ms : null;
}

function cmpDesc(a: number | null, b: number | null): number {
  if (a != null && b != null && a !== b) return b - a;
  if (a != null && b == null) return -1;
  if (a == null && b != null) return 1;
  return 0;
}

function cmpAsc(a: number | null, b: number | null): number {
  if (a != null && b != null && a !== b) return a - b;
  if (a != null && b == null) return -1;
  if (a == null && b != null) return 1;
  return 0;
}

function tieLeadId(a: string, b: string): number {
  return a.localeCompare(b);
}

/**
 * New column default (no user sort override):
 * created_at DESC → updated_at DESC → lead_id ASC
 */
export function compareNewColumnDefault(
  a: PipelineOpsSortableCard,
  b: PipelineOpsSortableCard
): number {
  const c = cmpDesc(parseMs(a.createdAtIso), parseMs(b.createdAtIso));
  if (c !== 0) return c;
  const u = cmpDesc(parseMs(a.updatedAtIso), parseMs(b.updatedAtIso));
  if (u !== 0) return u;
  return tieLeadId(a.leadId, b.leadId);
}

/** Newest first: created_at DESC, lead_id ASC */
export function compareNewestFirst(
  a: PipelineOpsSortableCard,
  b: PipelineOpsSortableCard
): number {
  const c = cmpDesc(parseMs(a.createdAtIso), parseMs(b.createdAtIso));
  if (c !== 0) return c;
  return tieLeadId(a.leadId, b.leadId);
}

/** Oldest first: created_at ASC, lead_id ASC */
export function compareOldestFirst(
  a: PipelineOpsSortableCard,
  b: PipelineOpsSortableCard
): number {
  const c = cmpAsc(parseMs(a.createdAtIso), parseMs(b.createdAtIso));
  if (c !== 0) return c;
  return tieLeadId(a.leadId, b.leadId);
}

/** Recently updated: updated_at DESC, lead_id ASC */
export function compareRecentlyUpdated(
  a: PipelineOpsSortableCard,
  b: PipelineOpsSortableCard
): number {
  const c = cmpDesc(parseMs(a.updatedAtIso), parseMs(b.updatedAtIso));
  if (c !== 0) return c;
  return tieLeadId(a.leadId, b.leadId);
}

/**
 * Oldest untouched: meaningful activity ASC (least recent first), lead_id ASC.
 * Passive presentation refresh must not be passed as meaningfulActivityAtIso.
 */
export function compareOldestUntouched(
  a: PipelineOpsSortableCard,
  b: PipelineOpsSortableCard
): number {
  const c = cmpAsc(
    parseMs(a.meaningfulActivityAtIso),
    parseMs(b.meaningfulActivityAtIso)
  );
  if (c !== 0) return c;
  return tieLeadId(a.leadId, b.leadId);
}

/**
 * Lost default: lost_at DESC → stage_entered DESC → updated_at DESC → lead_id ASC
 */
export function compareMostRecentlyLost(
  a: PipelineOpsSortableCard,
  b: PipelineOpsSortableCard
): number {
  const la = parseMs(a.lostAtIso) ?? parseMs(a.stageEnteredAtIso) ?? parseMs(a.updatedAtIso);
  const lb = parseMs(b.lostAtIso) ?? parseMs(b.stageEnteredAtIso) ?? parseMs(b.updatedAtIso);
  const c = cmpDesc(la, lb);
  if (c !== 0) return c;
  return tieLeadId(a.leadId, b.leadId);
}

export function compareOldestLost(
  a: PipelineOpsSortableCard,
  b: PipelineOpsSortableCard
): number {
  const la = parseMs(a.lostAtIso) ?? parseMs(a.stageEnteredAtIso) ?? parseMs(a.updatedAtIso);
  const lb = parseMs(b.lostAtIso) ?? parseMs(b.stageEnteredAtIso) ?? parseMs(b.updatedAtIso);
  const c = cmpAsc(la, lb);
  if (c !== 0) return c;
  return tieLeadId(a.leadId, b.leadId);
}

export function comparePipelineOpsSort(
  mode: PipelineOpsSortMode,
  a: PipelineOpsSortableCard,
  b: PipelineOpsSortableCard
): number {
  switch (mode) {
    case "newest_first":
    case "newest_created":
      return compareNewestFirst(a, b);
    case "oldest_first":
    case "oldest_created":
      return compareOldestFirst(a, b);
    case "recently_updated":
      return compareRecentlyUpdated(a, b);
    case "oldest_untouched":
      return compareOldestUntouched(a, b);
    case "most_recently_lost":
      return compareMostRecentlyLost(a, b);
    case "oldest_lost":
      return compareOldestLost(a, b);
    case "operational":
    default:
      return comparePipelineSortableLeads(
        {
          leadId: a.leadId,
          urgencyFlags: a.urgencyFlags as never,
          nextFollowUpAtIso: a.nextFollowUpAtIso,
          createdAtIso: a.createdAtIso,
          score: a.score,
        },
        {
          leadId: b.leadId,
          urgencyFlags: b.urgencyFlags as never,
          nextFollowUpAtIso: b.nextFollowUpAtIso,
          createdAtIso: b.createdAtIso,
          score: b.score,
        }
      );
  }
}

/** Extract sort keys from presentation card (requires timestamps on card). */
export function pipelineCardToOpsSortable(card: PipelineLeadCard): PipelineOpsSortableCard {
  const ts = card.timestamps;
  return {
    leadId: card.leadId,
    createdAtIso: ts?.createdAtIso ?? null,
    updatedAtIso: ts?.updatedAtIso ?? null,
    meaningfulActivityAtIso: ts?.meaningfulActivityAtIso ?? ts?.updatedAtIso ?? null,
    lostAtIso: ts?.lostAtIso ?? null,
    stageEnteredAtIso: ts?.stageEnteredAtIso ?? null,
    urgencyFlags: card.urgency.flags,
    nextFollowUpAtIso: card.nextAction.dueAtIso,
    score: card.score.highValue ? 1 : card.score.value,
  };
}

/**
 * Compute meaningful activity max from discrete timestamps (pure).
 * Excludes presentation refresh / generatedAt.
 */
export function maxMeaningfulActivityIso(
  parts: readonly (string | null | undefined)[]
): string | null {
  let bestMs: number | null = null;
  let bestIso: string | null = null;
  for (const p of parts) {
    const ms = parseMs(p);
    if (ms == null) continue;
    if (bestMs == null || ms > bestMs) {
      bestMs = ms;
      bestIso = String(p).trim();
    }
  }
  return bestIso;
}

export function sortPipelineCardsByOpsMode(
  cards: readonly PipelineLeadCard[],
  mode: PipelineOpsSortMode
): PipelineLeadCard[] {
  return [...cards].sort((a, b) =>
    comparePipelineOpsSort(mode, pipelineCardToOpsSortable(a), pipelineCardToOpsSortable(b))
  );
}
