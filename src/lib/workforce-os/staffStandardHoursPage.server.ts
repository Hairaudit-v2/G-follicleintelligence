import "server-only";

import { notFound } from "next/navigation";

import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadAllStaffForTenant } from "@/src/lib/staff/staff.server";
import { resolveHrOsRouteAccess } from "@/src/lib/platform/entitlements/hrOsRouteGate.server";
import { resolveStaffStandardHoursManageCapability } from "@/src/lib/workforce-os/staffStandardHoursManageGate.server";
import { loadWorkforceRosterPlanningPolicy } from "@/src/lib/workforce/rosterCadencePolicy.server";
import {
  loadActiveStandardHoursForStaff,
  loadActiveStandardHoursForTenant,
} from "@/src/lib/workforce-os/staffStandardHours.server";
import type { StaffStandardHoursDayInput } from "@/src/lib/workforce-os/staffStandardHoursCore";
import { listStaffMissingStandardHours } from "@/src/lib/workforce-os/rosterCommandCentreUxCore";

import type { RosterCommandCentreClinicOption } from "@/src/lib/workforce-os/workforceRosterCommandCentre.server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type StaffStandardHoursPageStaffOption = {
  id: string;
  name: string;
  role: string | null;
  hasStandardHours: boolean;
};

async function loadClinicsForTenant(tenantId: string): Promise<RosterCommandCentreClinicOption[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const { data, error } = await supabaseAdmin()
    .from("fi_clinics")
    .select("id, display_name")
    .eq("tenant_id", tid)
    .order("display_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const r = row as { id: string; display_name: string | null };
    return { id: String(r.id), displayName: r.display_name?.trim() || "Clinic" };
  });
}

export async function loadStaffStandardHoursSetupIndexPage(tenantId: string) {
  const access = await resolveHrOsRouteAccess(tenantId.trim());
  if (!access.ok) return null;

  const tid = tenantId.trim();
  const [staffRows, standardHoursMap, clinics, manage] = await Promise.all([
    loadAllStaffForTenant(tid),
    loadActiveStandardHoursForTenant(tid),
    loadClinicsForTenant(tid),
    resolveStaffStandardHoursManageCapability(tid),
  ]);

  const staffOptions = staffRows.map((s) => ({
    id: s.id,
    name: s.full_name?.trim() || "Staff",
    role: s.staff_role?.trim() || null,
  }));

  const standardHoursByStaffId: Record<string, StaffStandardHoursDayInput[]> = {};
  for (const [staffId, days] of standardHoursMap) {
    standardHoursByStaffId[staffId] = days;
  }

  const staffMissing = listStaffMissingStandardHours(staffOptions, standardHoursByStaffId);
  const staffWithOptions: StaffStandardHoursPageStaffOption[] = staffOptions.map((staff) => ({
    ...staff,
    hasStandardHours: Boolean(standardHoursByStaffId[staff.id]?.length),
  }));

  return {
    canManage: manage.canManage,
    manageDeniedReason: manage.manageDeniedReason,
    clinics,
    staffOptions: staffWithOptions,
    staffMissingStandardHours: staffMissing,
    standardHoursByStaffId,
  };
}

export async function loadStaffStandardHoursEditorPage(tenantId: string, staffId: string) {
  const access = await resolveHrOsRouteAccess(tenantId.trim());
  if (!access.ok) return null;

  const tid = tenantId.trim();
  const sid = staffId.trim();
  if (!sid) notFound();

  const [staffRows, days, clinics, rosterPlanning, manage] = await Promise.all([
    loadAllStaffForTenant(tid),
    loadActiveStandardHoursForStaff(tid, sid),
    loadClinicsForTenant(tid),
    loadWorkforceRosterPlanningPolicy(tid),
    resolveStaffStandardHoursManageCapability(tid),
  ]);

  const staff = staffRows.find((row) => row.id === sid);
  if (!staff) notFound();

  return {
    canManage: manage.canManage,
    manageDeniedReason: manage.manageDeniedReason,
    staff: {
      id: staff.id,
      name: staff.full_name?.trim() || "Staff",
      role: staff.staff_role?.trim() || null,
    },
    initialDays: days,
    clinics,
    rosterCadence: rosterPlanning.rosterCadence,
    defaultFullTimePattern: rosterPlanning.defaultFullTimePattern,
  };
}