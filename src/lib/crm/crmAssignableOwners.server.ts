/**
 * Server loader: staff-first CRM owner options for Assign / New enquiry.
 */

import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  resolveCrmAssignableOwners,
  type CrmAssignableStaffInput,
  type CrmAssignableUserInput,
  type CrmShellOwnerPickerRow,
} from "@/src/lib/crm/crmAssignableOwners";
import type { CrmShellUserPickerOption } from "@/src/lib/crm/types";

export type LoadCrmAssignableOwnersResult = {
  options: CrmShellUserPickerOption[];
  timingMs: {
    staffQuery: number;
    membersQuery: number;
    usersQuery: number;
    build: number;
    total: number;
  };
  diagnostics: {
    staffInputCount: number;
    userInputCount: number;
    eligibleCount: number;
    excludedSeedCount: number;
    excludedIneligibleCount: number;
    emailFallbackCount: number;
  };
};

/**
 * Canonical owner picker source. Prefer this over enumerating all fi_users.
 */
export async function loadCrmAssignableOwnerOptions(
  tenantId: string
): Promise<LoadCrmAssignableOwnersResult> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();
  const t0 = Date.now();

  // Staff-first: only active staff rows (dramatically smaller than all historical fi_users).
  const staffStart = Date.now();
  const staffRes = await supabase
    .from("fi_staff")
    .select("id, full_name, staff_role, email, fi_user_id, is_active")
    .eq("tenant_id", tid)
    .eq("is_active", true)
    .not("fi_user_id", "is", null)
    .order("full_name", { ascending: true })
    .limit(500);
  const staffQueryMs = Date.now() - staffStart;
  if (staffRes.error) throw new Error(staffRes.error.message);

  const staffRows = (staffRes.data ?? []) as {
    id: string;
    full_name: string | null;
    staff_role: string | null;
    email: string | null;
    fi_user_id: string | null;
    is_active: boolean;
  }[];

  const staffIds = staffRows.map((r) => String(r.id));
  const linkedUserIds = [
    ...new Set(staffRows.map((r) => r.fi_user_id?.trim()).filter((x): x is string => Boolean(x))),
  ];

  const membersStart = Date.now();
  const membersByStaffId = new Map<
    string,
    { employment_status: string | null; archived_at: string | null }
  >();
  if (staffIds.length > 0) {
    const membersRes = await supabase
      .from("fi_staff_members")
      .select("fi_staff_id, employment_status, archived_at")
      .eq("tenant_id", tid)
      .in("fi_staff_id", staffIds);
    // Non-fatal if lifecycle table missing rows
    if (!membersRes.error) {
      for (const raw of membersRes.data ?? []) {
        const r = raw as {
          fi_staff_id: string | null;
          employment_status: string | null;
          archived_at: string | null;
        };
        const sid = r.fi_staff_id?.trim();
        if (!sid) continue;
        membersByStaffId.set(sid, {
          employment_status: r.employment_status != null ? String(r.employment_status) : null,
          archived_at: r.archived_at != null ? String(r.archived_at) : null,
        });
      }
    }
  }
  const membersQueryMs = Date.now() - membersStart;

  const usersStart = Date.now();
  // Linked users + narrow set of staffless CRM operators (not entire tenant user table).
  const [linkedUsersRes, operatorUsersRes] = await Promise.all([
    linkedUserIds.length
      ? supabase
          .from("fi_users")
          .select("id, email, role")
          .eq("tenant_id", tid)
          .in("id", linkedUserIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("fi_users")
      .select("id, email, role")
      .eq("tenant_id", tid)
      .in("role", ["fi_admin", "admin", "crm_operator", "owner"])
      .limit(50),
  ]);
  const usersQueryMs = Date.now() - usersStart;
  if (linkedUsersRes.error) throw new Error(linkedUsersRes.error.message);
  if (operatorUsersRes.error) throw new Error(operatorUsersRes.error.message);

  const userMap = new Map<string, CrmAssignableUserInput>();
  for (const raw of [...(linkedUsersRes.data ?? []), ...(operatorUsersRes.data ?? [])]) {
    const r = raw as { id: string; email: string | null; role: string | null };
    const id = String(r.id);
    if (!userMap.has(id)) {
      userMap.set(id, {
        userId: id,
        email: r.email != null ? String(r.email) : null,
        role: r.role != null ? String(r.role) : null,
      });
    }
  }

  const staffInput: CrmAssignableStaffInput[] = staffRows.map((r) => {
    const life = membersByStaffId.get(String(r.id));
    return {
      staffId: String(r.id),
      fullName: r.full_name != null ? String(r.full_name).trim() || null : null,
      staffRole: r.staff_role != null ? String(r.staff_role) : null,
      workEmail: r.email != null ? String(r.email) : null,
      fiUserId: r.fi_user_id != null ? String(r.fi_user_id) : null,
      isActive: Boolean(r.is_active),
      employmentStatus: life?.employment_status ?? null,
      archivedAt: life?.archived_at ?? null,
    };
  });

  const buildStart = Date.now();
  const resolved = resolveCrmAssignableOwners({
    staff: staffInput,
    users: [...userMap.values()],
  });
  const buildMs = Date.now() - buildStart;
  const totalMs = Date.now() - t0;

  if (process.env.PIPELINE_OWNER_TIMING === "1" || process.env.NODE_ENV !== "production") {
    console.info(
      "[crm-assignable-owners]",
      JSON.stringify({
        tenantId: tid,
        ...resolved.diagnostics,
        timingMs: {
          staffQuery: staffQueryMs,
          membersQuery: membersQueryMs,
          usersQuery: usersQueryMs,
          build: buildMs,
          total: totalMs,
        },
      })
    );
  }

  const options: CrmShellUserPickerOption[] = resolved.shellRows.map(shellRowToPicker);

  return {
    options,
    timingMs: {
      staffQuery: staffQueryMs,
      membersQuery: membersQueryMs,
      usersQuery: usersQueryMs,
      build: buildMs,
      total: totalMs,
    },
    diagnostics: resolved.diagnostics,
  };
}

function shellRowToPicker(row: CrmShellOwnerPickerRow): CrmShellUserPickerOption {
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    staff_role: row.staff_role ?? null,
    role: row.role ?? null,
    is_active: row.is_active ?? true,
  };
}
