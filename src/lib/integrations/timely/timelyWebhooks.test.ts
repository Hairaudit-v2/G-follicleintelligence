import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { assertTimelyWebhookAuthorized, TimelyWebhookAuthError } from "./timelyWebhookAuth.server";
import { extractTimelyDiscoveryEventType, stableStringifyForWebhookHash } from "./timelyWebhookEvents.server";
import { timelyAppointmentWebhookSchema, timelyPatientWebhookSchema } from "./timelyWebhookSchemas";
import { processTimelyAppointmentWebhook, resolveTimelyStaffIdByName } from "./timelyAppointmentWebhook.server";
import { withTimelyWebhookAudit } from "./timelyWebhookAudit.server";
import { processTimelyPatientWebhook } from "./timelyPatientWebhook.server";
import { resolveTimelyBookingLead } from "./resolveTimelyBookingLead.server";
import type { FiBookingRow } from "@/src/lib/bookings/types";

const TENANT = "11111111-1111-4111-8111-111111111111";
const PERSON_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PATIENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LEAD_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const LEAD_ID_2 = "99999999-9999-4999-8999-999999999999";
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
    if (!r.ok || "duplicate" in r) return;
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

function makeAppointmentMockSupabase(
  mode: "no_patient" | "create" | "existing",
  existingRow?: FiBookingRow,
  opts?: {
    serviceBookingType?: string | null;
    serviceName?: string;
    serviceCategory?: string;
    crmLeads?: { id: string; status: string; updated_at?: string }[];
  }
): SupabaseClient {
  const serviceName = opts?.serviceName ?? "Consultation";
  const serviceCategory = opts?.serviceCategory ?? "Consultation";
  const serviceBookingType = opts?.serviceBookingType !== undefined ? opts.serviceBookingType : "consultation";
  const crmLeads = opts?.crmLeads ?? [];
  let insertedBookingId: string | null = null;
  let claimed = false;
  const existingBooking = existingRow ?? bookingRow("dddddddd-dddd-4ddd-8ddd-dddddddddddd");

  const mappingSelect = {
    eq: () => ({
      eq: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => {
              if (mode === "existing") {
                return { data: { id: "map-existing", internal_id: existingBooking.id }, error: null };
              }
              if (mode === "create" && insertedBookingId) {
                return { data: { id: "map-new", internal_id: insertedBookingId }, error: null };
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
        data: [{ booking_type: serviceBookingType, name: serviceName, category: serviceCategory }],
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

  const bookingSelect = {
    eq: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: existingBooking, error: null }),
      }),
    }),
  };

  const bookingUpdate = {
    eq: () => ({
      eq: async () => ({ error: null }),
    }),
  };

  const crmLeadsSelect = {
    eq: () => ({
      eq: () => ({
        order: async () => ({
          data: crmLeads.map((lead) => ({
            id: lead.id,
            status: lead.status,
            updated_at: lead.updated_at ?? "2026-06-01T00:00:00.000Z",
            created_at: "2026-01-01T00:00:00.000Z",
          })),
          error: null,
        }),
      }),
    }),
  };

  const from = (table: string) => {
    if (table === "fi_tenants") return tenantOk;
    if (table === "fi_external_entity_mappings") {
      return {
        select: () => mappingSelect,
        // Atomic claim: INSERT ... ON CONFLICT DO NOTHING RETURNING id. In "existing" mode the
        // mapping already exists → conflict → no row returned. Otherwise this worker wins the claim.
        upsert: () => ({
          select: async () => {
            if (mode === "existing" || claimed) {
              return { data: [], error: null };
            }
            claimed = true;
            return { data: [{ id: "map-new" }], error: null };
          },
        }),
        // setBookingMappingInternalId backfill.
        update: (patch: { internal_id?: string }) => ({
          eq: () => ({
            eq: async () => {
              if (patch && typeof patch.internal_id === "string") insertedBookingId = patch.internal_id;
              return { error: null };
            },
          }),
        }),
        // releaseBookingMappingClaim (failure path).
        delete: () => ({
          eq: () => ({
            eq: () => ({
              is: async () => {
                if (!insertedBookingId) claimed = false;
                return { error: null };
              },
            }),
          }),
        }),
      };
    }
    if (table === "fi_patient_source_ids") return { select: () => patientSource };
    if (table === "fi_patients") return { select: () => patientRow };
    if (table === "fi_clinics") return { select: () => clinics };
    if (table === "fi_services") return { select: () => services };
    if (table === "fi_bookings") {
      return {
        select: () => bookingSelect,
        update: () => bookingUpdate,
      };
    }
    if (table === "fi_crm_leads") return { select: () => crmLeadsSelect };
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

  function bookingRowForPayload(id: string, overrides: Partial<FiBookingRow> = {}): FiBookingRow {
    return {
      ...bookingRow(id),
      start_at: payloadBase.start_time,
      end_at: payloadBase.end_time,
      metadata: {
        source_system: "timely",
        external_appointment_id: payloadBase.external_appointment_id,
        external_patient_id: payloadBase.external_patient_id,
      },
      ...overrides,
    };
  }

  function appointmentPorts(overrides: Partial<Parameters<typeof processTimelyAppointmentWebhook>[3]> = {}) {
    const existing = bookingRowForPayload("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    return {
      loadActiveStaffForTenant: async () => [],
      createBooking: async () => existing,
      updateBooking: async () => existing,
      loadBooking: async () => existing,
      syncBookingReminders: async () => {},
      createConsultationFromBooking: async () => ({
        consultation: { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" },
        created: true,
      }),
      advanceCrmLeadOnTimelyConsultationBooking: async () => ({ action: "skipped" as const, stageSlug: null }),
      ...overrides,
    };
  }

  it("returns 404 when patient mapping missing", async () => {
    const r = await processTimelyAppointmentWebhook(
      TENANT,
      payloadBase,
      makeAppointmentMockSupabase("no_patient"),
      appointmentPorts()
    );
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 404);
    assert.match(r.message, /synced before appointment/i);
  });

  it("creates booking and returns id", async () => {
    let created = 0;
    const r = await processTimelyAppointmentWebhook(
      TENANT,
      payloadBase,
      makeAppointmentMockSupabase("create"),
      appointmentPorts({
        createBooking: async () => {
          created += 1;
          return bookingRow("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
        },
      })
    );
    assert.equal(r.ok, true);
    if (!r.ok || "duplicate" in r) return;
    assert.equal(r.booking_id, "dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    assert.equal(r.action, "created");
    assert.equal(created, 1);
  });

  it("updates existing booking when mapping already exists", async () => {
    let created = 0;
    let updated = 0;
    const rescheduled = timelyAppointmentWebhookSchema.parse({
      ...payloadBase,
      start_time: "2026-06-10T14:00:00.000Z",
      end_time: "2026-06-10T15:00:00.000Z",
      event_type: "appointment_rescheduled",
    });
    const r = await processTimelyAppointmentWebhook(
      TENANT,
      rescheduled,
      makeAppointmentMockSupabase("existing"),
      appointmentPorts({
        createBooking: async () => {
          created += 1;
          return bookingRow("new-booking");
        },
        updateBooking: async (params) => {
          updated += 1;
          assert.equal(params.startAt, "2026-06-10T14:00:00.000Z");
          assert.equal(params.endAt, "2026-06-10T15:00:00.000Z");
          return bookingRow("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
        },
      })
    );
    assert.equal(r.ok, true);
    if (!r.ok || "duplicate" in r) return;
    assert.equal(r.action, "updated");
    assert.equal(r.lifecycle_event, "appointment_rescheduled");
    assert.equal(r.booking_id, "dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    assert.equal(created, 0);
    assert.equal(updated, 1);
  });

  it("applies cancellation idempotently for existing booking", async () => {
    let updated = 0;
    const cancelled = timelyAppointmentWebhookSchema.parse({
      ...payloadBase,
      status: "Cancelled",
      event_type: "appointment_cancelled",
    });
    const r = await processTimelyAppointmentWebhook(
      TENANT,
      cancelled,
      makeAppointmentMockSupabase("existing"),
      appointmentPorts({
        createBooking: async () => bookingRow("new-booking"),
        updateBooking: async () => {
          updated += 1;
          return bookingRow("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
        },
      })
    );
    assert.equal(r.ok, true);
    if (!r.ok || "duplicate" in r) return;
    assert.equal(r.action, "updated");
    assert.equal(r.lifecycle_event, "appointment_cancelled");
    assert.equal(updated, 0);
  });

  it("returns unchanged when existing booking fields match", async () => {
    let updated = 0;
    const row = bookingRowForPayload("dddddddd-dddd-4ddd-8ddd-dddddddddddd", {
      metadata: {
        source_system: "timely",
        external_appointment_id: payloadBase.external_appointment_id,
        external_patient_id: payloadBase.external_patient_id,
        timely_lead_resolution: { status: "none", checked_at: "2026-06-01T00:00:00.000Z" },
      },
    });
    const r = await processTimelyAppointmentWebhook(
      TENANT,
      payloadBase,
      makeAppointmentMockSupabase("existing", row),
      appointmentPorts({
        loadBooking: async () => row,
        createBooking: async () => bookingRow("new-booking"),
        updateBooking: async () => {
          updated += 1;
          return row;
        },
      })
    );
    assert.equal(r.ok, true);
    if (!r.ok || "duplicate" in r) return;
    assert.equal(r.unchanged, true);
    assert.equal(updated, 0);
  });
});

describe("Timely appointment webhook — ConsultationOS workspace (Phase B)", () => {
  const CONSULTATION_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  const payloadBase = timelyAppointmentWebhookSchema.parse({
    external_appointment_id: "appt-consult-1",
    external_patient_id: "patient-ext-1",
    start_time: "2026-06-10T12:00:00.000Z",
    end_time: "2026-06-10T13:00:00.000Z",
    service_name: "Consultation",
  });

  function bookingRowForPayload(id: string, overrides: Partial<FiBookingRow> = {}): FiBookingRow {
    return {
      ...bookingRow(id),
      start_at: payloadBase.start_time,
      end_at: payloadBase.end_time,
      booking_type: "consultation",
      booking_status: "scheduled",
      metadata: {
        source_system: "timely",
        external_appointment_id: payloadBase.external_appointment_id,
        external_patient_id: payloadBase.external_patient_id,
      },
      ...overrides,
    };
  }

  function consultationPorts(overrides: Partial<Parameters<typeof processTimelyAppointmentWebhook>[3]> = {}) {
    const existing = bookingRowForPayload("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    return {
      loadActiveStaffForTenant: async () => [],
      createBooking: async () => existing,
      updateBooking: async () => existing,
      loadBooking: async () => existing,
      syncBookingReminders: async () => {},
      createConsultationFromBooking: async () => ({
        consultation: { id: CONSULTATION_ID },
        created: true,
      }),
      advanceCrmLeadOnTimelyConsultationBooking: async () => ({ action: "skipped" as const, stageSlug: null }),
      ...overrides,
    };
  }

  it("creates ConsultationOS workspace for consultation booking", async () => {
    let consultationCreates = 0;
    const row = bookingRowForPayload("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    const r = await processTimelyAppointmentWebhook(
      TENANT,
      payloadBase,
      makeAppointmentMockSupabase("create"),
      consultationPorts({
        createBooking: async () => row,
        loadBooking: async () => row,
        createConsultationFromBooking: async () => {
          consultationCreates += 1;
          return { consultation: { id: CONSULTATION_ID }, created: true };
        },
      })
    );
    assert.equal(r.ok, true);
    if (!r.ok || "duplicate" in r) return;
    assert.equal(r.consultation_id, CONSULTATION_ID);
    assert.equal(r.consultation_action, "created");
    assert.equal(consultationCreates, 1);
  });

  it("does not duplicate consultation on replay", async () => {
    let consultationCreates = 0;
    const row = bookingRowForPayload("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    const ports = consultationPorts({
      loadBooking: async () => row,
      createConsultationFromBooking: async () => {
        consultationCreates += 1;
        return consultationCreates === 1
          ? { consultation: { id: CONSULTATION_ID }, created: true }
          : { consultation: { id: CONSULTATION_ID }, created: false };
      },
    });
    const supabase = makeAppointmentMockSupabase("existing", row);
    const a = await processTimelyAppointmentWebhook(TENANT, payloadBase, supabase, ports);
    const b = await processTimelyAppointmentWebhook(TENANT, payloadBase, supabase, ports);
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    if (!a.ok || !b.ok || "duplicate" in a || "duplicate" in b) return;
    assert.equal(a.consultation_action, "created");
    assert.equal(b.consultation_action, "existing");
    assert.equal(a.consultation_id, CONSULTATION_ID);
    assert.equal(b.consultation_id, CONSULTATION_ID);
    assert.equal(consultationCreates, 2);
  });

  it("creates missing consultation when updated consultation booking has none", async () => {
    let consultationCreates = 0;
    const row = bookingRowForPayload("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    const rescheduled = timelyAppointmentWebhookSchema.parse({
      ...payloadBase,
      start_time: "2026-06-10T14:00:00.000Z",
      end_time: "2026-06-10T15:00:00.000Z",
      event_type: "appointment_rescheduled",
    });
    const r = await processTimelyAppointmentWebhook(
      TENANT,
      rescheduled,
      makeAppointmentMockSupabase("existing", row),
      consultationPorts({
        loadBooking: async () => row,
        updateBooking: async () => ({
          ...row,
          start_at: rescheduled.start_time,
          end_at: rescheduled.end_time,
        }),
        createConsultationFromBooking: async () => {
          consultationCreates += 1;
          return { consultation: { id: CONSULTATION_ID }, created: true };
        },
      })
    );
    assert.equal(r.ok, true);
    if (!r.ok || "duplicate" in r) return;
    assert.equal(r.action, "updated");
    assert.equal(r.consultation_id, CONSULTATION_ID);
    assert.equal(r.consultation_action, "created");
    assert.equal(consultationCreates, 1);
  });

  it("skips consultation workspace for cancelled consultation booking", async () => {
    let consultationCreates = 0;
    const row = bookingRowForPayload("dddddddd-dddd-4ddd-8ddd-dddddddddddd", {
      booking_status: "cancelled",
      cancelled_at: "2026-06-09T10:00:00.000Z",
    });
    const cancelled = timelyAppointmentWebhookSchema.parse({
      ...payloadBase,
      status: "Cancelled",
      event_type: "appointment_cancelled",
    });
    const r = await processTimelyAppointmentWebhook(
      TENANT,
      cancelled,
      makeAppointmentMockSupabase("existing", row),
      consultationPorts({
        loadBooking: async () => row,
        createConsultationFromBooking: async () => {
          consultationCreates += 1;
          return { consultation: { id: CONSULTATION_ID }, created: true };
        },
      })
    );
    assert.equal(r.ok, true);
    if (!r.ok || "duplicate" in r) return;
    assert.equal(r.consultation_id, null);
    assert.equal(r.consultation_action, "skipped");
    assert.equal(consultationCreates, 0);
  });

  it("skips consultation workspace for no_show consultation booking", async () => {
    let consultationCreates = 0;
    const row = bookingRowForPayload("dddddddd-dddd-4ddd-8ddd-dddddddddddd", {
      booking_status: "no_show",
    });
    const noShow = timelyAppointmentWebhookSchema.parse({
      ...payloadBase,
      status: "No Show",
      event_type: "appointment_no_show",
    });
    const r = await processTimelyAppointmentWebhook(
      TENANT,
      noShow,
      makeAppointmentMockSupabase("existing", row),
      consultationPorts({
        loadBooking: async () => row,
        createConsultationFromBooking: async () => {
          consultationCreates += 1;
          return { consultation: { id: CONSULTATION_ID }, created: true };
        },
      })
    );
    assert.equal(r.ok, true);
    if (!r.ok || "duplicate" in r) return;
    assert.equal(r.consultation_id, null);
    assert.equal(r.consultation_action, "skipped");
    assert.equal(consultationCreates, 0);
  });

  it("skips consultation workspace for non-consultation booking", async () => {
    let consultationCreates = 0;
    const row = bookingRowForPayload("dddddddd-dddd-4ddd-8ddd-dddddddddddd", {
      booking_type: "prp",
    });
    const r = await processTimelyAppointmentWebhook(
      TENANT,
      payloadBase,
      makeAppointmentMockSupabase("create", row, { serviceBookingType: "prp" }),
      consultationPorts({
        createBooking: async () => row,
        loadBooking: async () => row,
        createConsultationFromBooking: async () => {
          consultationCreates += 1;
          return { consultation: { id: CONSULTATION_ID }, created: true };
        },
      })
    );
    assert.equal(r.ok, true);
    if (!r.ok || "duplicate" in r) return;
    assert.equal(r.consultation_id, null);
    assert.equal(r.consultation_action, "skipped");
    assert.equal(consultationCreates, 0);
  });
});

describe("Timely appointment webhook — booking_type derivation from service", () => {
  const CONSULTATION_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

  const hairTransplantPayload = timelyAppointmentWebhookSchema.parse({
    external_appointment_id: "test_appt_real_001",
    external_patient_id: "patient-ext-1",
    service_name: "Hair Transplant Consultation",
    staff_name: "Dr Test",
    start_time: "2026-06-18T09:00:00Z",
    end_time: "2026-06-18T09:30:00Z",
    status: "booked",
  });

  function portsForBookingTypeCapture(expectedBookingType: string) {
    let capturedBookingType: string | null = null;
    const row = {
      ...bookingRow("dddddddd-dddd-4ddd-8ddd-dddddddddddd"),
      start_at: hairTransplantPayload.start_time,
      end_at: hairTransplantPayload.end_time,
      booking_type: expectedBookingType,
      booking_status: "scheduled",
      metadata: {
        source_system: "timely",
        external_appointment_id: hairTransplantPayload.external_appointment_id,
        external_patient_id: hairTransplantPayload.external_patient_id,
        service_name: hairTransplantPayload.service_name,
      },
    };

    return {
      capturedBookingType: () => capturedBookingType,
      ports: {
        loadActiveStaffForTenant: async () => [],
        createBooking: async (params: { bookingType: string }) => {
          capturedBookingType = params.bookingType;
          return row;
        },
        updateBooking: async () => row,
        loadBooking: async () => row,
        syncBookingReminders: async () => {},
        createConsultationFromBooking: async () => ({
          consultation: { id: CONSULTATION_ID },
          created: true,
        }),
        advanceCrmLeadOnTimelyConsultationBooking: async () => ({ action: "skipped" as const, stageSlug: null }),
      },
    };
  }

  it("derives hair_transplant_consultation when fi_services.booking_type is null", async () => {
    const { capturedBookingType, ports } = portsForBookingTypeCapture("hair_transplant_consultation");
    const r = await processTimelyAppointmentWebhook(
      TENANT,
      hairTransplantPayload,
      makeAppointmentMockSupabase("create", undefined, {
        serviceBookingType: null,
        serviceName: "Hair Transplant Consultation",
        serviceCategory: "Consultation",
      }),
      ports
    );
    assert.equal(r.ok, true);
    if (!r.ok || "duplicate" in r) return;
    assert.equal(capturedBookingType(), "hair_transplant_consultation");
    assert.equal(r.consultation_id, CONSULTATION_ID);
    assert.equal(r.consultation_action, "created");
  });

  it("prefers explicit fi_services.booking_type over name derivation", async () => {
    const { capturedBookingType, ports } = portsForBookingTypeCapture("consultation");
    const r = await processTimelyAppointmentWebhook(
      TENANT,
      hairTransplantPayload,
      makeAppointmentMockSupabase("create", undefined, {
        serviceBookingType: "consultation",
        serviceName: "Hair Transplant Consultation",
        serviceCategory: "Consultation",
      }),
      ports
    );
    assert.equal(r.ok, true);
    if (!r.ok || "duplicate" in r) return;
    assert.equal(capturedBookingType(), "consultation");
  });

  it("returns 422 when service exists but booking_type cannot be derived", async () => {
    const payload = timelyAppointmentWebhookSchema.parse({
      ...hairTransplantPayload,
      service_name: "Mystery Treatment",
    });
    const r = await processTimelyAppointmentWebhook(
      TENANT,
      payload,
      makeAppointmentMockSupabase("create", undefined, {
        serviceBookingType: null,
        serviceName: "Mystery Treatment",
        serviceCategory: "Treatment",
      }),
      portsForBookingTypeCapture("prp").ports
    );
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 422);
    assert.match(r.message, /Cannot derive booking_type/);
  });
});

describe("resolveTimelyBookingLead", () => {
  function crmSupabase(leads: { id: string; status: string }[]): SupabaseClient {
    return makeAppointmentMockSupabase("create", undefined, { crmLeads: leads });
  }

  it("returns matched for a single active lead", async () => {
    const r = await resolveTimelyBookingLead(crmSupabase([{ id: LEAD_ID, status: "open" }]), {
      tenant_id: TENANT,
      patient_id: PATIENT_ID,
      person_id: PERSON_ID,
    });
    assert.equal(r.lead_id, LEAD_ID);
    assert.equal(r.timely_lead_resolution.status, "matched");
    assert.match(r.timely_lead_resolution.checked_at, /^\d{4}-\d{2}-\d{2}T/);
  });

  it("returns none when no active CRM lead exists", async () => {
    const r = await resolveTimelyBookingLead(crmSupabase([]), {
      tenant_id: TENANT,
      patient_id: PATIENT_ID,
      person_id: PERSON_ID,
    });
    assert.equal(r.lead_id, null);
    assert.equal(r.timely_lead_resolution.status, "none");
  });

  it("returns ambiguous when multiple active CRM leads exist", async () => {
    const r = await resolveTimelyBookingLead(
      crmSupabase([
        { id: LEAD_ID, status: "open" },
        { id: LEAD_ID_2, status: "open" },
      ]),
      {
        tenant_id: TENANT,
        patient_id: PATIENT_ID,
        person_id: PERSON_ID,
      }
    );
    assert.equal(r.lead_id, null);
    assert.equal(r.timely_lead_resolution.status, "ambiguous");
  });

  it("ignores terminal CRM lead statuses", async () => {
    const r = await resolveTimelyBookingLead(
      crmSupabase([
        { id: LEAD_ID, status: "converted" },
        { id: LEAD_ID_2, status: "lost" },
      ]),
      {
        tenant_id: TENANT,
        patient_id: PATIENT_ID,
        person_id: PERSON_ID,
      }
    );
    assert.equal(r.lead_id, null);
    assert.equal(r.timely_lead_resolution.status, "none");
  });
});

describe("Timely appointment webhook — CRM lead resolution (Phase C)", () => {
  const payloadBase = timelyAppointmentWebhookSchema.parse({
    external_appointment_id: "appt-lead-1",
    external_patient_id: "patient-ext-1",
    start_time: "2026-06-10T12:00:00.000Z",
    end_time: "2026-06-10T13:00:00.000Z",
    service_name: "Consultation",
  });

  function bookingRowForPayload(id: string, overrides: Partial<FiBookingRow> = {}): FiBookingRow {
    return {
      ...bookingRow(id),
      start_at: payloadBase.start_time,
      end_at: payloadBase.end_time,
      person_id: PERSON_ID,
      patient_id: PATIENT_ID,
      metadata: {
        source_system: "timely",
        external_appointment_id: payloadBase.external_appointment_id,
        external_patient_id: payloadBase.external_patient_id,
      },
      ...overrides,
    };
  }

  function leadPorts(overrides: Partial<Parameters<typeof processTimelyAppointmentWebhook>[3]> = {}) {
    const existing = bookingRowForPayload("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    return {
      loadActiveStaffForTenant: async () => [],
      createBooking: async () => existing,
      updateBooking: async () => existing,
      loadBooking: async () => existing,
      syncBookingReminders: async () => {},
      createConsultationFromBooking: async () => ({
        consultation: { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" },
        created: true,
      }),
      advanceCrmLeadOnTimelyConsultationBooking: async () => ({ action: "skipped" as const, stageSlug: null }),
      ...overrides,
    };
  }

  it("links booking to a single active CRM lead on create", async () => {
    let capturedLeadId: string | null | undefined;
    let capturedMetadata: Record<string, unknown> | undefined;
    const row = bookingRowForPayload("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    const r = await processTimelyAppointmentWebhook(
      TENANT,
      payloadBase,
      makeAppointmentMockSupabase("create", row, {
        crmLeads: [{ id: LEAD_ID, status: "open" }],
      }),
      leadPorts({
        createBooking: async (params) => {
          capturedLeadId = params.leadId;
          capturedMetadata = params.metadata ?? undefined;
          return { ...row, lead_id: params.leadId ?? null, metadata: params.metadata ?? {} };
        },
        loadBooking: async () => row,
      })
    );
    assert.equal(r.ok, true);
    if (!r.ok || "duplicate" in r) return;
    assert.equal(r.lead_id, LEAD_ID);
    assert.equal(r.lead_resolution, "matched");
    assert.equal(capturedLeadId, LEAD_ID);
    assert.equal((capturedMetadata?.timely_lead_resolution as { status?: string })?.status, "matched");
  });

  it("does not overwrite an existing booking lead_id on update", async () => {
    const existingLead = "88888888-8888-4888-8888-888888888888";
    const row = bookingRowForPayload("dddddddd-dddd-4ddd-8ddd-dddddddddddd", { lead_id: existingLead });
    let updatedLeadId: string | null | undefined = "unset";
    const r = await processTimelyAppointmentWebhook(
      TENANT,
      payloadBase,
      makeAppointmentMockSupabase("existing", row, {
        crmLeads: [{ id: LEAD_ID, status: "open" }],
      }),
      leadPorts({
        loadBooking: async () => row,
        updateBooking: async (params) => {
          updatedLeadId = params.leadId;
          return row;
        },
      })
    );
    assert.equal(r.ok, true);
    if (!r.ok || "duplicate" in r) return;
    assert.equal(r.lead_id, existingLead);
    assert.equal(r.lead_resolution, "skipped");
    assert.equal(updatedLeadId, "unset");
  });

  it("returns ambiguous when multiple active CRM leads exist", async () => {
    let capturedLeadId: string | null | undefined = "unset";
    const row = bookingRowForPayload("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    const r = await processTimelyAppointmentWebhook(
      TENANT,
      payloadBase,
      makeAppointmentMockSupabase("create", row, {
        crmLeads: [
          { id: LEAD_ID, status: "open" },
          { id: LEAD_ID_2, status: "open" },
        ],
      }),
      leadPorts({
        createBooking: async (params) => {
          capturedLeadId = params.leadId;
          return { ...row, metadata: params.metadata ?? {} };
        },
        loadBooking: async () => row,
      })
    );
    assert.equal(r.ok, true);
    if (!r.ok || "duplicate" in r) return;
    assert.equal(r.lead_id, null);
    assert.equal(r.lead_resolution, "ambiguous");
    assert.equal(capturedLeadId, null);
  });

  it("returns none when no CRM lead exists", async () => {
    const row = bookingRowForPayload("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    const r = await processTimelyAppointmentWebhook(
      TENANT,
      payloadBase,
      makeAppointmentMockSupabase("create", row, { crmLeads: [] }),
      leadPorts({
        createBooking: async (params) => ({ ...row, metadata: params.metadata ?? {} }),
        loadBooking: async () => row,
      })
    );
    assert.equal(r.ok, true);
    if (!r.ok || "duplicate" in r) return;
    assert.equal(r.lead_id, null);
    assert.equal(r.lead_resolution, "none");
  });

  it("attaches missing lead_id on update path", async () => {
    const row = bookingRowForPayload("dddddddd-dddd-4ddd-8ddd-dddddddddddd", { lead_id: null });
    let patchedLeadId: string | null | undefined;
    let patchedMetadata: Record<string, unknown> | undefined;
    const supabase = makeAppointmentMockSupabase("existing", row, {
      crmLeads: [{ id: LEAD_ID, status: "open" }],
    });
    const originalFrom = supabase.from.bind(supabase);
    supabase.from = ((table: string) => {
      if (table !== "fi_bookings") return originalFrom(table);
      return {
        select: () => originalFrom("fi_bookings").select(),
        update: (patch: Record<string, unknown>) => ({
          eq: () => ({
            eq: async () => {
              if (patch.lead_id !== undefined) patchedLeadId = patch.lead_id as string | null;
              if (patch.metadata !== undefined) patchedMetadata = patch.metadata as Record<string, unknown>;
              return { error: null };
            },
          }),
        }),
      };
    }) as typeof supabase.from;

    const r = await processTimelyAppointmentWebhook(
      TENANT,
      payloadBase,
      supabase,
      leadPorts({ loadBooking: async () => row })
    );
    assert.equal(r.ok, true);
    if (!r.ok || "duplicate" in r) return;
    assert.equal(r.lead_id, LEAD_ID);
    assert.equal(r.lead_resolution, "matched");
    assert.equal(patchedLeadId, LEAD_ID);
    assert.equal((patchedMetadata?.timely_lead_resolution as { status?: string })?.status, "matched");
  });

  it("skips lead resolution safely when person is missing", async () => {
    const row = bookingRowForPayload("dddddddd-dddd-4ddd-8ddd-dddddddddddd", {
      person_id: null,
      patient_id: null,
    });
    const r = await processTimelyAppointmentWebhook(
      TENANT,
      payloadBase,
      makeAppointmentMockSupabase("existing", row, {
        crmLeads: [{ id: LEAD_ID, status: "open" }],
      }),
      leadPorts({ loadBooking: async () => row })
    );
    assert.equal(r.ok, true);
    if (!r.ok || "duplicate" in r) return;
    assert.equal(r.lead_id, null);
    assert.equal(r.lead_resolution, "skipped");
  });
});

describe("Timely appointment webhook — CRM stage advance (Phase D)", () => {
  const payloadBase = timelyAppointmentWebhookSchema.parse({
    external_appointment_id: "appt-crm-stage-1",
    external_patient_id: "patient-ext-1",
    start_time: "2026-06-10T12:00:00.000Z",
    end_time: "2026-06-10T13:00:00.000Z",
    service_name: "Consultation",
  });

  function bookingRowForPayload(id: string, overrides: Partial<FiBookingRow> = {}): FiBookingRow {
    return {
      ...bookingRow(id),
      start_at: payloadBase.start_time,
      end_at: payloadBase.end_time,
      person_id: PERSON_ID,
      patient_id: PATIENT_ID,
      lead_id: LEAD_ID,
      booking_type: "consultation",
      booking_status: "scheduled",
      metadata: {
        source_system: "timely",
        external_appointment_id: payloadBase.external_appointment_id,
        external_patient_id: payloadBase.external_patient_id,
      },
      ...overrides,
    };
  }

  function crmStagePorts(overrides: Partial<Parameters<typeof processTimelyAppointmentWebhook>[3]> = {}) {
    const row = bookingRowForPayload("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    return {
      loadActiveStaffForTenant: async () => [],
      createBooking: async () => row,
      updateBooking: async () => row,
      loadBooking: async () => row,
      syncBookingReminders: async () => {},
      createConsultationFromBooking: async () => ({
        consultation: { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" },
        created: true,
      }),
      advanceCrmLeadOnTimelyConsultationBooking: async () => ({
        action: "advanced" as const,
        stageSlug: "consult_scheduled",
      }),
      ...overrides,
    };
  }

  it("moves linked lead to consult_scheduled on consultation booking", async () => {
    let crmCalls = 0;
    const row = bookingRowForPayload("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    const r = await processTimelyAppointmentWebhook(
      TENANT,
      payloadBase,
      makeAppointmentMockSupabase("create", row, { crmLeads: [{ id: LEAD_ID, status: "open" }] }),
      crmStagePorts({
        createBooking: async (params) => {
          return { ...row, lead_id: params.leadId ?? LEAD_ID };
        },
        loadBooking: async () => ({ ...row, lead_id: LEAD_ID }),
        advanceCrmLeadOnTimelyConsultationBooking: async (input) => {
          crmCalls += 1;
          assert.equal(input.leadId, LEAD_ID);
          assert.equal(input.booking.booking_type, "consultation");
          return { action: "advanced", stageSlug: "consult_scheduled" };
        },
      })
    );
    assert.equal(r.ok, true);
    if (!r.ok || "duplicate" in r) return;
    assert.equal(r.crm_stage_action, "advanced");
    assert.equal(r.crm_stage_slug, "consult_scheduled");
    assert.equal(crmCalls, 1);
  });

  it("replay does not duplicate CRM stage history (unchanged on second call)", async () => {
    let crmCalls = 0;
    const row = bookingRowForPayload("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    const ports = crmStagePorts({
      loadBooking: async () => row,
      advanceCrmLeadOnTimelyConsultationBooking: async () => {
        crmCalls += 1;
        return crmCalls === 1
          ? { action: "advanced", stageSlug: "consult_scheduled" }
          : { action: "unchanged", stageSlug: "consult_scheduled" };
      },
    });
    const supabase = makeAppointmentMockSupabase("existing", row);
    const a = await processTimelyAppointmentWebhook(TENANT, payloadBase, supabase, ports);
    const b = await processTimelyAppointmentWebhook(TENANT, payloadBase, supabase, ports);
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    if (!a.ok || !b.ok || "duplicate" in a || "duplicate" in b) return;
    assert.equal(a.crm_stage_action, "advanced");
    assert.equal(b.crm_stage_action, "unchanged");
    assert.equal(crmCalls, 2);
  });

  it("skips CRM stage advance for non-consultation booking", async () => {
    let crmCalls = 0;
    const row = bookingRowForPayload("dddddddd-dddd-4ddd-8ddd-dddddddddddd", { booking_type: "prp" });
    const r = await processTimelyAppointmentWebhook(
      TENANT,
      payloadBase,
      makeAppointmentMockSupabase("create", row, { serviceBookingType: "prp" }),
      crmStagePorts({
        loadBooking: async () => row,
        createBooking: async () => row,
        advanceCrmLeadOnTimelyConsultationBooking: async () => {
          crmCalls += 1;
          return { action: "skipped", stageSlug: null };
        },
      })
    );
    assert.equal(r.ok, true);
    if (!r.ok || "duplicate" in r) return;
    assert.equal(r.crm_stage_action, "skipped");
    assert.equal(r.crm_stage_slug, null);
    assert.equal(crmCalls, 1);
  });

  it("skips CRM stage advance for cancelled consultation booking", async () => {
    const row = bookingRowForPayload("dddddddd-dddd-4ddd-8ddd-dddddddddddd", {
      booking_status: "cancelled",
      cancelled_at: "2026-06-09T10:00:00.000Z",
    });
    const cancelled = timelyAppointmentWebhookSchema.parse({
      ...payloadBase,
      status: "Cancelled",
      event_type: "appointment_cancelled",
    });
    const r = await processTimelyAppointmentWebhook(
      TENANT,
      cancelled,
      makeAppointmentMockSupabase("existing", row),
      crmStagePorts({
        loadBooking: async () => row,
        advanceCrmLeadOnTimelyConsultationBooking: async () => ({ action: "skipped", stageSlug: null }),
      })
    );
    assert.equal(r.ok, true);
    if (!r.ok || "duplicate" in r) return;
    assert.equal(r.crm_stage_action, "skipped");
  });

  it("skips CRM stage advance for no_show consultation booking", async () => {
    const row = bookingRowForPayload("dddddddd-dddd-4ddd-8ddd-dddddddddddd", { booking_status: "no_show" });
    const r = await processTimelyAppointmentWebhook(
      TENANT,
      payloadBase,
      makeAppointmentMockSupabase("existing", row),
      crmStagePorts({
        loadBooking: async () => row,
        advanceCrmLeadOnTimelyConsultationBooking: async () => ({ action: "skipped", stageSlug: null }),
      })
    );
    assert.equal(r.ok, true);
    if (!r.ok || "duplicate" in r) return;
    assert.equal(r.crm_stage_action, "skipped");
  });

  it("does not downgrade when lead is already at a later stage", async () => {
    const row = bookingRowForPayload("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    const r = await processTimelyAppointmentWebhook(
      TENANT,
      payloadBase,
      makeAppointmentMockSupabase("existing", row),
      crmStagePorts({
        loadBooking: async () => row,
        advanceCrmLeadOnTimelyConsultationBooking: async () => ({
          action: "unchanged",
          stageSlug: "consult_scheduled",
        }),
      })
    );
    assert.equal(r.ok, true);
    if (!r.ok || "duplicate" in r) return;
    assert.equal(r.crm_stage_action, "unchanged");
    assert.equal(r.crm_stage_slug, "consult_scheduled");
  });
});

describe("Timely appointment webhook — P0 duplicate/parallel/retry safety", () => {
  const payloadBase = timelyAppointmentWebhookSchema.parse({
    external_appointment_id: "appt-p0-1",
    external_patient_id: "patient-ext-1",
    start_time: "2026-06-10T12:00:00.000Z",
    end_time: "2026-06-10T13:00:00.000Z",
    service_name: "Consultation",
  });

  function bookingRowForPayload(id: string, overrides: Partial<FiBookingRow> = {}): FiBookingRow {
    return {
      ...bookingRow(id),
      start_at: payloadBase.start_time,
      end_at: payloadBase.end_time,
      booking_type: "consultation",
      booking_status: "scheduled",
      metadata: {
        source_system: "timely",
        external_appointment_id: payloadBase.external_appointment_id,
        external_patient_id: payloadBase.external_patient_id,
      },
      ...overrides,
    };
  }

  function countingPorts(
    counters: { creates: number; consultations: number; crm: number },
    overrides: Partial<Parameters<typeof processTimelyAppointmentWebhook>[3]> = {}
  ) {
    const row = bookingRowForPayload("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    return {
      loadActiveStaffForTenant: async () => [],
      createBooking: async () => {
        counters.creates += 1;
        return row;
      },
      updateBooking: async () => row,
      loadBooking: async () => row,
      syncBookingReminders: async () => {},
      createConsultationFromBooking: async () => {
        counters.consultations += 1;
        return { consultation: { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" }, created: counters.consultations === 1 };
      },
      advanceCrmLeadOnTimelyConsultationBooking: async () => {
        counters.crm += 1;
        return { action: "skipped" as const, stageSlug: null };
      },
      ...overrides,
    };
  }

  it("sequential duplicate appointment_created creates exactly one booking", async () => {
    const counters = { creates: 0, consultations: 0, crm: 0 };
    const supabase = makeAppointmentMockSupabase("create", bookingRowForPayload("dddddddd-dddd-4ddd-8ddd-dddddddddddd"));
    const ports = countingPorts(counters);

    const a = await processTimelyAppointmentWebhook(TENANT, payloadBase, supabase, ports);
    const b = await processTimelyAppointmentWebhook(TENANT, payloadBase, supabase, ports);

    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.equal(counters.creates, 1, "only one booking should be created across duplicate deliveries");
    if (!a.ok || "duplicate" in a) return;
    assert.equal(a.action, "created");
  });

  it("concurrent appointment_created creates exactly one booking (no orphan)", async () => {
    const counters = { creates: 0, consultations: 0, crm: 0 };
    const supabase = makeAppointmentMockSupabase("create", bookingRowForPayload("dddddddd-dddd-4ddd-8ddd-dddddddddddd"));
    const ports = countingPorts(counters);

    const [a, b] = await Promise.all([
      processTimelyAppointmentWebhook(TENANT, payloadBase, supabase, ports),
      processTimelyAppointmentWebhook(TENANT, payloadBase, supabase, ports),
    ]);

    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.equal(counters.creates, 1, "parallel delivery must not create a second booking");
    // Exactly one delivery owns the create; the other either syncs the same booking or no-ops.
    const losers = [a, b].filter((r) => r.ok && "duplicate" in r);
    assert.ok(losers.length <= 1);
  });

  it("existing mapping with booking_id present syncs (no new booking)", async () => {
    const counters = { creates: 0, consultations: 0, crm: 0 };
    const row = bookingRowForPayload("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    const r = await processTimelyAppointmentWebhook(
      TENANT,
      payloadBase,
      makeAppointmentMockSupabase("existing", row),
      countingPorts(counters, { loadBooking: async () => row })
    );
    assert.equal(r.ok, true);
    assert.equal(counters.creates, 0);
    if (!r.ok || "duplicate" in r) return;
    assert.equal(r.action, "updated");
    assert.equal(r.booking_id, row.id);
  });

  it("claimed mapping with missing booking_id is a safe no-op (no duplicate booking)", async () => {
    // Mapping row exists but internal_id is still null → another worker is mid-create.
    const supabase = {
      from: (table: string) => {
        if (table === "fi_tenants") {
          return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: TENANT }, error: null }) }) }) };
        }
        if (table === "fi_external_entity_mappings") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      maybeSingle: async () => ({ data: { id: "map-inflight", internal_id: null }, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as unknown as SupabaseClient;

    const counters = { creates: 0, consultations: 0, crm: 0 };
    const r = await processTimelyAppointmentWebhook(TENANT, payloadBase, supabase, countingPorts(counters));
    assert.equal(r.ok, true);
    assert.equal(counters.creates, 0);
    assert.equal("duplicate" in r && r.duplicate, true);
    if (!r.ok || !("duplicate" in r)) return;
    assert.equal(r.reason, "already_processing");
    assert.equal(r.booking_id, null);
  });

  it("releases the claim when booking creation fails, allowing repair without duplicate", async () => {
    const supabase = makeAppointmentMockSupabase("create", bookingRowForPayload("dddddddd-dddd-4ddd-8ddd-dddddddddddd"));
    let attempts = 0;
    const ports = countingPorts(
      { creates: 0, consultations: 0, crm: 0 },
      {
        createBooking: async () => {
          attempts += 1;
          if (attempts === 1) throw new Error("transient booking failure");
          return bookingRowForPayload("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
        },
      }
    );

    const first = await processTimelyAppointmentWebhook(TENANT, payloadBase, supabase, ports);
    assert.equal(first.ok, false);
    if (first.ok) return;
    assert.equal(first.status, 500);

    // Retry succeeds: the released claim let this worker re-claim and create exactly one booking.
    const second = await processTimelyAppointmentWebhook(TENANT, payloadBase, supabase, ports);
    assert.equal(second.ok, true);
    assert.equal(attempts, 2);
  });
});

function makeWebhookAuditMock(opts?: { finalizeError?: boolean }) {
  type Row = { id: string; tenant_id: string; route: string; payload_hash: string; status: string };
  const rows: Row[] = [];
  let seq = 0;

  const from = (table: string) => {
    if (table !== "fi_integration_webhook_events") throw new Error(`unexpected table ${table}`);
    return {
      insert: (row: { tenant_id: string; route: string; payload_hash: string; status: string }) => ({
        select: () => ({
          single: async () => {
            const dup = rows.find(
              (r) => r.tenant_id === row.tenant_id && r.route === row.route && r.payload_hash === row.payload_hash
            );
            if (dup) return { data: null, error: { code: "23505", message: "duplicate key" } };
            const id = `evt-${++seq}`;
            rows.push({ id, tenant_id: row.tenant_id, route: row.route, payload_hash: row.payload_hash, status: row.status });
            return { data: { id }, error: null };
          },
        }),
      }),
      select: () => {
        const filters: Record<string, string> = {};
        const chain = {
          eq: (col: string, val: string) => {
            filters[col] = val;
            return chain;
          },
          order: () => chain,
          limit: () => chain,
          maybeSingle: async () => {
            const found = rows.find(
              (r) =>
                r.tenant_id === filters.tenant_id && r.route === filters.route && r.payload_hash === filters.payload_hash
            );
            return { data: found ? { id: found.id, status: found.status } : null, error: null };
          },
        };
        return chain;
      },
      update: (patch: { status?: string }) => ({
        eq: async (_col: string, val: string) => {
          if (opts?.finalizeError) return { error: { message: "finalize failed" } };
          const row = rows.find((r) => r.id === val);
          if (row && patch.status) row.status = patch.status;
          return { error: null };
        },
      }),
    };
  };
  return { client: { from } as unknown as SupabaseClient, rows };
}

describe("withTimelyWebhookAudit — P0 idempotency & retry safety", () => {
  const ROUTE = "/api/tenants/[tenantId]/integrations/timely/appointment";
  const payload = { external_appointment_id: "appt-replay-1", external_patient_id: "p1" };

  it("replay after success returns 200 duplicate without re-running the handler", async () => {
    const { client } = makeWebhookAuditMock();
    let handlerCalls = 0;
    const run = () =>
      withTimelyWebhookAudit({
        tenantId: TENANT,
        route: ROUTE,
        payload,
        supabase: client,
        handler: async () => {
          handlerCalls += 1;
          return { ok: true as const, value: { booking_id: "b1" } };
        },
      });

    const a = await run();
    const b = await run();

    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.equal(handlerCalls, 1, "handler (booking/CRM/consultation side effects) must not re-run on replay");
    assert.equal("duplicate" in b && b.duplicate, true);
  });

  it("concurrent identical delivery runs the handler once (second is a no-op)", async () => {
    const { client } = makeWebhookAuditMock();
    let handlerCalls = 0;
    const handler = async () => {
      handlerCalls += 1;
      return { ok: true as const, value: { booking_id: "b1" } };
    };
    const [a, b] = await Promise.all([
      withTimelyWebhookAudit({ tenantId: TENANT, route: ROUTE, payload, supabase: client, handler }),
      withTimelyWebhookAudit({ tenantId: TENANT, route: ROUTE, payload, supabase: client, handler }),
    ]);
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.equal(handlerCalls, 1, "parallel delivery must claim once and run side effects once");
  });

  it("audit finalization failure after a successful handler stays 200 (no retry-triggering 500)", async () => {
    const { client } = makeWebhookAuditMock({ finalizeError: true });
    let handlerCalls = 0;
    const result = await withTimelyWebhookAudit({
      tenantId: TENANT,
      route: ROUTE,
      payload,
      supabase: client,
      handler: async () => {
        handlerCalls += 1;
        return { ok: true as const, value: { booking_id: "b1" } };
      },
    });
    assert.equal(handlerCalls, 1);
    assert.equal(result.ok, true, "finalization failure must not surface as an error/500 after work committed");
  });
});
