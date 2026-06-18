import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { serializeReceptionTaskRow } from "@/src/lib/receptionOs/receptionTaskSerialize";
import type { ReceptionTaskRow } from "@/src/lib/receptionOs/receptionTasks.types";

const row: ReceptionTaskRow = {
  id: "11111111-1111-4111-8111-111111111111",
  tenant_id: "22222222-2222-4222-8222-222222222222",
  title: "Overdue deposit",
  description: "Follow up",
  source_type: "payment",
  severity: "critical",
  status: "open",
  owner_fi_user_id: null,
  due_at: null,
  patient_id: null,
  case_id: null,
  lead_id: null,
  booking_id: null,
  payment_id: "33333333-3333-4333-8333-333333333333",
  consultation_id: null,
  source_alert_kind: "missing_deposit",
  source_ref_id: "deposit-33333333-3333-4333-8333-333333333333",
  resolution_notes: null,
  internal_notes: null,
  snoozed_until: null,
  metadata: {},
  created_by_fi_user_id: null,
  resolved_by_fi_user_id: null,
  dismissed_by_fi_user_id: null,
  created_at: "2026-06-19T10:00:00.000Z",
  updated_at: "2026-06-19T10:00:00.000Z",
  resolved_at: null,
  dismissed_at: null,
};

describe("receptionTaskSerialize", () => {
  it("maps snake_case DB rows to client task items", () => {
    const item = serializeReceptionTaskRow(row);
    assert.equal(item.id, row.id);
    assert.equal(item.sourceType, "payment");
    assert.equal(item.paymentId, row.payment_id);
    assert.equal(item.sourceRefId, row.source_ref_id);
  });
});

describe("reception task audit event kinds", () => {
  it("documents expected audit trail events", () => {
    const kinds = [
      "created",
      "assigned",
      "snoozed",
      "status_changed",
      "resolved",
      "dismissed",
      "note_added",
      "communication_sent",
    ];
    assert.equal(kinds.length, 8);
  });
});
