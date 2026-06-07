import { isAllowedBookingType } from "@/src/lib/bookings/bookingPolicy";
import type { FiServiceApprovedImportRow } from "./buildApprovedFiSeed";

/** Minimal existing row for planning (from `fi_services`). */
export type ExistingFiServiceSnapshot = {
  id: string;
  name: string;
  category: string | null;
  booking_type: string | null;
};

export type ApprovedServiceImportPlanAction = "create" | "update" | "skip";

export type ApprovedServiceImportPlanEntry = {
  approved: FiServiceApprovedImportRow;
  action: ApprovedServiceImportPlanAction;
  existingId?: string;
  /** Human-readable reason for skip or notes. */
  detail?: string;
};

export type ApprovedServiceImportPlanResult = {
  entries: ApprovedServiceImportPlanEntry[];
  warnings: string[];
};

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeServiceMatchKey(name: string, category: string): string {
  return `${norm(name)}|${norm(category)}`;
}

const HEX = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i;

export function validateApprovedRowForSchema(row: FiServiceApprovedImportRow): string | null {
  if (!row.name?.trim()) return "Missing name.";
  if (row.duration_minutes < 1 || row.duration_minutes > 1440) return "duration_minutes out of range (1–1440).";
  if (!Number.isFinite(row.base_price) || row.base_price < 0) return "base_price invalid.";
  if (row.booking_type != null && row.booking_type.trim() && !isAllowedBookingType(row.booking_type)) {
    return `booking_type not allowed: ${row.booking_type}`;
  }
  if (row.color != null && row.color.trim() && !HEX.test(row.color.trim())) {
    return `color must be hex or null: ${row.color}`;
  }
  return null;
}

/**
 * Deduplicate approved rows that share the same non-null `booking_type` (last row wins).
 */
export function dedupeApprovedByBookingType(rows: FiServiceApprovedImportRow[]): {
  rows: FiServiceApprovedImportRow[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const byBt = new Map<string, FiServiceApprovedImportRow>();
  const noBt: FiServiceApprovedImportRow[] = [];
  for (const r of rows) {
    const bt = r.booking_type?.trim();
    if (!bt) {
      noBt.push(r);
      continue;
    }
    const prev = byBt.get(bt);
    if (prev) {
      warnings.push(
        `Duplicate booking_type "${bt}" in approved file: keeping "${r.name}", dropping "${prev.name}" from this import batch.`
      );
    }
    byBt.set(bt, r);
  }
  return { rows: [...noBt, ...byBt.values()], warnings };
}

/**
 * Deduplicate approved rows with null `booking_type` that share the same name+category key (last wins).
 */
export function dedupeApprovedByNameCategory(rows: FiServiceApprovedImportRow[]): {
  rows: FiServiceApprovedImportRow[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const withBt: FiServiceApprovedImportRow[] = [];
  const nullBtByKey = new Map<string, FiServiceApprovedImportRow>();
  for (const r of rows) {
    if (r.booking_type?.trim()) {
      withBt.push(r);
      continue;
    }
    const k = normalizeServiceMatchKey(r.name, r.category);
    if (nullBtByKey.has(k)) {
      const prev = nullBtByKey.get(k)!;
      warnings.push(
        `Duplicate name+category (no booking_type) in batch: keeping "${r.name}", superseding "${prev.name}".`
      );
    }
    nullBtByKey.set(k, r);
  }
  return { rows: [...withBt, ...nullBtByKey.values()], warnings };
}

/**
 * Build create/update/skip plan for importing `approved_for_import` into `fi_services`.
 *
 * - Match by `booking_type` when set on the approved row (tenant-scoped unique when non-null).
 * - Otherwise match by normalized `name` + `category` against **existing rows with null `booking_type` only**;
 *   if none, **create** a new row (avoids overwriting a typed procedure row).
 */
export function buildApprovedServicesImportPlan(
  approved: FiServiceApprovedImportRow[],
  existing: ExistingFiServiceSnapshot[]
): ApprovedServiceImportPlanResult {
  const warnings: string[] = [];

  let rows = [...approved];
  const d1 = dedupeApprovedByBookingType(rows);
  rows = d1.rows;
  warnings.push(...d1.warnings);
  const d2 = dedupeApprovedByNameCategory(rows);
  rows = d2.rows;
  warnings.push(...d2.warnings);

  const byBookingType = new Map<string, ExistingFiServiceSnapshot>();
  const byNameCategory = new Map<string, ExistingFiServiceSnapshot[]>();
  for (const ex of existing) {
    const bt = ex.booking_type?.trim();
    if (bt) {
      byBookingType.set(bt, ex);
    }
    const k = normalizeServiceMatchKey(ex.name, ex.category ?? "");
    const arr = byNameCategory.get(k) ?? [];
    arr.push(ex);
    byNameCategory.set(k, arr);
  }

  const entries: ApprovedServiceImportPlanEntry[] = [];

  for (const row of rows) {
    const err = validateApprovedRowForSchema(row);
    if (err) {
      entries.push({ approved: row, action: "skip", detail: err });
      continue;
    }

    const bt = row.booking_type?.trim();
    if (bt) {
      const hit = byBookingType.get(bt);
      if (hit) {
        entries.push({ approved: row, action: "update", existingId: hit.id, detail: `Matched existing booking_type=${bt}.` });
      } else {
        entries.push({ approved: row, action: "create", detail: `New row with booking_type=${bt}.` });
      }
      continue;
    }

    const k = normalizeServiceMatchKey(row.name, row.category);
    const candidates = byNameCategory.get(k) ?? [];
    const nullBtCandidates = candidates.filter((c) => !c.booking_type?.trim());
    if (nullBtCandidates.length > 0) {
      const pick = nullBtCandidates.sort((a, b) => a.id.localeCompare(b.id))[0]!;
      if (nullBtCandidates.length > 1) {
        warnings.push(
          `Multiple existing services match name+category "${row.name}" / ${row.category} with empty booking_type; updating ${pick.id.slice(0, 8)}…`
        );
      }
      if (candidates.length > nullBtCandidates.length) {
        warnings.push(
          `Ignored ${candidates.length - nullBtCandidates.length} typed row(s) with same name+category when matching unlinked import row "${row.name}".`
        );
      }
      entries.push({
        approved: row,
        action: "update",
        existingId: pick.id,
        detail: "Matched by normalized name + category on existing row without booking_type.",
      });
    } else {
      entries.push({
        approved: row,
        action: "create",
        detail:
          "No booking_type on import row and no existing row with same name+category and empty booking_type — insert new row.",
      });
    }
  }

  return { entries, warnings };
}

export function summarizeImportPlan(plan: ApprovedServiceImportPlanResult): {
  created: number;
  updated: number;
  skipped: number;
} {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  for (const e of plan.entries) {
    if (e.action === "create") created++;
    else if (e.action === "update") updated++;
    else skipped++;
  }
  return { created, updated, skipped };
}
