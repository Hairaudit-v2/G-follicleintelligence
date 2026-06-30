import { BOOKING_TYPES, type BookingType } from "@/src/lib/bookings/bookingPolicy";
import type {
  FiServiceCategory,
  FiServiceSeedBuildResult,
  FiServiceSeedReviewRow,
  TimelyRowDisposition,
  TimelyServiceSalesExtract,
} from "./serviceSalesTypes";

const BOOKING_SET = new Set<string>(BOOKING_TYPES);

function normKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/** Split CSV respecting double-quoted fields (single-line rows). */
export function splitCsvRecords(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows: string[][] = [];
  for (const line of lines) {
    rows.push(parseCsvLine(line));
  }
  return rows;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && c === ",") {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

function parseMoney(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const cleaned = t.replace(/[$€£]/g, "").replace(/,/g, "");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseQty(raw: string): number {
  const n = Number.parseFloat(raw.trim().replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export type HeaderMap = {
  categoryIdx: number;
  nameIdx: number;
  qtyIdx: number;
  avgIdx: number | null;
  grossIdx: number | null;
  taxIdx: number | null;
  netIdx: number | null;
};

export function detectHeaderMap(headerCells: string[]): HeaderMap | null {
  const keys = headerCells.map((h, i) => ({ raw: h, i, k: normKey(h) }));

  const find = (...candidates: string[]): number | null => {
    for (const c of candidates) {
      const nk = normKey(c);
      const hit = keys.find((x) => x.k === nk || x.k.includes(nk) || nk.includes(x.k));
      if (hit) return hit.i;
    }
    return null;
  };

  const categoryIdx =
    find("servicecategory", "category", "servicegroup", "servicetype") ??
    keys.find((x) => x.k.includes("category") && !x.k.includes("name"))?.i ??
    null;
  const nameIdx =
    find("servicename", "service", "item", "description") ??
    keys.find((x) => x.k.includes("service") && x.k.includes("name"))?.i ??
    keys.find((x) => x.k === "service")?.i ??
    null;

  if (categoryIdx == null || nameIdx == null) return null;

  const qtyIdx =
    find("quantity", "qty", "count", "usage", "usagequantity", "volume", "services") ?? nameIdx + 1;

  const avgIdx = find("average", "averageamount", "avgsale", "avg", "averageprice", "unitaverage");
  const grossIdx = find("gross", "grossamount", "totalinctax", "total", "revenue", "grosssales");
  const taxIdx = find("tax", "taxamount", "gst", "salestax");
  const netIdx = find("net", "netamount", "totalexcludingtax", "totalex tax", "nett");

  return {
    categoryIdx,
    nameIdx,
    qtyIdx,
    avgIdx,
    grossIdx,
    taxIdx,
    netIdx,
  };
}

/** Stub / pivot labels from Timely summary exports. */
export function isStubOrPivotLabel(category: string, name: string): boolean {
  const c = category.trim();
  const n = name.trim();
  const cn = normKey(c);
  const nn = normKey(n);
  const blob = `${c} ${n}`.toLowerCase();
  if (/\bgrand\s*total\b/i.test(blob)) return true;
  if (/^servicecategory\d*$/i.test(c) || /^servicename\d*$/i.test(n)) return true;
  if (/^servicecategory\d*$/i.test(n) || /^servicename\d*$/i.test(c)) return true;
  if (/^column\d+$/i.test(c) || /^column\d+$/i.test(n)) return true;
  if (nn === "total" || nn === "subtotal" || nn === "grandtotal") return true;
  if (cn === "total" || cn === "summary" || cn === "reporttotal") return true;
  if (!c && !n) return true;
  return false;
}

const REDEMPTION_RE =
  /\b(package|gift\s*card|membership|prepaid|voucher)\s*(redemption|credit|usage)\b|\bredemption\b|\bpackage\s+credit\b|\breferral\s+credit\b|\bloyalty\s+redemption\b/i;

export function isPackageOrRedemptionRow(category: string, name: string): boolean {
  const blob = `${category} ${name}`;
  return REDEMPTION_RE.test(blob);
}

export function isLikelyNegativeAdjustment(
  category: string,
  name: string,
  gross: number | null,
  net: number | null
): boolean {
  const blob = `${category} ${name}`.toLowerCase();
  const neg = (gross != null && gross < 0) || (net != null && net < 0);
  if (!neg) return false;
  if (/adjustment|credit\s*note|reversal|refund|write[\s-]?off|discount\s*adjust/i.test(blob))
    return true;
  return true;
}

export function classifyRowDisposition(extract: TimelyServiceSalesExtract): TimelyRowDisposition {
  const { timelyCategory: cat, timelyServiceName: name } = extract;
  if (isStubOrPivotLabel(cat, name))
    return { kind: "excluded", reason: "Summary / header / pivot stub row" };
  if (isPackageOrRedemptionRow(cat, name))
    return {
      kind: "excluded",
      reason: "Package / gift / membership redemption or similar (deduped import)",
    };
  if (isLikelyNegativeAdjustment(cat, name, extract.grossAmount, extract.netAmount)) {
    return {
      kind: "excluded",
      reason: "Negative adjustment / refund aggregate — excluded from active seed list",
    };
  }
  return { kind: "seed" };
}

function mapTimelyBlobToFiCategory(cat: string, name: string): FiServiceCategory {
  const b = `${cat} ${name}`.toLowerCase();
  /** Strong clinical cues in the service name (or combined blob) win over Timely category labels such as "Consultation". */
  if (/\b(fue|follicular|transplant|hair\s*transplant|strip|day\s*surgery)\b/i.test(b))
    return "Surgery";
  if (/\bconsultation\b|hair\s*consult|\b(assessment|first\s*visit|initial\s*visit)\b/i.test(b))
    return "Consultation";
  if (/\b(follow[\s-]?up|post[\s-]?op|review\b|aftercare)\b/i.test(b)) return "Follow-up";
  if (/\b(trichoscopy|diagnostic|scope|biopsy|blood|lab|analysis)\b/i.test(b)) return "Diagnostics";
  if (/\b(prp|prf|mesotherapy|exosome|injection|laser|led|microneed|therapy|treatment)\b/i.test(b))
    return "Treatment";
  if (/\b(product|retail|shampoo|supplement)\b/i.test(b)) return "Other";
  return "Other";
}

function suggestBookingType(
  cat: string,
  name: string
): { booking: BookingType | null; flags: string[] } {
  const flags: string[] = [];
  const b = `${cat} ${name}`.toLowerCase();
  if (/\bprp\b/i.test(name) || /\bprp\b/i.test(cat)) return { booking: "prp", flags };
  if (/\bprf\b/i.test(b)) return { booking: "prf", flags };
  if (/\bmesotherapy\b/i.test(b)) return { booking: "mesotherapy", flags };
  if (/\bexosome\b/i.test(b)) return { booking: "exosomes", flags };
  if (/\b(fue|follicular|transplant|hair\s*transplant|strip\b|surgery\b)\b/i.test(b))
    return { booking: "surgery", flags };
  if (/\bfollow[\s-]?up\b/i.test(b)) return { booking: "follow_up", flags };
  if (/\b(review|check[\s-]?up)\b/i.test(b) && !/\bconsult/i.test(b))
    return { booking: "review", flags: [...flags, "booking_type_assumption_review"] };
  if (/\bconsult/i.test(b)) return { booking: "consultation", flags };
  flags.push("booking_type_uncertain");
  return { booking: null, flags };
}

function suggestDurationMinutes(fiCat: FiServiceCategory): number {
  switch (fiCat) {
    case "Consultation":
      return 45;
    case "Treatment":
      return 60;
    case "Surgery":
      return 480;
    case "Follow-up":
      return 30;
    case "Diagnostics":
      return 30;
    default:
      return 45;
  }
}

function suggestColor(fiCat: FiServiceCategory): string | null {
  switch (fiCat) {
    case "Consultation":
      return "#0ea5e9";
    case "Treatment":
      return "#22c55e";
    case "Surgery":
      return "#a855f7";
    case "Follow-up":
      return "#f97316";
    case "Diagnostics":
      return "#6366f1";
    default:
      return "#64748b";
  }
}

/**
 * Derive suggested list price: prefer average when it plausibly matches gross/qty;
 * else unit from gross/qty; else 0 + flag. Does not blindly use report totals as unit price.
 */
export function suggestBasePrice(
  qty: number,
  avg: number | null,
  gross: number | null
): { price: number; flags: string[] } {
  const flags: string[] = [];
  if (qty <= 0) {
    flags.push("price_qty_zero");
    return { price: 0, flags };
  }
  const unitFromGross = gross != null && gross > 0 ? gross / qty : null;
  if (avg != null && avg > 0) {
    if (unitFromGross != null) {
      const rel = Math.abs(avg - unitFromGross) / Math.max(unitFromGross, 1);
      if (rel <= 0.15 || qty === 1) {
        return { price: roundMoney(avg), flags };
      }
      flags.push("price_avg_gross_mismatch_used_gross_per_unit");
      return { price: roundMoney(unitFromGross), flags };
    }
    if (qty === 1) return { price: roundMoney(avg), flags };
    flags.push("price_used_average_despite_multi_qty_review");
    return { price: roundMoney(avg), flags };
  }
  if (unitFromGross != null && unitFromGross > 0) {
    return { price: roundMoney(unitFromGross), flags };
  }
  flags.push("price_unknown_default_zero");
  return { price: 0, flags };
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function isBookable(fiCat: FiServiceCategory, name: string): boolean {
  if (fiCat === "Other" && /\b(product|retail|shampoo)\b/i.test(name)) return false;
  return true;
}

export function extractRowsFromGrid(
  rows: string[][],
  startLine = 1
): { extracts: TimelyServiceSalesExtract[]; headerMap: HeaderMap | null; warnings: string[] } {
  const warnings: string[] = [];
  if (rows.length < 2) return { extracts: [], headerMap: null, warnings: ["CSV has no data rows"] };

  const map = detectHeaderMap(rows[0]!);
  if (!map) {
    warnings.push("Could not detect header row — need columns for category + service name.");
    return { extracts: [], headerMap: null, warnings };
  }

  const extracts: TimelyServiceSalesExtract[] = [];
  for (let r = 1; r < rows.length; r++) {
    const lineNo = startLine + r;
    const cells = rows[r]!;
    const cat = (cells[map.categoryIdx] ?? "").trim();
    const name = (cells[map.nameIdx] ?? "").trim();
    const qty = parseQty(cells[map.qtyIdx] ?? "0");
    const avg = map.avgIdx != null ? parseMoney(cells[map.avgIdx] ?? "") : null;
    const gross = map.grossIdx != null ? parseMoney(cells[map.grossIdx] ?? "") : null;
    const tax = map.taxIdx != null ? parseMoney(cells[map.taxIdx] ?? "") : null;
    const net = map.netIdx != null ? parseMoney(cells[map.netIdx] ?? "") : null;
    extracts.push({
      timelyCategory: cat,
      timelyServiceName: name,
      usageQuantity: qty,
      averageAmount: avg,
      grossAmount: gross,
      taxAmount: tax,
      netAmount: net,
      sourceLineNumber: lineNo,
    });
  }
  return { extracts, headerMap: map, warnings };
}

function mergeKey(e: TimelyServiceSalesExtract): string {
  return `${normKey(e.timelyCategory)}|${normKey(e.timelyServiceName)}`;
}

/** Merge duplicate service lines (e.g. split periods) by summing qty and gross, recomputing avg. */
export function mergeExtractsForSeed(
  extracts: TimelyServiceSalesExtract[]
): TimelyServiceSalesExtract[] {
  const map = new Map<string, TimelyServiceSalesExtract>();
  for (const e of extracts) {
    const k = mergeKey(e);
    const prev = map.get(k);
    if (!prev) {
      map.set(k, { ...e });
      continue;
    }
    const q = prev.usageQuantity + e.usageQuantity;
    const g1 = prev.grossAmount ?? 0;
    const g2 = e.grossAmount ?? 0;
    const gross = g1 + g2;
    const t1 = prev.taxAmount ?? 0;
    const t2 = e.taxAmount ?? 0;
    const n1 = prev.netAmount ?? 0;
    const n2 = e.netAmount ?? 0;
    map.set(k, {
      timelyCategory: prev.timelyCategory || e.timelyCategory,
      timelyServiceName: prev.timelyServiceName || e.timelyServiceName,
      usageQuantity: q,
      averageAmount: q > 0 && gross > 0 ? gross / q : prev.averageAmount,
      grossAmount: gross || null,
      taxAmount: t1 + t2 || null,
      netAmount: n1 + n2 || null,
      sourceLineNumber: prev.sourceLineNumber,
    });
  }
  return Array.from(map.values());
}

export function buildFiServiceSeedFromTimelyGrid(rows: string[][]): FiServiceSeedBuildResult {
  const { extracts: raw, warnings: w0 } = extractRowsFromGrid(rows);
  const excluded: { line: number; summary: string; reason: string }[] = [];
  const eligible: TimelyServiceSalesExtract[] = [];

  for (const ex of raw) {
    const disp = classifyRowDisposition(ex);
    if (disp.kind === "excluded") {
      excluded.push({
        line: ex.sourceLineNumber,
        summary: `${ex.timelyCategory} — ${ex.timelyServiceName}`,
        reason: disp.reason,
      });
      continue;
    }
    eligible.push(ex);
  }

  const merged = mergeExtractsForSeed(eligible);
  const seedRows: FiServiceSeedReviewRow[] = [];

  for (const ex of merged) {
    const fiCat = mapTimelyBlobToFiCategory(ex.timelyCategory, ex.timelyServiceName);

    const { booking, flags: bf } = suggestBookingType(ex.timelyCategory, ex.timelyServiceName);
    const booking_type = booking && BOOKING_SET.has(booking) ? booking : null;
    const { price, flags: pf } = suggestBasePrice(
      ex.usageQuantity,
      ex.averageAmount,
      ex.grossAmount
    );
    const review_flags = [...bf, ...pf];
    if (fiCat === "Other" && !booking_type) review_flags.push("fi_category_other_review");

    const is_active = true;
    const notes = [
      `Timely import line ${ex.sourceLineNumber}; qty=${ex.usageQuantity}`,
      ex.grossAmount != null ? `gross=${ex.grossAmount}` : "",
      ex.netAmount != null ? `net=${ex.netAmount}` : "",
    ]
      .filter(Boolean)
      .join("; ");

    seedRows.push({
      name: ex.timelyServiceName.trim() || ex.timelyCategory.trim() || "Unnamed service",
      category: fiCat,
      booking_type,
      duration_minutes: suggestDurationMinutes(fiCat),
      base_price: price,
      color: suggestColor(fiCat),
      is_active,
      is_bookable: isBookable(fiCat, ex.timelyServiceName),
      source: "timely_import",
      notes,
      review_flags,
      timely: ex,
    });
  }

  return { seedRows, excluded, warnings: w0 };
}

export function buildFiServiceSeedFromTimelyCsv(csvText: string): FiServiceSeedBuildResult {
  const grid = splitCsvRecords(csvText);
  return buildFiServiceSeedFromTimelyGrid(grid);
}

export function seedRowsToCsv(seedRows: FiServiceSeedReviewRow[]): string {
  const headers = [
    "name",
    "category",
    "booking_type",
    "duration_minutes",
    "base_price",
    "color",
    "is_active",
    "is_bookable",
    "source",
    "notes",
    "review_flags",
  ];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [headers.join(",")];
  for (const r of seedRows) {
    lines.push(
      [
        esc(r.name),
        esc(r.category),
        esc(r.booking_type ?? ""),
        String(r.duration_minutes),
        String(r.base_price),
        esc(r.color ?? ""),
        r.is_active ? "true" : "false",
        r.is_bookable ? "true" : "false",
        esc(r.source),
        esc(r.notes),
        esc(r.review_flags.join("; ")),
      ].join(",")
    );
  }
  return lines.join("\n");
}

export function buildMarkdownReport(
  result: FiServiceSeedBuildResult,
  meta: { inputPath: string; generatedAtIso: string }
): string {
  const lines: string[] = [];
  lines.push(`# Stage 7A.1 — Timely ServiceSales → FI catalogue seed (review)`);
  lines.push("");
  lines.push(`- **Generated:** ${meta.generatedAtIso}`);
  lines.push(`- **Input:** ${meta.inputPath}`);
  lines.push(`- **Seed rows:** ${result.seedRows.length}`);
  lines.push(`- **Excluded rows:** ${result.excluded.length}`);
  lines.push("");
  if (result.warnings.length) {
    lines.push(`## Warnings`);
    for (const w of result.warnings) lines.push(`- ${w}`);
    lines.push("");
  }
  lines.push(`## Rules applied`);
  lines.push(`- Dropped stub/pivot labels (e.g. ServiceCategory1, ServiceName5, totals).`);
  lines.push(`- Dropped package / gift / membership redemption style rows.`);
  lines.push(`- Excluded negative adjustment / refund aggregates from the **active** seed list.`);
  lines.push(`- Merged duplicate Timely category+service keys by summing quantity and gross.`);
  lines.push(
    `- **\`base_price\`:** prefers average when consistent with gross÷qty; otherwise gross÷qty; else 0 with flag.`
  );
  lines.push(
    `- **\`booking_type\`:** only set when mapping is confident; otherwise \`null\` + \`review_flags\`.`
  );
  lines.push(
    `- **\`is_bookable\` / \`source\` / \`notes\`:** review metadata — **not** columns on current \`fi_services\` (Stage 7A.1 is pre-DB).`
  );
  lines.push("");
  lines.push(`## FI category mapping (Timely → FI)`);
  lines.push(`| FI category | Heuristic |`);
  lines.push(`|-------------|-----------|`);
  lines.push(`| Consultation | consult / assessment / first visit |`);
  lines.push(`| Treatment | PRP/PRF/meso/exosome/injection/laser/therapy |`);
  lines.push(
    `| Surgery | FUE / follicular / transplant / strip / day surgery (name wins over Timely "Consultation" label) |`
  );
  lines.push(`| Follow-up | follow-up/post-op/review |`);
  lines.push(`| Diagnostics | trichoscopy/diagnostic/lab |`);
  lines.push(`| Other | fallback / retail product |`);
  lines.push("");
  lines.push(`## Seed list (preview)`);
  lines.push(
    `| # | name | category | booking_type | duration_min | base_price | is_active | is_bookable | flags |`
  );
  lines.push(
    `|---|------|----------|----------------|--------------|------------|-----------|---------------|-------|`
  );
  result.seedRows.forEach((r, i) => {
    const fl = r.review_flags.join(", ") || "—";
    lines.push(
      `| ${i + 1} | ${r.name.replace(/\|/g, "\\|")} | ${r.category} | ${r.booking_type ?? "—"} | ${r.duration_minutes} | ${r.base_price} | ${r.is_active} | ${r.is_bookable} | ${fl.replace(/\|/g, "\\|")} |`
    );
  });
  lines.push("");
  lines.push(`## Excluded / suppressed`);
  if (result.excluded.length === 0) lines.push(`_None._`);
  else {
    lines.push(`| line | summary | reason |`);
    lines.push(`|------|---------|--------|`);
    for (const e of result.excluded) {
      lines.push(
        `| ${e.line} | ${e.summary.replace(/\|/g, "\\|")} | ${e.reason.replace(/\|/g, "\\|")} |`
      );
    }
  }
  lines.push("");
  lines.push(`## Next steps`);
  lines.push(`1. Human-review rows with \`review_flags\`.`);
  lines.push(
    `2. Align \`booking_type\` with Evolved clinical naming (max one row per type per tenant in \`fi_services\`).`
  );
  lines.push(
    `3. When approved, add a guarded import path (separate task) — **this stage does not insert into the database.**`
  );
  return lines.join("\n");
}
