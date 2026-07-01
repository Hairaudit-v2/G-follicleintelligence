import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

import { deriveGrossMinutesWorked, sumBreakMinutes } from "./staffTimeClockCore";
import { loadWorkforceTimeClockPolicy } from "./staffTimeClockPolicy.server";
import {
  createTimesheetEntry,
  updateTimesheetEntryLabour,
} from "./wageProfile.server";
import type { TimesheetEntry } from "./wageProfileCore";

export async function syncTimesheetEntryFromPunch(opts: {
  tenantId: string;
  punchId: string;
  client?: SupabaseClient;
}): Promise<{ entry: TimesheetEntry | null; updated: boolean; reason: string | null }> {
  const tid = assertNonEmptyUuid(opts.tenantId, "tenantId");
  const punchId = assertNonEmptyUuid(opts.punchId, "punchId");
  const supabase = opts.client ?? supabaseAdmin();

  const { data: punch, error: punchErr } = await supabase
    .from("fi_workforce_time_punches")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", punchId)
    .maybeSingle();
  if (punchErr) throw new Error(punchErr.message);
  if (!punch) throw new Error("Punch not found.");

  const row = punch as Record<string, unknown>;
  if (String(row.status) !== "closed" || !row.clock_out_at) {
    return { entry: null, updated: false, reason: "Punch is not closed." };
  }

  const policy = await loadWorkforceTimeClockPolicy(tid, supabase);
  const { data: breaks } = await supabase
    .from("fi_workforce_time_punch_breaks")
    .select("break_start_at, break_end_at, status")
    .eq("tenant_id", tid)
    .eq("punch_id", punchId)
    .eq("status", "closed");

  const breakMinutes = policy.breaksEnabled
    ? sumBreakMinutes(
        ((breaks ?? []) as { break_start_at: string; break_end_at: string | null; status: string }[]).map(
          (b) => ({
            breakStartAt: String(b.break_start_at),
            breakEndAt: b.break_end_at != null ? String(b.break_end_at) : null,
            status: "closed" as const,
          })
        )
      )
    : 0;

  const gross = deriveGrossMinutesWorked(
    "closed",
    String(row.clock_in_at),
    String(row.clock_out_at)
  );
  const netMinutes = gross != null ? Math.max(0, gross - breakMinutes) : 0;
  const staffMemberId = row.staff_member_id != null ? String(row.staff_member_id) : null;
  if (!staffMemberId || netMinutes <= 0) {
    return { entry: null, updated: false, reason: "No payable minutes or staff link." };
  }

  const note =
    breakMinutes > 0
      ? `Synced from PIN punch (${breakMinutes} min breaks deducted).`
      : "Synced from PIN punch.";

  const timesheetEntryId =
    row.timesheet_entry_id != null ? String(row.timesheet_entry_id) : null;

  if (!timesheetEntryId) {
    try {
      const entry = await createTimesheetEntry({
        tenantId: tid,
        staffMemberId,
        workDate: String(row.work_date).slice(0, 10),
        minutesWorked: netMinutes,
        shiftId: row.shift_id != null ? String(row.shift_id) : null,
        notes: note,
        client: supabase,
      });
      await supabase
        .from("fi_workforce_time_punches")
        .update({
          timesheet_entry_id: entry.id,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tid)
        .eq("id", punchId);
      return { entry, updated: true, reason: null };
    } catch (e) {
      return {
        entry: null,
        updated: false,
        reason: e instanceof Error ? e.message : "Could not create timesheet.",
      };
    }
  }

  try {
    const entry = await updateTimesheetEntryLabour({
      tenantId: tid,
      entryId: timesheetEntryId,
      staffMemberId,
      minutesWorked: netMinutes,
      notes: note,
      metadataPatch: { punch_id: punchId, break_minutes: breakMinutes },
      client: supabase,
    });
    return { entry, updated: true, reason: null };
  } catch (e) {
    return {
      entry: null,
      updated: false,
      reason: e instanceof Error ? e.message : "Could not recalculate timesheet.",
    };
  }
}