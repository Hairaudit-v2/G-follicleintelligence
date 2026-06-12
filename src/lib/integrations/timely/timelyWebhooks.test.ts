import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { assertTimelyWebhookAuthorized, TimelyWebhookAuthError } from "./timelyWebhookAuth.server";
import { extractTimelyDiscoveryEventType, stableStringifyForWebhookHash } from "./timelyWebhookEvents.server";
import { timelyAppointmentWebhookSchema, timelyPatientWebhookSchema } from "./timelyWebhookSchemas";
import { processTimelyAppointmentWebhook, resolveTimelyStaffIdByName } from "./timelyAppointmentWebhook.server";
import { processTimelyPatientWebhook } from "./timelyPatientWebhook.server";
import type { FiBookingRow } from "@/src/lib/bookings/types";

const TENANT = "11111111-1111-4111-8111-111111111111";
const SECRET = "test-timely-webhook-secret-32chars!";

function reqWithAuth(token: string | null): Request {
  const headers = new Headers();
  if (token !== null) headers.set("Authorization", `Bearer ${token}`);
  return new Request("https://example.com/webhook", { headers });
}

describe("Timely webhook auth", () => {
  const prev = { ...process.env };
  const env = process.env as Record<string, string | undefined>;

  beforeEach(() => {
    Object.assign(process.env, prev);
    process.env.FI_TIMELY_WEBHOOK_SECRET = SECRET;
    env.NODE_ENV = "test";
  });

  afterEach(() => {
    Object.assign(process.env, prev);
  });

  it("rejects invalid secret", () => {
    assert.throws(
      () => assertTimelyWebhookAuthorized(reqWithAuth("wrong-secret")),
      (e: unknown) => e instanceof TimelyWebhookAuthError && (e as TimelyWebhookAuthError).status === 401
    );
  });

  it("rejects missing bearer", () => {
    assert.throws(
      () => assertTimelyWebhookAuthorized(reqWithAuth(null)),
      (e: unknown) => e instanceof TimelyWebhookAuthError && (e as TimelyWebhookAuthError).status === 401
    );
  });

  it("accepts matching secret", () => {
    assert.doesNotThrow(() => assertTimelyWebhookAuthorized(reqWithAuth(SECRET)));
  });

  it("rejects when secret missing in production", () => {
    delete process.env.FI_TIMELY_WEBHOOK_SECRET;
    env.NODE_ENV = "production";
    assert.throws(
      () => assertTimelyWebhookAuthorized(reqWithAuth(SECRET)),
      (e: unknown) => e instanceof TimelyWebhookAuthError && (e as TimelyWebhookAuthError).status === 503
    );
  });

  it("rejects when configured secret is too short", () => {
    process.env.FI_TIMELY_WEBHOOK_SECRET = "short_secret";
    env.NODE_ENV = "test";
    assert.throws(
      () => assertTimelyWebhookAuthorized(reqWithAuth("short_secret")),
      (e: unknown) => e instanceof TimelyWebhookAuthError && (e as TimelyWebhookAuthError).status === 503
    );
  });
});

describe("Timely discovery webhook helpers", () => {
  it("stableStringify sorts object keys for canonical hash input", () => {
    assert.equal(stableStringifyForWebhookHash({ b: 2, a: 1 }), `{"a":1,"b":2}`);
  });

  it("extractTimelyDiscoveryEventType prefers event_type, event, type", () => {
    assert.equal(extractTimelyDiscoveryEventType({ event_type: "x" }), "x");
    assert.equal(extractTimelyDiscoveryEventType({ event: "e" }), "e");
    assert.equal(extractTimelyDiscoveryEventType({ type: "t" }), "t");
    assert.equal(extractTimelyDiscoveryEventType({}), "zapier_discovery");
    assert.equal(extractTimelyDiscoveryEventType([]), "zapier_discovery");
  });
});

describe("Timely webhook schemas", () => {
  it("patient schema requires external_id", () => {
    const r = timelyPatientWebhookSchema.safeParse({});
    assert.equal(r.success, false);
  });

  it("appointment schema requires ids and times", () => {
    const r = timelyAppointmentWebhookSchema.safeParse({
      external_appointment_id: "a1",
      external_patient_id: "p1",
      start_time: "2026-06-01T10:00:00.000Z",
      end_time: "2026-06-01T11:00:00.000Z",
    });
    assert.equal(r.success, true);
  });
});

describe("resolveTimelyStaffIdByName", () => {
  const rows = [
    { id: "s1", full_name: "Dr Jane Doe" },
    { id: "s2", full_name: "Dr Jane Doe" },
  ];

  it("returns null when staff_name empty", () => {
    assert.deepEqual(resolveTimelyStaffIdByName(rows, ""), { staffId: null, ambiguous: false });
  });

  it("detects ambiguous exact full_name matches", () => {
    const r = resolveTimelyStaffIdByName(rows, "Dr Jane Doe");
    assert.equal(r.ambiguous, true);
    assert.equal(r.staffId, null);
  });
});

function makePatientMockSupabase(): SupabaseClient {
  const tenantOk = {
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: { id: TENANT }, error: null }),
      }),
    }),
  };
  const updateChain = {
    eq: () => ({
      eq: async () => ({ error: null }),
    }),
  };
  const from = (table: string) => {
    if (table === "fi_tenants") return tenantOk;
    if (table === "fi_persons" || table === "fi_patients") {
      return { update: () => updateChain };
    }
    throw new Error(`unexpected table ${table}`);
  };
  return { from } as unknown as SupabaseClient;
}

describe("Timely patient webhook (mocked foundation)", () => {
  const person = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    tenant_id: TENANT,
    metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
  const patient = {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    tenant_id: TENANT,
    person_id: person.id,
    primary_clinic_id: null,
    metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };

  it("creates patient via foundation ports", async () => {
    let personCalls = 0;
    const supabase = makePatientMockSupabase();
    const payload = timelyPatientWebhookSchema.parse({
      external_id: "timely-99",
      first_name: "Ann",
      last_name: "Test",
      email: "ann@example.com",
    });
    const r = await processTimelyPatientWebhook(
      TENANT,
      payload,
      supabase,
      {
        resolveOrCreatePerson: async () => {
          personCalls += 1;
          return { person, created: true, mapping_created: true };
        },
        resolveOrCreatePatient: async () => {
          return { patient, created: true, mapping_created: true };
        },
      }
    );
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.patient_id, patient.id);
    assert.equal(r.person_id, person.id);
    assert.equal(personCalls, 1);
  });

  it("is idempotent at foundation layer (same ids on repeat)", async () => {
    const supabase = makePatientMockSupabase();
    const payload = timelyPatientWebhookSchema.parse({ external_id: "timely-100" });
    const ports = {
      resolveOrCreatePerson: async () => ({ person, created: false, mapping_created: false }),
      resolveOrCreatePatient: async () => ({ patient, created: false, mapping_created: false }),
    };
    const a = await processTimelyPatientWebhook(TENANT, payload, supabase, ports);
    const b = await processTimelyPatientWebhook(TENANT, payload, supabase, ports);
    assert.equal(a.ok && b.ok && a.patient_id === b.patient_id && a.person_id === b.person_id, true);
  });
});

function bookingRow(id: string): FiBookingRow {
  return {
    id,
    tenant_id: TENANT,
    lead_id: null,
    person_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    patient_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    case_id: null,
    clinic_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    room_id: null,
    room_required: false,
    assigned_staff_id: null,
    assigned_user_id: null,
    booking_type: "consultation",
    booking_status: "scheduled",
    title: "T",
    description: null,
    start_at: "2026-06-01T10:00:00.000Z",
    end_at: "2026-06-01T11:00:00.000Z",
    timezone: null,
    location: null,
    metadata: {},
    cancelled_at: null,
    cancelled_by_user_id: null,
    cancellation_reason: null,
    created_by_user_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function makeAppointmentMockSupabase(mode: "no_patient" | "create" | "duplicate"): SupabaseClient {
  let insertedBookingId: string | null = null;

  const mappingSelect = {
    eq: () => ({
      eq: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => {
              if (mode === "duplicate") {
                return { data: { internal_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" }, error: null };
              }
              if (mode === "create" && insertedBookingId) {
                return { data: { internal_id: insertedBookingId }, error: null };
              }
              return { data: null, error: null };
            },
          }),
        }),
      }),
    }),
  };

  const patientSource = {
    eq: () => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (mode === "no_patient") return { data: null, error: null };
            return { data: { patient_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }, error: null };
          },
        }),
      }),
    }),
  };

  const patientRow = {
    eq: () => ({
      eq: () => ({
        maybeSingle: async () => ({
          data: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", person_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
          error: null,
        }),
      }),
    }),
  };

  const clinics = {
    eq: () => ({
      order: async () => ({
        data: [{ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }],
        error: null,
      }),
    }),
  };

  const services = {
    eq: () => ({
      eq: async () => ({
        data: [{ booking_type: "consultation", name: "Consultation" }],
        error: null,
      }),
    }),
  };

  const tenantOk = {
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: { id: TENANT }, error: null }),
      }),
    }),
  };

  const from = (table: string) => {
    if (table === "fi_tenants") return tenantOk;
    if (table === "fi_external_entity_mappings") {
      return {
        select: () => mappingSelect,
        insert: async (row: { internal_id?: string }) => {
          if (row && typeof row.internal_id === "string") insertedBookingId = row.internal_id;
          return { error: null };
        },
      };
    }
    if (table === "fi_patient_source_ids") return { select: () => patientSource };
    if (table === "fi_patients") return { select: () => patientRow };
    if (table === "fi_clinics") return { select: () => clinics };
    if (table === "fi_services") return { select: () => services };
    throw new Error(`unexpected table ${table}`);
  };

  return { from } as unknown as SupabaseClient;
}

describe("Timely appointment webhook (mocked data path)", () => {
  const payloadBase = timelyAppointmentWebhookSchema.parse({
    external_appointment_id: "appt-1",
    external_patient_id: "patient-ext-1",
    start_time: "2026-06-10T12:00:00.000Z",
    end_time: "2026-06-10T13:00:00.000Z",
  });

  it("returns 404 when patient mapping missing", async () => {
    const r = await processTimelyAppointmentWebhook(TENANT, payloadBase, makeAppointmentMockSupabase("no_patient"), {
      loadActiveStaffForTenant: async () => [],
      createBooking: async () => bookingRow("x"),
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 404);
    assert.match(r.message, /synced before appointment/i);
  });

  it("creates booking and returns id", async () => {
    let created = 0;
    const r = await processTimelyAppointmentWebhook(TENANT, payloadBase, makeAppointmentMockSupabase("create"), {
      loadActiveStaffForTenant: async () => [],
      createBooking: async () => {
        created += 1;
        return bookingRow("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
      },
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.booking_id, "dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    assert.equal(created, 1);
  });

  it("is idempotent when mapping already exists", async () => {
    let created = 0;
    const r = await processTimelyAppointmentWebhook(TENANT, payloadBase, makeAppointmentMockSupabase("duplicate"), {
      loadActiveStaffForTenant: async () => [],
      createBooking: async () => {
        created += 1;
        return bookingRow("new-booking");
      },
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.duplicate, true);
    assert.equal(r.booking_id, "dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    assert.equal(created, 0);
  });
});
