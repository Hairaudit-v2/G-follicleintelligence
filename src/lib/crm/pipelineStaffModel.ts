/**
 * FI-UX-REBUILD-1 S4.1 — Canonical Pipeline staff stage & lead model (pure).
 *
 * Presentation / validation only. Does not persist stages, move leads, convert,
 * merge identities, or depend on React / Supabase / server loaders.
 *
 * Canonical card identity: leadId = fi_crm_leads.id (never person/patient/task).
 * Staff columns group backend slugs for display; mutations still target real stage IDs
 * (destination selection for grouped columns is deferred to S4.2/S4.3).
 */

// ---------------------------------------------------------------------------
// Staff columns
// ---------------------------------------------------------------------------

export type PipelineStaffColumnId =
  | "new"
  | "contacting"
  | "qualified"
  | "consultation"
  | "planning_quote"
  | "booked_deposit"
  | "converted"
  | "nurture"
  | "closed_lost";

export type PipelineStageLifecycle =
  | "active"
  | "holding"
  | "terminal_won"
  | "terminal_lost";

export type PipelineStaffColumnDefinition = {
  id: PipelineStaffColumnId;
  label: string;
  lifecycle: PipelineStageLifecycle;
  /** Staff-facing display order (0-based). Nurture is holding, not a sequential mid-funnel step. */
  order: number;
};

/** Stable staff-facing column order (presentation only). */
export const PIPELINE_STAFF_COLUMN_ORDER: readonly PipelineStaffColumnId[] = [
  "new",
  "contacting",
  "qualified",
  "consultation",
  "planning_quote",
  "booked_deposit",
  "converted",
  "nurture",
  "closed_lost",
] as const;

export const PIPELINE_STAFF_COLUMNS: readonly PipelineStaffColumnDefinition[] = [
  { id: "new", label: "New", lifecycle: "active", order: 0 },
  { id: "contacting", label: "Contacting", lifecycle: "active", order: 1 },
  { id: "qualified", label: "Qualified", lifecycle: "active", order: 2 },
  { id: "consultation", label: "Consultation", lifecycle: "active", order: 3 },
  { id: "planning_quote", label: "Planning / quote", lifecycle: "active", order: 4 },
  { id: "booked_deposit", label: "Booked / deposit", lifecycle: "active", order: 5 },
  { id: "converted", label: "Converted", lifecycle: "terminal_won", order: 6 },
  { id: "nurture", label: "Nurture", lifecycle: "holding", order: 7 },
  { id: "closed_lost", label: "Closed / lost", lifecycle: "terminal_lost", order: 8 },
] as const;

const COLUMN_BY_ID: ReadonlyMap<PipelineStaffColumnId, PipelineStaffColumnDefinition> = new Map(
  PIPELINE_STAFF_COLUMNS.map((c) => [c.id, c])
);

// ---------------------------------------------------------------------------
// Backend stage → staff column crosswalk (default production slugs)
// ---------------------------------------------------------------------------

/**
 * Maps known `fi_crm_pipeline_stages.slug` values to staff columns.
 * Backend slugs are never renamed; this is presentation grouping only.
 * A staff column may group multiple backend stages — mutations must still use a real stage id.
 */
export const PIPELINE_DEFAULT_STAGE_CROSSWALK: Readonly<
  Record<string, PipelineStaffColumnId>
> = {
  new: "new",
  contacted: "contacting",
  qualified: "qualified",
  consult_scheduled: "consultation",
  consult_completed: "consultation",
  treatment_planning: "planning_quote",
  quote_sent: "planning_quote",
  deposit_or_booked: "booked_deposit",
  in_treatment: "booked_deposit",
  won_closed: "converted",
  nurture: "nurture",
  lost: "closed_lost",
} as const;

/** Known production default stage slugs that must appear in the crosswalk. */
export const PIPELINE_KNOWN_PRODUCTION_STAGE_SLUGS: readonly string[] = Object.freeze(
  Object.keys(PIPELINE_DEFAULT_STAGE_CROSSWALK)
);

/**
 * Deterministic active fallback when a stage is unknown and no won/lost/entry flag applies.
 * Exposed via resolution source `fallback` / audit `fallbackStageSlugs` — never silent.
 */
export const PIPELINE_UNKNOWN_ACTIVE_FALLBACK_COLUMN: PipelineStaffColumnId = "qualified";

// ---------------------------------------------------------------------------
// Stage definition (structural; no DB row coupling)
// ---------------------------------------------------------------------------

export type PipelineStageDefinition = {
  id?: string | null;
  slug: string;
  label: string;
  sortOrder: number;
  isEntry: boolean;
  isWon: boolean;
  isLost: boolean;
  archived?: boolean;
};

// ---------------------------------------------------------------------------
// Stage resolution
// ---------------------------------------------------------------------------

export type PipelineStageResolutionSource =
  | "known_slug"
  | "won_flag"
  | "lost_flag"
  | "entry_flag"
  | "fallback";

export type PipelineStageResolution = {
  columnId: PipelineStaffColumnId;
  lifecycle: PipelineStageLifecycle;
  source: PipelineStageResolutionSource;
  warning: string | null;
};

export function resolvePipelineStageLifecycle(
  columnId: PipelineStaffColumnId
): PipelineStageLifecycle {
  return COLUMN_BY_ID.get(columnId)?.lifecycle ?? "active";
}

/**
 * Resolve a backend stage definition to a staff column.
 *
 * Precedence:
 * 1. Conflicting won+lost flags → closed_lost + warning (deterministic, not healthy)
 * 2. isWon → converted
 * 3. isLost → closed_lost
 * 4. known slug crosswalk
 * 5. isEntry → new
 * 6. null / unknown active → qualified fallback (detectable)
 *
 * Urgency flags never participate.
 */
export function resolvePipelineStaffStage(
  stage: PipelineStageDefinition | null
): PipelineStageResolution {
  if (!stage) {
    return withLifecycle(
      PIPELINE_UNKNOWN_ACTIVE_FALLBACK_COLUMN,
      "fallback",
      "missing_stage: used qualified fallback"
    );
  }

  if (stage.isWon && stage.isLost) {
    return withLifecycle(
      "closed_lost",
      "fallback",
      `conflicting_terminal_flags:slug=${normalizeSlug(stage.slug)}`
    );
  }

  if (stage.isWon) {
    return withLifecycle("converted", "won_flag", null);
  }

  if (stage.isLost) {
    return withLifecycle("closed_lost", "lost_flag", null);
  }

  const slug = normalizeSlug(stage.slug);
  const known = slug ? PIPELINE_DEFAULT_STAGE_CROSSWALK[slug] : undefined;
  if (known) {
    return withLifecycle(known, "known_slug", null);
  }

  if (stage.isEntry) {
    return withLifecycle("new", "entry_flag", null);
  }

  return withLifecycle(
    PIPELINE_UNKNOWN_ACTIVE_FALLBACK_COLUMN,
    "fallback",
    `unknown_active_stage:slug=${slug || "(empty)"}: used qualified fallback`
  );
}

function withLifecycle(
  columnId: PipelineStaffColumnId,
  source: PipelineStageResolutionSource,
  warning: string | null
): PipelineStageResolution {
  return {
    columnId,
    lifecycle: resolvePipelineStageLifecycle(columnId),
    source,
    warning,
  };
}

function normalizeSlug(slug: string | null | undefined): string {
  return (slug ?? "").trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Terminal / holding / active helpers
// ---------------------------------------------------------------------------

export function isPipelineTerminalWon(
  columnId: PipelineStaffColumnId | PipelineStageResolution | null | undefined
): boolean {
  return asColumnId(columnId) === "converted";
}

export function isPipelineTerminalLost(
  columnId: PipelineStaffColumnId | PipelineStageResolution | null | undefined
): boolean {
  return asColumnId(columnId) === "closed_lost";
}

export function isPipelineHolding(
  columnId: PipelineStaffColumnId | PipelineStageResolution | null | undefined
): boolean {
  return asColumnId(columnId) === "nurture";
}

export function isPipelineActive(
  columnId: PipelineStaffColumnId | PipelineStageResolution | null | undefined
): boolean {
  const id = asColumnId(columnId);
  if (!id) return false;
  return resolvePipelineStageLifecycle(id) === "active";
}

function asColumnId(
  value: PipelineStaffColumnId | PipelineStageResolution | null | undefined
): PipelineStaffColumnId | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  return value.columnId;
}

// ---------------------------------------------------------------------------
// Lead lifecycle reconciliation (presentation only — no mutation)
// ---------------------------------------------------------------------------

export type PipelineLeadLifecycleState =
  | "active"
  | "holding"
  | "converted"
  | "lost"
  | "archived";

export type PipelineLeadLifecycleWarning =
  | "status_converted_active_stage"
  | "won_stage_open_status"
  | "lost_status_active_stage"
  | "lost_stage_open_status"
  | "converted_at_without_won_stage"
  | "converted_stage_without_patient"
  | "archived_with_active_stage"
  | "reopened_stale_terminal_status"
  | "status_stage_mismatch";

export type PipelineLeadLifecycleInput = {
  /** Lead status string from fi_crm_leads.status (e.g. open, converted, lost, archived). */
  status: string | null | undefined;
  /** Resolved staff column (from resolvePipelineStaffStage). */
  columnId: PipelineStaffColumnId;
  convertedAtIso?: string | null;
  patientId?: string | null;
  /** Explicit archived flag; also inferred from status === "archived". */
  archived?: boolean | null;
};

export type PipelineLeadLifecycleResolution = {
  state: PipelineLeadLifecycleState;
  warningCodes: PipelineLeadLifecycleWarning[];
};

/**
 * Display lifecycle from stage + lead status evidence.
 * Precedence: archived → converted evidence/won stage → lost evidence → nurture → active.
 * Disagreements yield deterministic display state plus warning codes (no silent overwrite).
 */
export function resolvePipelineLeadLifecycle(
  input: PipelineLeadLifecycleInput
): PipelineLeadLifecycleResolution {
  const warnings = new Set<PipelineLeadLifecycleWarning>();
  const status = (input.status ?? "").trim().toLowerCase();
  const archived = Boolean(input.archived) || status === "archived";
  const columnId = input.columnId;
  const hasConvertedAt = Boolean(input.convertedAtIso?.trim());
  const hasPatient = Boolean(input.patientId?.trim());
  const wonStage = isPipelineTerminalWon(columnId);
  const lostStage = isPipelineTerminalLost(columnId);
  const holding = isPipelineHolding(columnId);
  const activeStage = isPipelineActive(columnId);
  const statusConverted = status === "converted";
  const statusLost = status === "lost";
  const statusOpen = status === "open" || status === "" || status === "active";

  // Warnings (collect regardless of final state)
  if (statusConverted && activeStage) {
    warnings.add("status_converted_active_stage");
    warnings.add("status_stage_mismatch");
  }
  if (wonStage && statusOpen) {
    warnings.add("won_stage_open_status");
    warnings.add("status_stage_mismatch");
  }
  if (statusLost && activeStage) {
    warnings.add("lost_status_active_stage");
    warnings.add("status_stage_mismatch");
  }
  if (lostStage && statusOpen) {
    warnings.add("lost_stage_open_status");
    warnings.add("status_stage_mismatch");
  }
  if (hasConvertedAt && !wonStage && !statusConverted) {
    warnings.add("converted_at_without_won_stage");
  }
  if (wonStage && !hasPatient) {
    warnings.add("converted_stage_without_patient");
  }
  if (archived && activeStage) {
    warnings.add("archived_with_active_stage");
  }
  if ((statusConverted || statusLost) && activeStage && !archived) {
    // reopened board placement with stale terminal status
    if (statusConverted || statusLost) {
      warnings.add("reopened_stale_terminal_status");
    }
  }

  // Display precedence
  if (archived) {
    return { state: "archived", warningCodes: [...warnings] };
  }

  if (statusConverted || wonStage || (hasConvertedAt && (statusConverted || wonStage))) {
    return { state: "converted", warningCodes: [...warnings] };
  }
  // converted_at alone without won/status still surfaces converted for display when strong evidence:
  // ticket: "Explicit converted evidence or won stage". convertedAt counts as evidence with warning.
  if (hasConvertedAt && !lostStage && !statusLost) {
    if (!wonStage) warnings.add("converted_at_without_won_stage");
    return { state: "converted", warningCodes: [...warnings] };
  }

  if (statusLost || lostStage) {
    return { state: "lost", warningCodes: [...warnings] };
  }

  if (holding) {
    return { state: "holding", warningCodes: [...warnings] };
  }

  return { state: "active", warningCodes: [...warnings] };
}

// ---------------------------------------------------------------------------
// Urgency boundary (not stages)
// ---------------------------------------------------------------------------

/**
 * Urgency is orthogonal to staff-column membership.
 * Flags may coexist, affect sort/filters, and are derived later (S4.2+).
 * They must never become columns (no Overdue / Stale / Unassigned columns).
 */
export type PipelineUrgencyFlag =
  | "overdue_follow_up"
  | "due_today"
  | "untouched_new"
  | "unassigned"
  | "stale"
  | "consultation_due"
  | "consultation_no_show"
  | "high_value"
  | "blocked";

/** Sort priority ranks for urgency (lower = higher priority). Unlisted flags do not rank. */
const URGENCY_SORT_RANK: readonly PipelineUrgencyFlag[] = [
  "blocked",
  "overdue_follow_up",
  "due_today",
  "untouched_new",
  "consultation_no_show",
  "consultation_due",
] as const;

// ---------------------------------------------------------------------------
// Stable lead ordering
// ---------------------------------------------------------------------------

export type PipelineSortableLead = {
  leadId: string;
  urgencyFlags: readonly PipelineUrgencyFlag[];
  nextFollowUpAtIso: string | null;
  createdAtIso: string | null;
  score: number | null;
};

function bestUrgencyRank(flags: readonly PipelineUrgencyFlag[]): number {
  let best = URGENCY_SORT_RANK.length;
  for (let i = 0; i < URGENCY_SORT_RANK.length; i++) {
    if (flags.includes(URGENCY_SORT_RANK[i]!)) {
      best = Math.min(best, i);
    }
  }
  return best;
}

function parseIsoMs(iso: string | null | undefined): number | null {
  if (iso == null || !String(iso).trim()) return null;
  const ms = Date.parse(String(iso).trim());
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Deterministic comparator. Does not rely on source array order.
 * Invalid dates fail safe (treated as missing). Equal keys use leadId ascending.
 */
export function comparePipelineSortableLeads(
  a: PipelineSortableLead,
  b: PipelineSortableLead
): number {
  const ur = bestUrgencyRank(a.urgencyFlags) - bestUrgencyRank(b.urgencyFlags);
  if (ur !== 0) return ur;

  const aFu = parseIsoMs(a.nextFollowUpAtIso);
  const bFu = parseIsoMs(b.nextFollowUpAtIso);
  if (aFu != null && bFu != null && aFu !== bFu) return aFu - bFu;
  if (aFu != null && bFu == null) return -1;
  if (aFu == null && bFu != null) return 1;

  const aHv = a.urgencyFlags.includes("high_value") ? 0 : 1;
  const bHv = b.urgencyFlags.includes("high_value") ? 0 : 1;
  if (aHv !== bHv) return aHv - bHv;

  // Optional score: higher score first when both present (does not override higher priorities)
  if (a.score != null && b.score != null && a.score !== b.score) {
    return b.score - a.score;
  }
  if (a.score != null && b.score == null) return -1;
  if (a.score == null && b.score != null) return 1;

  const aCr = parseIsoMs(a.createdAtIso);
  const bCr = parseIsoMs(b.createdAtIso);
  if (aCr != null && bCr != null && aCr !== bCr) return aCr - bCr;
  if (aCr != null && bCr == null) return -1;
  if (aCr == null && bCr != null) return 1;

  return a.leadId.localeCompare(b.leadId);
}

export function sortPipelineSortableLeads(
  leads: readonly PipelineSortableLead[]
): PipelineSortableLead[] {
  return [...leads].sort(comparePipelineSortableLeads);
}

// ---------------------------------------------------------------------------
// Identity helpers (semantics only — no merge)
// ---------------------------------------------------------------------------

/** Canonical Pipeline card key: fi_crm_leads.id */
export function pipelineLeadIdentityKey(leadId: string): string {
  return leadId.trim();
}

/**
 * Multiple leads for one person or patient remain separate cards.
 * Equality is leadId only — never name/email/phone/personId/patientId.
 */
export function pipelineLeadsAreSameCard(aLeadId: string, bLeadId: string): boolean {
  return pipelineLeadIdentityKey(aLeadId) === pipelineLeadIdentityKey(bLeadId);
}

// ---------------------------------------------------------------------------
// Crosswalk audit
// ---------------------------------------------------------------------------

export type PipelineStageCrosswalkAudit = {
  duplicateSlugs: string[];
  /** Known slugs that would resolve to conflicting columns (config integrity). */
  duplicateColumnMembership: string[];
  conflictingTerminalFlags: string[];
  unmappedActiveStages: string[];
  fallbackStageSlugs: string[];
  missingEntryStage: boolean;
  missingWonStage: boolean;
  missingLostStage: boolean;
  warnings: string[];
  errors: string[];
  pass: boolean;
};

/**
 * Validate tenant stage set against the default crosswalk and terminal invariants.
 * Blocking errors set pass=false (duplicate slug, conflict flags, missing won/lost,
 * known production slug missing from crosswalk config, invalid config).
 */
export function auditPipelineStageCrosswalk(
  stages: readonly PipelineStageDefinition[]
): PipelineStageCrosswalkAudit {
  const duplicateSlugs: string[] = [];
  const duplicateColumnMembership: string[] = [];
  const conflictingTerminalFlags: string[] = [];
  const unmappedActiveStages: string[] = [];
  const fallbackStageSlugs: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  // Static config integrity: each known slug maps to exactly one column
  const reverse = new Map<string, PipelineStaffColumnId>();
  for (const [slug, columnId] of Object.entries(PIPELINE_DEFAULT_STAGE_CROSSWALK)) {
    if (reverse.has(slug) && reverse.get(slug) !== columnId) {
      duplicateColumnMembership.push(slug);
      errors.push(`known_slug_multi_column:${slug}`);
    }
    reverse.set(slug, columnId);
  }

  // All production known slugs present in crosswalk (config self-check)
  for (const slug of PIPELINE_KNOWN_PRODUCTION_STAGE_SLUGS) {
    if (!(slug in PIPELINE_DEFAULT_STAGE_CROSSWALK)) {
      errors.push(`known_production_slug_missing_from_crosswalk:${slug}`);
    }
  }

  const slugCounts = new Map<string, number>();
  const entrySlugs: string[] = [];
  const sortOrders = new Map<number, string[]>();
  let hasWon = false;
  let hasLost = false;
  let hasEntry = false;

  for (const stage of stages) {
    const slug = normalizeSlug(stage.slug);
    if (!slug) {
      errors.push("empty_stage_slug");
      continue;
    }

    slugCounts.set(slug, (slugCounts.get(slug) ?? 0) + 1);

    if (stage.isEntry) {
      hasEntry = true;
      entrySlugs.push(slug);
    }
    if (stage.isWon) hasWon = true;
    if (stage.isLost) hasLost = true;

    if (stage.isWon && stage.isLost) {
      conflictingTerminalFlags.push(slug);
      errors.push(`conflicting_terminal_flags:${slug}`);
    }

    const orders = sortOrders.get(stage.sortOrder) ?? [];
    orders.push(slug);
    sortOrders.set(stage.sortOrder, orders);

    if (stage.archived) {
      warnings.push(`archived_stage_referenced:${slug}`);
    }

    const resolution = resolvePipelineStaffStage(stage);
    if (resolution.source === "fallback" && !stage.isWon && !stage.isLost) {
      fallbackStageSlugs.push(slug);
      if (!stage.archived) {
        unmappedActiveStages.push(slug);
        warnings.push(`unknown_active_fallback:${slug}`);
      }
    }

    // Known production slug present in tenant stages should map via known_slug (or won/lost flags)
    if (
      slug in PIPELINE_DEFAULT_STAGE_CROSSWALK &&
      !stage.isWon &&
      !stage.isLost &&
      resolution.source !== "known_slug"
    ) {
      errors.push(`known_slug_resolution_unexpected:${slug}:${resolution.source}`);
    }
  }

  for (const [slug, count] of slugCounts) {
    if (count > 1) {
      duplicateSlugs.push(slug);
      errors.push(`duplicate_stage_slug:${slug}:count=${count}`);
    }
  }

  if (entrySlugs.length > 1) {
    warnings.push(`multiple_entry_stages:${entrySlugs.join(",")}`);
  }

  for (const [order, slugs] of sortOrders) {
    if (slugs.length > 1) {
      warnings.push(`duplicate_sort_order:${order}:${slugs.join(",")}`);
    }
  }

  const missingEntryStage = !hasEntry;
  const missingWonStage = !hasWon;
  const missingLostStage = !hasLost;

  // Platform default expects an entry stage; missing entry is a warning when custom first stages exist,
  // but empty stage sets with no entry still warn. Missing won/lost block rollout.
  if (missingEntryStage) {
    warnings.push("missing_entry_stage");
  }
  if (missingWonStage) {
    errors.push("missing_won_stage");
  }
  if (missingLostStage) {
    errors.push("missing_lost_stage");
  }

  // If tenant stages include only a subset of known production slugs, that is OK (per-tenant).
  // Blocking "known production active stage missing from the crosswalk" is a config-level check above.

  const pass = errors.length === 0;

  return {
    duplicateSlugs: uniqueSorted(duplicateSlugs),
    duplicateColumnMembership: uniqueSorted(duplicateColumnMembership),
    conflictingTerminalFlags: uniqueSorted(conflictingTerminalFlags),
    unmappedActiveStages: uniqueSorted(unmappedActiveStages),
    fallbackStageSlugs: uniqueSorted(fallbackStageSlugs),
    missingEntryStage,
    missingWonStage,
    missingLostStage,
    warnings: uniqueSorted(warnings),
    errors: uniqueSorted(errors),
    pass,
  };
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

/** Staff column definition lookup. */
export function getPipelineStaffColumn(
  columnId: PipelineStaffColumnId
): PipelineStaffColumnDefinition | undefined {
  return COLUMN_BY_ID.get(columnId);
}
