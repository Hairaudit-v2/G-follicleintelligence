import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

type Evidence = {
  milestone: string;
  verdict: string;
  baseCommit: string;
  settingsAfter: string[];
  routesPreserved: boolean;
  permissionsChanged: boolean;
  hubspotImportRemainsReachable: boolean;
  clinicGuidePrimaryNav: boolean;
  holdRoutesUntouched: string[];
};

const evidence = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "docs", "audits", "evidence-fi-ux-structure-2c1b.json"),
    "utf8"
  )
) as Evidence;

test("2C.1B evidence freezes the Settings IA contract", () => {
  assert.equal(evidence.milestone, "FI-UX-STRUCTURE-2C.1B");
  assert.equal(evidence.verdict, "GREEN");
  assert.equal(evidence.baseCommit, "22a603c3");
  assert.deepEqual(evidence.settingsAfter, [
    "Clinic",
    "Roles & permissions",
    "Templates",
    "Integrations",
    "Billing",
    "Security",
  ]);
  assert.equal(evidence.routesPreserved, true);
  assert.equal(evidence.permissionsChanged, false);
  assert.equal(evidence.hubspotImportRemainsReachable, true);
  assert.equal(evidence.clinicGuidePrimaryNav, false);
  assert.deepEqual(evidence.holdRoutesUntouched, [
    "/staff",
    "/audit",
    "/workforce-os/staff-access",
  ]);
});
