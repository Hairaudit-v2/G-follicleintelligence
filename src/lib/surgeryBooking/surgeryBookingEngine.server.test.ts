import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { SurgeryBookingConfirmBody } from "./surgeryBookingTypes";

const TENANT = "11111111-1111-4111-8111-111111111111";
const OTHER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PATIENT = "22222222-2222-4222-8222-222222222222";
const CLINIC = "44444444-4444-4444-8444-444444444444";
const ROOM = "55555555-5555-4555-8555-555555555555";
const STAFF = "66666666-6666-4666-8666-666666666666";

function buildBody(): SurgeryBookingConfirmBody {
  return {
    patientId: PATIENT,
    personId: null,
    caseId: null,
    leadId: null,
    clinicId: CLINIC,
    consultationId: null,
    crmQuoteId: null,
    procedureType: "FUE hair transplant",
    graftEstimate: "3000",
    surgeonStaffId: STAFF,
    startAt: "2026-08-01T01:00:00.000Z",
    endAt: "2026-08-01T09:00:00.000Z",
    timezone: "Australia/Perth",
    roomId: ROOM,
    bookingStatus: "scheduled",
    createDepositRequest: false,
    entrySource: "regression_test",
  };
}

function createMockSupabase(patientTenantId: string): SupabaseClient {
  return {
    from(table: string) {
      const filters: Record<string, string> = {};
      const chain = {
        select: () => chain,
        eq: (col: string, val: string) => {
          filters[col] = val;
          return chain;
        },
        is: () => chain,
        maybeSingle: async () => {
          if (table === "fi_patients") {
            if (filters.tenant_id === TENANT && filters.id === PATIENT) {
              return { data: { id: PATIENT, tenant_id: patientTenantId }, error: null };
            }
            return { data: null, error: null };
          }
          if (table === "fi_staff" && filters.id === STAFF) {
            return { data: { id: STAFF, fi_user_id: null }, error: null };
          }
          if (["fi_clinics", "fi_clinic_rooms"].includes(table)) {
            return filters.tenant_id === TENANT
              ? { data: { id: filters.id, tenant_id: TENANT }, error: null }
              : { data: null, error: null };
          }
          return { data: null, error: null };
        },
      };
      return chain;
    },
  } as unknown as SupabaseClient;
}

describe("confirmSurgeryBooking tenant safety", () => {
  it("rejects cross-tenant patient anchor before writes", async () => {
    const { confirmSurgeryBooking } = await import("./surgeryBookingEngine.server");
    await assert.rejects(
      () =>
        confirmSurgeryBooking({
          tenantId: TENANT,
          body: buildBody(),
          createdByFiUserId: null,
          client: createMockSupabase(OTHER),
        }),
      (err: Error) => {
        assert.match(err.message, /does not belong to this tenant/);
        return true;
      }
    );
  });
});