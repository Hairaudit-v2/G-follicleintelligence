import { isAllowedBookingType } from "@/src/lib/bookings/bookingPolicy";
import { validateApprovedRowForSchema } from "./approvedFiServicesImportPlan";
import type { FiServiceApprovedImportRow, FiServiceApprovedPayload, FiServiceInactiveDeferredRow, FiServiceRemovedNonBookable } from "./buildApprovedFiSeed";
import { FI_SERVICE_CATEGORIES, type FiServiceCategory } from "./serviceSalesTypes";

const HEX = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i;

/** Normalise non-standard Excel `booking_type` tokens to schema-allowed values. */
export const EXCEL_BOOKING_TYPE_ALIASES: Record<string, string> = {
  facial_prp: "prp",
  led: "other",
};

export type ExcelCatalogueRawRow = Record<string, unknown>;

export type ExcelCatalogueRejectedRow = {
  excel_row_number: number;
  service_name: string;
  reasons: string[];
};

export type StagedCatalogueRow = {
  excel_row_number: number;
  bookable: boolean;
  row: FiServiceApprovedImportRow;
};

function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return String(v).trim();
}

function parseYesNo(v: unknown): boolean | null {
  const s = str(v).toLowerCase();
  if (!s) return null;
  if (s === "yes" || s === "y" || s === "true" || s === "1") return true;
  if (s === "no" || s === "n" || s === "false" || s === "0") return false;
  return null;
}

function parseFiniteNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function normalizeHexColor(raw: string): { color: string | null; warning?: string } {
  const s = raw.trim();
  if (!s) return { color: null };
  const withHash = s.startsWith("#") ? s : `#${s}`;
  const lower = withHash.length === 4 || withHash.length === 7 ? withHash.toLowerCase() : withHash;
  if (!HEX.test(lower)) {
    return { color: null, warning: `Invalid colour "${raw}" — cleared (must be #RGB or #RRGGBB).` };
  }
  return { color: lower };
}

function parseCategory(raw: string): FiServiceCategory | null {
  const hit = FI_SERVICE_CATEGORIES.find((c) => c === raw.trim());
  return hit ?? null;
}

function normaliseBookingTypeToken(raw: string): { value: string | null; aliasNote?: string } {
  const t = raw.trim().toLowerCase();
  if (!t) return { value: null };
  const mapped = EXCEL_BOOKING_TYPE_ALIASES[t] ?? t;
  if (mapped !== t) {
    return { value: mapped, aliasNote: `booking_type alias: ${t} → ${mapped} (FI schema).` };
  }
  return { value: mapped };
}

/**
 * Parse one `Services Catalogue` object row (from `xlsx` sheet_to_json).
 * Returns `null` if the row is not a data row or `Import?` is not "Yes".
 */
export function parseExcelCatalogueRow(
  excel_row_number: number,
  raw: ExcelCatalogueRawRow
): { kind: "skip_empty" } | { kind: "not_yes"; importToken: string } | { kind: "parsed"; staged: StagedCatalogueRow } | { kind: "rejected"; rejected: ExcelCatalogueRejectedRow } {
  const importToken = str(raw["Import?"]);
  const name = str(raw["Service Name"]);

  if (!importToken && !name) return { kind: "skip_empty" };

  const importLower = importToken.toLowerCase();
  if (importLower !== "yes") {
    return { kind: "not_yes", importToken: importToken || "(blank)" };
  }

  const reasons: string[] = [];
  if (!name) reasons.push("missing_name");

  const catRaw = str(raw["FI Category"]);
  const category = parseCategory(catRaw);
  if (!category) reasons.push(catRaw ? `invalid_category:${catRaw}` : "missing_category");

  const btRaw = str(raw["Booking Type"]);
  const { value: btNorm, aliasNote } = normaliseBookingTypeToken(btRaw);
  let booking_type: string | null = btNorm;
  const notes: string[] = [];
  if (aliasNote) notes.push(aliasNote);

  if (booking_type && !isAllowedBookingType(booking_type)) {
    booking_type = null;
    notes.push(`booking_type "${btRaw || btNorm}" is not allowed by FI — cleared to null.`);
  }

  const durationRaw = raw["Suggested Duration (mins)"];
  const duration = parseFiniteNumber(durationRaw);
  if (duration == null || duration < 1 || duration > 1440) {
    reasons.push("missing_or_invalid_duration_minutes");
  }

  const price = parseFiniteNumber(raw["Base Price AUD"]);
  const base_price = price != null && price >= 0 ? price : 0;
  if (price == null || !Number.isFinite(price) || price < 0) {
    notes.push("base_price missing or invalid — defaulted to 0.");
  }

  const colourRaw = str(raw["Colour"] ?? raw["Color"]);
  const col = normalizeHexColor(colourRaw);
  if (col.warning) notes.push(col.warning);

  const activeParsed = parseYesNo(raw["Active?"]);
  const is_active = activeParsed !== false;

  const bookableParsed = parseYesNo(raw["Bookable?"]);
  const bookable = bookableParsed !== false;

  const internal = str(raw["Internal Notes"]);
  if (internal) notes.push(`Excel notes: ${internal}`);

  if (reasons.length > 0) {
    return {
      kind: "rejected",
      rejected: { excel_row_number, service_name: name || "(unnamed)", reasons },
    };
  }

  const row: FiServiceApprovedImportRow = {
    name,
    category: category!,
    booking_type,
    duration_minutes: duration!,
    base_price,
    color: col.color,
    is_active,
    review_flags: [],
    curation_notes: notes.length ? notes.join(" ") : undefined,
  };

  return { kind: "parsed", staged: { excel_row_number, bookable, row } };
}

/**
 * When several catalogue rows share the same non-null `booking_type`, only one may keep it
 * (`fi_services` partial unique index on `(tenant_id, booking_type)`). Prefer bookable+active
 * rows, then earlier Excel row order.
 */
export function resolveDuplicateBookingTypesInCatalogue(staged: StagedCatalogueRow[]): {
  rows: FiServiceApprovedImportRow[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const sorted = [...staged].sort((a, b) => a.excel_row_number - b.excel_row_number);

  const byBt = new Map<string, StagedCatalogueRow[]>();
  for (const s of sorted) {
    const bt = s.row.booking_type?.trim();
    if (!bt) continue;
    const arr = byBt.get(bt) ?? [];
    arr.push(s);
    byBt.set(bt, arr);
  }

  function pickWinner(group: StagedCatalogueRow[]): StagedCatalogueRow {
    return [...group].sort((a, b) => {
      const ab = a.bookable ? 1 : 0;
      const bb = b.bookable ? 1 : 0;
      if (ab !== bb) return bb - ab;
      const aa = a.row.is_active ? 1 : 0;
      const ba = b.row.is_active ? 1 : 0;
      if (aa !== ba) return ba - aa;
      return a.excel_row_number - b.excel_row_number;
    })[0]!;
  }

  const winRowByType = new Map<string, number>();
  for (const [bt, group] of Array.from(byBt.entries())) {
    if (group.length < 2) {
      winRowByType.set(bt, group[0]!.excel_row_number);
      continue;
    }
    const w = pickWinner(group);
    winRowByType.set(bt, w.excel_row_number);
  }

  const rows: FiServiceApprovedImportRow[] = [];
  for (const s of sorted) {
    const bt = s.row.booking_type?.trim();
    if (!bt) {
      rows.push({ ...s.row });
      continue;
    }
    const winNum = winRowByType.get(bt);
    if (winNum === s.excel_row_number) {
      rows.push({ ...s.row });
      continue;
    }
    const group = byBt.get(bt) ?? [];
    const win = group.find((g) => g.excel_row_number === winNum)!;
    const flags = [...(s.row.review_flags ?? [])];
    if (!flags.includes("duplicate_booking_type_cleared")) flags.push("duplicate_booking_type_cleared");
    const note = `booking_type cleared: duplicate "${bt}" in Excel catalogue — canonical row is "${win.row.name}" (Excel row ${win.excel_row_number}).`;
    warnings.push(
      `Duplicate booking_type "${bt}": keeping "${win.row.name}" (Excel row ${win.excel_row_number}); cleared on "${s.row.name}" (Excel row ${s.excel_row_number}).`
    );
    rows.push({
      ...s.row,
      booking_type: null,
      review_flags: flags,
      curation_notes: [s.row.curation_notes, note].filter(Boolean).join(" "),
    });
  }

  return { rows, warnings };
}

export function finalSchemaCheck(rows: FiServiceApprovedImportRow[]): { ok: FiServiceApprovedImportRow[]; rejected: ExcelCatalogueRejectedRow[] } {
  const ok: FiServiceApprovedImportRow[] = [];
  const rejected: ExcelCatalogueRejectedRow[] = [];
  for (const r of rows) {
    const err = validateApprovedRowForSchema(r);
    if (err) {
      rejected.push({ excel_row_number: 0, service_name: r.name, reasons: [`schema:${err}`] });
      continue;
    }
    ok.push(r);
  }
  return { ok, rejected };
}

export function buildApprovedPayloadFromExcelCatalogue(
  rawRows: ExcelCatalogueRawRow[],
  meta: FiServiceApprovedPayload["meta"]
): {
  payload: FiServiceApprovedPayload;
  warnings: string[];
  rejected: ExcelCatalogueRejectedRow[];
  not_imported_review: { excel_row_number: number; import_token: string; name: string; reason: string }[];
} {
  const warnings: string[] = [];
  const rejected: ExcelCatalogueRejectedRow[] = [];
  const not_imported_review: { excel_row_number: number; import_token: string; name: string; reason: string }[] = [];
  const removed_non_bookable: FiServiceRemovedNonBookable[] = [];

  const staged: StagedCatalogueRow[] = [];
  let excel_row_number = 1;

  for (const raw of rawRows) {
    excel_row_number++;
    const parsed = parseExcelCatalogueRow(excel_row_number, raw);
    if (parsed.kind === "skip_empty") continue;
    if (parsed.kind === "parsed") {
      staged.push(parsed.staged);
      continue;
    }
    if (parsed.kind === "rejected") {
      rejected.push(parsed.rejected);
      continue;
    }
    const importToken = parsed.importToken;
    const name = str(raw["Service Name"]);
    const internal = str(raw["Internal Notes"]).toLowerCase();
    if (/\bretail\b/.test(internal) || /\bdeposit\b/.test(name.toLowerCase()) || /\bretail\b/.test(name.toLowerCase())) {
      removed_non_bookable.push({
        name: name || "(unnamed)",
        category: (parseCategory(str(raw["FI Category"])) ?? "Other") as FiServiceCategory,
        reason: `Excel row marked "${importToken}" — non-bookable / financial per catalogue notes.`,
      });
    } else {
      not_imported_review.push({
        excel_row_number,
        import_token: importToken,
        name: name || "(unnamed)",
        reason: `Import? is not Yes (${importToken}) — not included in approved_for_import.`,
      });
    }
  }

  const dup = resolveDuplicateBookingTypesInCatalogue(staged);
  warnings.push(...dup.warnings);

  const checked = finalSchemaCheck(dup.rows);
  for (const r of checked.rejected) {
    rejected.push(r);
  }

  const approved_for_import = checked.ok;

  const inactive_deferred: FiServiceInactiveDeferredRow[] = [];

  const payload: FiServiceApprovedPayload = {
    meta,
    approved_for_import,
    inactive_deferred,
    removed_non_bookable,
    summary: {
      approved_active_count: approved_for_import.filter((r) => r.is_active).length,
      inactive_deferred_count: inactive_deferred.length,
      removed_non_bookable_count: removed_non_bookable.length,
      uncertain_resolved_count: 0,
    },
  };

  return { payload, warnings, rejected, not_imported_review };
}

export function buildStage7a4MarkdownReport(args: {
  payload: FiServiceApprovedPayload;
  warnings: string[];
  rejected: ExcelCatalogueRejectedRow[];
  not_imported_review: { excel_row_number: number; import_token: string; name: string; reason: string }[];
}): string {
  const { payload, warnings, rejected, not_imported_review } = args;
  const lines: string[] = [];
  lines.push("# Stage 7A.4 — Curated Excel service catalogue → FI approved seed");
  lines.push("");
  lines.push(`- **Generated:** ${payload.meta.generated_at}`);
  lines.push(`- **Source Excel:** ${payload.meta.source_excel_path ?? "(unknown)"}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`| Metric | Count |`);
  lines.push(`|--------|------:|`);
  lines.push(`| **Approved rows** (\`approved_for_import\`) | ${payload.approved_for_import.length} |`);
  lines.push(`| **Active** (\`is_active: true\`) | ${payload.summary.approved_active_count} |`);
  lines.push(`| **Inactive in approved list** | ${payload.approved_for_import.filter((r) => !r.is_active).length} |`);
  lines.push(`| **Removed (non-bookable)** | ${payload.removed_non_bookable.length} |`);
  lines.push(`| **Rejected (validation)** | ${rejected.length} |`);
  const missingNames = rejected.filter((r) => r.reasons.some((x) => x === "missing_name")).length;
  const missingDurations = rejected.filter((r) => r.reasons.some((x) => x === "missing_or_invalid_duration_minutes")).length;
  lines.push(`| **Rejected — missing name** | ${missingNames} |`);
  lines.push(`| **Rejected — missing / invalid duration** | ${missingDurations} |`);
  lines.push(`| **Not imported (not Yes)** | ${not_imported_review.length} |`);
  lines.push("");
  lines.push("## Warnings");
  if (warnings.length === 0) lines.push("_None._");
  else for (const w of warnings) lines.push(`- ${w}`);
  lines.push("");
  lines.push("## Duplicate booking types");
  lines.push(
    "Non-null `booking_type` must be unique per tenant in `fi_services`. Duplicate types in the Excel sheet had `booking_type` cleared on non-canonical rows (see `review_flags` / `curation_notes` on those rows)."
  );
  lines.push("");
  lines.push("## Approved services (ready for Stage 7A.3 dry-run)");
  if (payload.approved_for_import.length === 0) lines.push("_None._");
  else {
    for (const r of payload.approved_for_import) {
      const bt = r.booking_type ?? "—";
      lines.push(
        `- **${r.name}** — ${r.category}; \`booking_type\`: ${bt}; ${r.duration_minutes} min; AUD ${r.base_price}; colour ${r.color ?? "—"}; active=${r.is_active}`
      );
      if (r.review_flags.length) lines.push(`  - *Flags:* ${r.review_flags.join(", ")}`);
      if (r.curation_notes) lines.push(`  - *Note:* ${r.curation_notes}`);
    }
  }
  lines.push("");
  lines.push("## Rejected rows");
  if (rejected.length === 0) lines.push("_None._");
  else {
    for (const r of rejected) {
      lines.push(`- Row ${r.excel_row_number}: **${r.service_name}** — ${r.reasons.join("; ")}`);
    }
  }
  lines.push("");
  lines.push("## Not imported (Import? ≠ Yes)");
  if (not_imported_review.length === 0) lines.push("_None._");
  else {
    for (const r of not_imported_review) {
      lines.push(`- Row ${r.excel_row_number}: **${r.name}** — ${r.reason}`);
    }
  }
  lines.push("");
  lines.push("## Removed (non-bookable)");
  if (payload.removed_non_bookable.length === 0) lines.push("_None._");
  else {
    for (const r of payload.removed_non_bookable) {
      lines.push(`- **${r.name}** — ${r.reason}`);
    }
  }
  lines.push("");
  lines.push("## Next step");
  lines.push("Run `npm run import:approved-services` with `--tenant-id` (dry-run) against `docs/timely-import/output/fi-services-seed-approved.json` — **no DB writes in Stage 7A.4.**");
  return lines.join("\n");
}
