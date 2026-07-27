import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PATIENT_GATEWAY_MAX_MESSAGE_LENGTH,
  buildPrivacySafeMessageNotificationPreview,
  evaluateMessageDuplicate,
  evaluateMessageRateLimit,
  mapMessageRowToItem,
  messagingPayloadExposesStaffFields,
  sanitizePatientMessageClientPayload,
  validatePatientGatewayMessageBody,
} from "./patientGatewayMessagingCore";

describe("patientGatewayMessagingCore", () => {
  it("K. rejects empty message body", () => {
    assert.equal(validatePatientGatewayMessageBody("").ok, false);
    assert.equal(validatePatientGatewayMessageBody("   ").ok, false);
    assert.equal(validatePatientGatewayMessageBody(null).ok, false);
  });

  it("L. rejects oversized message body", () => {
    const body = "x".repeat(PATIENT_GATEWAY_MAX_MESSAGE_LENGTH + 1);
    const r = validatePatientGatewayMessageBody(body);
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.code, "message_too_long");
  });

  it("accepts trimmed valid body", () => {
    const r = validatePatientGatewayMessageBody("  Hello clinic  ");
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.body, "Hello clinic");
  });

  it("M/N. sanitizes client impersonation / delivery status keys", () => {
    const { body, ignoredKeys } = sanitizePatientMessageClientPayload({
      body: "ok",
      direction: "clinic_to_patient",
      senderLabel: "Doctor",
      status: "read",
      patientId: "x",
      isStaff: true,
    });
    assert.equal(body, "ok");
    assert.ok(ignoredKeys.includes("direction"));
    assert.ok(ignoredKeys.includes("status"));
    assert.ok(ignoredKeys.includes("isStaff"));
  });

  it("O. rate limit and duplicate windows", () => {
    const now = Date.parse("2026-07-27T12:00:00.000Z");
    const recent = Array.from({ length: 10 }, (_, i) =>
      new Date(now - i * 1000).toISOString()
    );
    assert.equal(evaluateMessageRateLimit({ recentSentAtIsos: recent, nowMs: now }).ok, false);
    assert.equal(
      evaluateMessageDuplicate({
        recentBodies: [{ body: "same", sentAt: new Date(now - 1000).toISOString() }],
        candidateBody: "same",
        nowMs: now,
      }).ok,
      false
    );
  });

  it("V. privacy-safe preview never includes clinical body text", () => {
    const preview = buildPrivacySafeMessageNotificationPreview();
    assert.ok(!preview.toLowerCase().includes("finasteride"));
    assert.ok(!preview.toLowerCase().includes("blood"));
    assert.match(preview, /clinical team|Follicle Intelligence/i);
  });

  it("maps patient sender label to You", () => {
    const item = mapMessageRowToItem({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      direction: "patient_to_clinic",
      sender_label: "Impersonate Staff",
      body: "hi",
      sent_at: "2026-07-27T00:00:00.000Z",
      status: "sent",
    });
    assert.equal(item.senderLabel, "You");
    assert.equal(item.direction, "patient_to_clinic");
  });

  it("F. staff-field detector flags internal payloads", () => {
    assert.equal(messagingPayloadExposesStaffFields({ body: "ok" }), false);
    assert.equal(
      messagingPayloadExposesStaffFields({ internal_note: "secret", staff_id: "x" }),
      true
    );
  });
});
