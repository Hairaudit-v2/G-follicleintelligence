/**
 * FI-OUTCOME-INTELLIGENCE-FACT-EVENTS-1 — pure publish decision layer for surgery-case intelligence facts.
 */

import { surgeryCaseIntelligenceFactsSchema } from "@/src/lib/surgeryOs/surgeryOsBoardPayloadSchema";
import type { SurgeryCaseIntelligenceFacts } from "./surgeryCaseFactsCore";

export const SURGERY_CASE_INTELLIGENCE_FACTS_EVENT_TYPE =
  "surgery_case_intelligence_facts" as const;

export const SURGERY_CASE_INTELLIGENCE_SOURCE = "surgery_case_intelligence" as const;

export type SurgeryCaseIntelligencePublishAction = "insert" | "update" | "skip";

export type SurgeryCaseIntelligencePublishDecision = {
  action: SurgeryCaseIntelligencePublishAction;
  reason?: string;
  existingEventId?: string;
};

export type PublishSurgeryCaseIntelligenceFactsResult = {
  action: "inserted" | "updated" | "skipped";
  reason?: string;
  eventId?: string;
  factsVersion: string;
  lastPublishedAt: string;
};

export class SurgeryCaseFactsPublishValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SurgeryCaseFactsPublishValidationError";
  }
}

export function parseFactsVersionNumber(version: string): number | null {
  const match = /^surgery_case_intelligence_facts_v(\d+)$/.exec(version.trim());
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

export function compareFactsVersions(a: string, b: string): number {
  const na = parseFactsVersionNumber(a);
  const nb = parseFactsVersionNumber(b);
  if (na != null && nb != null) return na - nb;
  return a.localeCompare(b);
}

export function resolveSurgeryCaseIntelligencePublishEntityId(
  facts: Pick<SurgeryCaseIntelligenceFacts, "case_id" | "surgery_id">
): { entityId: string; entityType: "case" | "surgery" } {
  const caseId = facts.case_id?.trim();
  if (caseId) return { entityId: caseId, entityType: "case" };
  return { entityId: facts.surgery_id, entityType: "surgery" };
}

export function buildSurgeryCaseIntelligenceFactsIdempotencyKey(input: {
  tenantId: string;
  entityId: string;
  factsVersion: string;
}): string {
  return `${input.tenantId.trim()}:${input.entityId.trim()}:${input.factsVersion.trim()}`;
}

export function validateSurgeryCaseIntelligenceFactsForPublish(
  facts: unknown
): SurgeryCaseIntelligenceFacts {
  const parsed = surgeryCaseIntelligenceFactsSchema.safeParse(facts);
  if (!parsed.success) {
    throw new SurgeryCaseFactsPublishValidationError(
      parsed.error.issues.map((i) => i.message).join("; ") ||
        "Invalid surgery case intelligence facts."
    );
  }

  const value = parsed.data;
  if (!value.facts_version?.trim()) {
    throw new SurgeryCaseFactsPublishValidationError("facts_version is required.");
  }

  if (!value.has_final_graft_count && value.final_reviewed_graft_count != null) {
    throw new SurgeryCaseFactsPublishValidationError(
      "final_reviewed_graft_count must be null when has_final_graft_count is false."
    );
  }

  for (const link of value.graft_tray_links) {
    if (!link.has_final_count && link.final_accepted_count != null) {
      throw new SurgeryCaseFactsPublishValidationError(
        "graft_tray_links must not expose final_accepted_count without has_final_count."
      );
    }
    if (link.superseded_stale_job && link.final_accepted_count != null) {
      throw new SurgeryCaseFactsPublishValidationError(
        "superseded_stale_job links must not publish final_accepted_count."
      );
    }
  }

  return value;
}

export function buildSurgeryCaseIntelligenceFactsEventMetadata(input: {
  facts: SurgeryCaseIntelligenceFacts;
  lastPublishedAt: string;
  payloadJson: SurgeryCaseIntelligenceFacts;
}): Record<string, unknown> {
  const { facts, lastPublishedAt, payloadJson } = input;
  return {
    source: SURGERY_CASE_INTELLIGENCE_SOURCE,
    facts_version: facts.facts_version,
    last_published_at: lastPublishedAt,
    case_id: facts.case_id,
    surgery_id: facts.surgery_id,
    patient_id: facts.patient_id,
    has_final_graft_count: facts.has_final_graft_count,
    final_reviewed_graft_count: facts.final_reviewed_graft_count,
    graft_tray_review_pending: facts.graft_tray_review_pending,
    superseded_stale_estimate: facts.superseded_stale_estimate,
    payload_json: payloadJson,
    idempotency_key: buildSurgeryCaseIntelligenceFactsIdempotencyKey({
      tenantId: facts.tenant_id,
      entityId: resolveSurgeryCaseIntelligencePublishEntityId(facts).entityId,
      factsVersion: facts.facts_version,
    }),
  };
}

export function resolveNewestPublishedFactsVersion(
  publishedVersions: readonly string[]
): string | null {
  if (!publishedVersions.length) return null;
  return publishedVersions.reduce((best, current) =>
    compareFactsVersions(current, best) > 0 ? current : best
  );
}

export function findPublishedFactsVersionRow(
  rows: ReadonlyArray<{ id: string; factsVersion: string | null }>,
  factsVersion: string
): { id: string; factsVersion: string } | null {
  for (const row of rows) {
    if (row.factsVersion === factsVersion) {
      return { id: row.id, factsVersion: row.factsVersion };
    }
  }
  return null;
}

export function decideSurgeryCaseIntelligencePublishAction(input: {
  incomingVersion: string;
  existingRows: ReadonlyArray<{ id: string; factsVersion: string | null }>;
  force?: boolean;
}): SurgeryCaseIntelligencePublishDecision {
  const versions = input.existingRows
    .map((row) => row.factsVersion)
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0);

  const sameVersionRow = findPublishedFactsVersionRow(input.existingRows, input.incomingVersion);
  if (sameVersionRow) {
    return { action: "update", existingEventId: sameVersionRow.id };
  }

  const newest = resolveNewestPublishedFactsVersion(versions);
  if (newest && compareFactsVersions(input.incomingVersion, newest) < 0 && !input.force) {
    return {
      action: "skip",
      reason: `A newer facts_version (${newest}) is already published.`,
    };
  }

  return { action: "insert" };
}

export function resolveSurgeryCaseIntelligenceEventValue(
  facts: SurgeryCaseIntelligenceFacts
): number | null {
  if (!facts.has_final_graft_count) return null;
  return facts.final_reviewed_graft_count;
}
