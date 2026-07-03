/**
 * Smoke: standard-hours save + roster payload load (service role).
 * Usage: node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs scripts/smoke-standard-hours-roster.ts <tenantId> [staffId]
 */
import { loadRosterCommandCentrePageData } from "@/src/lib/workforce-os/rosterCommandCentrePageLoader.server";
import { defaultRosterCommandCentreDateRange } from "@/src/lib/workforce-os/workforceRosterQueryParams";
import { loadWorkforceRosterPlanningPolicy } from "@/src/lib/workforce/rosterCadencePolicy.server";
import {
  applyStandardHoursTemplate,
  staffHasConfiguredStandardHours,
} from "@/src/lib/workforce-os/staffStandardHoursCore";
import {
  loadActiveStandardHoursForStaff,
  saveStaffStandardHours,
} from "@/src/lib/workforce-os/staffStandardHours.server";
import { loadAllStaffForTenant } from "@/src/lib/staff/staff.server";

const tenantId = process.argv[2]?.trim();
const staffIdArg = process.argv[3]?.trim();

async function main() {
  if (!tenantId) {
    console.error("Usage: smoke-standard-hours-roster.ts <tenantId> [staffId]");
    process.exit(1);
  }

  const rosterPlanning = await loadWorkforceRosterPlanningPolicy(tenantId);
  const defaultRange = defaultRosterCommandCentreDateRange(new Date(), rosterPlanning);

  const staffRows = await loadAllStaffForTenant(tenantId);
  const staff =
    staffRows.find((s) => s.id === staffIdArg) ??
    staffRows.find((s) => s.full_name?.toLowerCase().includes("connor")) ??
    staffRows[0];

  if (!staff) {
    console.error("No staff found for tenant.");
    process.exit(1);
  }

  console.log(`Tenant: ${tenantId}`);
  console.log(`Staff: ${staff.full_name} (${staff.id})`);

  const before = await loadActiveStandardHoursForStaff(tenantId, staff.id);
  console.log(`Before save — configured: ${staffHasConfiguredStandardHours(before)}`);

  const days = applyStandardHoursTemplate("reception_standard");
  const saved = await saveStaffStandardHours({ tenantId, staffId: staff.id, days });
  console.log(`Save validation: ${saved.validation.valid}`);

  const after = await loadActiveStandardHoursForStaff(tenantId, staff.id);
  console.log(`After save — configured: ${staffHasConfiguredStandardHours(after)}`);

  const roster = await loadRosterCommandCentrePageData({
    tenantId,
    dateRange: { startsAt: defaultRange.startsAt, endsAt: defaultRange.endsAt },
    periodStart: defaultRange.periodStart,
    weekStart: defaultRange.weekStart,
    rosterPlanning,
  });

  if (!roster.ok) {
    console.error("Roster load failed:", roster.failedStep, roster.message);
    process.exit(1);
  }

  const hours = roster.payload.standardHoursByStaffId[staff.id];
  console.log(`Roster load ok — staff in hours map: ${Boolean(hours?.length)}`);
  console.log(`Weekly total minutes: ${hours ? hours.filter((d) => d.is_working_day).length : 0} working days`);
  console.log("Smoke passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});