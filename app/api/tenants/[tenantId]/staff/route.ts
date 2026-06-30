/**
 * GET /api/tenants/[tenantId]/staff — list staff (tenant members).
 * POST — create staff (admin / fi_admin / service key).
 */
import { NextResponse } from "next/server";

import {
  assertCrmTenantReadAllowed,
  assertCrmTenantStaffManageAllowed,
} from "@/src/lib/crm/crmGate";
import { extractAdminKeyFromRequest, mapCrmRouteError } from "@/src/lib/crm/crmHttp";
import { staffCreateBodySchema } from "@/src/lib/staff/staffApiSchemas";
import { insertFiStaff, loadAllStaffForTenant } from "@/src/lib/staff/staff.server";

export const dynamic = "force-dynamic";

function serializeStaff(row: Awaited<ReturnType<typeof loadAllStaffForTenant>>[number]) {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    fi_user_id: row.fi_user_id,
    full_name: row.full_name,
    staff_role: row.staff_role,
    email: row.email,
    mobile: row.mobile,
    default_timezone: row.default_timezone,
    working_hours: row.working_hours,
    is_active: row.is_active,
    calendar_color: row.calendar_color,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    if (!tenantId?.trim())
      return NextResponse.json({ ok: false, error: "Missing tenantId." }, { status: 400 });

    const adminKey = extractAdminKeyFromRequest(req);
    await assertCrmTenantReadAllowed({ tenantId, adminKey, request: req });

    const rows = await loadAllStaffForTenant(tenantId.trim());
    return NextResponse.json({ ok: true, staff: rows.map(serializeStaff) });
  } catch (e: unknown) {
    return mapCrmRouteError(e);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    if (!tenantId?.trim())
      return NextResponse.json({ ok: false, error: "Missing tenantId." }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const adminKey = extractAdminKeyFromRequest(req, body);
    await assertCrmTenantStaffManageAllowed({ tenantId, adminKey, request: req });

    const parsed = staffCreateBodySchema.parse(body);
    const row = await insertFiStaff(tenantId.trim(), {
      full_name: parsed.full_name,
      staff_role: parsed.staff_role,
      email: parsed.email?.trim() || null,
      mobile: parsed.mobile?.trim() || null,
      default_timezone: parsed.default_timezone?.trim() || null,
      working_hours: parsed.working_hours ?? {},
      is_active: parsed.is_active,
      calendar_color: parsed.calendar_color?.trim() || null,
      fi_user_id:
        parsed.fi_user_id === "" || parsed.fi_user_id == null
          ? null
          : String(parsed.fi_user_id).trim() || null,
    });

    return NextResponse.json({ ok: true, staff: serializeStaff(row) }, { status: 201 });
  } catch (e: unknown) {
    return mapCrmRouteError(e);
  }
}
