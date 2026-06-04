import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  crmArchiveLeadNoteBodySchema,
  crmCreateLeadNoteBodySchema,
  crmUpdateLeadNoteBodySchema,
} from "./crmApiSchemas";
import { collectChangedLeadNoteDetailKeys, noteDetailSnapshotFromRowLike } from "./crmLeadNoteChangedFields";
import {
  assertCrmLeadNoteBodyNonEmpty,
  assertCrmLeadNoteVisibilityAllowed,
  assertLeadNoteNotArchived,
  isLeadNoteOwnedByLeadTenant,
  sortCrmLeadNotesForDisplay,
} from "./crmLeadNotePolicy";
import type { FiCrmLeadNoteRow } from "./types";

const TID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function leadNoteRow(p: Partial<FiCrmLeadNoteRow> & Pick<FiCrmLeadNoteRow, "id" | "note_body">): FiCrmLeadNoteRow {
  return {
    tenant_id: TID,
    lead_id: LID,
    author_user_id: null,
    note_visibility: "internal",
    is_pinned: false,
    archived_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...p,
  };
}

describe("Stage 2J — visibility policy (pure)", () => {
  it("accepts allowed visibilities", () => {
    assertCrmLeadNoteVisibilityAllowed("internal");
    assertCrmLeadNoteVisibilityAllowed("sales");
    assertCrmLeadNoteVisibilityAllowed("clinical");
    assertCrmLeadNoteVisibilityAllowed("admin");
  });

  it("rejects invalid visibility", () => {
    assert.throws(() => assertCrmLeadNoteVisibilityAllowed("public"), /Invalid note visibility/);
  });
});

describe("Stage 2J — note body (pure)", () => {
  it("rejects empty body", () => {
    assert.throws(() => assertCrmLeadNoteBodyNonEmpty("   "), /Note body is required/);
  });

  it("returns trimmed body", () => {
    assert.equal(assertCrmLeadNoteBodyNonEmpty("  hello  "), "hello");
  });
});

describe("Stage 2J — changed_keys (pure)", () => {
  it("lists only changed comparable fields", () => {
    const before = noteDetailSnapshotFromRowLike(
      leadNoteRow({ id: "x", note_body: "a", note_visibility: "internal", is_pinned: false })
    );
    const after = { ...before, note_visibility: "sales" };
    assert.deepEqual(collectChangedLeadNoteDetailKeys(before, after), ["note_visibility"]);
  });

  it("detects pinned change", () => {
    const before = noteDetailSnapshotFromRowLike(leadNoteRow({ id: "x", note_body: "t", note_visibility: "internal", is_pinned: false }));
    const after = { ...before, is_pinned: true };
    assert.deepEqual(collectChangedLeadNoteDetailKeys(before, after), ["is_pinned"]);
  });
});

describe("Stage 2J — archived guard (pure)", () => {
  it("blocks edits when archived_at set", () => {
    assert.throws(
      () => assertLeadNoteNotArchived(leadNoteRow({ id: "a", note_body: "x", archived_at: "2026-02-01T00:00:00.000Z" })),
      /Archived notes cannot/
    );
  });
});

describe("Stage 2J — pinned sort (pure)", () => {
  it("sorts pinned first then newest created_at", () => {
    const rows = [
      leadNoteRow({ id: "old", note_body: "o", is_pinned: false, created_at: "2026-01-01T00:00:00.000Z" }),
      leadNoteRow({ id: "pin-old", note_body: "p1", is_pinned: true, created_at: "2026-01-02T00:00:00.000Z" }),
      leadNoteRow({ id: "new", note_body: "n", is_pinned: false, created_at: "2026-06-01T00:00:00.000Z" }),
      leadNoteRow({ id: "pin-new", note_body: "p2", is_pinned: true, created_at: "2026-06-02T00:00:00.000Z" }),
    ];
    const s = sortCrmLeadNotesForDisplay(rows).map((r) => r.id);
    assert.deepEqual(s, ["pin-new", "pin-old", "new", "old"]);
  });
});

describe("Stage 2J — tenant/lead scope helper (pure)", () => {
  it("matches tenant and lead", () => {
    assert.equal(isLeadNoteOwnedByLeadTenant(leadNoteRow({ id: "1", note_body: "x" }), TID, LID), true);
    assert.equal(isLeadNoteOwnedByLeadTenant(leadNoteRow({ id: "1", note_body: "x" }), TID, "other"), false);
    assert.equal(isLeadNoteOwnedByLeadTenant(leadNoteRow({ id: "1", note_body: "x", tenant_id: "other" }), TID, LID), false);
  });
});

describe("Stage 2J — Zod schemas", () => {
  it("create rejects invalid visibility enum", () => {
    assert.throws(() => crmCreateLeadNoteBodySchema.parse({ noteBody: "hi", noteVisibility: "team" }), /Invalid enum/);
  });

  it("update requires a patch field", () => {
    assert.throws(() => crmUpdateLeadNoteBodySchema.parse({}), /at least one field/);
  });

  it("archive body is strict empty object or adminKey only", () => {
    crmArchiveLeadNoteBodySchema.parse({});
    crmArchiveLeadNoteBodySchema.parse({ adminKey: "x" });
    assert.throws(() => crmArchiveLeadNoteBodySchema.parse({ extra: 1 }), /Unrecognized key/);
  });
});
