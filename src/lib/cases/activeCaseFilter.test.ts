/**
 * Regression test: soft-delete visibility guard.
 *
 * Verifies that every operational fi_cases query site includes
 * .is("deleted_at", null) and that intentionally-unfiltered sites do NOT.
 *
 * Source-level test -- no DB required.
 */
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

// src/lib/cases/activeCaseFilter.test.ts is 3 levels deep from repo root
const REPO = path.resolve(__dirname, "../../../");

function read(rel: string): string {
  return fs.readFileSync(path.join(REPO, rel), "utf8");
}

function countActiveCaseFilters(text: string): number {
  const marker = '.from("fi_cases")';
  let idx = text.indexOf(marker);
  let count = 0;
  while (idx !== -1) {
    const win = text.slice(idx, idx + 600);
    if (win.includes('.is("deleted_at", null)')) count++;
    idx = text.indexOf(marker, idx + 1);
  }
  return count;
}

function hasActiveCaseFilter(text: string): boolean {
  return countActiveCaseFilters(text) > 0;
}

// Operational sites -- MUST contain the filter
const MUST_FILTER: Array<{ file: string; label: string; minCount: number }> = [
  { file: "src/lib/cases/caseLoaders.ts", label: "caseLoaders", minCount: 3 },
  { file: "src/lib/cases/caseUpdate.ts", label: "caseUpdate", minCount: 1 },
  { file: "src/lib/cases/postOpUpdate.ts", label: "postOpUpdate", minCount: 2 },
  { file: "src/lib/cases/procedureDayUpdate.ts", label: "procedureDayUpdate", minCount: 1 },
  { file: "src/lib/cases/surgeryPlanningUpdate.ts", label: "surgeryPlanningUpdate", minCount: 1 },
  {
    file: "src/lib/payments/paymentRecordMutations.server.ts",
    label: "paymentRecordMutations",
    minCount: 1,
  },
  {
    file: "src/lib/clinicalNotes/clinicalNotesMutations.server.ts",
    label: "clinicalNotesMutations",
    minCount: 1,
  },
  {
    file: "src/lib/medicationOs/medicationOsMutations.server.ts",
    label: "medicationOsMutations",
    minCount: 1,
  },
  {
    file: "src/lib/consultationForms/consultationFormMutations.server.ts",
    label: "consultationFormMutations",
    minCount: 1,
  },
  {
    file: "src/lib/revenueOs/revenueInvoiceMutations.server.ts",
    label: "revenueInvoiceMutations",
    minCount: 2,
  },
  {
    file: "src/lib/fi-os/clinicalIntelligence.server.ts",
    label: "clinicalIntelligence",
    minCount: 1,
  },
  {
    file: "src/lib/fi/foundation/foundationOsDashboardRead.server.ts",
    label: "foundationOsDashboardRead",
    minCount: 1,
  },
  { file: "src/lib/fi/foundation/patientRecord.ts", label: "patientRecord", minCount: 1 },
  {
    file: "src/lib/fiAdmin/clinicOsGlobalSearchLoader.server.ts",
    label: "clinicOsGlobalSearch",
    minCount: 1,
  },
  { file: "src/lib/fiOs/fiHomeDashboardLoader.server.ts", label: "fiHomeDashboard", minCount: 1 },
  { file: "src/lib/patientImages/patientImagesServer.ts", label: "patientImages", minCount: 1 },
  { file: "src/lib/patients/patientDirectoryLoader.ts", label: "patientDirectory", minCount: 2 },
  {
    file: "src/lib/patients/patientOsDashboardLoader.server.ts",
    label: "patientOsDashboard",
    minCount: 2,
  },
  { file: "src/lib/patients/patientProfileLoader.ts", label: "patientProfileLoader", minCount: 1 },
  { file: "src/lib/patients/patientSlideOverLoader.ts", label: "patientSlideOver", minCount: 1 },
  {
    file: "src/lib/patients/timeline/patientTimelineServer.ts",
    label: "patientTimeline",
    minCount: 1,
  },
  { file: "src/lib/crm/leadConversion.ts", label: "crmLeadConversion", minCount: 1 },
  { file: "src/lib/crm/tasks.ts", label: "crmTasks", minCount: 1 },
  { file: "src/lib/crm/crmQuoteMutations.server.ts", label: "crmQuoteMutations", minCount: 1 },
  { file: "src/lib/bookings/bookings.ts", label: "bookings", minCount: 1 },
  { file: "app/api/fi/report/route.ts", label: "api/fi/report", minCount: 2 },
  { file: "app/api/fi/uploads/route.ts", label: "api/fi/uploads", minCount: 1 },
  {
    file: "app/api/tenants/[tenantId]/cases/[caseId]/route.ts",
    label: "api/cases/[caseId]",
    minCount: 1,
  },
  {
    file: "app/api/tenants/[tenantId]/cases/[caseId]/run-model/route.ts",
    label: "api/run-model",
    minCount: 1,
  },
  {
    file: "app/api/tenants/[tenantId]/cases/[caseId]/submit/route.ts",
    label: "api/submit",
    minCount: 2,
  },
  {
    file: "app/api/tenants/[tenantId]/cases/[caseId]/uploads/route.ts",
    label: "api/uploads",
    minCount: 1,
  },
  { file: "app/api/tenants/[tenantId]/cases/route.ts", label: "api/cases:list", minCount: 1 },
  { file: "lib/actions/fi-prescribing-actions.ts", label: "fi-prescribing-actions", minCount: 1 },
  { file: "lib/fi/pipeline.ts", label: "fi-pipeline", minCount: 1 },
  { file: "lib/fi/services/caseSubmission.ts", label: "caseSubmission", minCount: 3 },
];

// System/integrity sites -- intentionally UNFILTERED
const MUST_NOT_FILTER: Array<{ file: string; label: string }> = [
  { file: "src/lib/fi/foundation/integrity.ts", label: "integrity (system count)" },
  { file: "src/lib/fi/foundation/backfillFoundation.ts", label: "backfillFoundation" },
  { file: "src/lib/systemStatus/systemStatusChecks.ts", label: "systemStatusChecks" },
  { file: "lib/fi/events/mapping.ts", label: "fi-event-mapping" },
];

// Tests

test("withActiveCases helper exports and contains is(deleted_at, null)", () => {
  const text = read("src/lib/cases/activeCaseFilter.ts");
  assert.ok(text.includes('.is("deleted_at", null)'), "missing .is() call");
  assert.ok(text.includes("export function withActiveCases"), "missing export");
});

for (const entry of MUST_FILTER) {
  const file = entry.file;
  const label = entry.label;
  const minCount = entry.minCount;
  test("[must-filter] " + label, () => {
    let text = "";
    try {
      text = read(file);
    } catch (_e) {
      assert.fail("File not found: " + file);
    }
    const n = countActiveCaseFilters(text);
    assert.ok(
      n >= minCount,
      "Expected >= " + minCount + " filtered fi_cases query in " + file + ", found " + n
    );
  });
}

for (const entry of MUST_NOT_FILTER) {
  const file = entry.file;
  const label = entry.label;
  test("[must-not-filter] " + label, () => {
    let text = "";
    try {
      text = read(file);
    } catch (_e) {
      return;
    }
    assert.ok(
      !hasActiveCaseFilter(text),
      file +
        " is intentionally unfiltered -- .is(deleted_at, null) must not appear near fi_cases here"
    );
  });
}
