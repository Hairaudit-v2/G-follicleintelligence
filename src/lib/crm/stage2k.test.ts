import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  crmArchiveLeadCommunicationBodySchema,
  crmCreateLeadCommunicationBodySchema,
  crmUpdateLeadCommunicationBodySchema,
} from "./crmApiSchemas";
import {
  collectChangedLeadCommunicationDetailKeys,
  leadCommunicationDetailSnapshotFromRowLike,
} from "./crmLeadCommunicationChangedFields";
import {
  assertCrmLeadCommunicationDirectionAllowed,
  assertCrmLeadCommunicationMetadataObject,
  assertCrmLeadCommunicationOutcomeAllowed,
  assertCrmLeadCommunicationPreviewBounded,
  assertCrmLeadCommunicationSubjectBounded,
  assertCrmLeadCommunicationTypeAllowed,
  assertLeadCommunicationNotArchived,
  isLeadCommunicationOwnedByLeadTenant,
  sortCrmLeadCommunicationsForDisplay,
  CRM_LEAD_COMMUNICATION_MAX_PREVIEW,
  CRM_LEAD_COMMUNICATION_MAX_SUBJECT,
} from "./crmLeadCommunicationPolicy";
import type { FiCrmLeadCommunicationRow } from "./types";

const TID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function commRow(
  p: Partial<FiCrmLeadCommunicationRow> & Pick<FiCrmLeadCommunicationRow, "id">
): FiCrmLeadCommunicationRow {
  return {
    tenant_id: TID,
    lead_id: LID,
    actor_user_id: null,
    communication_type: "phone",
    direction: "outbound",
    outcome: null,
    subject: null,
    preview: null,
    external_message_id: null,
    external_thread_id: null,
    contact_at: "2026-01-01T12:00:00.000Z",
    next_follow_up_at: null,
    metadata: {},
    archived_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...p,
  };
}

describe("Stage 2K — communication type (pure)", () => {
  it("accepts allowed types", () => {
    assert.equal(assertCrmLeadCommunicationTypeAllowed("  phone  "), "phone");
    assert.equal(assertCrmLeadCommunicationTypeAllowed("email"), "email");
  });

  it("rejects invalid type", () => {
    assert.throws(() => assertCrmLeadCommunicationTypeAllowed("fax"), /Invalid communication type/);
  });
});

describe("Stage 2K — direction (pure)", () => {
  it("accepts allowed directions", () => {
    assert.equal(assertCrmLeadCommunicationDirectionAllowed("internal"), "internal");
  });

  it("rejects invalid direction", () => {
    assert.throws(() => assertCrmLeadCommunicationDirectionAllowed("reply"), /Invalid direction/);
  });
});

describe("Stage 2K — outcome (pure)", () => {
  it("allows null / empty", () => {
    assert.equal(assertCrmLeadCommunicationOutcomeAllowed(undefined), null);
    assert.equal(assertCrmLeadCommunicationOutcomeAllowed(null), null);
    assert.equal(assertCrmLeadCommunicationOutcomeAllowed("   "), null);
  });

  it("accepts allow-listed outcome", () => {
    assert.equal(assertCrmLeadCommunicationOutcomeAllowed("booked"), "booked");
  });

  it("rejects invalid outcome when present", () => {
    assert.throws(() => assertCrmLeadCommunicationOutcomeAllowed("sold"), /Invalid outcome/);
  });
});

describe("Stage 2K — subject / preview bounds (pure)", () => {
  it("rejects subject over max", () => {
    const s = "x".repeat(CRM_LEAD_COMMUNICATION_MAX_SUBJECT + 1);
    assert.throws(() => assertCrmLeadCommunicationSubjectBounded(s), /subject must be at most/);
  });

  it("rejects preview over max", () => {
    const s = "x".repeat(CRM_LEAD_COMMUNICATION_MAX_PREVIEW + 1);
    assert.throws(() => assertCrmLeadCommunicationPreviewBounded(s), /preview must be at most/);
  });

  it("accepts at-limit strings", () => {
    const s = "x".repeat(CRM_LEAD_COMMUNICATION_MAX_SUBJECT);
    assert.equal(assertCrmLeadCommunicationSubjectBounded(s), s);
  });
});

describe("Stage 2K — metadata object (pure)", () => {
  it("empty for undefined/null", () => {
    assert.deepEqual(assertCrmLeadCommunicationMetadataObject(undefined), {});
    assert.deepEqual(assertCrmLeadCommunicationMetadataObject(null), {});
  });

  it("accepts plain object", () => {
    assert.deepEqual(assertCrmLeadCommunicationMetadataObject({ a: 1 }), { a: 1 });
  });

  it("rejects array", () => {
    assert.throws(() => assertCrmLeadCommunicationMetadataObject([]), /JSON object/);
  });
});

describe("Stage 2K — changed_keys (pure)", () => {
  it("lists only changed comparable fields", () => {
    const before = leadCommunicationDetailSnapshotFromRowLike(
      commRow({
        id: "x",
        communication_type: "phone",
        direction: "outbound",
        outcome: null,
        metadata: {},
      })
    );
    const after = { ...before, direction: "inbound" };
    assert.deepEqual(collectChangedLeadCommunicationDetailKeys(before, after), ["direction"]);
  });

  it("detects metadata change via fingerprint", () => {
    const before = leadCommunicationDetailSnapshotFromRowLike(
      commRow({ id: "a", metadata: { x: 1 } })
    );
    const after = { ...before, metadata: { x: 2 } };
    assert.deepEqual(collectChangedLeadCommunicationDetailKeys(before, after), ["metadata"]);
  });
});

describe("Stage 2K — archived guard (pure)", () => {
  it("blocks edits when archived_at set", () => {
    assert.throws(
      () =>
        assertLeadCommunicationNotArchived(
          commRow({ id: "a", archived_at: "2026-02-01T00:00:00.000Z" })
        ),
      /Archived contact log/
    );
  });
});

describe("Stage 2K — sort newest contact_at first (pure)", () => {
  it("orders by contact_at descending", () => {
    const rows = [
      commRow({ id: "old", contact_at: "2026-01-01T12:00:00.000Z" }),
      commRow({ id: "new", contact_at: "2026-06-01T12:00:00.000Z" }),
      commRow({ id: "mid", contact_at: "2026-03-01T12:00:00.000Z" }),
    ];
    const s = sortCrmLeadCommunicationsForDisplay(rows).map((r) => r.id);
    assert.deepEqual(s, ["new", "mid", "old"]);
  });
});

describe("Stage 2K — tenant/lead scope helper (pure)", () => {
  it("matches tenant and lead", () => {
    assert.equal(isLeadCommunicationOwnedByLeadTenant(commRow({ id: "1" }), TID, LID), true);
    assert.equal(
      isLeadCommunicationOwnedByLeadTenant(
        commRow({ id: "1" }),
        TID,
        "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
      ),
      false
    );
    assert.equal(
      isLeadCommunicationOwnedByLeadTenant(commRow({ id: "1", tenant_id: "other" }), TID, LID),
      false
    );
  });
});

describe("Stage 2K — Zod schemas", () => {
  it("create rejects invalid communicationType", () => {
    assert.throws(
      () =>
        crmCreateLeadCommunicationBodySchema.parse({
          communicationType: "fax",
          direction: "outbound",
        }),
      /Invalid enum/
    );
  });

  it("create rejects invalid direction", () => {
    assert.throws(
      () =>
        crmCreateLeadCommunicationBodySchema.parse({
          communicationType: "phone",
          direction: "both",
        }),
      /Invalid enum/
    );
  });

  it("create rejects invalid outcome", () => {
    assert.throws(
      () =>
        crmCreateLeadCommunicationBodySchema.parse({
          communicationType: "phone",
          direction: "outbound",
          outcome: "sold",
        }),
      /Invalid enum/
    );
  });

  it("create rejects subject over max", () => {
    assert.throws(
      () =>
        crmCreateLeadCommunicationBodySchema.parse({
          communicationType: "phone",
          direction: "outbound",
          subject: "x".repeat(CRM_LEAD_COMMUNICATION_MAX_SUBJECT + 1),
        }),
      /512 character/
    );
  });

  it("update requires a patch field", () => {
    assert.throws(() => crmUpdateLeadCommunicationBodySchema.parse({}), /at least one field/);
  });

  it("archive body is strict", () => {
    crmArchiveLeadCommunicationBodySchema.parse({});
    assert.throws(
      () => crmArchiveLeadCommunicationBodySchema.parse({ extra: 1 }),
      /Unrecognized key/
    );
  });

  it("create rejects non-object metadata", () => {
    assert.throws(
      () =>
        crmCreateLeadCommunicationBodySchema.parse({
          communicationType: "phone",
          direction: "outbound",
          metadata: [] as unknown as Record<string, unknown>,
        }),
      /Expected object, received array/
    );
  });
});
