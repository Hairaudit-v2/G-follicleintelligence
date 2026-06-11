/**
 * One-off: dry-run the bundled HubSpot export with Stage 1 pure validators (no DB).
 * Usage: npx tsx scripts/hubspot-import-dry-run-verify.ts [path-to.csv]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseHubspotContactsCsv } from "../src/lib/crm/hubspotImport/parseHubspotContactsCsv";
import {
  rowHasBlockingIssues,
  validateHubspotContactsRows,
} from "../src/lib/crm/hubspotImport/validateHubspotContactsImport";

const defaultCsv = resolve(process.cwd(), "hubspot-crm-exports-comprehensive-lead-flow-2026-06-11.csv");
const csvPath = resolve(process.cwd(), process.argv[2] ?? defaultCsv);

const csv = readFileSync(csvPath, "utf8");
const parsed = parseHubspotContactsCsv(csv);
if (parsed.error) {
  console.error("Parse error:", parsed.error);
  process.exit(1);
}

const report = validateHubspotContactsRows(parsed.rows);

const unmappedLeadStatuses = new Set<string>();
const unmappedJourneyStages = new Set<string>();
for (const rr of report.rowResults) {
  const row = parsed.rows.find((r) => r.rowIndex === rr.rowIndex);
  if (rr.leadStatusUnmapped && row?.leadStatus?.trim()) unmappedLeadStatuses.add(row.leadStatus.trim());
  if (rr.journeyUnmapped && row?.stageOfJourney?.trim()) unmappedJourneyStages.add(row.stageOfJourney.trim());
}

const validRowResults = report.rowResults.filter((r) => !rowHasBlockingIssues(r));
const pilot = validRowResults
  .slice()
  .sort((a, b) => a.rowIndex - b.rowIndex)
  .slice(0, 100)
  .map((rr) => ({
    rowIndex: rr.rowIndex,
    recordId: rr.recordId,
    classification: rr.classification,
  }));

console.log(
  JSON.stringify(
    {
      csvPath,
      parseHeaders: parsed.headers,
      totalDataRows: parsed.rows.length,
      dryRunPassed: report.passed,
      blockingCount: report.blockingCount,
      warningCount: report.warningCount,
      duplicateRecordIdsInFile: report.duplicateRecordIdsInFile,
      duplicateEmailsInFile: report.duplicateEmailsInFile,
      duplicatePhonesInFile: report.duplicatePhonesInFile,
      validRowCount: validRowResults.length,
      unmappedLeadStatuses: Array.from(unmappedLeadStatuses).sort(),
      unmappedJourneyStages: Array.from(unmappedJourneyStages).sort(),
      pilotFirst100: pilot,
    },
    null,
    2
  )
);
