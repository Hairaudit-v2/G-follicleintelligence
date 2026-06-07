import type { FiServiceCategory, FiServiceSeedReviewRow } from "./serviceSalesTypes";

/** Row shape aligned with `fi_services` insert/update plus optional curation metadata. */
export type FiServiceApprovedImportRow = {
  name: string;
  category: FiServiceCategory;
  booking_type: string | null;
  duration_minutes: number;
  base_price: number;
  color: string | null;
  is_active: boolean;
  /** Always empty for approved-for-import rows (flags accepted or cleared). */
  review_flags: string[];
  curation_notes?: string;
};

export type FiServiceInactiveDeferredRow = FiServiceApprovedImportRow & {
  deferral_reason: string;
};

export type FiServiceRemovedNonBookable = {
  name: string;
  category: FiServiceCategory;
  reason: string;
};

export type FiServiceApprovedPayload = {
  meta: {
    /** `7a2` = Timely review JSON pipeline; `7a4` = curated Excel catalogue. */
    stage: "7a2" | "7a4";
    /** Present for Stage 7A.2 (Timely review → approved). */
    source_review_path?: string;
    /** Path or note about the Timely CSV used to build the review file (7A.2). */
    timely_input_note?: string;
    /** Present for Stage 7A.4 (Excel → approved). */
    source_excel_path?: string;
    generated_at: string;
  };
  approved_for_import: FiServiceApprovedImportRow[];
  inactive_deferred: FiServiceInactiveDeferredRow[];
  removed_non_bookable: FiServiceRemovedNonBookable[];
  summary: {
    approved_active_count: number;
    inactive_deferred_count: number;
    removed_non_bookable_count: number;
    /** Rows that had review_flags before curation (excluding removed). */
    uncertain_resolved_count: number;
  };
};

function normName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function grossOf(r: FiServiceSeedReviewRow): number {
  return r.timely.grossAmount ?? 0;
}

/**
 * When multiple Timely rows share the same normalized name under **Consultation**, keep the
 * highest-gross row in the pipeline and defer the rest (inactive until merged manually).
 */
export function collectConsultationDuplicateDeferrals(rows: FiServiceSeedReviewRow[]): {
  kept: FiServiceSeedReviewRow[];
  deferred: FiServiceInactiveDeferredRow[];
} {
  const consultBuckets = new Map<string, FiServiceSeedReviewRow[]>();
  for (const r of rows) {
    if (r.category !== "Consultation") continue;
    const k = normName(r.name);
    if (!k) continue;
    const arr = consultBuckets.get(k) ?? [];
    arr.push(r);
    consultBuckets.set(k, arr);
  }
  const loserKeys = new Set<string>();
  const deferred: FiServiceInactiveDeferredRow[] = [];
  for (const [, group] of consultBuckets) {
    if (group.length < 2) continue;
    group.sort((a, b) => grossOf(b) - grossOf(a));
    const [, ...rest] = group;
    for (const r of rest) {
      loserKeys.add(`${r.name}|${r.timely.sourceLineNumber}`);
      deferred.push({
        name: r.name,
        category: r.category,
        booking_type: r.booking_type,
        duration_minutes: r.duration_minutes,
        base_price: r.base_price,
        color: r.color,
        is_active: false,
        review_flags: [],
        deferral_reason: "Duplicate consultation service name in Timely export — superseded by higher-gross row.",
        curation_notes: `Superseded in curation; Timely line ${r.timely.sourceLineNumber}.`,
      });
    }
  }
  const kept = rows.filter((r) => !loserKeys.has(`${r.name}|${r.timely.sourceLineNumber}`));
  return { kept, deferred };
}

const UNCERTAIN_FLAG = "booking_type_uncertain";
const OTHER_CAT_FLAG = "fi_category_other_review";

function hasUncertainMapping(r: FiServiceSeedReviewRow): boolean {
  return r.review_flags.some((f) => f === UNCERTAIN_FLAG || f === OTHER_CAT_FLAG);
}

function hasOnlyPriceUnknown(r: FiServiceSeedReviewRow): boolean {
  return r.review_flags.length > 0 && r.review_flags.every((f) => f === "price_unknown_default_zero");
}

/**
 * Curate Stage 7A.1 review rows into an FI-ready approved payload (no DB writes).
 *
 * - Drops non-bookable retail-style rows from the import list.
 * - Defers rows with uncertain FI/booking mappings (inactive until manually resolved).
 * - Resolves at most one row per `booking_type` (highest gross wins); others keep catalogue entry with `booking_type` cleared.
 * - Clears accepted `review_flags` on approved rows; optional `curation_notes`.
 */
export function buildApprovedFiSeedFromReviewRows(
  seedRows: FiServiceSeedReviewRow[],
  meta: FiServiceApprovedPayload["meta"]
): FiServiceApprovedPayload {
  const removed_non_bookable: FiServiceRemovedNonBookable[] = [];
  const inactive_deferred: FiServiceInactiveDeferredRow[] = [];

  const bookable = seedRows.filter((r) => {
    if (!r.is_bookable) {
      removed_non_bookable.push({
        name: r.name,
        category: r.category,
        reason: "Not a bookable clinical service (e.g. retail / bundle).",
      });
      return false;
    }
    return true;
  });

  const afterConsultDedupe = collectConsultationDuplicateDeferrals(bookable);
  inactive_deferred.push(...afterConsultDedupe.deferred);

  const uncertain: FiServiceSeedReviewRow[] = [];
  const pipeline: FiServiceSeedReviewRow[] = [];
  for (const r of afterConsultDedupe.kept) {
    if (hasUncertainMapping(r)) {
      uncertain.push(r);
      inactive_deferred.push({
        name: r.name,
        category: r.category,
        booking_type: r.booking_type,
        duration_minutes: r.duration_minutes,
        base_price: r.base_price,
        color: r.color,
        is_active: false,
        review_flags: [],
        deferral_reason: "Uncertain FI category or booking_type mapping — resolve manually before import.",
        curation_notes: `Original flags: ${r.review_flags.join(", ")}`,
      });
      continue;
    }
    pipeline.push(r);
  }

  const byType = new Map<string, FiServiceSeedReviewRow[]>();
  for (const r of pipeline) {
    const bt = r.booking_type?.trim();
    if (!bt) continue;
    const arr = byType.get(bt) ?? [];
    arr.push(r);
    byType.set(bt, arr);
  }

  const bookingTypeCleared = new Set<string>();
  for (const [, group] of Array.from(byType.entries())) {
    if (group.length < 2) continue;
    group.sort((a, b) => grossOf(b) - grossOf(a));
    const [, ...losers] = group;
    for (const l of losers) {
      bookingTypeCleared.add(`${l.name}|${l.timely.sourceLineNumber}`);
    }
  }

  const approved_for_import: FiServiceApprovedImportRow[] = [];

  for (const r of pipeline) {
    const key = `${r.name}|${r.timely.sourceLineNumber}`;
    const originalBookingType = r.booking_type;
    let booking_type = r.booking_type;
    let duration_minutes = r.duration_minutes;
    const notes: string[] = [];

    if (bookingTypeCleared.has(key)) {
      booking_type = null;
      notes.push(
        `booking_type cleared: duplicate "${originalBookingType}" in import batch — canonical row kept by highest gross in Timely window.`
      );
      if (/\bplanning\b/i.test(r.name) && duration_minutes >= 120) {
        duration_minutes = 60;
        notes.push("duration_minutes adjusted to 60 for planning-style row after booking_type dedupe.");
      }
    }

    if (hasOnlyPriceUnknown(r)) {
      notes.push("Timely window showed no unit revenue; base_price left at 0 — confirm before go-live.");
    }

    approved_for_import.push({
      name: r.name,
      category: r.category,
      booking_type,
      duration_minutes,
      base_price: r.base_price,
      color: r.color,
      is_active: true,
      review_flags: [],
      curation_notes: notes.length ? notes.join(" ") : undefined,
    });
  }

  return {
    meta,
    approved_for_import,
    inactive_deferred,
    removed_non_bookable,
    summary: {
      approved_active_count: approved_for_import.length,
      inactive_deferred_count: inactive_deferred.length,
      removed_non_bookable_count: removed_non_bookable.length,
      uncertain_resolved_count: uncertain.length,
    },
  };
}

export function buildStage7a2MarkdownReport(payload: FiServiceApprovedPayload): string {
  const s = payload.summary;
  const lines: string[] = [];
  lines.push(`# Stage 7A.2 — Timely service seed (final review)`);
  lines.push("");
  lines.push(`- **Generated:** ${payload.meta.generated_at}`);
  lines.push(`- **Source review:** ${payload.meta.source_review_path ?? "—"}`);
  lines.push(`- **Timely input note:** ${payload.meta.timely_input_note ?? "—"}`);
  lines.push("");
  lines.push(`## Counts`);
  lines.push(`| Metric | Count |`);
  lines.push(`|--------|------:|`);
  lines.push(`| **Approved for FI import** (\`is_active: true\`) | ${s.approved_active_count} |`);
  lines.push(`| **Inactive / deferred** (manual follow-up) | ${s.inactive_deferred_count} |`);
  lines.push(`| **Removed (non-bookable)** | ${s.removed_non_bookable_count} |`);
  lines.push(`| **Uncertain mappings deferred** | ${s.uncertain_resolved_count} |`);
  lines.push("");
  lines.push(`## Recommended defaults`);
  lines.push(`- One **\`booking_type\`** value per tenant in \`fi_services\` when linked; duplicates in Timely are merged by keeping the highest-gross row for that type.`);
  lines.push(`- **Diagnostics / other** services without a confident \`booking_type\` stay in **inactive_deferred** until mapped (often \`other\` or left unlinked).`);
  lines.push(`- **Retail** lines are excluded from the bookable clinical catalogue.`);
  lines.push("");
  lines.push(`## Services ready for FI import`);
  if (payload.approved_for_import.length === 0) lines.push(`_None — re-run after fixing review input._`);
  else {
    for (const r of payload.approved_for_import) {
      const bt = r.booking_type ?? "—";
      lines.push(`- **${r.name}** — ${r.category}; \`booking_type\`: ${bt}; ${r.duration_minutes} min; AUD ${r.base_price}; colour ${r.color ?? "—"}`);
      if (r.curation_notes) lines.push(`  - *Note:* ${r.curation_notes}`);
    }
  }
  lines.push("");
  lines.push(`## Inactive / deferred`);
  if (payload.inactive_deferred.length === 0) lines.push(`_None._`);
  else {
    for (const r of payload.inactive_deferred) {
      lines.push(`- **${r.name}** — ${r.deferral_reason}`);
    }
  }
  lines.push("");
  lines.push(`## Removed (non-bookable)`);
  if (payload.removed_non_bookable.length === 0) lines.push(`_None._`);
  else {
    for (const r of payload.removed_non_bookable) {
      lines.push(`- **${r.name}** — ${r.reason}`);
    }
  }
  lines.push("");
  lines.push(`## Next step`);
  lines.push(`Use a guarded import job (separate task) to upsert \`fi_services\` from \`fi-services-seed-approved.json\` — **no Supabase insert in Stage 7A.2.**`);
  return lines.join("\n");
}
