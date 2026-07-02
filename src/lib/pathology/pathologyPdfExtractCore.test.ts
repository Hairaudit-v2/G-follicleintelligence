import assert from "node:assert/strict";
import test from "node:test";

import { extractPathologyMarkersFromPdf } from "@/src/lib/pathology/pathologyPdfExtractCore";

test("pipe-delimited pdf text rows are parsed", () => {
  const text = "Ferritin | 45 | ug/L | 30-300 | normal\nVitamin D | 62 | nmol/L | 50-200 | normal";
  const out = extractPathologyMarkersFromPdf(new TextEncoder().encode(text));
  assert.equal(out.source, "pdf_text");
  assert.equal(out.markers.length, 2);
  assert.equal(out.markers[0]?.test_label, "Ferritin");
});

test("empty pdf returns empty markers", () => {
  const out = extractPathologyMarkersFromPdf(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
  assert.equal(out.markers.length, 0);
  assert.equal(out.source, "empty");
});
