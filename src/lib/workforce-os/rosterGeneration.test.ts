import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { loadAvailabilityBlocksInRange } from "@/src/lib/workforce-os/rosterGeneration.server";
import { generateRosterFromStandardHours } from "@/src/lib/workforce-os/rosterGenerationCore";
import { applyStandardHoursTemplate } from "@/src/lib/workforce-os/staffStandardHoursCore";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STAFF = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

type AvailabilityBlockRow = Record<string, unknown>;

function makeAvailabilityBlockMockClient(blocks: AvailabilityBlockRow[]): SupabaseClient {
  const from = (table: string) => {
    if (table !== "fi_staff_availability_blocks") {
      throw new Error(`Unexpected table: ${table}`);
    }

    const filters: Array<(row: Record<string, unknown>) => boolean> = [];

    const api = {
      select(_cols: string) {
        return api;
      },
      eq(col: string, val: unknown) {
        filters.push((row) => row[col] === val);
        return api;
      },
      in(col: string, vals: unknown[]) {
        filters.push((row) => vals.includes(row[col]));
        return api;
      },
      gte(col: string, val: unknown) {
        filters.push((row) => String(row[col] ?? "") >= String(val));
        return api;
      },
      lte(col: string, val: unknown) {
        filters.push((row) => String(row[col] ?? "") <= String(val));
        return api;
      },
      then(resolve: (value: { data: AvailabilityBlockRow[]; error: null }) => void) {
        resolve({
          data: blocks.filter((row) => filters.every((f) => f(row))),
          error: null,
        });
      },
    };
    return api;
  };

  return { from } as unknown as SupabaseClient;
}

test("loadAvailabilityBlocksInRange loads long leave blocks that start before the roster period", async () => {
  const rangeStartIso = "2026-07-06T00:00:00.000Z";
  const rangeEndIso = "2026-07-13T00:00:00.000Z";
  const maternityBlock = {
    id: randomUUID(),
    tenant_id: TENANT,
    staff_id: STAFF,
    block_type: "maternity_leave",
    status: "active",
    starts_at: "2026-06-01T00:00:00.000Z",
    ends_at: "2026-08-31T23:59:59.999Z",
  };

  const client = makeAvailabilityBlockMockClient([maternityBlock]);
  const loaded = await loadAvailabilityBlocksInRange(
    TENANT,
    rangeStartIso,
    rangeEndIso,
    undefined,
    client
  );

  assert.equal(loaded.length, 1);
  assert.equal(loaded[0]?.staff_id, STAFF);
  assert.equal(loaded[0]?.block_type, "maternity_leave");
});

test("generateRosterFromStandardHours skips shifts when long leave overlaps the generation range", () => {
  const days = applyStandardHoursTemplate("five_eight");
  const rangeStartIso = "2026-07-06T00:00:00.000Z";
  const rangeEndIso = "2026-07-13T00:00:00.000Z";

  const plan = generateRosterFromStandardHours({
    tenantId: TENANT,
    staffIds: [STAFF],
    standardHoursByStaff: new Map([[STAFF, days]]),
    staffTimezoneById: new Map([[STAFF, "Australia/Perth"]]),
    rangeStartIso,
    rangeEndIso,
    existingShifts: [],
    availabilityBlocks: [
      {
        block_type: "maternity_leave",
        starts_at: "2026-06-01T00:00:00.000Z",
        ends_at: "2026-08-31T23:59:59.999Z",
        status: "active",
      },
    ],
  });

  assert.equal(plan.candidates.length, 0);
  assert.ok(plan.skips.some((skip) => skip.reason === "leave_blocked"));
});
