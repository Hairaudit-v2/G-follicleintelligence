/**
 * Stage 7A.2 — Build curated `fi-services-seed-approved.json` from `fi-services-seed-review.json`.
 * Does not touch Supabase.
 *
 * Run after: npm run timely:import-preview
 */

import * as fs from "node:fs";
import * as path from "node:path";

import {
  buildApprovedFiSeedFromReviewRows,
  buildStage7a2MarkdownReport,
} from "../src/lib/timelyImport/buildApprovedFiSeed";
import type { FiServiceSeedReviewRow } from "../src/lib/timelyImport/serviceSalesTypes";

function main(): void {
  const root = path.resolve(__dirname, "..");
  const reviewPath = path.join(root, "docs", "timely-import", "output", "fi-services-seed-review.json");
  if (!fs.existsSync(reviewPath)) {
    console.error(`Missing ${reviewPath}. Run npm run timely:import-preview first.`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(reviewPath, "utf8")) as {
    generatedAt?: string;
    inputPath?: string;
    seedRows?: FiServiceSeedReviewRow[];
  };

  const seedRows = raw.seedRows ?? [];
  const generated_at = new Date().toISOString();
  const inputCsv =
    raw.inputPath === "docs/timely-import/input/ServiceSales.csv"
      ? "docs/timely-import/input/ServiceSales.csv (real Timely export)"
      : `${raw.inputPath ?? "unknown"} (fixture or custom path — replace with input/ServiceSales.csv for production curation)`;

  const payload = buildApprovedFiSeedFromReviewRows(seedRows, {
    stage: "7a2",
    source_review_path: path.relative(root, reviewPath).replace(/\\/g, "/"),
    timely_input_note: inputCsv,
    generated_at,
  });

  const outDir = path.join(root, "docs", "timely-import", "output");
  fs.mkdirSync(outDir, { recursive: true });

  const approvedPath = path.join(outDir, "fi-services-seed-approved.json");
  const reportPath = path.join(outDir, "stage-7a2-final-report.md");

  fs.writeFileSync(approvedPath, JSON.stringify(payload, null, 2), "utf8");
  fs.writeFileSync(reportPath, buildStage7a2MarkdownReport(payload), "utf8");

  console.log(
    JSON.stringify(
      {
        ok: true,
        approvedPath: path.relative(root, approvedPath).replace(/\\/g, "/"),
        reportPath: path.relative(root, reportPath).replace(/\\/g, "/"),
        summary: payload.summary,
      },
      null,
      2
    )
  );
}

main();
