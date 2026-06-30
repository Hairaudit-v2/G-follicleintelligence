import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { publishPatientEvent } from "@/src/lib/analytics-os/analyticsModulePublishers";
import {
  isEventTypeAllowedForModule,
  PATIENT_EVENTS,
} from "@/src/lib/analytics-os/analyticsEventTypes";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PATIENT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function createStoreMock() {
  const store: Record<string, unknown>[] = [];
  const client = {
    from(table: string) {
      assert.equal(table, "fi_analytics_events");
      return {
        insert(row: Record<string, unknown>) {
          const full = { ...row, id: randomUUID(), created_at: new Date().toISOString() };
          store.push(full);
          return {
            select() {
              return { single: async () => ({ data: full, error: null }) };
            },
          };
        },
      };
    },
  };
  return { client, store };
}

test("patient_photo_quick_action_completed is registered on patient_os", () => {
  assert.ok(PATIENT_EVENTS.includes("patient_photo_quick_action_completed"));
  assert.ok(isEventTypeAllowedForModule("patient_os", "patient_photo_quick_action_completed"));
});

test("patient_photo_quick_action_completed persists required metadata", async () => {
  const { client, store } = createStoreMock();

  await publishPatientEvent(
    {
      tenantId: TENANT,
      eventType: "patient_photo_quick_action_completed",
      entityId: PATIENT,
      entityType: "patient",
      eventMetadata: {
        tenant_id: TENANT,
        patient_id: PATIENT,
        intent: "camera",
        source: "patient_profile",
        returned_to_gallery: true,
      },
    },
    { supabaseClientForTests: client as never }
  );

  assert.equal(store.length, 1);
  assert.equal(store[0]?.tenant_id, TENANT);
  assert.equal(store[0]?.module_name, "patient_os");
  assert.equal(store[0]?.event_type, "patient_photo_quick_action_completed");
  assert.equal(store[0]?.entity_id, PATIENT);
  assert.equal(store[0]?.entity_type, "patient");

  const metadata = store[0]?.event_metadata as Record<string, unknown>;
  assert.equal(metadata.tenant_id, TENANT);
  assert.equal(metadata.patient_id, PATIENT);
  assert.equal(metadata.intent, "camera");
  assert.equal(metadata.source, "patient_profile");
  assert.equal(metadata.returned_to_gallery, true);
});

test("patient_photo_quick_action_completed supports slide-over library uploads", async () => {
  const { client, store } = createStoreMock();

  await publishPatientEvent(
    {
      tenantId: TENANT,
      eventType: "patient_photo_quick_action_completed",
      entityId: PATIENT,
      entityType: "patient",
      eventMetadata: {
        tenant_id: TENANT,
        patient_id: PATIENT,
        intent: "library",
        source: "patient_slide_over",
        returned_to_gallery: true,
      },
    },
    { supabaseClientForTests: client as never }
  );

  assert.equal(store.length, 1);
  const metadata = store[0]?.event_metadata as Record<string, unknown>;
  assert.equal(metadata.intent, "library");
  assert.equal(metadata.source, "patient_slide_over");
});
