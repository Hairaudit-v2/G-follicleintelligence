import "server-only";

import { calendarDateStringFromInstant, resolveTenantCalendarTimezone } from "@/src/lib/calendar/calendarTimezone";
import { HR_OS_ROUTE_REQUIRED_ROLES } from "@/src/lib/platform/entitlements/hrOsRouteGateCore.server";
import { resolveHrOsRouteAccess } from "@/src/lib/platform/entitlements/hrOsRouteGate.server";
import { workforceTenantClient } from "@/src/lib/workforce-os/security/tenantScopedQuery.server";
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

  // Tenant-scoped via the WorkforceOS guard helper (see workforce-os/security/tenantScopedQuery.server.ts).
  const { data, error } = await workforceTenantClient(tenantId)
    .list("fi_staff_members", "id, full_name, fi_staff_id")
    .in("id", unique);
  if (error) throw new Error(error.message);

  // Dynamic-column select infers a loose row type from PostgREST; normalise once via `unknown`.
  const rows = (data ?? []) as unknown as Array<{
    id: string;
    full_name: string | null;
    fi_staff_id: string | null;
  }>;

  const map = new Map<string, PayPeriodExportStaffRef>();
  for (const row of rows) {
    const id = String(row.id);
    map.set(id, {
      staffMemberId: id,
      fiStaffId: row.fi_staff_id != null ? String(row.fi_staff_id) : null,
      staffFullName: row.full_name != null ? String(row.full_name) : null,
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
  const { data: tzRow } = await workforceTenantClient(tid)
    .list("fi_tenant_settings", "default_timezone, metadata")
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