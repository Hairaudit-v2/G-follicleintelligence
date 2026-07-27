import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  loadPatientGatewayNotificationPreferences,
  updatePatientGatewayNotificationPreferences,
} from "./patientGatewayNotificationPreferences.server";
import type { PatientGatewayContext } from "./patientGatewayTypes";

const PATIENT_A = "11111111-1111-4111-8111-111111111111";
const PATIENT_B = "22222222-2222-4222-8222-222222222222";
const TENANT_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const CTX_A: PatientGatewayContext = {
  authUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  patientId: PATIENT_A,
  tenantId: TENANT_A,
  personId: "55555555-5555-4555-8555-555555555555",
  patientStatus: "active",
  clinicName: "Clinic A",
};

function createPatientPrefsMock(initial: {
  id: string;
  tenant_id: string;
  metadata: Record<string, unknown>;
  reminder_consent: boolean | null;
  preferred_contact_method: string | null;
}) {
  let row = { ...initial, metadata: { ...initial.metadata } };
  return {
    from(table: string) {
      const filters: { col: string; val: unknown }[] = [];
      let updatePayload: Record<string, unknown> | null = null;
      const builder: Record<string, unknown> = {
        select() {
          return builder;
        },
        update(payload: Record<string, unknown>) {
          updatePayload = payload;
          return builder;
        },
        eq(col: string, val: unknown) {
          filters.push({ col, val });
          return builder;
        },
        maybeSingle: async () => {
          if (table !== "fi_patients") return { data: null, error: null };
          const ok = filters.every((f) => String((row as Record<string, unknown>)[f.col]) === String(f.val));
          return { data: ok ? row : null, error: null };
        },
        then(resolve: (v: { data: unknown; error: null }) => unknown) {
          if (table === "fi_patients" && updatePayload) {
            const ok = filters.every(
              (f) => String((row as Record<string, unknown>)[f.col]) === String(f.val)
            );
            if (ok) {
              row = {
                ...row,
                metadata: (updatePayload.metadata as Record<string, unknown>) ?? row.metadata,
              };
            }
            return Promise.resolve(resolve({ data: null, error: null }));
          }
          return Promise.resolve(resolve({ data: null, error: null }));
        },
      };
      return builder;
    },
  };
}

describe("patientGatewayNotificationPreferences.server", () => {
  it("P. Patient reads own notification preferences", async () => {
    const supabase = createPatientPrefsMock({
      id: PATIENT_A,
      tenant_id: TENANT_A,
      metadata: {},
      reminder_consent: true,
      preferred_contact_method: "email",
    });
    const result = await loadPatientGatewayNotificationPreferences(CTX_A, {
      writeAudit: false,
      supabase: supabase as never,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.preferences.email, true);
    assert.equal(result.preferences.push, false);
  });

  it("Q. Patient updates allowed preference", async () => {
    const supabase = createPatientPrefsMock({
      id: PATIENT_A,
      tenant_id: TENANT_A,
      metadata: {},
      reminder_consent: true,
      preferred_contact_method: "both",
    });
    const result = await updatePatientGatewayNotificationPreferences(
      CTX_A,
      { push: true, messageNotifications: false },
      { writeAudit: false, supabase: supabase as never }
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.preferences.push, true);
    assert.equal(result.preferences.messageNotifications, false);
  });

  it("R. Patient A cannot update Patient B preferences (server-derived identity)", async () => {
    const supabase = createPatientPrefsMock({
      id: PATIENT_B,
      tenant_id: TENANT_A,
      metadata: {},
      reminder_consent: true,
      preferred_contact_method: "email",
    });
    // ctx is PATIENT_A; mock only has PATIENT_B → not found
    const result = await updatePatientGatewayNotificationPreferences(
      CTX_A,
      { email: false },
      { writeAudit: false, supabase: supabase as never }
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "not_found");
  });
});
