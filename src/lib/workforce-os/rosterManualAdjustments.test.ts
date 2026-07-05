import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  canClearGeneratedShift,
  canEditRosterShift,
  canHardDeleteGeneratedDraftShift,
  isGeneratedShiftSource,
  ROSTER_SHIFT_AUDIT_ACTION_TYPES,
  ROSTER_SHIFT_EDIT_REASON_REQUIRED_MESSAGE,
  ROSTER_SHIFT_UPDATE_OUTCOMES,
  rosterShiftCancellationAuditMetadata,
} from "@/src/lib/workforce-os/rosterManualAdjustmentsCore";
import { insertRosterShiftAuditEvent } from "@/src/lib/workforce-os/rosterShiftAudit.server";
import {
  clearGeneratedRosterShiftsForPeriod,
  evaluateStaffShiftAssignmentWarnings,
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
const SHIFT_CANCELLED = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SHIFT_SICK_CANCELLED = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SHIFT_REPLACEMENT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab";
const STAFF_OTHER = "22222222-2222-4222-8222-222222222222";

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

function sampleShift(overrides: Partial<ShiftRow> & Pick<ShiftRow, "id">): ShiftRow {
  return {
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
    ...overrides,
  };
}

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
                  neq(col: string, val: string) {
                    const rows = shifts.filter((s) => {
                      const tenantMatch = filters.some(
                        (f) => f.col === "tenant_id" && s.tenant_id === f.val
                      );
                      const staffMatch = filters.some(
                        (f) => f.col === "staff_id" && s.staff_id === f.val
                      );
                      const statusOk = col === "status" ? s.status !== val : true;
                      return tenantMatch && staffMatch && statusOk;
                    });
                    return Promise.resolve({ data: rows, error: null });
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

  it("omits blank cancellation notes from audit metadata", () => {
    assert.equal(rosterShiftCancellationAuditMetadata(undefined), undefined);
    assert.equal(rosterShiftCancellationAuditMetadata(null), undefined);
    assert.equal(rosterShiftCancellationAuditMetadata(""), undefined);
    assert.equal(rosterShiftCancellationAuditMetadata("   "), undefined);
    assert.deepEqual(rosterShiftCancellationAuditMetadata("Patient rescheduled"), {
      notes: "Patient rescheduled",
    });
  });

  it("canEditRosterShift allows scheduled and confirmed manual and generated shifts", () => {
    const base = {
      staff_id: STAFF_ACTIVE,
      clinic_id: null,
      shift_type: "clinic_day",
      starts_at: "2026-07-06T01:00:00.000Z",
      ends_at: "2026-07-06T09:00:00.000Z",
      notes: null,
    };
    assert.deepEqual(
      canEditRosterShift({ id: SHIFT_MANUAL, ...base, status: "scheduled", shift_source: "manual" }),
      { editable: true }
    );
    assert.deepEqual(
      canEditRosterShift({
        id: SHIFT_CONFIRMED,
        ...base,
        status: "confirmed",
        shift_source: "manual",
      }),
      { editable: true }
    );
    assert.deepEqual(
      canEditRosterShift({
        id: SHIFT_GENERATED,
        ...base,
        status: "scheduled",
        shift_source: "standard_hours",
      }),
      { editable: true }
    );
    assert.deepEqual(
      canEditRosterShift({
        id: SHIFT_REPLACEMENT,
        ...base,
        status: "scheduled",
        shift_source: "manual",
        adjustment_reason: "sick_cover",
      }),
      { editable: true }
    );
  });

  it("canEditRosterShift rejects cancelled, sick-cancelled, and completed shifts", () => {
    const base = {
      staff_id: STAFF_ACTIVE,
      clinic_id: null,
      shift_type: "clinic_day",
      starts_at: "2026-07-06T01:00:00.000Z",
      ends_at: "2026-07-06T09:00:00.000Z",
      notes: null,
      shift_source: "manual" as const,
    };
    assert.equal(
      canEditRosterShift({
        id: SHIFT_CANCELLED,
        ...base,
        status: "cancelled",
        cancellation_reason: "clinic_closed",
      }).editable,
      false
    );
    const sickCancelled = canEditRosterShift({
      id: SHIFT_SICK_CANCELLED,
      ...base,
      status: "cancelled",
      cancellation_reason: "staff_sick",
    });
    assert.equal(sickCancelled.editable, false);
    if (!sickCancelled.editable) {
      assert.match(sickCancelled.reason, /Sick-cancelled/);
    }
    assert.equal(
      canEditRosterShift({ id: SHIFT_MANUAL, ...base, status: "completed" }).editable,
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
    assert.deepEqual(supabase.auditEvents[0]?.metadata, {});
  });

  it("persists optional cancellation notes in audit metadata", async () => {
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

    await cancelStaffShiftWithReason({
      tenantId: TENANT,
      shiftId: SHIFT_CONFIRMED,
      cancellationReason: "clinic_closed",
      notes: "  Public holiday closure  ",
      updatedBy: FI_USER,
      client: supabase,
    });

    assert.deepEqual(supabase.auditEvents[0]?.metadata, {
      notes: "Public holiday closure",
    });
  });
});

describe("generated draft hard-delete cancellation", () => {
  it("hard-deletes scheduled generated shift and writes audit without notes metadata when omitted", async () => {
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
    ]);

    await cancelStaffShiftWithReason({
      tenantId: TENANT,
      shiftId: SHIFT_GENERATED,
      cancellationReason: "duplicate_generated_shift",
      updatedBy: FI_USER,
      hardDeleteGeneratedDraft: true,
      client: supabase,
    });

    assert.equal(supabase.shifts.length, 0);
    assert.equal(
      supabase.auditEvents[0]?.action_type,
      ROSTER_SHIFT_AUDIT_ACTION_TYPES.SHIFT_REMOVED_GENERATED
    );
    assert.deepEqual(supabase.auditEvents[0]?.metadata, {});
  });

  it("hard-deletes scheduled generated shift and persists notes in audit metadata when provided", async () => {
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
    ]);

    await cancelStaffShiftWithReason({
      tenantId: TENANT,
      shiftId: SHIFT_GENERATED,
      cancellationReason: "duplicate_generated_shift",
      notes: "Duplicate from regenerate",
      updatedBy: FI_USER,
      hardDeleteGeneratedDraft: true,
      client: supabase,
    });

    assert.equal(supabase.shifts.length, 0);
    assert.deepEqual(supabase.auditEvents[0]?.metadata, {
      notes: "Duplicate from regenerate",
    });
  });
});

describe("updateStaffShift hardening", () => {
  it("excludes self from overlap checks on notes-only and time edits", async () => {
    const supabase = createMockSupabase([sampleShift({ id: SHIFT_MANUAL })]);

    const notesResult = await updateStaffShift({
      tenantId: TENANT,
      shiftId: SHIFT_MANUAL,
      notes: "Notes only",
      updatedBy: FI_USER,
      allowOverride: true,
      client: supabase,
    });
    assert.equal(notesResult.shift.notes, "Notes only");
    assert.equal(notesResult.outcome, ROSTER_SHIFT_UPDATE_OUTCOMES.SHIFT_UPDATED);

    const timeResult = await updateStaffShift({
      tenantId: TENANT,
      shiftId: SHIFT_MANUAL,
      startsAt: "2026-07-06T02:00:00.000Z",
      endsAt: "2026-07-06T10:00:00.000Z",
      editReason: "timing_change",
      updatedBy: FI_USER,
      allowOverride: true,
      client: supabase,
    });
    assert.equal(timeResult.shift.starts_at, "2026-07-06T02:00:00.000Z");
  });

  it("evaluateStaffShiftAssignmentWarnings excludes shift being edited", async () => {
    const supabase = createMockSupabase([sampleShift({ id: SHIFT_MANUAL })]);

    const withoutExclude = await evaluateStaffShiftAssignmentWarnings({
      tenantId: TENANT,
      staffId: STAFF_ACTIVE,
      shiftType: "clinic_day",
      startsAt: "2026-07-06T01:00:00.000Z",
      endsAt: "2026-07-06T09:00:00.000Z",
      client: supabase,
    });
    assert.ok(withoutExclude.warnings.some((w) => w.code === "shift_overlap"));

    const withExclude = await evaluateStaffShiftAssignmentWarnings({
      tenantId: TENANT,
      staffId: STAFF_ACTIVE,
      shiftType: "clinic_day",
      startsAt: "2026-07-06T01:00:00.000Z",
      endsAt: "2026-07-06T09:00:00.000Z",
      excludeShiftId: SHIFT_MANUAL,
      client: supabase,
    });
    assert.ok(!withExclude.warnings.some((w) => w.code === "shift_overlap"));
  });

  it("rejects cancelled and sick-cancelled shifts", async () => {
    const supabase = createMockSupabase([
      sampleShift({
        id: SHIFT_CANCELLED,
        status: "cancelled",
        cancellation_reason: "clinic_closed",
      }),
      sampleShift({
        id: SHIFT_SICK_CANCELLED,
        status: "cancelled",
        cancellation_reason: "staff_sick",
      }),
    ]);

    await assert.rejects(
      () =>
        updateStaffShift({
          tenantId: TENANT,
          shiftId: SHIFT_CANCELLED,
          notes: "nope",
          updatedBy: FI_USER,
          client: supabase,
        }),
      /Cancelled shifts cannot be edited/
    );
    await assert.rejects(
      () =>
        updateStaffShift({
          tenantId: TENANT,
          shiftId: SHIFT_SICK_CANCELLED,
          notes: "nope",
          updatedBy: FI_USER,
          client: supabase,
        }),
      /Sick-cancelled shifts cannot be edited/
    );
  });

  it("allows editing scheduled manual and generated shifts without changing shift_source", async () => {
    const supabase = createMockSupabase([
      sampleShift({ id: SHIFT_MANUAL }),
      sampleShift({ id: SHIFT_GENERATED, shift_source: "standard_hours" }),
    ]);

    await updateStaffShift({
      tenantId: TENANT,
      shiftId: SHIFT_MANUAL,
      notes: "Manual note",
      updatedBy: FI_USER,
      allowOverride: true,
      client: supabase,
    });
    assert.equal(supabase.shifts.find((s) => s.id === SHIFT_MANUAL)?.shift_source, "manual");

    await updateStaffShift({
      tenantId: TENANT,
      shiftId: SHIFT_GENERATED,
      notes: "Generated note",
      updatedBy: FI_USER,
      allowOverride: true,
      client: supabase,
    });
    assert.equal(
      supabase.shifts.find((s) => s.id === SHIFT_GENERATED)?.shift_source,
      "standard_hours"
    );
  });

  it("rejects staff reassignment attempts", async () => {
    const supabase = createMockSupabase([sampleShift({ id: SHIFT_MANUAL })]);

    await assert.rejects(
      () =>
        updateStaffShift({
          tenantId: TENANT,
          shiftId: SHIFT_MANUAL,
          staffId: STAFF_OTHER,
          notes: "reassign",
          updatedBy: FI_USER,
          client: supabase,
        }),
      /Staff reassignment is not supported/
    );
  });

  it("returns unchanged outcome without audit row on no-op update", async () => {
    const supabase = createMockSupabase([sampleShift({ id: SHIFT_MANUAL, notes: "Same" })]);

    const result = await updateStaffShift({
      tenantId: TENANT,
      shiftId: SHIFT_MANUAL,
      notes: "Same",
      updatedBy: FI_USER,
      client: supabase,
    });

    assert.equal(result.outcome, ROSTER_SHIFT_UPDATE_OUTCOMES.SHIFT_UNCHANGED);
    assert.equal(supabase.auditEvents.length, 0);
    assert.equal(supabase.shifts[0]?.updated_by, null);
  });

  it("allows notes-only edit without edit reason", async () => {
    const supabase = createMockSupabase([sampleShift({ id: SHIFT_MANUAL })]);

    const result = await updateStaffShift({
      tenantId: TENANT,
      shiftId: SHIFT_MANUAL,
      notes: "Updated notes",
      updatedBy: FI_USER,
      allowOverride: true,
      client: supabase,
    });

    assert.equal(result.shift.notes, "Updated notes");
    assert.equal(supabase.auditEvents[0]?.reason, null);
  });

  it("rejects time edit without edit reason and accepts with valid reason", async () => {
    const supabase = createMockSupabase([sampleShift({ id: SHIFT_MANUAL })]);

    await assert.rejects(
      () =>
        updateStaffShift({
          tenantId: TENANT,
          shiftId: SHIFT_MANUAL,
          startsAt: "2026-07-06T02:00:00.000Z",
          updatedBy: FI_USER,
          allowOverride: true,
          client: supabase,
        }),
      new RegExp(ROSTER_SHIFT_EDIT_REASON_REQUIRED_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    );

    const result = await updateStaffShift({
      tenantId: TENANT,
      shiftId: SHIFT_MANUAL,
      startsAt: "2026-07-06T02:00:00.000Z",
      editReason: "timing_change",
      updatedBy: FI_USER,
      allowOverride: true,
      client: supabase,
    });
    assert.equal(result.shift.starts_at, "2026-07-06T02:00:00.000Z");
    assert.equal(supabase.auditEvents[0]?.reason, "timing_change");
  });

  it("writes audit metadata with source and changed_fields", async () => {
    const supabase = createMockSupabase([sampleShift({ id: SHIFT_MANUAL })]);

    await updateStaffShift({
      tenantId: TENANT,
      shiftId: SHIFT_MANUAL,
      notes: "Drawer note",
      updatedBy: FI_USER,
      allowOverride: true,
      client: supabase,
    });

    assert.deepEqual(supabase.auditEvents[0]?.metadata, {
      source: "roster_shift_drawer",
      changed_fields: ["notes"],
      notes: "Drawer note",
    });
  });

  it("rejects end <= start", async () => {
    const supabase = createMockSupabase([sampleShift({ id: SHIFT_MANUAL })]);

    await assert.rejects(
      () =>
        updateStaffShift({
          tenantId: TENANT,
          shiftId: SHIFT_MANUAL,
          startsAt: "2026-07-06T09:00:00.000Z",
          endsAt: "2026-07-06T01:00:00.000Z",
          editReason: "timing_change",
          updatedBy: FI_USER,
          client: supabase,
        }),
      /Shift end must be after start/
    );
  });

  it("updateStaffShift stores updated_by and writes audit event", async () => {
    const supabase = createMockSupabase([sampleShift({ id: SHIFT_MANUAL })]);

    const result = await updateStaffShift({
      tenantId: TENANT,
      shiftId: SHIFT_MANUAL,
      notes: "Updated notes",
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
