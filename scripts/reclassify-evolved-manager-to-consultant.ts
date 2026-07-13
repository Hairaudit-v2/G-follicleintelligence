#!/usr/bin/env tsx
/**
 * One-shot: reclassify manager@evolvedhair.com.au from tenant_backend/manager to consultant.
 * Dry-run by default; pass --commit to apply.
 *
 *   node scripts/run-with-system-ca.mjs tsx scripts/reclassify-evolved-manager-to-consultant.ts
 *   node scripts/run-with-system-ca.mjs tsx scripts/reclassify-evolved-manager-to-consultant.ts --commit
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { supabaseAdmin } from "../lib/supabaseAdmin";
import { resolveFiOsPostLoginPathSuffix } from "../src/lib/fiOs/fiOsRoleLandingCore";
import { normalizeStaffRoleKey } from "../src/lib/staffAccess/staffAccessRegistry";

const AUTH_USER_ID = "af1f9179-8441-4027-b434-4a3ccdb6ca66";
const TENANT_ID = "c2615b95-b707-4485-aa5f-be8f78ec868a";
const EMAIL = "manager@evolvedhair.com.au";

const TARGET = {
  authFiRole: "member",
  fiUsersRole: "member",
  staffRole: "consultant",
} as const;

function loadRepoEnvFiles(): void {
  for (const name of [".env.local", ".env"] as const) {
    const p = resolve(process.cwd(), name);
    if (!existsSync(p)) continue;
    let raw = readFileSync(p, "utf8");
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const withoutExport = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
      const eq = withoutExport.indexOf("=");
      if (eq <= 0) continue;
      const key = withoutExport.slice(0, eq).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      let val = withoutExport.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

type Snapshot = {
  auth: {
    email: string | null;
    fi_role: string | null;
    fi_tenant_id: string | null;
    user_metadata: Record<string, unknown>;
  } | null;
  fiUser: {
    id: string;
    role: string;
    email: string | null;
  } | null;
  fiStaff: {
    id: string;
    staff_role: string | null;
    full_name: string | null;
    is_active: boolean;
  } | null;
  fiStaffMember: { id: string; role_code: string | null } | null;
  tenantAdmin: {
    admin_role: string;
    status: string;
  } | null;
  fiOsIdentity: { os_role: string } | null;
  referenceConsultants: Array<{
    email: string | null;
    fi_users_role: string;
    staff_role: string | null;
    auth_fi_role: string | null;
  }>;
};

async function loadSnapshot(supabase: ReturnType<typeof supabaseAdmin>): Promise<Snapshot> {
  const { data: authData, error: authErr } = await supabase.auth.admin.getUserById(AUTH_USER_ID);
  if (authErr) throw new Error(`auth lookup: ${authErr.message}`);

  const meta = (authData.user?.user_metadata ?? {}) as Record<string, unknown>;

  const { data: fiUser } = await supabase
    .from("fi_users")
    .select("id, role, email")
    .eq("tenant_id", TENANT_ID)
    .eq("auth_user_id", AUTH_USER_ID)
    .maybeSingle();

  let fiStaff: Snapshot["fiStaff"] = null;
  if (fiUser) {
    const { data: staff } = await supabase
      .from("fi_staff")
      .select("id, staff_role, full_name, is_active")
      .eq("tenant_id", TENANT_ID)
      .eq("fi_user_id", String((fiUser as { id: string }).id))
      .maybeSingle();
    if (staff) {
      const s = staff as {
        id: string;
        staff_role: string | null;
        full_name: string | null;
        is_active: boolean;
      };
      fiStaff = {
        id: String(s.id),
        staff_role: s.staff_role,
        full_name: s.full_name,
        is_active: Boolean(s.is_active),
      };
    }
  }

  let fiStaffMember: Snapshot["fiStaffMember"] = null;
  if (fiStaff) {
    const { data: member } = await supabase
      .from("fi_staff_members")
      .select("id, role_code")
      .eq("fi_staff_id", fiStaff.id)
      .is("archived_at", null)
      .maybeSingle();
    if (member) {
      fiStaffMember = {
        id: String((member as { id: string }).id),
        role_code: (member as { role_code: string | null }).role_code,
      };
    }
  }

  let tenantAdmin: Snapshot["tenantAdmin"] = null;
  if (fiUser) {
    const { data: admin } = await supabase
      .from("fi_tenant_admin_users")
      .select("admin_role, status")
      .eq("tenant_id", TENANT_ID)
      .eq("fi_user_id", String((fiUser as { id: string }).id))
      .maybeSingle();
    if (admin) {
      tenantAdmin = {
        admin_role: String((admin as { admin_role: string }).admin_role),
        status: String((admin as { status: string }).status),
      };
    }
  }

  const { data: osRow } = await supabase
    .from("fi_os_identities")
    .select("os_role")
    .eq("auth_user_id", AUTH_USER_ID)
    .maybeSingle();

  const { data: consultantStaffRows } = await supabase
    .from("fi_staff")
    .select("id, staff_role, fi_user_id")
    .eq("tenant_id", TENANT_ID)
    .ilike("staff_role", "%consultant%")
    .eq("is_active", true)
    .limit(5);

  const referenceConsultants: Snapshot["referenceConsultants"] = [];
  for (const row of consultantStaffRows ?? []) {
    const fiUserId = String((row as { fi_user_id: string }).fi_user_id);
    const { data: u } = await supabase
      .from("fi_users")
      .select("email, role, auth_user_id")
      .eq("id", fiUserId)
      .maybeSingle();
    let authFiRole: string | null = null;
    const authId = (u as { auth_user_id: string | null } | null)?.auth_user_id;
    if (authId) {
      const { data: refAuth } = await supabase.auth.admin.getUserById(authId);
      authFiRole =
        typeof refAuth.user?.user_metadata?.fi_role === "string"
          ? refAuth.user.user_metadata.fi_role
          : null;
    }
    referenceConsultants.push({
      email: (u as { email: string | null } | null)?.email ?? null,
      fi_users_role: String((u as { role: string } | null)?.role ?? ""),
      staff_role: String((row as { staff_role: string | null }).staff_role ?? ""),
      auth_fi_role: authFiRole,
    });
  }

  return {
    auth: authData.user
      ? {
          email: authData.user.email ?? null,
          fi_role: typeof meta.fi_role === "string" ? meta.fi_role : null,
          fi_tenant_id: typeof meta.fi_tenant_id === "string" ? meta.fi_tenant_id : null,
          user_metadata: meta,
        }
      : null,
    fiUser: fiUser
      ? {
          id: String((fiUser as { id: string }).id),
          role: String((fiUser as { role: string | null }).role ?? "member"),
          email: (fiUser as { email: string | null }).email,
        }
      : null,
    fiStaff,
    fiStaffMember,
    tenantAdmin,
    fiOsIdentity: osRow ? { os_role: String((osRow as { os_role: string }).os_role) } : null,
    referenceConsultants,
  };
}

function landingPreview(staffRole: string | null, fiUsersRole: string, osRole: string | null) {
  const staffKey = normalizeStaffRoleKey(staffRole) ?? staffRole?.trim().toLowerCase() ?? null;
  return resolveFiOsPostLoginPathSuffix({
    osRole: osRole,
    staffRoleKey: staffKey,
  });
}

async function main(): Promise<void> {
  loadRepoEnvFiles();
  const commit = process.argv.includes("--commit");
  const supabase = supabaseAdmin();

  console.log("=== BEFORE ===");
  const before = await loadSnapshot(supabase);
  console.log(JSON.stringify(before, null, 2));

  if (before.tenantAdmin) {
    console.warn(
      "\nWARN: fi_tenant_admin_users row present — not removing automatically:",
      before.tenantAdmin
    );
  }

  if (!before.fiUser) {
    console.error("FAIL: no fi_users row for auth user in tenant");
    process.exit(1);
  }
  if (!before.fiStaff) {
    console.error("FAIL: no fi_staff row linked to fi_user");
    process.exit(1);
  }

  const planned = {
    auth: {
      fi_role: TARGET.authFiRole,
      fi_tenant_id: TENANT_ID,
    },
    fi_users: { role: TARGET.fiUsersRole },
    fi_staff: { staff_role: TARGET.staffRole },
    fi_staff_members: { role_code: TARGET.staffRole },
    fi_os_identities: before.fiOsIdentity
      ? "unchanged (staff_role drives landing)"
      : "no row — not creating (match Evolved consultant pattern)",
  };
  console.log("\n=== PLANNED CHANGES ===");
  console.log(JSON.stringify(planned, null, 2));
  console.log(
    "\nLanding preview after:",
    landingPreview(TARGET.staffRole, TARGET.fiUsersRole, before.fiOsIdentity?.os_role ?? null)
  );

  if (!commit) {
    console.log("\nDRY-RUN complete. Re-run with --commit to apply.");
    return;
  }

  const nextMeta = {
    ...before.auth?.user_metadata,
    fi_role: TARGET.authFiRole,
    fi_tenant_id: TENANT_ID,
  };
  const { error: authUpdateErr } = await supabase.auth.admin.updateUserById(AUTH_USER_ID, {
    user_metadata: nextMeta,
  });
  if (authUpdateErr) throw new Error(`auth update: ${authUpdateErr.message}`);

  const { error: fiUserErr } = await supabase
    .from("fi_users")
    .update({ role: TARGET.fiUsersRole, updated_at: new Date().toISOString() })
    .eq("id", before.fiUser.id)
    .eq("tenant_id", TENANT_ID);
  if (fiUserErr) throw new Error(`fi_users update: ${fiUserErr.message}`);

  const { error: staffErr } = await supabase
    .from("fi_staff")
    .update({ staff_role: TARGET.staffRole, updated_at: new Date().toISOString() })
    .eq("id", before.fiStaff.id)
    .eq("tenant_id", TENANT_ID);
  if (staffErr) throw new Error(`fi_staff update: ${staffErr.message}`);

  if (before.fiStaffMember) {
    const { error: memberErr } = await supabase
      .from("fi_staff_members")
      .update({ role_code: TARGET.staffRole, updated_at: new Date().toISOString() })
      .eq("id", before.fiStaffMember.id);
    if (memberErr) throw new Error(`fi_staff_members update: ${memberErr.message}`);
  }

  console.log("\n=== AFTER ===");
  const after = await loadSnapshot(supabase);
  console.log(JSON.stringify(after, null, 2));
  console.log(
    "\nLanding preview verified:",
    landingPreview(
      after.fiStaff?.staff_role ?? null,
      after.fiUser?.role ?? "",
      after.fiOsIdentity?.os_role ?? null
    )
  );
  console.log("\nPASS: updates applied for", EMAIL);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
