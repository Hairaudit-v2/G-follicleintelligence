import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFiPersonsMetadataSearchOrFilter,
  patientDirectorySearchIlikePattern,
} from "@/src/lib/patients/patientDirectorySearch";

test("patientDirectorySearchIlikePattern escapes ILIKE metacharacters", () => {
  const q = patientDirectorySearchIlikePattern("100%_x");
  assert.match(q, /^"/);
  assert.match(q, /"$/);
  assert.ok(q.includes("\\%"));
  assert.ok(q.includes("\\_"));
});

test("buildFiPersonsMetadataSearchOrFilter uses text JSON paths only (no jsonb ilike)", () => {
  const orf = buildFiPersonsMetadataSearchOrFilter(patientDirectorySearchIlikePattern("Jane"));
  assert.ok(orf.includes("metadata->>display_name.ilike."));
  assert.ok(orf.includes("metadata->hubspot->>email.ilike."));
  assert.ok(!orf.includes("metadata.ilike"));
  assert.ok(!orf.includes("metadata::text"));
  assert.equal((orf.match(/\.ilike\./g) ?? []).length, 8);
});
