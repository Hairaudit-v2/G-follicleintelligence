import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as XLSX from "xlsx";
import {
  extractFormIdsFromWorkbookBuffer,
  reconcileFormIdSets,
} from "./hubspotExportFormIdsCore";

function guid(n: number): string {
  const hex = n.toString(16).padStart(12, "0");
  return `aaaaaaaa-bbbb-cccc-dddd-${hex}`;
}

function workbookBuffer(sheets: Record<string, unknown[][]>): Buffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("hubspotExportFormIdsCore", () => {
  it("extracts exactly 48 unique valid form IDs", () => {
    const ids = Array.from({ length: 48 }, (_, i) => guid(i + 1));
    const rows = [["Form ID", "Name"], ...ids.map((id, i) => [id, `Form ${i}`])];
    const result = extractFormIdsFromWorkbookBuffer(
      workbookBuffer({ "All forms": rows }),
      { sourceFilename: "fixture-48.xlsx", expectedUniqueFormCount: 48 }
    );
    assert.equal(result.ok, true);
    assert.equal(result.actualUniqueFormCount, 48);
    assert.equal(result.formIds.length, 48);
    assert.deepEqual(result.formIds, [...ids].map((id) => id.toLowerCase()).sort());
  });

  it("detects duplicate IDs", () => {
    const id = guid(1);
    const rows = [
      ["Form ID"],
      [id],
      [id],
      ...Array.from({ length: 46 }, (_, i) => [guid(i + 2)]),
    ];
    const result = extractFormIdsFromWorkbookBuffer(
      workbookBuffer({ "All forms": rows }),
      { sourceFilename: "dupes.xlsx", expectedUniqueFormCount: 48 }
    );
    assert.equal(result.ok, false);
    assert.equal(result.actualUniqueFormCount, 47);
    assert.deepEqual(result.duplicateIds, [id.toLowerCase()]);
  });

  it("counts malformed IDs", () => {
    const rows = [
      ["Form ID"],
      ["not-a-guid"],
      ...Array.from({ length: 48 }, (_, i) => [guid(i + 1)]),
    ];
    const result = extractFormIdsFromWorkbookBuffer(
      workbookBuffer({ "All forms": rows }),
      { sourceFilename: "bad.xlsx", expectedUniqueFormCount: 48 }
    );
    assert.equal(result.ok, false);
    assert.equal(result.invalidIdCount, 1);
    assert.equal(result.actualUniqueFormCount, 48);
  });

  it("fails when unique total is wrong", () => {
    const rows = [["Form ID"], ...Array.from({ length: 46 }, (_, i) => [guid(i + 1)])];
    const result = extractFormIdsFromWorkbookBuffer(
      workbookBuffer({ "All forms": rows }),
      { sourceFilename: "46.xlsx", expectedUniqueFormCount: 48 }
    );
    assert.equal(result.ok, false);
    assert.equal(result.actualUniqueFormCount, 46);
  });

  it("selects the best ID column across multiple sheets", () => {
    const ids = Array.from({ length: 48 }, (_, i) => guid(i + 1));
    const result = extractFormIdsFromWorkbookBuffer(
      workbookBuffer({
        Summary: [["Metric", "Value"], ["Forms", 48]],
        "All forms": [["Form ID"], ...ids.map((id) => [id])],
      }),
      { sourceFilename: "multi.xlsx", expectedUniqueFormCount: 48 }
    );
    assert.equal(result.ok, true);
    assert.equal(result.sourceSheet, "All forms");
    assert.equal(result.sourceIdColumn, "Form ID");
  });

  it("ignores blank rows without failing uniqueness", () => {
    const ids = Array.from({ length: 48 }, (_, i) => guid(i + 1));
    const rows = [["Form ID"], ...ids.map((id) => [id]), [""], [null]];
    const result = extractFormIdsFromWorkbookBuffer(
      workbookBuffer({ "All forms": rows }),
      { sourceFilename: "blanks.xlsx", expectedUniqueFormCount: 48 }
    );
    assert.equal(result.ok, true);
    assert.equal(result.blankIdCount, 2);
  });

  it("reconciles export vs backup ID sets", () => {
    const exportIds = [guid(1), guid(2), guid(3)];
    const backupIds = [guid(2), guid(3), guid(4)];
    const r = reconcileFormIdSets(exportIds, backupIds);
    assert.equal(r.exportUnique, 3);
    assert.equal(r.backupUnique, 3);
    assert.deepEqual(r.onlyInExport, [guid(1)]);
    assert.deepEqual(r.onlyInBackup, [guid(4)]);
    assert.equal(r.intersectionCount, 2);
  });
});
