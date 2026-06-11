import { parsePlanItemRole } from "./medicationOsMappers";
import type { DraftTherapyPlanItemInput, PlanItemRole, PlanStatus } from "./medicationOsTypes";

export const PLAN_LIFECYCLE_ACTIONS = [
  "activate",
  "pause",
  "resume",
  "complete",
  "cancel",
  "supersede",
] as const;
export type PlanLifecycleAction = (typeof PLAN_LIFECYCLE_ACTIONS)[number];

export type NormalisedTherapyPlanItemInsert = {
  canonical_code: string;
  role: PlanItemRole;
  dosing_summary: string | null;
  sessions_planned: number | null;
  sessions_completed: number;
  day_offset_start: number | null;
  day_offset_end: number | null;
  pathology_gate: string | null;
  sort_order: number;
  metadata: Record<string, unknown>;
};

/**
 * Enforces allowed status transitions for therapy plan lifecycle mutations.
 */
export function assertPlanCanTransition(current: PlanStatus, action: PlanLifecycleAction): void {
  const ok = (() => {
    switch (action) {
      case "activate":
        return current === "draft";
      case "pause":
        return current === "active";
      case "resume":
        return current === "paused";
      case "complete":
        return current === "active";
      case "cancel":
        return current === "draft" || current === "active" || current === "paused";
      case "supersede":
        return current === "draft" || current === "active" || current === "paused";
      default:
        return false;
    }
  })();
  if (!ok) {
    throw new Error(`Invalid therapy plan transition: cannot ${action} from status "${current}".`);
  }
}

function asObjectRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

/**
 * Stable sort order, trimmed codes, defaulted numerics for insert/update payloads.
 */
export function normaliseTherapyPlanItems(items: DraftTherapyPlanItemInput[]): NormalisedTherapyPlanItemInsert[] {
  if (!items.length) {
    throw new Error("Therapy plan requires at least one item.");
  }
  const trimmed = items.map((it, index) => {
    const code = String(it.canonical_code ?? "").trim().toLowerCase();
    if (!code) {
      throw new Error("Each therapy plan item must include a non-empty canonical_code.");
    }
    const role = parsePlanItemRole(it.role);
    const sessionsPlanned =
      it.sessions_planned != null && !Number.isNaN(Number(it.sessions_planned))
        ? Math.max(0, Math.trunc(Number(it.sessions_planned)))
        : null;
    const sessionsCompleted = Math.max(0, Math.trunc(Number(it.sessions_completed ?? 0)));
    return {
      canonical_code: code,
      role,
      dosing_summary: it.dosing_summary != null ? String(it.dosing_summary).trim() || null : null,
      sessions_planned: sessionsPlanned,
      sessions_completed: sessionsCompleted,
      day_offset_start:
        it.day_offset_start != null && !Number.isNaN(Number(it.day_offset_start))
          ? Math.trunc(Number(it.day_offset_start))
          : null,
      day_offset_end:
        it.day_offset_end != null && !Number.isNaN(Number(it.day_offset_end)) ? Math.trunc(Number(it.day_offset_end)) : null,
      pathology_gate: it.pathology_gate != null ? String(it.pathology_gate).trim() || null : null,
      sort_order: typeof it.sort_order === "number" && !Number.isNaN(it.sort_order) ? Math.trunc(it.sort_order) : index,
      metadata: asObjectRecord(it.metadata),
    };
  });
  trimmed.sort((a, b) => a.sort_order - b.sort_order);
  return trimmed.map((it, i) => ({ ...it, sort_order: i }));
}

export function findInvalidCanonicalCodes(codes: string[], allowedActiveCodes: Set<string>): string[] {
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const raw of codes) {
    const c = String(raw ?? "").trim().toLowerCase();
    if (!c) continue;
    if (seen.has(c)) continue;
    seen.add(c);
    if (!allowedActiveCodes.has(c)) invalid.push(c);
  }
  return invalid;
}

export function assertCanonicalCodesAllowed(codes: string[], allowedActiveCodes: Set<string>): void {
  const invalid = findInvalidCanonicalCodes(codes, allowedActiveCodes);
  if (invalid.length) {
    throw new Error(`Unknown or inactive canonical_code for tenant: ${invalid.join(", ")}`);
  }
}
