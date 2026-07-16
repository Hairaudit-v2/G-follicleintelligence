/**
 * Privacy-safe HubSpot forms-inventory XLSX → canonical form GUID extraction.
 * Does not emit form names, URLs, or other non-ID cells into evidence output.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";

export const HUBSPOT_FORM_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const CANDIDATE_ID_HEADERS = [
  "form id",
  "form guid",
  "formid",
  "form_id",
  "guid",
  "id",
] as const;

export type SheetScan = {
  sheetName: string;
  headers: string[];
  candidateColumns: { header: string; columnIndex: number; uniqueValid: number }[];
  rowCount: number;
};

export type ExtractFormIdsResult = {
  evidenceType: "hubspot_export_form_inventory";
  sourceFilename: string;
  sourceSha256: string;
  sourceSheet: string;
  sourceIdColumn: string;
  expectedUniqueFormCount: number;
  actualUniqueFormCount: number;
  duplicateIds: string[];
  invalidIdCount: number;
  blankIdCount: number;
  formIds: string[];
  sheets: SheetScan[];
  ok: boolean;
  error?: string;
};

export function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function normalizeFormId(value: unknown): string {
  return String(value ?? "").trim();
}

export function isValidHubspotFormId(value: string): boolean {
  return HUBSPOT_FORM_ID_RE.test(value);
}

function scoreCandidateHeader(header: string): number {
  const h = normalizeHeader(header);
  if (h === "form id" || h === "form guid" || h === "formid" || h === "form_id") return 100;
  if (h === "guid") return 80;
  if (h === "id") return 40;
  return 0;
}

export function extractFormIdsFromWorkbookBuffer(
  buffer: Buffer,
  options: {
    sourceFilename: string;
    expectedUniqueFormCount?: number;
    preferredSheet?: string;
    preferredIdColumn?: string;
  }
): ExtractFormIdsResult {
  const expected = options.expectedUniqueFormCount ?? 48;
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheets: SheetScan[] = [];

  type Candidate = {
    sheetName: string;
    header: string;
    columnIndex: number;
    uniqueValid: number;
    score: number;
  };
  const candidates: Candidate[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    }) as unknown[][];
    if (!rows.length) {
      sheets.push({ sheetName, headers: [], candidateColumns: [], rowCount: 0 });
      continue;
    }
    const headers = (rows[0] ?? []).map((h) => String(h ?? ""));
    const candidateColumns: SheetScan["candidateColumns"] = [];
    for (let col = 0; col < headers.length; col++) {
      const header = headers[col] ?? "";
      const score = scoreCandidateHeader(header);
      if (score === 0 && !options.preferredIdColumn) continue;
      if (
        options.preferredIdColumn &&
        normalizeHeader(header) !== normalizeHeader(options.preferredIdColumn) &&
        score === 0
      ) {
        continue;
      }
      const values = new Set<string>();
      for (let r = 1; r < rows.length; r++) {
        const id = normalizeFormId(rows[r]?.[col]);
        if (id && isValidHubspotFormId(id)) values.add(id.toLowerCase());
      }
      const entry = {
        header,
        columnIndex: col,
        uniqueValid: values.size,
      };
      candidateColumns.push(entry);
      if (score > 0 || options.preferredIdColumn) {
        candidates.push({
          sheetName,
          header,
          columnIndex: col,
          uniqueValid: values.size,
          score: score + (options.preferredSheet === sheetName ? 10 : 0),
        });
      }
    }
    sheets.push({
      sheetName,
      headers,
      candidateColumns,
      rowCount: Math.max(0, rows.length - 1),
    });
  }

  let chosen: Candidate | undefined;
  if (options.preferredSheet && options.preferredIdColumn) {
    chosen = candidates.find(
      (c) =>
        c.sheetName === options.preferredSheet &&
        normalizeHeader(c.header) === normalizeHeader(options.preferredIdColumn)
    );
  }
  if (!chosen) {
    chosen = [...candidates].sort((a, b) => {
      if (b.uniqueValid !== a.uniqueValid) return b.uniqueValid - a.uniqueValid;
      return b.score - a.score;
    })[0];
  }

  const sourceSha256 = createHash("sha256").update(buffer).digest("hex");
  if (!chosen) {
    return {
      evidenceType: "hubspot_export_form_inventory",
      sourceFilename: options.sourceFilename,
      sourceSha256,
      sourceSheet: "",
      sourceIdColumn: "",
      expectedUniqueFormCount: expected,
      actualUniqueFormCount: 0,
      duplicateIds: [],
      invalidIdCount: 0,
      blankIdCount: 0,
      formIds: [],
      sheets,
      ok: false,
      error: "No candidate form-ID column found in workbook.",
    };
  }

  const sheet = workbook.Sheets[chosen.sheetName]!;
  const rows = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];

  const seen = new Map<string, number>();
  const formIds: string[] = [];
  const duplicateIds: string[] = [];
  let invalidIdCount = 0;
  let blankIdCount = 0;

  for (let r = 1; r < rows.length; r++) {
    const raw = normalizeFormId(rows[r]?.[chosen.columnIndex]);
    if (!raw) {
      blankIdCount += 1;
      continue;
    }
    if (!isValidHubspotFormId(raw)) {
      invalidIdCount += 1;
      continue;
    }
    const key = raw.toLowerCase();
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    if (count === 1) formIds.push(key);
    if (count === 2) duplicateIds.push(key);
  }

  formIds.sort((a, b) => a.localeCompare(b));
  duplicateIds.sort((a, b) => a.localeCompare(b));

  const actualUniqueFormCount = formIds.length;
  const ok =
    actualUniqueFormCount === expected &&
    duplicateIds.length === 0 &&
    invalidIdCount === 0;

  return {
    evidenceType: "hubspot_export_form_inventory",
    sourceFilename: options.sourceFilename,
    sourceSha256,
    sourceSheet: chosen.sheetName,
    sourceIdColumn: chosen.header,
    expectedUniqueFormCount: expected,
    actualUniqueFormCount,
    duplicateIds,
    invalidIdCount,
    blankIdCount,
    formIds,
    sheets,
    ok,
    error: ok
      ? undefined
      : `Expected ${expected} unique valid form IDs; got ${actualUniqueFormCount} (duplicates=${duplicateIds.length}, invalid=${invalidIdCount}, blank=${blankIdCount}).`,
  };
}

export function extractFormIdsFromWorkbookPath(
  path: string,
  options?: {
    expectedUniqueFormCount?: number;
    preferredSheet?: string;
    preferredIdColumn?: string;
    sourceFilename?: string;
  }
): ExtractFormIdsResult {
  const buffer = readFileSync(path);
  return extractFormIdsFromWorkbookBuffer(buffer, {
    sourceFilename: options?.sourceFilename ?? path.split(/[/\\]/).pop() ?? path,
    expectedUniqueFormCount: options?.expectedUniqueFormCount,
    preferredSheet: options?.preferredSheet,
    preferredIdColumn: options?.preferredIdColumn,
  });
}

export function reconcileFormIdSets(exportIds: string[], backupIds: string[]) {
  const exportSet = new Set(exportIds.map((id) => id.toLowerCase()));
  const backupSet = new Set(backupIds.map((id) => id.toLowerCase()));
  const onlyInExport = [...exportSet].filter((id) => !backupSet.has(id)).sort();
  const onlyInBackup = [...backupSet].filter((id) => !exportSet.has(id)).sort();
  const exportCounts = new Map<string, number>();
  for (const id of exportIds) {
    const k = id.toLowerCase();
    exportCounts.set(k, (exportCounts.get(k) ?? 0) + 1);
  }
  const backupCounts = new Map<string, number>();
  for (const id of backupIds) {
    const k = id.toLowerCase();
    backupCounts.set(k, (backupCounts.get(k) ?? 0) + 1);
  }
  return {
    exportUnique: exportSet.size,
    backupUnique: backupSet.size,
    onlyInExport,
    onlyInBackup,
    duplicatesInExport: [...exportCounts.entries()]
      .filter(([, c]) => c > 1)
      .map(([id]) => id)
      .sort(),
    duplicatesInBackup: [...backupCounts.entries()]
      .filter(([, c]) => c > 1)
      .map(([id]) => id)
      .sort(),
    intersectionCount: [...exportSet].filter((id) => backupSet.has(id)).length,
  };
}
