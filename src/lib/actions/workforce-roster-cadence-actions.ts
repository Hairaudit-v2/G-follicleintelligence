"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { CrmAccessError } from "@/src/lib/crm/crmGate";
import { assertHrOsRosterManageAllowed } from "@/src/lib/workforce-os/workforceRosterCommandCentre.server";
import {
  saveWorkforceRosterPlanningPolicy,
  loadWorkforceRosterPlanningPolicy,
} from "@/src/lib/workforce/rosterCadencePolicy.server";
import {
  ROSTER_CADENCE_VALUES,
  type WorkforceRosterPlanningPolicy,
} from "@/src/lib/workforce/rosterCadencePolicyCore";

const rosterCadenceSchema = z.enum(["weekly", "fortnightly", "monthly"]);
const weekStartDaySchema = z.enum(["monday", "sunday"]);
const generationModeSchema = z.enum([
  "standard_hours_only",
  "copy_previous_period",
  "hybrid",
]);
const fullTimePatternSchema = z.enum(["five_eight", "four_ten", "custom"]);

const saveRosterPlanningSchema = z.object({
  tenantId: z.string().uuid(),
  rosterCadence: rosterCadenceSchema,
  rosterWeekStartDay: weekStartDaySchema,
  rosterPlanningHorizonWeeks: z.number().int().min(1).max(52),
  rosterPublishRequired: z.boolean(),
  rosterGenerationMode: generationModeSchema,
  defaultShiftLengthHours: z.number().positive().max(24).nullable().optional(),
  defaultFullTimePattern: fullTimePatternSchema,
  rosterCycleAnchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function errMsg(e: unknown): string {
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidateRosterSurfaces(tenantId: string): void {
  const tid = tenantId.trim();
  revalidatePath(`/fi-admin/${tid}/settings/clinic-setup`);
  revalidatePath(`/fi-admin/${tid}/workforce-os/roster`);
  revalidatePath(`/fi-admin/${tid}/workforce-os/roster/standard-hours`);
  revalidatePath(`/fi-admin/${tid}/hr-os/roster`);
}

export type WorkforceRosterCadenceActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function loadWorkforceRosterPlanningPolicyAction(
  tenantId: string
): Promise<WorkforceRosterCadenceActionResult<WorkforceRosterPlanningPolicy>> {
  try {
    await assertHrOsRosterManageAllowed(tenantId);
    const policy = await loadWorkforceRosterPlanningPolicy(tenantId);
    return { ok: true, data: policy };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function saveWorkforceRosterPlanningPolicyAction(
  body: unknown
): Promise<WorkforceRosterCadenceActionResult<WorkforceRosterPlanningPolicy>> {
  try {
    const parsed = saveRosterPlanningSchema.parse(body);
    await assertHrOsRosterManageAllowed(parsed.tenantId);
    const policy = await saveWorkforceRosterPlanningPolicy(parsed.tenantId, {
      rosterCadence: parsed.rosterCadence,
      rosterWeekStartDay: parsed.rosterWeekStartDay,
      rosterPlanningHorizonWeeks: parsed.rosterPlanningHorizonWeeks,
      rosterPublishRequired: parsed.rosterPublishRequired,
      rosterGenerationMode: parsed.rosterGenerationMode,
      defaultShiftLengthHours: parsed.defaultShiftLengthHours ?? null,
      defaultFullTimePattern: parsed.defaultFullTimePattern,
      rosterCycleAnchorDate: parsed.rosterCycleAnchorDate,
    });
    revalidateRosterSurfaces(parsed.tenantId);
    return { ok: true, data: policy };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export { ROSTER_CADENCE_VALUES };
