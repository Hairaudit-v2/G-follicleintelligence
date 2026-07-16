/**
 * Extract canonical HubSpot form IDs from a local forms-inventory XLSX.
 *
 * Usage:
 *   npx tsx scripts/audits/extract-hubspot-export-form-ids.ts --input <path.xlsx>
 *   FI_HUBSPOT_FORMS_INVENTORY_XLSX=<path> npx tsx scripts/audits/extract-hubspot-export-form-ids.ts
 *
 * Writes privacy-safe JSON evidence (IDs + workbook hashes only).
 * Exits non-zero unless exactly 48 unique valid form IDs are extracted.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import {
  extractFormIdsFromWorkbookPath,
} from "./hubspotExportFormIdsCore";

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return undefined;
  return process.argv[idx + 1];
}

const input =
  argValue("--input") ??
  process.env.FI_HUBSPOT_FORMS_INVENTORY_XLSX ??
  "";
const outPath =
  argValue("--out") ??
  path.resolve("docs/audits/evidence-fi-hubspot-export-form-ids.json");
const expected = Number(argValue("--expected") ?? "48");
const preferredSheet = argValue("--sheet");
const preferredIdColumn = argValue("--id-column");

if (!input) {
  console.error(
    JSON.stringify({
      error: "missing_input",
      hint: "Pass --input <xlsx> or set FI_HUBSPOT_FORMS_INVENTORY_XLSX",
    })
  );
  process.exit(2);
}

const result = extractFormIdsFromWorkbookPath(input, {
  expectedUniqueFormCount: expected,
  preferredSheet,
  preferredIdColumn,
  sourceFilename: path.basename(input),
});

const evidence = {
  evidenceType: result.evidenceType,
  sourceFilename: result.sourceFilename,
  sourceSha256: result.sourceSha256,
  sourceSheet: result.sourceSheet,
  sourceIdColumn: result.sourceIdColumn,
  expectedUniqueFormCount: result.expectedUniqueFormCount,
  actualUniqueFormCount: result.actualUniqueFormCount,
  duplicateIds: result.duplicateIds,
  invalidIdCount: result.invalidIdCount,
  blankIdCount: result.blankIdCount,
  formIds: result.formIds,
  sheetSummary: result.sheets.map((s) => ({
    sheetName: s.sheetName,
    rowCount: s.rowCount,
    candidateColumns: s.candidateColumns.map((c) => ({
      header: c.header,
      uniqueValid: c.uniqueValid,
    })),
  })),
};

writeFileSync(outPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify(
    {
      outPath,
      ok: result.ok,
      actualUniqueFormCount: result.actualUniqueFormCount,
      sourceSheet: result.sourceSheet,
      sourceIdColumn: result.sourceIdColumn,
      sourceSha256: result.sourceSha256,
      error: result.error ?? null,
    },
    null,
    2
  )
);

if (!result.ok) process.exit(1);
