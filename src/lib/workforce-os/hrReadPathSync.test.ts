import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function extractExportedFunctionBody(source: string, functionName: string): string {
  const marker = `export async function ${functionName}`;
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `expected ${functionName} in source`);
  const nextExport = source.indexOf("\nexport ", start + marker.length);
  return nextExport >= 0 ? source.slice(start, nextExport) : source.slice(start);
}

test("loadStaffAccessCentrePage does not call syncAllStaffProjectionsForTenant", () => {
  const source = readRepoFile("src/lib/team/access/staffAccessCentre.server.ts");
  const body = extractExportedFunctionBody(source, "loadStaffAccessCentrePage");
  assert.equal(body.includes("syncAllStaffProjectionsForTenant"), false);
});

test("loadWorkforceOsDirectoryPage does not call syncAllStaffProjectionsForTenant", () => {
  const source = readRepoFile("src/lib/workforce-os/workforceOsDirectoryLoader.server.ts");
  const body = extractExportedFunctionBody(source, "loadWorkforceOsDirectoryPage");
  assert.equal(body.includes("syncAllStaffProjectionsForTenant"), false);
});

test("loadWorkforceOsHrReconciliationPage does not call syncAllStaffProjectionsForTenant", () => {
  const source = readRepoFile("src/lib/workforce-os/workforceOsDirectoryLoader.server.ts");
  const body = extractExportedFunctionBody(source, "loadWorkforceOsHrReconciliationPage");
  assert.equal(body.includes("syncAllStaffProjectionsForTenant"), false);
  assert.match(body, /loadTenantHrProjectionHealth/);
});

test("runStaffIdentityReadinessAudit does not call syncAllStaffProjectionsForTenant", () => {
  const source = readRepoFile("src/lib/team/identity/staffIdentityReadinessAudit.server.ts");
  const body = extractExportedFunctionBody(source, "runStaffIdentityReadinessAudit");
  assert.equal(body.includes("syncAllStaffProjectionsForTenant"), false);
});

test("runHrProjectionSyncAction calls explicit projection sync", () => {
  const source = readRepoFile("lib/actions/workforce-os-staff-lifecycle-actions.ts");
  const body = extractExportedFunctionBody(source, "runHrProjectionSyncAction");
  assert.match(body, /runHrProjectionSyncForTenant/);
});

test("loadHrReconciliationPageAction remains read-only without projection sync", () => {
  const source = readRepoFile("lib/actions/workforce-os-staff-lifecycle-actions.ts");
  const body = extractExportedFunctionBody(source, "loadHrReconciliationPageAction");
  assert.equal(body.includes("syncAllStaffProjectionsForTenant"), false);
  assert.match(body, /loadHrReconciliationPageData/);
});

test("staff import runner still syncs projections after import", () => {
  const source = readRepoFile("src/lib/staffImport/iiohrHrStaffImportRunner.ts");
  assert.match(source, /syncAllStaffProjectionsForTenant/);
});

test("email reconciliation mutation still syncs projections before linking", () => {
  const source = readRepoFile("src/lib/workforce-os/hrReconciliation.server.ts");
  const body = extractExportedFunctionBody(source, "runEmailReconciliationForTenant");
  assert.match(body, /syncAllStaffProjectionsForTenant/);
});
