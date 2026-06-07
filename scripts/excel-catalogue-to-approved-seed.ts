/**
 * Stage 7A.4 — Build `fi-services-seed-approved.json` from the curated Evolved Excel service catalogue.
 * Does not touch Supabase.
 *
 * Usage:
 *   npx tsx scripts/excel-catalogue-to-approved-seed.ts
 *   npx tsx scripts/excel-catalogue-to-approved-seed.ts --excel=docs/timely-import/input/my-catalogue.xlsx
 */

import * as fs from "node:fs";
import * as path from "node:path";

import * as XLSX from "xlsx";

import {
  buildApprovedPayloadFromExcelCatalogue,
  buildStage7a4MarkdownReport,
  type ExcelCatalogueRawRow,
} from "../src/lib/timelyImport/excelCatalogueToApprovedSeed";

const DEFAULT_SHEET = "Services Catalogue";
const DEFAULT_EXCEL_REL = path.join("docs", "timely-import", "input", "evolved-fi-services-catalogue-draft (1).xlsx");

function argValue(prefix: string): string | undefined {
  const a = process.argv.find((x) => x.startsWith(prefix));
  if (!a) return undefined;
  const v = a.slice(prefix.length).trim();
  return v || undefined;
}

function main(): void {
  const root = path.resolve(__dirname, "..");
  const excelRel = argValue("--excel=") ?? DEFAULT_EXCEL_REL;
  const excelAbs = path.isAbsolute(excelRel) ? excelRel : path.join(root, excelRel);
  if (!fs.existsSync(excelAbs)) {
    console.error(JSON.stringify({ ok: false, error: `Excel file not found: ${excelAbs}` }, null, 2));
    process.exit(1);
  }

  const wb = XLSX.readFile(excelAbs);
  const sheetName = wb.SheetNames.includes(DEFAULT_SHEET) ? DEFAULT_SHEET : wb.SheetNames[0];
  if (!sheetName || !wb.Sheets[sheetName]) {
    console.error(JSON.stringify({ ok: false, error: "Workbook has no readable sheets." }, null, 2));
    process.exit(1);
  }

  const sh = wb.Sheets[sheetName]!;
  const rawRows = XLSX.utils.sheet_to_json<ExcelCatalogueRawRow>(sh, { defval: "" });
  const generated_at = new Date().toISOString();
  const source_excel_path = path.relative(root, excelAbs).replace(/\\/g, "/");

  const { payload, warnings, rejected, not_imported_review } = buildApprovedPayloadFromExcelCatalogue(rawRows, {
    stage: "7a4",
    source_excel_path,
    generated_at,
  });

  const outDir = path.join(root, "docs", "timely-import", "output");
  fs.mkdirSync(outDir, { recursive: true });

  const approvedPath = path.join(outDir, "fi-services-seed-approved.json");
  const reportPath = path.join(outDir, "stage-7a4-review-report.md");

  fs.writeFileSync(approvedPath, JSON.stringify(payload, null, 2), "utf8");
  fs.writeFileSync(
    reportPath,
    buildStage7a4MarkdownReport({ payload, warnings, rejected, not_imported_review }),
    "utf8"
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        sheet: sheetName,
        approvedPath: path.relative(root, approvedPath).replace(/\\/g, "/"),
        reportPath: path.relative(root, reportPath).replace(/\\/g, "/"),
        approved_count: payload.approved_for_import.length,
        warnings,
        rejected_count: rejected.length,
        not_imported_review_count: not_imported_review.length,
        removed_non_bookable_count: payload.removed_non_bookable.length,
      },
      null,
      2
    )
  );
}

main();
