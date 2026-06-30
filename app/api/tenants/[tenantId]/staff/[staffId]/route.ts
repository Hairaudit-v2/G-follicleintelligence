/**
 * PATCH /api/tenants/[tenantId]/staff/[staffId] — update staff (admin / fi_admin / service key).
 */
import { NextResponse } from "next/server";

import { assertCrmTenantStaffManageAllowed } from "@/src/lib/crm/crmGate";
import { extractAdminKeyFromRequest, mapCrmRouteError } from "@/src/lib/crm/crmHttp";
import { staffPatchBodySchema } from "@/src/lib/staff/staffApiSchemas";
import { updateFiStaff } from "@/src/lib/staff/staff.server";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; staffId: string }> }
) {
  try {
    const { tenantId, staffId } = await params;
    if (!tenantId?.trim() || !staffId?.trim()) {
      return NextResponse.json(
        { ok: false, error: "Missing tenantId or staffId." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const adminKey = extractAdminKeyFromRequest(req, body);
    await assertCrmTenantStaffManageAllowed({ tenantId, adminKey, request: req });

    const parsed = staffPatchBodySchema.parse(body);
    const patch: Parameters<typeof updateFiStaff>[2] = {};
    if (parsed.full_name !== undefined) patch.full_name = parsed.full_name;
    if (parsed.staff_role !== undefined) patch.staff_role = parsed.staff_role;
    if (parsed.email !== undefined) patch.email = parsed.email?.trim() || null;
    if (parsed.mobile !== undefined) patch.mobile = parsed.mobile?.trim() || null;
    if (parsed.default_timezone !== undefined)
      patch.default_timezone = parsed.default_timezone?.trim() || null;
    if (parsed.working_hours !== undefined) patch.working_hours = parsed.working_hours ?? {};
    if (parsed.is_active !== undefined) patch.is_active = parsed.is_active;
    if (parsed.calendar_color !== undefined)
      patch.calendar_color = parsed.calendar_color?.trim() || null;
    if (parsed.fi_user_id !== undefined) {
      patch.fi_user_id =
        parsed.fi_user_id === "" || parsed.fi_user_id == null
          ? null
          : String(parsed.fi_user_id).trim() || null;
    }

    const row = await updateFiStaff(tenantId.trim(), staffId.trim(), patch);
    return NextResponse.json({
      ok: true,
      staff: {
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
      },
    });
  } catch (e: unknown) {
    return mapCrmRouteError(e);
  }
}
