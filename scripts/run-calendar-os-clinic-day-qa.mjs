#!/usr/bin/env node
/**
 * CalendarOS V2 — clinic-day operational QA report generator.
 *
 * Usage:
 *   node scripts/run-calendar-os-clinic-day-qa.mjs
 *   node scripts/run-calendar-os-clinic-day-qa.mjs --write
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const { buildCalendarOsV2QaReport, formatCalendarOsV2QaReport } = await import(
  pathToFileURL(join(root, "src/lib/calendar-os/calendarClinicDayQaCore.ts")).href
);

const report = buildCalendarOsV2QaReport();
const markdown = formatCalendarOsV2QaReport(report);

console.log(markdown);

if (process.argv.includes("--write")) {
  const outPath = join(root, "docs/calendar-os-v2-qa-report.md");
  writeFileSync(outPath, markdown, "utf8");
  console.error(`\nWrote ${outPath}`);
}