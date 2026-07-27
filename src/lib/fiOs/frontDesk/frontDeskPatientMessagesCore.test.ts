import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildFrontDeskPatientHref,
  buildFrontDeskSafeMessagePreview,
  compareFrontDeskPatientMessageQueueItems,
  deriveFrontDeskStaffWorkState,
  filterFrontDeskPatientMessageQueueItems,
  isSensitiveFrontDeskMessageCategory,
  type FrontDeskPatientMessageQueueItem,
} from "./frontDeskPatientMessagesCore";

function item(
  partial: Partial<FrontDeskPatientMessageQueueItem> &
    Pick<FrontDeskPatientMessageQueueItem, "threadId" | "unreadCount" | "lastMessageAt">
): FrontDeskPatientMessageQueueItem {
  return {
    patientId: "p1",
    patientDisplayName: "Demo Patient",
    category: "general",
    categoryLabel: "General enquiry",
    subject: "General enquiry",
    status: "open",
    workState: partial.unreadCount > 0 ? "unread" : "open",
    preview: "hello",
    previewPolicy: "bounded_text",
    patientHref: "/x",
    ...partial,
  };
}

describe("frontDeskPatientMessagesCore", () => {
  it("marks post_op and medication as sensitive", () => {
    assert.equal(isSensitiveFrontDeskMessageCategory("post_op"), true);
    assert.equal(isSensitiveFrontDeskMessageCategory("medication"), true);
    assert.equal(isSensitiveFrontDeskMessageCategory("general"), false);
    assert.equal(isSensitiveFrontDeskMessageCategory("billing"), false);
  });

  it("withholds body preview for sensitive categories (PART F / I)", () => {
    const safe = buildFrontDeskSafeMessagePreview({
      category: "post_op",
      body: "I've uploaded my photos and my pain is 8/10",
    });
    assert.equal(safe.preview, null);
    assert.equal(safe.previewPolicy, "generic_sensitive");
    assert.equal(safe.toastBody, "New patient message — open to view");
    assert.ok(!safe.toastBody.includes("pain"));
  });

  it("allows bounded preview for administrative categories", () => {
    const long = "A".repeat(200);
    const safe = buildFrontDeskSafeMessagePreview({ category: "general", body: long });
    assert.equal(safe.previewPolicy, "bounded_text");
    assert.ok(safe.preview);
    assert.ok((safe.preview?.length ?? 0) <= 120);
    assert.ok(safe.preview?.endsWith("…"));
  });

  it("orders unread first then newest activity", () => {
    const a = item({
      threadId: "a",
      unreadCount: 0,
      lastMessageAt: "2026-07-27T12:00:00.000Z",
    });
    const b = item({
      threadId: "b",
      unreadCount: 2,
      lastMessageAt: "2026-07-27T11:00:00.000Z",
    });
    const c = item({
      threadId: "c",
      unreadCount: 1,
      lastMessageAt: "2026-07-27T13:00:00.000Z",
    });
    const sorted = [a, b, c].sort(compareFrontDeskPatientMessageQueueItems);
    assert.deepEqual(
      sorted.map((x) => x.threadId),
      ["c", "b", "a"]
    );
  });

  it("derives unread / open / handled without using patient_read_at", () => {
    assert.equal(
      deriveFrontDeskStaffWorkState({
        unreadCount: 1,
        staffHandledAt: "2026-07-27T10:00:00.000Z",
        lastPatientMessageAt: "2026-07-27T09:00:00.000Z",
      }),
      "unread"
    );
    assert.equal(
      deriveFrontDeskStaffWorkState({
        unreadCount: 0,
        staffHandledAt: null,
        lastPatientMessageAt: "2026-07-27T09:00:00.000Z",
      }),
      "open"
    );
    assert.equal(
      deriveFrontDeskStaffWorkState({
        unreadCount: 0,
        staffHandledAt: "2026-07-27T10:00:00.000Z",
        lastPatientMessageAt: "2026-07-27T09:00:00.000Z",
      }),
      "handled"
    );
    // New patient message after handled reopens as open (not handled).
    assert.equal(
      deriveFrontDeskStaffWorkState({
        unreadCount: 0,
        staffHandledAt: "2026-07-27T09:00:00.000Z",
        lastPatientMessageAt: "2026-07-27T11:00:00.000Z",
      }),
      "open"
    );
  });

  it("filters unread queue items", () => {
    const items = [
      item({ threadId: "a", unreadCount: 0, lastMessageAt: "2026-07-27T12:00:00.000Z" }),
      item({ threadId: "b", unreadCount: 3, lastMessageAt: "2026-07-27T11:00:00.000Z" }),
    ];
    const unread = filterFrontDeskPatientMessageQueueItems(items, "unread");
    assert.equal(unread.length, 1);
    assert.equal(unread[0]?.threadId, "b");
  });

  it("builds patient profile deep link with thread anchor", () => {
    const href = buildFrontDeskPatientHref("tenant-1", "patient-1", "thread-1");
    assert.equal(
      href,
      "/fi-admin/tenant-1/patients/patient-1?focus=messages&thread=thread-1"
    );
  });
});
