import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  canClearGeneratedShift,
  canHardDeleteGeneratedDraftShift,
  isGeneratedShiftSource,
  ROSTER_SHIFT_AUDIT_ACTION_TYPES,
} from "@/src/lib/workforce-os/rosterManualAdjustmentsCore";
import { insertRosterShiftAuditEvent } from "@/src/lib/workforce-os/rosterShiftAudit.server";
import {
  clearGeneratedRosterShiftsForPeriod,
  updateStaffShift,
  cancelStaffShiftWithReason,
} from "@/src/lib/workforce-os/rosterManualAdjustments.server";
import { createStaffShift } from "@/src/lib/workforce-os/workforceRostering.server";

const TENANT = "11111111-1111-4111-8111-111111111111";
const STAFF_ACTIVE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FI_USER = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const SHIFT_GENERATED = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const SHIFT_MANUAL = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const SHIFT_CONFIRMED = "99999999-9999-4999-8999-999999999999";

type ShiftRow = {
  id: string;
  tenant_id: string;
  staff_id: string;
  clinic_id: string | null;
  shift_type: string;
  starts_at: string;
  ends_at: string;
  status: string;
  notes: string | null;
  shift_source: string;
  created_by: string | null;
  updated_by: string | null;
  adjustment_reason: string | null;
  cancellation_reason: string | null;
};

function createMockSupabase(initialShifts: ShiftRow[]) {
  const shifts = [...initialShifts];
  const auditEvents: Array<Record<string, unknown>> = [];

  const client = {
    from(table: string) {
      if (table === "fi_staff_shifts") {
        return {
          select(_cols?: string) {
            return {
              eq(col: string, val: string) {
                const filters = [{ col, val }];
                const chain = {
                  eq(col2: string, val2: string) {
                    filters.push({ col: col2, val: val2 });
                    return chain;
                  },
                  neq(_col: string, _val: string) {
                    return Promise.resolve({ data: [], error: null });
                  },
                  maybeSingle: async () => {
                    const row = shifts.find((s) =>
                      filters.every(
                        (f) => String((s as Record<string, unknown>)[f.col]) === f.val
                      )
                    );
                    return { data: row ?? null, error: null };
                  },
                  single: async () => chain.maybeSingle(),
                  in(_col: string, _vals: string[]) {
                    return chain;
                  },
                };
                return chain;
              },
            };
          },
          insert(row: Record<string, unknown>) {
            const inserted: ShiftRow = {
              id: String(row.id ?? crypto.randomUUID()),
              tenant_id: String(row.tenant_id),
              staff_id: String(row.staff_id),
              clinic_id: row.clinic_id != null ? String(row.clinic_id) : null,
              shift_type: String(row.shift_type),
              starts_at: String(row.starts_at),
              ends_at: String(row.ends_at),
              status: String(row.status ?? "scheduled"),
              notes: row.notes != null ? String(row.notes) : null,
              shift_source: String(row.shift_source ?? "manual"),
              created_by: row.created_by != null ? String(row.created_by) : null,
              updated_by: null,
              adjustment_reason:
                row.adjustment_reason != null ? String(row.adjustment_reason) : null,
              cancellation_reason: null,
            };
            shifts.push(inserted);
            return {
              select: () => ({
                single: async () => ({ data: inserted, error: null }),
              }),
            };
          },
          update(patch: Record<string, unknown>) {
            const filters: Array<{ col: string; val: string }> = [];
            const chain = {
              eq(col: string, val: string) {
                filters.push({ col, val });
                return chain;
              },
              in(col: string, vals: string[]) {
                filters.push({ col, val: vals.join(",") });
                return chain;
              },
              select(_cols?: string) {
                return {
                  single: async () => {
                    const row = shifts.find((s) =>
                      filters.every((f) => {
                        if (f.col.endsWith("_id") && f.val.includes(",")) {
                          return f.val.split(",").includes(String((s as Record<string, unknown>)[f.col]));
                        }
                        return String((s as Record<string, unknown>)[f.col]) === f.val;
                      })
                    );
                    if (!row) return { data: null, error: { message: "not found" } };
                    Object.assign(row, patch);
                    return { data: row, error: null };
                  },
                  then(resolve: (v: unknown) => void) {
                    const matched = shifts.filter((s) =>
                      filters.every((f) => String((s as Record<string, unknown>)[f.col]) === f.val)
                    );
                    for (const row of matched) Object.assign(row, patch);
                    resolve({ data: matched, error: null });
                  },
                };
              },
              then(resolve: (v: unknown) => void) {
                const matched = shifts.filter((s) =>
                  filters.every((f) => String((s as Record<string, unknown>)[f.col]) === f.val)
                );
                for (const row of matched) Object.assign(row, patch);
                resolve({ data: matched, error: null });
              },
            };
            return chain;
          },
          delete() {
            const filters: Array<{ col: string; val: string }> = [];
            const chain = {
              eq(col: string, val: string) {
                filters.push({ col, val });
                return chain;
              },
              in(col: string, vals: string[]) {
                filters.push({ col, val: vals.join(",") });
                return chain;
              },
              then(resolve: (v: unknown) => void) {
                for (let i = shifts.length - 1; i >= 0; i -= 1) {
                  const s = shifts[i];
                  const match = filters.every((f) => {
                    if (f.val.includes(",")) {
                      return f.val.split(",").includes(String((s as Record<string, unknown>)[f.col]));
                    }
                    return String((s as Record<string, unknown>)[f.col]) === f.val;
                  });
                  if (match) shifts.splice(i, 1);
                }
                resolve({ error: null });
              },
            };
            return chain;
          },
        };
      }

      if (table === "fi_roster_shift_audit_events") {
        return {
          insert(row: Record<string, unknown>) {
            auditEvents.push(row);
            return Promise.resolve({ error: null });
          },
        };
      }

      if (table === "fi_staff_availability_blocks") {
        return {
          select() {
            return {
              eq() {
                const chain = {
                  eq() {
                    return chain;
                  },
                  neq() {
                    return Promise.resolve({ data: [], error: null });
                  },
                };
                return chain;
              },
            };
          },
        };
      }

      if (table === "fi_staff_source_ids") {
        return {
          select() {
            return {
              eq() {
                return {
                  eq: async () => ({ data: [], error: null }),
                };
              },
            };
          },
        };
      }

      if (table === "fi_staff") {
        return {
          select(_cols?: string) {
            return {
              eq(col: string, val: string) {
                const filters = [{ col, val }];
                const chain = {
                  eq(col2: string, val2: string) {
                    filters.push({ col: col2, val: val2 });
                    return chain;
                  },
                  maybeSingle: async () => {
                    const row = {
                      id: STAFF_ACTIVE,
                      tenant_id: TENANT,
                      full_name: "Active Staff",
                      staff_role: "nurse",
                      is_active: true,
                      default_timezone: "Australia/Perth",
                      working_hours: {},
                      staff_metadata: {},
                    };
                    const match = filters.every(
                      (f) => String((row as Record<string, unknown>)[f.col]) === f.val
                    );
                    return { data: match ? row : null, error: null };
                  },
                  order: async () => ({
                    data: [
                      {
                        id: STAFF_ACTIVE,
                        tenant_id: TENANT,
                        full_name: "Active Staff",
                        staff_role: "nurse",
                        is_active: true,
                        default_timezone: "Australia/Perth",
                        working_hours: {},
                        staff_metadata: {},
                      },
                    ],
                    error: null,
                  }),
                };
                return chain;
              },
            };
          },
        };
      }

      if (table === "fi_staff_members") {
        return {
          select() {
            return {
              eq() {
                return {
                  order: async () => ({
                    data: [
                      {
                        id: "88888888-8888-4888-8888-888888888888",
                        tenant_id: TENANT,
                        fi_staff_id: STAFF_ACTIVE,
                        full_name: "Active Staff",
                        employment_status: "active",
                        archived_at: null,
                      },
                    ],
                    error: null,
                  }),
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
    rpc(name: string, args: Record<string, unknown>) {
      if (name !== "fi_clear_generated_roster_shifts") {
        throw new Error(`Unexpected rpc ${name}`);
      }
      let cancelled = 0;
      for (const shift of shifts) {
        if (
          shift.tenant_id === args.p_tenant_id &&
          shift.status === "scheduled" &&
          isGeneratedShiftSource(shift.shift_source) &&
          shift.starts_at >= String(args.p_range_start) &&
          shift.starts_at < String(args.p_range_end)
        ) {
          shift.status = "cancelled";
          shift.cancellation_reason = String(args.p_cancellation_reason);
          shift.updated_by = args.p_updated_by != null ? String(args.p_updated_by) : null;
          cancelled += 1;
        }
      }
      return Promise.resolve({ data: { cancelled_count: cancelled }, error: null });
    },
    get shifts() {
      return shifts;
    },
    get auditEvents() {
      return auditEvents;
    },
  };

  return client as unknown as SupabaseClient & {
    shifts: ShiftRow[];
    auditEvents: Array<Record<string, unknown>>;
  };
}

describe("roster manual adjustments core", () => {
  it("identifies generated shift sources", () => {
    assert.equal(isGeneratedShiftSource("standard_hours"), true);
    assert.equal(isGeneratedShiftSource("copy_week"), true);
    assert.equal(isGeneratedShiftSource("manual"), false);
  });

  it("allows clearing only scheduled generated shifts", () => {
    assert.equal(
      canClearGeneratedShift({
        id: SHIFT_GENERATED,
        staff_id: STAFF_ACTIVE,
        clinic_id: null,
        shift_type: "clinic_day",
        starts_at: "2026-07-06T01:00:00.000Z",
        ends_at: "2026-07-06T09:00:00.000Z",
        status: "scheduled",
        notes: null,
        shift_source: "standard_hours",
      }),
      true
    );
    assert.equal(
      canClearGeneratedShift({
        id: SHIFT_MANUAL,
        staff_id: STAFF_ACTIVE,
        clinic_id: null,
        shift_type: "clinic_day",
        starts_at: "2026-07-06T01:00:00.000Z",
        ends_at: "2026-07-06T09:00:00.000Z",
        status: "scheduled",
        notes: null,
        shift_source: "manual",
      }),
      false
    );
    assert.equal(
      canClearGeneratedShift({
        id: SHIFT_CONFIRMED,
        staff_id: STAFF_ACTIVE,
        clinic_id: null,
        shift_type: "clinic_day",
        starts_at: "2026-07-06T01:00:00.000Z",
        ends_at: "2026-07-06T09:00:00.000Z",
        status: "confirmed",
        notes: null,
        shift_source: "standard_hours",
      }),
      false
    );
  });

  it("allows hard delete only for generated draft shifts", () => {
    assert.equal(
      canHardDeleteGeneratedDraftShift({
        id: SHIFT_GENERATED,
        staff_id: STAFF_ACTIVE,
        clinic_id: null,
        shift_type: "clinic_day",
        starts_at: "2026-07-06T01:00:00.000Z",
        ends_at: "2026-07-06T09:00:00.000Z",
        status: "scheduled",
        notes: null,
        shift_source: "standard_hours",
      }),
      true
    );
    assert.equal(
      canHardDeleteGeneratedDraftShift({
        id: SHIFT_CONFIRMED,
        staff_id: STAFF_ACTIVE,
        clinic_id: null,
        shift_type: "clinic_day",
        starts_at: "2026-07-06T01:00:00.000Z",
        ends_at: "2026-07-06T09:00:00.000Z",
        status: "confirmed",
        notes: null,
        shift_source: "standard_hours",
      }),
      false
    );
  });
});

describe("manual shift create uses fi_users.id for created_by", () => {
  it("createStaffShift stores fi_users actor id", async () => {
    const supabase = createMockSupabase([]);
    const shift = await createStaffShift({
      tenantId: TENANT,
      staffId: STAFF_ACTIVE,
      shiftType: "clinic_day",
      startsAt: "2026-07-06T01:00:00.000Z",
      endsAt: "2026-07-06T09:00:00.000Z",
      createdBy: FI_USER,
      adjustmentReason: "manual_adjustment",
      client: supabase,
    });

    assert.equal(shift.created_by ?? FI_USER, FI_USER);
    assert.equal(supabase.shifts[0]?.created_by, FI_USER);
  });
});

describe("clear generated roster", () => {
  it("removes generated draft shifts only and preserves manual shifts", async () => {
    const supabase = createMockSupabase([
      {
        id: SHIFT_GENERATED,
        tenant_id: TENANT,
        staff_id: STAFF_ACTIVE,
        clinic_id: null,
        shift_type: "clinic_day",
        starts_at: "2026-07-06T01:00:00.000Z",
        ends_at: "2026-07-06T09:00:00.000Z",
        status: "scheduled",
        notes: null,
        shift_source: "standard_hours",
        created_by: FI_USER,
        updated_by: null,
        adjustment_reason: null,
        cancellation_reason: null,
      },
      {
        id: SHIFT_MANUAL,
        tenant_id: TENANT,
        staff_id: STAFF_ACTIVE,
        clinic_id: null,
        shift_type: "clinic_day",
        starts_at: "2026-07-07T01:00:00.000Z",
        ends_at: "2026-07-07T09:00:00.000Z",
        status: "scheduled",
        notes: null,
        shift_source: "manual",
        created_by: FI_USER,
        updated_by: null,
        adjustment_reason: "manual_adjustment",
        cancellation_reason: null,
      },
    ]);

    const result = await clearGeneratedRosterShiftsForPeriod({
      tenantId: TENANT,
      rangeStartIso: "2026-07-06T00:00:00.000Z",
      rangeEndIso: "2026-07-08T00:00:00.000Z",
      updatedBy: FI_USER,
      client: supabase,
    });

    assert.equal(result.cancelledCount, 1);
    assert.equal(
      supabase.shifts.find((s) => s.id === SHIFT_GENERATED)?.status,
      "cancelled"
    );
    assert.equal(supabase.shifts.find((s) => s.id === SHIFT_MANUAL)?.status, "scheduled");
    assert.equal(supabase.auditEvents.length, 1);
    assert.equal(supabase.auditEvents[0]?.action_type, ROSTER_SHIFT_AUDIT_ACTION_TYPES.SHIFT_REMOVED_GENERATED);
  });
});

describe("cancel confirmed shift retains historical record", () => {
  it("soft-cancels confirmed shift instead of deleting", async () => {
    const supabase = createMockSupabase([
      {
        id: SHIFT_CONFIRMED,
        tenant_id: TENANT,
        staff_id: STAFF_ACTIVE,
        clinic_id: null,
        shift_type: "clinic_day",
        starts_at: "2026-07-06T01:00:00.000Z",
        ends_at: "2026-07-06T09:00:00.000Z",
        status: "confirmed",
        notes: null,
        shift_source: "manual",
        created_by: FI_USER,
        updated_by: null,
        adjustment_reason: null,
        cancellation_reason: null,
      },
    ]);

    const shift = await cancelStaffShiftWithReason({
      tenantId: TENANT,
      shiftId: SHIFT_CONFIRMED,
      cancellationReason: "staff_sick",
      updatedBy: FI_USER,
      client: supabase,
    });

    assert.equal(shift.status, "cancelled");
    assert.equal(supabase.shifts.length, 1);
    assert.equal(supabase.shifts[0]?.updated_by, FI_USER);
    assert.equal(supabase.shifts[0]?.cancellation_reason, "staff_sick");
    assert.equal(supabase.auditEvents[0]?.action_type, ROSTER_SHIFT_AUDIT_ACTION_TYPES.SHIFT_CANCELLED);
    assert.equal(supabase.auditEvents[0]?.actor_fi_user_id, FI_USER);
  });
});

describe("manual shift update uses fi_users.id for updated_by", () => {
  it("updateStaffShift stores updated_by and writes audit event", async () => {
    const supabase = createMockSupabase([
      {
        id: SHIFT_MANUAL,
        tenant_id: TENANT,
        staff_id: STAFF_ACTIVE,
        clinic_id: null,
        shift_type: "clinic_day",
        starts_at: "2026-07-06T01:00:00.000Z",
        ends_at: "2026-07-06T09:00:00.000Z",
        status: "scheduled",
        notes: null,
        shift_source: "manual",
        created_by: FI_USER,
        updated_by: null,
        adjustment_reason: null,
        cancellation_reason: null,
      },
    ]);

    const result = await updateStaffShift({
      tenantId: TENANT,
      shiftId: SHIFT_MANUAL,
      notes: "Updated notes",
      adjustmentReason: "manual_adjustment",
      updatedBy: FI_USER,
      allowOverride: true,
      client: supabase,
    });

    assert.equal(result.shift.notes, "Updated notes");
    assert.equal(supabase.shifts[0]?.updated_by, FI_USER);
    assert.equal(
      supabase.auditEvents[0]?.action_type,
      ROSTER_SHIFT_AUDIT_ACTION_TYPES.SHIFT_UPDATED_MANUAL
    );
  });
});

describe("audit events are written", () => {
  it("insertRosterShiftAuditEvent persists action metadata", async () => {
    const supabase = createMockSupabase([]);
    await insertRosterShiftAuditEvent({
      tenantId: TENANT,
      shiftId: SHIFT_MANUAL,
      staffId: STAFF_ACTIVE,
      actorFiUserId: FI_USER,
      actionType: ROSTER_SHIFT_AUDIT_ACTION_TYPES.SHIFT_CREATED_MANUAL,
      reason: "sick_cover",
      newValues: { staff_id: STAFF_ACTIVE },
      client: supabase,
    });

    assert.equal(supabase.auditEvents.length, 1);
    assert.equal(supabase.auditEvents[0]?.action_type, "shift_created_manual");
    assert.equal(supabase.auditEvents[0]?.actor_fi_user_id, FI_USER);
  });
});
