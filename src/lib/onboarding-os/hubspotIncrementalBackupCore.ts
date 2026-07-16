/**
 * FI-HUBSPOT-INCREMENTAL-BACKUP-1 — pure cutoff / watermark / filter helpers.
 * No I/O. Safe for unit tests without HubSpot or Supabase.
 */

export const HUBSPOT_INCREMENTAL_MILESTONE = "FI-HUBSPOT-INCREMENTAL-BACKUP-1";
export const HUBSPOT_INCREMENTAL_SOURCE_SYSTEM = "hubspot";
export const HUBSPOT_INCREMENTAL_DATASETS = ["notes"] as const;
export type HubspotIncrementalDataset = (typeof HUBSPOT_INCREMENTAL_DATASETS)[number];

export const HUBSPOT_INCREMENTAL_STUCK_AGE_MS = 30 * 60 * 1000;

export type HubspotIncrementalRunStatus =
  | "started"
  | "completed"
  | "partial"
  | "failed"
  | "cancelled";

export type HubspotIncrementalVerificationState =
  | "pending"
  | "passed"
  | "failed"
  | "skipped";

export type ParsedUtcCutoff = {
  iso: string;
  epochMs: number;
};

export type IncrementalRange = {
  cutoffFrom: ParsedUtcCutoff;
  cutoffTo: ParsedUtcCutoff;
};

export type NoteTimestampCandidate = {
  id: string;
  updatedAt: string | null | undefined;
  createdAt?: string | null | undefined;
};

export type IncrementalCheckpoint = {
  searchAfter: string | null;
  lastUpdatedAt: string | null;
  lastId: string | null;
  pagesCompleted: number;
};

export type IncrementalCounters = {
  discovered: number;
  inRange: number;
  inserted: number;
  updated: number;
  unchanged: number;
  failed: number;
  skippedOutOfRange: number;
};

export function isHubspotIncrementalDataset(value: string): value is HubspotIncrementalDataset {
  return (HUBSPOT_INCREMENTAL_DATASETS as readonly string[]).includes(value);
}

/**
 * Accept only explicit UTC ISO-8601 with Z or numeric offset.
 * Rejects bare local datetimes and date-only strings.
 */
export function parseStrictUtcTimestamp(raw: string, label: string): ParsedUtcCutoff {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error(`${label} is required.`);
  // Must include time and an explicit zone (Z or ±HH:MM).
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.test(trimmed)) {
    throw new Error(
      `${label} must be an explicit UTC ISO-8601 timestamp with Z or numeric offset (e.g. 2026-07-16T00:00:00.000Z).`
    );
  }
  const epochMs = Date.parse(trimmed);
  if (!Number.isFinite(epochMs)) {
    throw new Error(`${label} is not a valid timestamp.`);
  }
  return { iso: new Date(epochMs).toISOString(), epochMs };
}

export function parseIncrementalRange(input: {
  cutoffFrom: string;
  cutoffTo: string;
}): IncrementalRange {
  const cutoffFrom = parseStrictUtcTimestamp(input.cutoffFrom, "cutoff-from");
  const cutoffTo = parseStrictUtcTimestamp(input.cutoffTo, "cutoff-to");
  if (cutoffTo.epochMs <= cutoffFrom.epochMs) {
    throw new Error("cutoff-to must be strictly greater than cutoff-from.");
  }
  return { cutoffFrom, cutoffTo };
}

/**
 * Inclusive lower / exclusive upper on updatedAt (fallback createdAt).
 * updatedAt >= cutoff_from && updatedAt < cutoff_to
 */
export function noteUpdatedAtMs(note: NoteTimestampCandidate): number | null {
  const raw = note.updatedAt ?? note.createdAt ?? null;
  if (!raw) return null;
  const ms = Date.parse(String(raw));
  return Number.isFinite(ms) ? ms : null;
}

export function isNoteInIncrementalRange(
  note: NoteTimestampCandidate,
  range: IncrementalRange
): boolean {
  const ms = noteUpdatedAtMs(note);
  if (ms == null) return false;
  return ms >= range.cutoffFrom.epochMs && ms < range.cutoffTo.epochMs;
}

/** Stable ordering: updatedAt ASC, id ASC — prevents equal-timestamp skips. */
export function compareNotesForIncremental(
  a: NoteTimestampCandidate,
  b: NoteTimestampCandidate
): number {
  const am = noteUpdatedAtMs(a) ?? 0;
  const bm = noteUpdatedAtMs(b) ?? 0;
  if (am !== bm) return am - bm;
  return a.id.localeCompare(b.id);
}

export function filterNotesInRange(
  notes: NoteTimestampCandidate[],
  range: IncrementalRange
): { inRange: NoteTimestampCandidate[]; skippedOutOfRange: number } {
  const inRange: NoteTimestampCandidate[] = [];
  let skippedOutOfRange = 0;
  for (const note of notes) {
    if (!note.id?.trim()) continue;
    if (isNoteInIncrementalRange(note, range)) inRange.push(note);
    else skippedOutOfRange += 1;
  }
  inRange.sort(compareNotesForIncremental);
  return { inRange, skippedOutOfRange };
}

/**
 * After a page, skip notes already processed when timestamps collide across pages.
 * Resume continues strictly after (lastUpdatedAt, lastId).
 */
export function applyTiebreakerCursor(
  notes: NoteTimestampCandidate[],
  lastUpdatedAt: string | null,
  lastId: string | null
): NoteTimestampCandidate[] {
  if (!lastUpdatedAt || !lastId) return notes;
  const lastMs = Date.parse(lastUpdatedAt);
  if (!Number.isFinite(lastMs)) return notes;
  return notes.filter((note) => {
    const ms = noteUpdatedAtMs(note);
    if (ms == null) return false;
    if (ms > lastMs) return true;
    if (ms < lastMs) return false;
    return note.id.localeCompare(lastId) > 0;
  });
}

export function emptyIncrementalCounters(): IncrementalCounters {
  return {
    discovered: 0,
    inRange: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
    skippedOutOfRange: 0,
  };
}

export function emptyIncrementalCheckpoint(): IncrementalCheckpoint {
  return {
    searchAfter: null,
    lastUpdatedAt: null,
    lastId: null,
    pagesCompleted: 0,
  };
}

export function parseIncrementalCheckpoint(raw: unknown): IncrementalCheckpoint {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    searchAfter: typeof row.searchAfter === "string" && row.searchAfter ? row.searchAfter : null,
    lastUpdatedAt:
      typeof row.lastUpdatedAt === "string" && row.lastUpdatedAt ? row.lastUpdatedAt : null,
    lastId: typeof row.lastId === "string" && row.lastId ? row.lastId : null,
    pagesCompleted:
      typeof row.pagesCompleted === "number" && Number.isFinite(row.pagesCompleted)
        ? Math.max(0, Math.floor(row.pagesCompleted))
        : 0,
  };
}

/** Watermark advances only after success + verification_passed. */
export function canAdvanceIncrementalWatermark(input: {
  status: string;
  verificationState: string;
  paginationComplete: boolean;
  unresolvedFailures: boolean;
}): boolean {
  if (!input.paginationComplete) return false;
  if (input.unresolvedFailures) return false;
  if (input.verificationState !== "passed") return false;
  return input.status === "completed";
}

export function nextWatermarkFromCutoffTo(cutoffToIso: string): {
  watermark_timestamp: string;
  watermark_tiebreaker: null;
} {
  return { watermark_timestamp: cutoffToIso, watermark_tiebreaker: null };
}

export function isIncrementalRunStuck(input: {
  status: string;
  startedAt: string | null;
  lastCheckpointAt: string | null;
  nowMs?: number;
  staleAgeMs?: number;
}): boolean {
  if (input.status !== "started") return false;
  const now = input.nowMs ?? Date.now();
  const staleAge = input.staleAgeMs ?? HUBSPOT_INCREMENTAL_STUCK_AGE_MS;
  const anchor = input.lastCheckpointAt ?? input.startedAt;
  if (!anchor) return true;
  const ms = Date.parse(anchor);
  if (!Number.isFinite(ms)) return true;
  return now - ms >= staleAge;
}

export function hubspotSearchDatetimeMs(isoUtc: string): string {
  const ms = Date.parse(isoUtc);
  if (!Number.isFinite(ms)) throw new Error("Invalid datetime for HubSpot search filter.");
  return String(ms);
}

export function classifyUpsertOutcome(input: {
  existedBefore: boolean;
  previousChecksum: string | null;
  nextChecksum: string;
}): "inserted" | "updated" | "unchanged" {
  if (!input.existedBefore) return "inserted";
  if (input.previousChecksum && input.previousChecksum === input.nextChecksum) return "unchanged";
  return "updated";
}
