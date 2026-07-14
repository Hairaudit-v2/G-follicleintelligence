import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { applyRosterGenerationPlan } from "@/src/lib/workforce-os/rosterGeneration.server";
import { generateRosterFromStandardHours } from "@/src/lib/workforce-os/rosterGenerationCore";
import { applyStandardHoursTemplate } from "@/src/lib/workforce-os/staffStandardHoursCore";
import {
  ROSTER_TX_OUTCOMES,
  validateRosterShiftCandidatesForReplace,
} from "@/src/lib/workforce-os/rosterTxCore";
import {
  saveStaffStandardHours,
  StaffStandardHoursSaveTransactionError,
} from "@/src/lib/workforce-os/staffStandardHours.server";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STAFF = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CLINIC = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

type StandardHoursRow = Record<string, unknown>;
type ShiftRow = Record<string, unknown>;

function createTransactionalMock(seed?: {
  failStandardHoursInsert?: boolean;
  failRosterInsert?: boolean;
  staff?: Array<{ id: string; tenant_id: string }>;
}) {
  const staff = seed?.staff ?? [{ id: STAFF, tenant_id: TENANT }];
  const clinics = [{ id: CLINIC, tenant_id: TENANT }];
  const standardHours: StandardHoursRow[] = [
    {
      id: randomUUID(),
      tenant_id: TENANT,
      staff_id: STAFF,
      weekday: 0,
      cycle_week: 1,
      status: "active",
      is_working_day: true,
      start_time: "08:00",
      end_time: "16:00",
    },
  ];
  const shifts: ShiftRow[] = [
    {
      id: "generated-shift-1",
      tenant_id: TENANT,
      staff_id: STAFF,
      shift_source: "standard_hours",
      status: "scheduled",
      starts_at: "2026-07-06T01:00:00.000Z",
      ends_at: "2026-07-06T09:00:00.000Z",
      shift_type: "clinic_day",
    },
    {
      id: "manual-shift-1",
      tenant_id: TENANT,
      staff_id: STAFF,
      shift_source: "manual",
      status: "scheduled",
      starts_at: "2026-07-07T01:00:00.000Z",
      ends_at: "2026-07-07T09:00:00.000Z",
      shift_type: "clinic_day",
    },
  ];
  const workingHoursByStaff = new Map<string, Record<string, unknown>>();

  const client = {
    from(table: string) {
      if (table === "fi_staff") {
        return {
          select() {
            return {
              eq(col: string, val: string) {
                const filters = [{ col, val }];
                const chain = {
                  eq(col2: string, val2: string) {
                    filters.push({ col: col2, val: val2 });
                    return chain;
                  },
                  maybeSingle: async () => ({
                    data:
                      staff.find((s) =>
                        filters.every(
                          (f) => String((s as Record<string, unknown>)[f.col]) === f.val
                        )
                      ) ?? null,
                    error: null,
                  }),
                };
                return chain;
              },
            };
          },
          update(patch: Record<string, unknown>) {
            return {
              eq(col: string, val: string) {
                const filters = [{ col, val }];
                const chain = {
                  eq(col2: string, val2: string) {
                    filters.push({ col: col2, val: val2 });
                    return chain;
                  },
                  async then(resolve: (v: { error: null }) => void) {
                    const row = staff.find((s) =>
                      filters.every((f) => String((s as Record<string, unknown>)[f.col]) === f.val)
                    );
                    if (row) workingHoursByStaff.set(row.id, patch);
                    resolve({ error: null });
                  },
                };
                return chain;
              },
            };
          },
        };
      }

      if (table === "fi_clinics") {
        return {
          select() {
            return {
              eq(col: string, val: string) {
                const filters = [{ col, val }];
                const chain = {
                  eq(col2: string, val2: string) {
                    filters.push({ col: col2, val: val2 });
                    return chain;
                  },
                  maybeSingle: async () => ({
                    data:
                      clinics.find((c) =>
                        filters.every(
                          (f) => String((c as Record<string, unknown>)[f.col]) === f.val
                        )
                      ) ?? null,
                    error: null,
                  }),
                };
                return chain;
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
    async rpc(
      fn: string,
      args: Record<string, unknown>
    ): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> {
      if (fn === "fi_replace_staff_standard_hours") {
        if (seed?.failStandardHoursInsert) {
          return { data: null, error: { message: "insert failed" } };
        }
        for (const row of standardHours) {
          if (
            row.tenant_id === args.p_tenant_id &&
            row.staff_id === args.p_staff_id &&
            row.status === "active"
          ) {
            row.status = "archived";
          }
        }
        const rows = (args.p_rows as Record<string, unknown>[]) ?? [];
        for (const row of rows) {
          standardHours.push({
            ...row,
            id: randomUUID(),
            tenant_id: args.p_tenant_id,
            staff_id: args.p_staff_id,
            status: "active",
            effective_from: args.p_effective_from,
          });
        }
        return {
          data: {
            ok: true,
            archived_count: 1,
            inserted_count: rows.length,
          },
          error: null,
        };
      }

      if (fn === "fi_replace_generated_roster_shifts") {
        if (seed?.failRosterInsert) {
          return { data: null, error: { message: "roster insert failed" } };
        }
        const cancelIds = (args.p_shift_ids_to_cancel as string[]) ?? [];
        for (const shift of shifts) {
          if (cancelIds.includes(String(shift.id)) && shift.shift_source === "standard_hours") {
            shift.status = "cancelled";
          }
        }
        const newRows = (args.p_new_shifts as Record<string, unknown>[]) ?? [];
        for (const row of newRows) {
          shifts.push({
            ...row,
            id: randomUUID(),
            tenant_id: args.p_tenant_id,
            status: "scheduled",
          });
        }
        return {
          data: {
            ok: true,
            cancelled_count: cancelIds.length,
            inserted_count: newRows.length,
          },
          error: null,
        };
      }

      return { data: null, error: { message: `unknown rpc ${fn}` } };
    },
  } as unknown as SupabaseClient;

  return { client, standardHours, shifts, workingHoursByStaff };
}

describe("standard hours transaction safety", () => {
  it("insert failure leaves previous active rows intact", async () => {
    const { client, standardHours } = createTransactionalMock({ failStandardHoursInsert: true });
    const activeBefore = standardHours.filter((r) => r.status === "active").length;

    await assert.rejects(
      () =>
        saveStaffStandardHours(
          { tenantId: TENANT, staffId: STAFF, days: applyStandardHoursTemplate("four_ten") },
          { supabaseClientForTests: client }
        ),
      (e: unknown) => {
        assert.ok(e instanceof StaffStandardHoursSaveTransactionError);
        return true;
      }
    );

    assert.equal(standardHours.filter((r) => r.status === "active").length, activeBefore);
  });

  it("successful save archives old rows and inserts new active rows", async () => {
    const { client, standardHours } = createTransactionalMock();
    const result = await saveStaffStandardHours(
      { tenantId: TENANT, staffId: STAFF, days: applyStandardHoursTemplate("four_ten") },
      { supabaseClientForTests: client }
    );

    assert.equal(result.outcome, ROSTER_TX_OUTCOMES.STANDARD_HOURS_SAVED);
    assert.equal(standardHours.filter((r) => r.status === "archived").length, 1);
    assert.equal(standardHours.filter((r) => r.status === "active").length, 7);
  });
});

describe("roster replace transaction safety", () => {
  const days = applyStandardHoursTemplate("five_eight");
  const existingShifts = [
    {
      id: "generated-shift-1",
      staff_id: STAFF,
      starts_at: "2026-07-06T01:00:00.000Z",
      ends_at: "2026-07-06T09:00:00.000Z",
      shift_source: "standard_hours" as const,
      status: "scheduled",
    },
    {
      id: "manual-shift-1",
      staff_id: STAFF,
      starts_at: "2026-07-07T01:00:00.000Z",
      ends_at: "2026-07-07T09:00:00.000Z",
      shift_source: "manual" as const,
      status: "scheduled",
    },
  ];

  it("candidate validation failure leaves existing generated shifts intact", async () => {
    const { client, shifts } = createTransactionalMock();
    const plan = generateRosterFromStandardHours({
      tenantId: TENANT,
      staffIds: [STAFF],
      standardHoursByStaff: new Map([[STAFF, days]]),
      staffTimezoneById: new Map([[STAFF, "Australia/Perth"]]),
      rangeStartIso: "2026-07-06T00:00:00.000Z",
      rangeEndIso: "2026-07-13T00:00:00.000Z",
      existingShifts,
      availabilityBlocks: [],
      overwriteGeneratedOnly: true,
    });
    const invalidPlan = {
      ...plan,
      shiftIdsToReplace: ["manual-shift-1"],
    };

    const result = await applyRosterGenerationPlan({
      tenantId: TENANT,
      staffIds: [STAFF],
      rangeStartIso: "2026-07-06T00:00:00.000Z",
      rangeEndIso: "2026-07-13T00:00:00.000Z",
      plan: invalidPlan,
      existingShifts,
      client,
    });

    assert.equal(result.outcome, ROSTER_TX_OUTCOMES.ROSTER_REPLACE_FAILED_NO_CHANGES);
    assert.equal(shifts.find((s) => s.id === "generated-shift-1")?.status, "scheduled");
  });

  it("insert failure leaves existing generated shifts intact", async () => {
    const { client, shifts } = createTransactionalMock({ failRosterInsert: true });
    const plan = generateRosterFromStandardHours({
      tenantId: TENANT,
      staffIds: [STAFF],
      standardHoursByStaff: new Map([[STAFF, days]]),
      staffTimezoneById: new Map([[STAFF, "Australia/Perth"]]),
      rangeStartIso: "2026-07-06T00:00:00.000Z",
      rangeEndIso: "2026-07-13T00:00:00.000Z",
      existingShifts,
      availabilityBlocks: [],
      overwriteGeneratedOnly: true,
    });

    const result = await applyRosterGenerationPlan({
      tenantId: TENANT,
      staffIds: [STAFF],
      rangeStartIso: "2026-07-06T00:00:00.000Z",
      rangeEndIso: "2026-07-13T00:00:00.000Z",
      plan,
      existingShifts,
      client,
    });

    assert.equal(result.outcome, ROSTER_TX_OUTCOMES.ROSTER_REPLACE_FAILED_NO_CHANGES);
    assert.equal(shifts.find((s) => s.id === "generated-shift-1")?.status, "scheduled");
    assert.equal(shifts.filter((s) => s.status === "cancelled").length, 0);
  });

  it("successful replace cancels only eligible generated shifts", async () => {
    const { client, shifts } = createTransactionalMock();
    const plan = generateRosterFromStandardHours({
      tenantId: TENANT,
      staffIds: [STAFF],
      standardHoursByStaff: new Map([[STAFF, days]]),
      staffTimezoneById: new Map([[STAFF, "Australia/Perth"]]),
      rangeStartIso: "2026-07-06T00:00:00.000Z",
      rangeEndIso: "2026-07-13T00:00:00.000Z",
      existingShifts,
      availabilityBlocks: [],
      overwriteGeneratedOnly: true,
    });

    const result = await applyRosterGenerationPlan({
      tenantId: TENANT,
      staffIds: [STAFF],
      rangeStartIso: "2026-07-06T00:00:00.000Z",
      rangeEndIso: "2026-07-13T00:00:00.000Z",
      plan,
      existingShifts,
      client,
    });

    assert.equal(result.outcome, ROSTER_TX_OUTCOMES.ROSTER_REPLACE_COMMITTED);
    assert.equal(shifts.find((s) => s.id === "generated-shift-1")?.status, "cancelled");
    assert.equal(shifts.find((s) => s.id === "manual-shift-1")?.status, "scheduled");
    assert.ok(shifts.filter((s) => s.status === "scheduled").length > 1);
  });
});

describe("validateRosterShiftCandidatesForReplace", () => {
  it("rejects replacing manual shifts", () => {
    const result = validateRosterShiftCandidatesForReplace({
      tenantId: TENANT,
      staffIds: [STAFF],
      rangeStartIso: "2026-07-06T00:00:00.000Z",
      rangeEndIso: "2026-07-13T00:00:00.000Z",
      candidates: [],
      shiftIdsToReplace: ["manual-shift-1"],
      existingShifts: [
        {
          id: "manual-shift-1",
          staff_id: STAFF,
          starts_at: "2026-07-07T01:00:00.000Z",
          ends_at: "2026-07-07T09:00:00.000Z",
          shift_source: "manual",
        },
      ],
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => /eligible generated/i.test(e)));
  });
});
