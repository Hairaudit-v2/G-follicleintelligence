/**
 * Stage 7A.1 — Build FI service catalogue **review** artefacts from Timely ServiceSales.csv.
 * Does not insert into the database.
 *
 * Usage:
 *   npx tsx scripts/timely-service-sales-to-fi-seed.ts [path/to/ServiceSales.csv]
 *
 * Default input: docs/timely-import/input/ServiceSales.csv (if present)
 * else:          docs/timely-import/fixtures/ServiceSales.sample.csv
 *
 * Outputs (docs/timely-import/output/):
 *   - fi-services-seed-review.json
 *   - fi-services-seed-review.csv
 *   - stage-7a1-report.md
 */

import * as fs from "node:fs";
import * as path from "node:path";

import {
  buildFiServiceSeedFromTimelyCsv,
  buildMarkdownReport,
  seedRowsToCsv,
} from "../src/lib/timelyImport/serviceSalesToFiSeed";

function main(): void {
  const root = path.resolve(__dirname, "..");
  const defaultUser = path.join(root, "docs", "timely-import", "input", "ServiceSales.csv");
  const defaultFixture = path.join(root, "docs", "timely-import", "fixtures", "ServiceSales.sample.csv");
  const argPath = process.argv[2]?.trim();
  const inputPath = argPath
    ? path.resolve(argPath)
    : fs.existsSync(defaultUser)
      ? defaultUser
      : defaultFixture;

  if (!fs.existsSync(inputPath)) {
    console.error(`Input CSV not found: ${inputPath}`);
    console.error("Copy ServiceSales.csv to docs/timely-import/input/ or pass an explicit path.");
    process.exit(1);
  }

  const csvText = fs.readFileSync(inputPath, "utf8");
  const result = buildFiServiceSeedFromTimelyCsv(csvText);
  const outDir = path.join(root, "docs", "timely-import", "output");
  fs.mkdirSync(outDir, { recursive: true });

  const generatedAtIso = new Date().toISOString();
  const jsonPath = path.join(outDir, "fi-services-seed-review.json");
  const csvOutPath = path.join(outDir, "fi-services-seed-review.csv");
  const mdPath = path.join(outDir, "stage-7a1-report.md");

  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        generatedAt: generatedAtIso,
        inputPath: path.relative(root, inputPath).replace(/\\/g, "/"),
        warnings: result.warnings,
        excluded: result.excluded,
        seedRows: result.seedRows,
      },
      null,
      2
    ),
    "utf8"
  );
  fs.writeFileSync(csvOutPath, seedRowsToCsv(result.seedRows), "utf8");
  fs.writeFileSync(
    mdPath,
    buildMarkdownReport(result, {
      inputPath: path.relative(root, inputPath).replace(/\\/g, "/"),
      generatedAtIso,
    }),
    "utf8"
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        input: path.relative(root, inputPath).replace(/\\/g, "/"),
        seedRowCount: result.seedRows.length,
        excludedCount: result.excluded.length,
        outputs: [
          path.relative(root, jsonPath).replace(/\\/g, "/"),
          path.relative(root, csvOutPath).replace(/\\/g, "/"),
          path.relative(root, mdPath).replace(/\\/g, "/"),
        ],
      },
      null,
      2
    )
  );
}

main();
