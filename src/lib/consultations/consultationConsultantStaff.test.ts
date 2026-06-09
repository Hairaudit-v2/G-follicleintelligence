import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveConsultationConsultantDisplayName } from "@/src/lib/consultations/consultationConsultantDisplay";
import { consultationUpsertBodySchema } from "@/src/lib/consultations/consultationTypes";

const STAFF_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

test("consultant display prefers linked staff name over legacy consultant_name", () => {
  const label = resolveConsultationConsultantDisplayName({
    consultant_staff_id: STAFF_ID,
    consultant_name: "Legacy Name",
    linkedStaffName: "Dr Linked",
  });
  assert.equal(label, "Dr Linked");
});

test("consultant display falls back to consultant_name for legacy rows", () => {
  const label = resolveConsultationConsultantDisplayName({
    consultant_staff_id: null,
    consultant_name: "Legacy Name",
    linkedStaffName: null,
  });
  assert.equal(label, "Legacy Name");
});

test("consultation upsert schema accepts persisted consultant_staff_id", () => {
  const parsed = consultationUpsertBodySchema.parse({
    consultant_name: "Dr Linked",
    consultant_staff_id: STAFF_ID,
    status: "draft",
  });
  assert.equal(parsed.consultant_staff_id, STAFF_ID);
});

test("consultation upsert schema allows clearing consultant_staff_id", () => {
  const parsed = consultationUpsertBodySchema.parse({
    consultant_staff_id: null,
    consultant_name: "Free text only",
  });
  assert.equal(parsed.consultant_staff_id, null);
});
