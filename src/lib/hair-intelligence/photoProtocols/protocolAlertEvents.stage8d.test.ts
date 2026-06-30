import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPhotoProtocolAlertDeliveryPayload,
  shouldDeliverPhotoProtocolAlert,
} from "./protocolAlertDelivery";
import type { PhotoProtocolAlert } from "./protocolAlerts";
import {
  assertPhotoProtocolAlertStatusTransition,
  buildPhotoProtocolAlertIdempotencyKey,
  mapComputedAlertToUpsertCandidate,
  mergePhotoProtocolAlertUpsertCandidate,
  type ExistingAlertEventRow,
} from "./protocolAlertEventsPure";
import {
  fiOsFoundationPhotoProtocolAnalyticsHref,
  fiOsPatientTwinPhotoProtocolHref,
  hairAuditCasePhotoProtocolHrefPlaceholder,
} from "./protocolDeepLinks";
import type { HliPhotoProtocolAlertEvent, HliPhotoProtocolSession } from "./types";

describe("Stage 8D photo protocol alert events", () => {
  it("buildPhotoProtocolAlertIdempotencyKey is deterministic", () => {
    const a = buildPhotoProtocolAlertIdempotencyKey({
      source_system: "fi_os",
      tenant_id: "11111111-1111-1111-1111-111111111111",
      protocol_session_id: "22222222-2222-2222-2222-222222222222",
      alert_type: "missing_required_images",
      patient_id: "33333333-3333-3333-3333-333333333333",
      case_id: null,
      source_record_id: "rec-1",
    });
    const b = buildPhotoProtocolAlertIdempotencyKey({
      source_system: "fi_os",
      tenant_id: "11111111-1111-1111-1111-111111111111",
      protocol_session_id: "22222222-2222-2222-2222-222222222222",
      alert_type: "missing_required_images",
      patient_id: "33333333-3333-3333-3333-333333333333",
      case_id: null,
      source_record_id: "rec-1",
    });
    assert.equal(a, b);
    assert.ok(a.includes("tenant:11111111-1111-1111-1111-111111111111"));
    assert.ok(a.includes("type:missing_required_images"));
  });

  it("buildPhotoProtocolAlertIdempotencyKey uses global tenant token when tenant_id null", () => {
    const k = buildPhotoProtocolAlertIdempotencyKey({
      source_system: "hairaudit",
      tenant_id: null,
      protocol_session_id: "22222222-2222-2222-2222-222222222222",
      alert_type: "hairaudit_not_ready",
      patient_id: null,
      case_id: null,
      source_record_id: "audit-9",
    });
    assert.ok(k.includes("tenant:global"));
    assert.ok(k.includes("src:audit-9"));
  });

  it("mapComputedAlertToUpsertCandidate maps session + alert", () => {
    const alert: PhotoProtocolAlert = {
      type: "needs_retake",
      severity: "high",
      source_system: "fi_os",
      patient_id: "p1",
      case_id: null,
      session_id: "s1",
      clinical_context: "consultation",
      message: "msg",
      recommended_action: "act",
      detected_at: "2026-06-01T12:00:00.000Z",
    };
    const session: HliPhotoProtocolSession = {
      id: "s1",
      source_system: "fi_os",
      source_record_id: "srid",
      tenant_id: "t1",
      patient_id: "p1",
      case_id: null,
      protocol_template_id: "tmpl",
      status: "in_progress",
      started_at: null,
      completed_at: null,
      created_by_user_id: null,
      metadata: {},
      created_at: "2026-06-01T00:00:00Z",
      updated_at: "2026-06-01T00:00:00Z",
    };
    const c = mapComputedAlertToUpsertCandidate(
      alert,
      session,
      "clinic-1",
      "2026-06-02T00:00:00.000Z"
    );
    assert.equal(c.protocol_session_id, "s1");
    assert.equal(c.alert_type, "needs_retake");
    assert.equal(c.clinic_id, "clinic-1");
    assert.equal(c.payload.clinical_context, "consultation");
    assert.equal(c.status, "open");
    assert.ok(c.idempotency_key.length > 20);
  });

  it("mergePhotoProtocolAlertUpsertCandidate preserves workflow status and ack columns", () => {
    const candidate = mapComputedAlertToUpsertCandidate(
      {
        type: "missing_required_images",
        severity: "high",
        source_system: "fi_os",
        patient_id: "p1",
        case_id: null,
        session_id: "s1",
        clinical_context: "consultation",
        message: "new",
        recommended_action: "go",
        detected_at: "2026-06-01T12:00:00.000Z",
      },
      {
        id: "s1",
        source_system: "fi_os",
        source_record_id: "x",
        tenant_id: "t1",
        patient_id: "p1",
        case_id: null,
        protocol_template_id: "tmpl",
        status: "in_progress",
        started_at: null,
        completed_at: null,
        created_by_user_id: null,
        metadata: {},
        created_at: "2026-06-01T00:00:00Z",
        updated_at: "2026-06-01T00:00:00Z",
      },
      null,
      "2026-06-01T12:00:00.000Z"
    );

    const existing: ExistingAlertEventRow & { idempotency_key: string } = {
      idempotency_key: candidate.idempotency_key,
      status: "acknowledged",
      first_detected_at: "2026-06-01T10:00:00.000Z",
      last_detected_at: "2026-06-01T11:00:00.000Z",
      acknowledged_at: "2026-06-01T10:30:00.000Z",
      acknowledged_by_user_id: "u1",
      resolved_at: null,
      resolved_by_user_id: null,
    };

    const merged = mergePhotoProtocolAlertUpsertCandidate(
      candidate,
      existing,
      "2026-06-01T13:00:00.000Z"
    );
    assert.equal(merged.status, "acknowledged");
    assert.equal(merged.first_detected_at, "2026-06-01T10:00:00.000Z");
    assert.equal(merged.last_detected_at, "2026-06-01T13:00:00.000Z");
    assert.equal(merged.message, "new");
    assert.equal(merged.acknowledged_at, "2026-06-01T10:30:00.000Z");
    assert.equal(merged.acknowledged_by_user_id, "u1");
  });

  it("assertPhotoProtocolAlertStatusTransition validates common paths", () => {
    assert.doesNotThrow(() => assertPhotoProtocolAlertStatusTransition("open", "acknowledged"));
    assert.doesNotThrow(() => assertPhotoProtocolAlertStatusTransition("acknowledged", "resolved"));
    assert.doesNotThrow(() => assertPhotoProtocolAlertStatusTransition("open", "resolved"));
    assert.doesNotThrow(() => assertPhotoProtocolAlertStatusTransition("resolved", "dismissed"));
    assert.throws(() => assertPhotoProtocolAlertStatusTransition("resolved", "acknowledged"));
    assert.doesNotThrow(() => assertPhotoProtocolAlertStatusTransition("open", "open"));
  });

  it("deep links include expected paths and anchors", () => {
    const twin = fiOsPatientTwinPhotoProtocolHref("tenant-uuid", "patient-uuid");
    assert.equal(twin, "/fi-admin/tenant-uuid/patients/patient-uuid/twin#smart-photo-protocol");
    const fo = fiOsFoundationPhotoProtocolAnalyticsHref("tenant-uuid");
    assert.equal(fo, "/fi-admin/tenant-uuid/foundation-integrity#fi-os-photo-protocol-analytics");
    assert.ok(
      hairAuditCasePhotoProtocolHrefPlaceholder("case-1").includes(
        "/hairaudit/cases/case-1/photo-protocol"
      )
    );
  });

  it("buildPhotoProtocolAlertDeliveryPayload and shouldDeliver stub", () => {
    const ev: HliPhotoProtocolAlertEvent = {
      id: "e1",
      source_system: "fi_os",
      source_record_id: "sr",
      tenant_id: "t1",
      clinic_id: null,
      patient_id: "p1",
      case_id: null,
      protocol_session_id: "s1",
      alert_type: "missing_required_images",
      severity: "high",
      status: "open",
      message: "Hello",
      recommended_action: "Do thing",
      payload: {},
      idempotency_key: "k1",
      first_detected_at: "2026-06-01T00:00:00Z",
      last_detected_at: "2026-06-01T00:00:00Z",
      acknowledged_at: null,
      acknowledged_by_user_id: null,
      resolved_at: null,
      resolved_by_user_id: null,
      created_at: "2026-06-01T00:00:00Z",
      updated_at: "2026-06-01T00:00:00Z",
    };
    const p = buildPhotoProtocolAlertDeliveryPayload(ev, "email");
    assert.equal(p.channel, "email");
    assert.ok(p.body.includes("Hello"));
    assert.ok(p.deep_links.patient_twin_protocol?.includes("#smart-photo-protocol"));
    assert.equal(shouldDeliverPhotoProtocolAlert(ev, "in_app"), true);
    assert.equal(shouldDeliverPhotoProtocolAlert(ev, "email"), false);
    assert.equal(shouldDeliverPhotoProtocolAlert({ ...ev, status: "resolved" }, "in_app"), false);
  });
});
