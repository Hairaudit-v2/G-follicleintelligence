import { readFileSync } from "node:fs";
import { join } from "node:path";

// Load .env.local into process.env
const envPath = join(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const { loadEvolvedPerthHrStaffRecordsForFiPush } = await import(
  "../src/lib/hr/loadEvolvedPerthHrStaffSnapshot.server.ts"
);
const { mapIiohrHrStaffRecordsToFiSyncRows } = await import(
  "../src/lib/hr/iiohrFiStaffSyncMapper.ts"
);
const { mapIiohrHrStaffSyncRowToImportRow } = await import(
  "../src/lib/staffImport/iiohrHrStaffSync.ts"
);
const { runWorkforceReconciliationForInboundRows, beginWorkforceHrSyncRun } =
  await import("../src/lib/workforce/workforceHrStaffSyncOrchestrator.server.ts");

const tenantId = process.env.EVOLVED_PERTH_TENANT_ID?.trim();
if (!tenantId) throw new Error("EVOLVED_PERTH_TENANT_ID missing");

const hrRows = await loadEvolvedPerthHrStaffRecordsForFiPush();
const importRows = mapIiohrHrStaffRecordsToFiSyncRows(hrRows).map(mapIiohrHrStaffSyncRowToImportRow);
const started = await beginWorkforceHrSyncRun({ tenantId });
const result = await runWorkforceReconciliationForInboundRows({
  tenantId,
  rows: importRows,
  hrSyncRunId: started.hrSyncRunId,
});
console.log(JSON.stringify({ started, result }, null, 2));