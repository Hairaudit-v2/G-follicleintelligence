import "server-only";

import { calendarDateStringFromInstant, resolveTenantCalendarTimezone } from "@/src/lib/calendar/calendarTimezone";
import { HR_OS_ROUTE_REQUIRED_ROLES } from "@/src/lib/platform/entitlements/hrOsRouteGateCore.server";
import { resolveHrOsRouteAccess } from "@/src/lib/platform/entitlements/hrOsRouteGate.server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildPayPeriodExportBundle,
  parsePayPeriodExportScope,
  parsePayPeriodExportView,
  payPeriodExportFilename,
  serializePayPeriodExportCsv,
  type PayPeriodExportStaffRef,
} from "@/src/lib/workforce/payPeriodExportCore";
import { resolvePayPeriodContaining } from "@/src/lib/workforce/payPeriodCore";
import { loadWorkforceTimeClockPolicy } from "@/src/lib/workforce/staffTimeClockPolicy.server";
import { listTimesheetEntries } from "@/src/lib/workforce/wageProfile.server";

export type PayPeriodExportResult =
  | { ok: true; body: string; filename: string }
  | { ok: false; status: number; error: string };

async function loadStaffRefsForExport(
  tenantId: string,
  staffMemberIds: string[]
): Promise<Map<string, PayPeriodExportStaffRef>> {
  const unique = [...new Set(staffMemberIds)];
  if (unique.length === 0) return new Map();

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_members")
    .select("id, full_name, fi_staff_id")
    .eq("tenant_id", tenantId)
    .in("id", unique);
  if (error) throw new Error(error.message);

  const map = new Map<string, PayPeriodExportStaffRef>();
  for (const row of data ?? []) {
    const id = String((row as { id: string }).id);
    map.set(id, {
      staffMemberId: id,
      fiStaffId:
        (row as { fi_staff_id: string | null }).fi_staff_id != null
          ? String((row as { fi_staff_id: string | null }).fi_staff_id)
          : null,
      staffFullName:
        (row as { full_name: string | null }).full_name != null
          ? String((row as { full_name: string | null }).full_name)
          : null,
    });
  }
  return map;
}

export async function buildPayPeriodPayrollExport(input: {
  tenantId: string;
  periodDate?: string | null;
  scopeRaw?: string | null;
  viewRaw?: string | null;
}): Promise<PayPeriodExportResult> {
  const tid = input.tenantId.trim();
  const access = await resolveHrOsRouteAccess(tid);
  if (!access.ok) return { ok: false, status: 403, error: "WorkforceOS access denied." };

  const role = access.userRole.trim().toLowerCase();
  const canManage =
    access.platformAdminPreview ||
    (HR_OS_ROUTE_REQUIRED_ROLES as readonly string[]).includes(role);
  if (!canManage) {
    return { ok: false, status: 403, error: "Payroll export requires HR manager access." };
  }

  const timeClockPolicy = await loadWorkforceTimeClockPolicy(tid);
  const supabase = supabaseAdmin();
  const { data: tzRow } = await supabase
    .from("fi_tenant_settings")
    .select("default_timezone, metadata")
    .eq("tenant_id", tid)
    .maybeSingle();
  const calendarTimezone = resolveTenantCalendarTimezone(
    tzRow as { default_timezone?: string | null; metadata?: Record<string, unknown> | null } | null
  );
  const anchorDate =
    input.periodDate?.trim() ||
    calendarDateStringFromInstant(new Date(), calendarTimezone);
  const payPeriod = resolvePayPeriodContaining(
    anchorDate,
    timeClockPolicy.payPeriodFrequency,
    timeClockPolicy.payPeriodAnchor
  );

  const entries = await listTimesheetEntries(tid, {
    periodStart: payPeriod.start,
    periodEnd: payPeriod.end,
    limit: 5000,
  });
  const staffRefs = await loadStaffRefsForExport(
    tid,
    entries.map((e) => e.staffMemberId)
  );

  const bundle = buildPayPeriodExportBundle({
    tenantId: tid,
    payPeriod,
    entries,
    staffRefs,
    scope: parsePayPeriodExportScope(input.scopeRaw),
    view: parsePayPeriodExportView(input.viewRaw),
  });

  return {
    ok: true,
    body: serializePayPeriodExportCsv(bundle),
    filename: payPeriodExportFilename(bundle),
  };
}