import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadBookingsForOperatorView } from "@/src/lib/bookings/bookings";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadAllStaffForTenant } from "@/src/lib/staff/staff.server";
import { loadActiveStandardHoursForTenant } from "@/src/lib/workforce-os/staffStandardHours.server";
import type {
  RosterCommandCentrePageFailure,
  RosterLoadCounts,
  RosterLoadStep,
} from "@/src/lib/workforce-os/rosterCommandCentrePageLoader.types";
import type { RosterAssignableCandidate } from "@/src/lib/workforce-os/workforceRosterCandidates";
import type { RosterCommandCentrePayload } from "@/src/lib/workforce-os/workforceRosterCommandCentre.server";
import {
  loadRosterCommandCentre,
  loadRosterEventDetail,
  type LoadRosterCommandCentreInput,
} from "@/src/lib/workforce-os/workforceRosterCommandCentre.server";

export type {
  RosterCommandCentrePageFailure,
  RosterLoadCounts,
  RosterLoadStep,
} from "@/src/lib/workforce-os/rosterCommandCentrePageLoader.types";

export type RosterCommandCentrePageSuccess = {
  ok: true;
  payload: RosterCommandCentrePayload;
  eventDetails: Record<
    string,
    { candidatesByRole: Record<string, RosterAssignableCandidate[]> } | undefined
  >;
  schemaCheckPassed: boolean;
  counts: RosterLoadCounts;
};

export type RosterCommandCentrePageResult =
  | RosterCommandCentrePageSuccess
  | RosterCommandCentrePageFailure;

function countsFromPayload(payload: RosterCommandCentrePayload): RosterLoadCounts {
  return {
    staffCount: payload.staffOptions.length,
    shiftsCount: payload.shifts.length,
    standardHoursStaffCount: Object.keys(payload.standardHoursByStaffId).length,
    availabilityBlockCount: payload.availabilityBlocks.length,
    clinicalEventCount: payload.events.length,
  };
}

async function verifyRosterSchema(tenantId: string): Promise<boolean> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = supabaseAdmin();
  const [standardHoursRes, shiftsRes] = await Promise.all([
    supabase.from("fi_staff_standard_hours").select("id").eq("tenant_id", tid).limit(1),
    supabase.from("fi_staff_shifts").select("shift_source").eq("tenant_id", tid).limit(1),
  ]);
  return !standardHoursRes.error && !shiftsRes.error;
}

async function pinpointRosterLoadStep(
  input: LoadRosterCommandCentreInput
): Promise<RosterLoadStep> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const dateRange = input.dateRange ?? { startsAt: "", endsAt: "" };
  const supabase = supabaseAdmin();

  try {
    await loadAllStaffForTenant(tid);
  } catch {
    return "load_staff";
  }

  try {
    await loadActiveStandardHoursForTenant(tid);
  } catch {
    return "load_standard_hours";
  }

  try {
    const shiftsRes = await supabase
      .from("fi_staff_shifts")
      .select("id")
      .eq("tenant_id", tid)
      .neq("status", "cancelled")
      .gte("starts_at", dateRange.startsAt)
      .lt("starts_at", dateRange.endsAt)
      .limit(1);
    if (shiftsRes.error) throw new Error(shiftsRes.error.message);
  } catch {
    return "load_shifts";
  }

  try {
    const blocksRes = await supabase
      .from("fi_staff_availability_blocks")
      .select("id")
      .eq("tenant_id", tid)
      .eq("status", "active")
      .gte("starts_at", dateRange.startsAt)
      .lt("starts_at", dateRange.endsAt)
      .limit(1);
    if (blocksRes.error) throw new Error(blocksRes.error.message);
  } catch {
    return "load_availability";
  }

  try {
    await loadBookingsForOperatorView({
      tenantId: tid,
      rangeStartIso: dateRange.startsAt,
      rangeEndIso: dateRange.endsAt,
      clinicId: input.clinicId?.trim() || undefined,
      limit: 1,
    });
  } catch {
    return "load_clinical_events";
  }

  return "load_roster_payload";
}

function failureDigest(error: unknown): string | undefined {
  if (error instanceof Error && "digest" in error) {
    const digest = (error as Error & { digest?: string }).digest;
    return digest?.trim() || undefined;
  }
  return undefined;
}

export async function loadRosterCommandCentrePageData(
  input: LoadRosterCommandCentreInput & { preselectedEventKey?: string | null }
): Promise<RosterCommandCentrePageResult> {
  const schemaCheckPassed = await verifyRosterSchema(input.tenantId).catch(() => false);
  if (!schemaCheckPassed) {
    return {
      ok: false,
      failedStep: "schema_check",
      message:
        "Roster schema check failed. Confirm fi_staff_standard_hours and fi_staff_shifts.shift_source exist for this tenant.",
      schemaCheckPassed: false,
      counts: {},
    };
  }

  let payload: RosterCommandCentrePayload;
  try {
    payload = await loadRosterCommandCentre(input);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Roster load failed.";
    const failedStep = await pinpointRosterLoadStep(input).catch(
      (): RosterLoadStep => "load_roster_payload"
    );
    return {
      ok: false,
      failedStep,
      message,
      digest: failureDigest(e),
      schemaCheckPassed: true,
      counts: {},
    };
  }

  const eventDetails: RosterCommandCentrePageSuccess["eventDetails"] = {};
  /** Only hydrate explicitly selected events — missing-role scans load every staff member per role. */
  const hydrationKeys = input.preselectedEventKey?.trim()
    ? [input.preselectedEventKey.trim()]
    : [];

  try {
    const hydrationResults = await Promise.allSettled(
      hydrationKeys.map(async (key) => {
        const [eventSource, eventId] = key.split(":");
        if (!eventSource || !eventId || eventSource !== "booking") return null;
        const detail = await loadRosterEventDetail({
          tenantId: input.tenantId.trim(),
          eventSource: "booking",
          eventId,
        });
        if (!detail.event) return null;
        return { key, candidatesByRole: detail.candidatesByRole };
      })
    );

    for (const result of hydrationResults) {
      if (result.status !== "fulfilled" || !result.value) continue;
      eventDetails[result.value.key] = { candidatesByRole: result.value.candidatesByRole };
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Roster event detail load failed.";
    return {
      ok: false,
      failedStep: "load_event_details",
      message,
      digest: failureDigest(e),
      schemaCheckPassed: true,
      counts: countsFromPayload(payload),
    };
  }

  return {
    ok: true,
    payload: { ...payload, preselectedEventKey: input.preselectedEventKey?.trim() || null },
    eventDetails,
    schemaCheckPassed: true,
    counts: countsFromPayload(payload),
  };
}
