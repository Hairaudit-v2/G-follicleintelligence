/**
 * Focused smoke: roster → standard hours → generate → calendar eligibility chain.
 * Usage: node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs scripts/smoke-roster-calendar-chain.ts [tenantId]
 */
import { loadRepoEnvFiles } from "./lib/loadRepoEnvFiles.mjs";

loadRepoEnvFiles();

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadAllStaffForTenant } from "@/src/lib/staff/staff.server";
import {
  canSelectStaffForClinicalPicker,
  enrichCrmShellStaffPickerOption,
} from "@/src/lib/team/directory";
import { buildStaffHrNotificationNoLinkSummary } from "@/src/lib/staff/staffHrNotificationSummary";
import { parseStaffWeeklyHours } from "@/src/lib/staff/staffWeeklyHours";
import { loadWorkforceRosterPlanningPolicy } from "@/src/lib/workforce/rosterCadencePolicy.server";
import { rosterDateRangeFromPeriodStart } from "@/src/lib/workforce/rosterCadencePolicyCore";
import { loadRosterCommandCentrePageData } from "@/src/lib/workforce-os/rosterCommandCentrePageLoader.server";
import { listStaffMissingStandardHours } from "@/src/lib/workforce-os/rosterCommandCentreUxCore";
import { generateRosterFromStandardHoursForTenant } from "@/src/lib/workforce-os/rosterGeneration.server";
import {
  applyStandardHoursTemplate,
  staffHasConfiguredStandardHours,
} from "@/src/lib/workforce-os/staffStandardHoursCore";
import {
  applyDefaultClinicStandardHoursToMissingStaff,
  loadActiveStandardHoursForStaff,
  loadActiveStandardHoursForTenant,
  saveStaffStandardHours,
} from "@/src/lib/workforce-os/staffStandardHours.server";
import { defaultRosterCommandCentreDateRange } from "@/src/lib/workforce-os/workforceRosterQueryParams";

type CheckResult = { id: number; label: string; pass: boolean; detail: string };

const checks: CheckResult[] = [];
let tenantId = process.argv[2]?.trim() ?? "";

function record(id: number, label: string, pass: boolean, detail: string): void {
  checks.push({ id, label, pass, detail });
  const mark = pass ? "PASS" : "FAIL";
  console.log(`[${mark}] ${id}. ${label}`);
  console.log(`       ${detail}`);
}

async function resolveTenantId(): Promise<string> {
  if (tenantId) return tenantId;
  const slug = (process.env.FI_EVOLVED_TENANT_SLUG ?? "evolved").trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_tenants")
    .select("id, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) {
    throw new Error(`No fi_tenants row for slug=${slug}. Pass tenantId as argv[2].`);
  }
  return String(data.id);
}

async function loadRosterPayload(tid: string) {
  const rosterPlanning = await loadWorkforceRosterPlanningPolicy(tid);
  const defaultRange = defaultRosterCommandCentreDateRange(new Date(), rosterPlanning);
  return loadRosterCommandCentrePageData({
    tenantId: tid,
    dateRange: { startsAt: defaultRange.startsAt, endsAt: defaultRange.endsAt },
    periodStart: defaultRange.periodStart,
    weekStart: defaultRange.weekStart,
    rosterPlanning,
  });
}

async function main(): Promise<void> {
  tenantId = await resolveTenantId();
  console.log(`\n=== Roster→Calendar chain smoke (tenant ${tenantId}) ===\n`);

  const staffRows = await loadAllStaffForTenant(tenantId);
  const targetStaff =
    staffRows.find((s) => s.full_name?.toLowerCase().includes("connor")) ?? staffRows[0];
  if (!targetStaff) {
    console.error("No staff in tenant.");
    process.exit(1);
  }

  const otherStaff = staffRows.find((s) => s.id !== targetStaff.id) ?? null;

  // 1 — Standard hours save
  const beforeSave = await loadActiveStandardHoursForStaff(tenantId, targetStaff.id);
  const days = applyStandardHoursTemplate("reception_standard");
  const saved = await saveStaffStandardHours({
    tenantId,
    staffId: targetStaff.id,
    days,
  });
  const afterSave = await loadActiveStandardHoursForStaff(tenantId, targetStaff.id);
  const { data: staffRowAfter } = await supabaseAdmin()
    .from("fi_staff")
    .select("working_hours")
    .eq("tenant_id", tenantId)
    .eq("id", targetStaff.id)
    .maybeSingle();
  const weekly = parseStaffWeeklyHours(
    (staffRowAfter?.working_hours as Record<string, unknown> | null) ?? null
  );
  record(
    1,
    "Staff standard hours save correctly",
    saved.validation.valid &&
      staffHasConfiguredStandardHours(afterSave) &&
      Boolean(weekly.mon?.enabled || weekly.tue?.enabled),
    `validation=${saved.validation.valid}, configured before=${staffHasConfiguredStandardHours(beforeSave)}, after=${staffHasConfiguredStandardHours(afterSave)}, working_hours synced=${Boolean(weekly.mon?.enabled)}`
  );

  // 2 — Roster grid clears missing-hours state for saved staff
  const rosterAfterSave = await loadRosterPayload(tenantId);
  const missingAfterSave =
    rosterAfterSave.ok
      ? listStaffMissingStandardHours(
          rosterAfterSave.payload.staffOptions,
          rosterAfterSave.payload.standardHoursByStaffId
        )
      : [];
  const targetStillMissing = missingAfterSave.some((s) => s.id === targetStaff.id);
  record(
    2,
    'Roster grid clears "Set standard hours first" after save',
    rosterAfterSave.ok && !targetStillMissing,
    rosterAfterSave.ok
      ? `${targetStaff.full_name} in missing list: ${targetStillMissing} (missing count=${missingAfterSave.length})`
      : `Roster load failed: ${rosterAfterSave.ok ? "" : rosterAfterSave.message}`
  );

  // 3 — Bulk default only fills staff without hours (never overwrites)
  const hoursMapBeforeBulk = await loadActiveStandardHoursForTenant(tenantId);
  const preConfiguredIds = [...hoursMapBeforeBulk.entries()]
    .filter(([, days]) => staffHasConfiguredStandardHours(days))
    .map(([id]) => id);

  if (otherStaff && !staffHasConfiguredStandardHours(hoursMapBeforeBulk.get(otherStaff.id))) {
    await saveStaffStandardHours({
      tenantId,
      staffId: otherStaff.id,
      days: applyStandardHoursTemplate("four_ten"),
    });
    hoursMapBeforeBulk.set(otherStaff.id, applyStandardHoursTemplate("four_ten"));
    preConfiguredIds.push(otherStaff.id);
  }

  const bulk = await applyDefaultClinicStandardHoursToMissingStaff(tenantId);
  const hoursMapAfterBulk = await loadActiveStandardHoursForTenant(tenantId);

  let overwriteDetected = false;
  for (const configuredId of preConfiguredIds) {
    const beforeDays = hoursMapBeforeBulk.get(configuredId);
    const afterDays = hoursMapAfterBulk.get(configuredId);
    if (
      staffHasConfiguredStandardHours(beforeDays) &&
      JSON.stringify(beforeDays) !== JSON.stringify(afterDays)
    ) {
      overwriteDetected = true;
      break;
    }
  }

  const allSkippedWerePreConfigured = bulk.skippedStaffIds.every((id) =>
    preConfiguredIds.includes(id)
  );
  record(
    3,
    '"Apply default clinic hours" only fills staff with no existing hours',
    !overwriteDetected && bulk.skippedCount >= preConfiguredIds.length && allSkippedWerePreConfigured,
    `applied=${bulk.appliedCount}, skipped=${bulk.skippedCount}, overwriteDetected=${overwriteDetected}, preConfigured=${preConfiguredIds.length}`
  );

  // 4 — Generate roster works once staff hours exist
  const rosterPlanning = await loadWorkforceRosterPlanningPolicy(tenantId);
  const defaultRange = defaultRosterCommandCentreDateRange(new Date(), rosterPlanning);
  const genRange = rosterDateRangeFromPeriodStart(
    defaultRange.periodStart,
    rosterPlanning.rosterCadence,
    rosterPlanning.rosterWeekStartDay
  );
  let genError: string | null = null;
  let genCreated = 0;
  try {
    const gen = await generateRosterFromStandardHoursForTenant({
      tenantId,
      rangeStartIso: genRange.startsAt,
      rangeEndIso: genRange.endsAt,
      staffIds: [targetStaff.id],
      overwriteGeneratedOnly: true,
    });
    genCreated = gen.createdCount;
  } catch (e) {
    genError = e instanceof Error ? e.message : String(e);
  }
  record(
    4,
    "Generate roster works once staff hours exist",
    genError === null && genCreated >= 0,
    genError ?? `createdCount=${genCreated} for ${targetStaff.full_name}`
  );

  // 5 — Generated roster does not crash page on reload (double load)
  const reload1 = await loadRosterPayload(tenantId);
  const reload2 = await loadRosterPayload(tenantId);
  record(
    5,
    "Generated roster does not crash the page on reload",
    reload1.ok && reload2.ok,
    `reload1=${reload1.ok}, reload2=${reload2.ok}${!reload1.ok ? ` err=${reload1.message}` : ""}${!reload2.ok ? ` err2=${reload2.message}` : ""}`
  );

  // 6 — Calendar staff allocation sees eligible staff after hours sync
  const freshHr = buildStaffHrNotificationNoLinkSummary();
  const pickerOption = enrichCrmShellStaffPickerOption(
    {
      id: targetStaff.id,
      email: targetStaff.email ?? "",
      full_name: targetStaff.full_name ?? "Staff",
      staff_role: targetStaff.staff_role,
      is_active: targetStaff.is_active,
      working_hours: (staffRowAfter?.working_hours as Record<string, unknown>) ?? {},
    },
    freshHr
  );
  const calendarSelectable = canSelectStaffForClinicalPicker(pickerOption);
  record(
    6,
    "Calendar staff allocation can see eligible/available staff",
    calendarSelectable,
    `${targetStaff.full_name} clinically_available=${pickerOption.clinical_readiness.clinically_available}, block=${pickerOption.clinical_readiness.block_reason ?? "none"}`
  );

  // 7 — No full-tenant staff projection sync on roster render (static import graph check)
  const rosterLoaderSrc = await import("node:fs/promises").then((fs) =>
    fs.readFile("src/lib/workforce-os/rosterCommandCentrePageLoader.server.ts", "utf8")
  );
  const rosterCentreSrc = await import("node:fs/promises").then((fs) =>
    fs.readFile("src/lib/workforce-os/workforceRosterCommandCentre.server.ts", "utf8")
  );
  const rosterPageSrc = await import("node:fs/promises").then((fs) =>
    fs.readFile("app/(fi-admin)/fi-admin/[tenantId]/workforce-os/roster/page.tsx", "utf8")
  );
  const noProjectionSync =
    !rosterLoaderSrc.includes("syncAllStaffProjectionsForTenant") &&
    !rosterCentreSrc.includes("syncAllStaffProjectionsForTenant") &&
    !rosterPageSrc.includes("syncAllStaffProjectionsForTenant");
  record(
    7,
    "No full-tenant staff hydration runs during roster page render unless explicitly required",
    noProjectionSync,
    noProjectionSync
      ? "roster loader/centre/page do not import syncAllStaffProjectionsForTenant (loadAllStaffForTenant still runs for grid — expected)"
      : "syncAllStaffProjectionsForTenant found in roster render path"
  );

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n=== Summary: ${checks.length - failed.length}/${checks.length} passed ===`);
  if (failed.length) {
    console.log("\nFailed checks:");
    for (const f of failed) console.log(`  - ${f.id}: ${f.detail}`);
    process.exit(1);
  }
  console.log("All checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});