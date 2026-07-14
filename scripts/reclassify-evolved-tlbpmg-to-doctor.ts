#!/usr/bin/env tsx
/**
 * Provision + reclassify tlbpmg@gmail.com as Evolved doctor for raw-password login.
 * Dry-run by default; pass --commit to apply.
 *
 * Before this script: auth user exists, but fi_users is only on Demo Clinic
 * (tenant_backend + invited clinic_admin) with no Evolved membership / fi_staff.
 *
 *   node scripts/run-with-system-ca.mjs tsx scripts/reclassify-evolved-tlbpmg-to-doctor.ts
 *   node scripts/run-with-system-ca.mjs tsx scripts/reclassify-evolved-tlbpmg-to-doctor.ts --commit
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { supabaseAdmin } from "../lib/supabaseAdmin";
import { resolveWorkspaceProfileKeyFromSignals } from "../src/lib/fi-os/workspaceProfileDerivation";
import { resolveFiOsPostLoginPathSuffix } from "../src/lib/fiOs/fiOsRoleLandingCore";
import { normalizeStaffRoleKey } from "../src/lib/staffAccess/staffAccessRegistry";
import { normalizeFiTenantAdminRole } from "../src/lib/tenantAdmin/tenantAdminRoles";

const AUTH_USER_ID = "b6c79e17-0fb2-46b3-835a-f7626c79b52b";
const TENANT_ID = "c2615b95-b707-4485-aa5f-be8f78ec868a";
/** Demo Clinic (acme-demo) — legacy membership to demote/clear admin overrides. */
const DEMO_TENANT_ID = "cef53cb8-04b6-4e06-878a-5ba065c22425";
const EMAIL = "tlbpmg@gmail.com";
/** Global position type: DOCTOR → default_workspace_profile doctor */
const DOCTOR_POSITION_TYPE_ID = "331fe3e7-adcc-4d38-94a8-c84ebcd5508c";

const TARGET = {
  authFiRole: "member",
  /** Match Seetal doctor convention (`member` + staff_role doctor). */
  fiUsersRole: "member",
  staffRole: "doctor",
  displayFullName: "tlbpmg",
  displayFirstName: "tlbpmg",
  workspaceProfile: "doctor",
  positionTypeId: DOCTOR_POSITION_TYPE_ID,
  defaultTimezone: "Australia/Perth",
} as const;

const ADMIN_METADATA_KEYS = [
  "clinic_admin",
  "finance_admin",
  "operations_admin",
  "dashboard_viewer",
  "manager",
  "owner",
  "consultant",
  "doctor",
  "nurse",
  "platform_admin",
] as const;

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

function scrubAdminStaffMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (key === "workspace_profile") continue;
    const lower = key.toLowerCase();
    if (ADMIN_METADATA_KEYS.some((k) => lower.includes(k))) continue;
    next[key] = value;
  }
  next.workspace_profile = TARGET.workspaceProfile;
  return next;
}

type ProfileSnapshot = {
  auth: {
    email: string | null;
    fi_role: string | null;
    fi_tenant_id: string | null;
  } | null;
  fiUser: { id: string; role: string; email: string | null } | null;
  demoFiUser: { id: string; role: string; email: string | null } | null;
  fiStaff: {
    id: string;
    staff_role: string | null;
    full_name: string | null;
    position_type_id: string | null;
    staff_metadata: Record<string, unknown>;
    is_active: boolean;
  } | null;
  fiStaffMember: {
    id: string;
    role_code: string | null;
    full_name: string | null;
    first_name: string | null;
    source_synced_at: string | null;
  } | null;
  positionType: {
    id: string;
    code: string;
    default_workspace_profile: string | null;
  } | null;
  featureTemplate: { template_key: string; workspace_profile: string | null } | null;
  tenantAdmin: { admin_role: string; status: string } | null;
  demoTenantAdmin: { admin_role: string; status: string } | null;
  fiOsIdentity: { os_role: string } | null;
  derivedWorkspaceProfile: string;
  landingPath: string;
};

async function loadProfileSnapshot(
  supabase: ReturnType<typeof supabaseAdmin>
): Promise<ProfileSnapshot> {
  const { data: authData, error: authErr } = await supabase.auth.admin.getUserById(AUTH_USER_ID);
  if (authErr) throw new Error(`auth lookup: ${authErr.message}`);
  const meta = (authData.user?.user_metadata ?? {}) as Record<string, unknown>;

  const { data: fiUser } = await supabase
    .from("fi_users")
    .select("id, role, email")
    .eq("tenant_id", TENANT_ID)
    .eq("auth_user_id", AUTH_USER_ID)
    .maybeSingle();

  const { data: demoFiUser } = await supabase
    .from("fi_users")
    .select("id, role, email")
    .eq("tenant_id", DEMO_TENANT_ID)
    .eq("auth_user_id", AUTH_USER_ID)
    .maybeSingle();

  let fiStaff: ProfileSnapshot["fiStaff"] = null;
  if (fiUser) {
    const { data: staff } = await supabase
      .from("fi_staff")
      .select("id, staff_role, full_name, position_type_id, staff_metadata, is_active")
      .eq("tenant_id", TENANT_ID)
      .eq("fi_user_id", String((fiUser as { id: string }).id))
      .maybeSingle();
    if (staff) {
      const s = staff as {
        id: string;
        staff_role: string | null;
        full_name: string | null;
        position_type_id: string | null;
        staff_metadata: unknown;
        is_active: boolean;
      };
      const md =
        s.staff_metadata && typeof s.staff_metadata === "object" && !Array.isArray(s.staff_metadata)
          ? (s.staff_metadata as Record<string, unknown>)
          : {};
      fiStaff = {
        id: String(s.id),
        staff_role: s.staff_role,
        full_name: s.full_name,
        position_type_id: s.position_type_id,
        staff_metadata: md,
        is_active: Boolean(s.is_active),
      };
    }
  }

  let fiStaffMember: ProfileSnapshot["fiStaffMember"] = null;
  if (fiStaff) {
    const { data: member } = await supabase
      .from("fi_staff_members")
      .select("id, role_code, full_name, first_name, source_synced_at")
      .eq("fi_staff_id", fiStaff.id)
      .is("archived_at", null)
      .maybeSingle();
    if (member) {
      const m = member as {
        id: string;
        role_code: string | null;
        full_name: string | null;
        first_name: string | null;
        source_synced_at: string | null;
      };
      fiStaffMember = {
        id: String(m.id),
        role_code: m.role_code,
        full_name: m.full_name,
        first_name: m.first_name,
        source_synced_at: m.source_synced_at,
      };
    }
  }

  let positionType: ProfileSnapshot["positionType"] = null;
  let featureTemplate: ProfileSnapshot["featureTemplate"] = null;
  const posId = fiStaff?.position_type_id?.trim() ?? "";
  if (posId) {
    const { data: pt } = await supabase
      .from("fi_staff_position_types")
      .select("id, code, default_workspace_profile, default_feature_template_key")
      .eq("id", posId)
      .maybeSingle();
    if (pt) {
      positionType = {
        id: String((pt as { id: string }).id),
        code: String((pt as { code: string }).code),
        default_workspace_profile:
          (pt as { default_workspace_profile: string | null }).default_workspace_profile ?? null,
      };
      const tk = String(
        (pt as { default_feature_template_key: string | null }).default_feature_template_key ?? ""
      ).trim();
      if (tk) {
        const { data: tpl } = await supabase
          .from("fi_staff_feature_templates")
          .select("template_key, workspace_profile")
          .eq("template_key", tk)
          .or(`tenant_id.is.null,tenant_id.eq.${TENANT_ID}`)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();
        if (tpl) {
          featureTemplate = {
            template_key: String((tpl as { template_key: string }).template_key),
            workspace_profile:
              (tpl as { workspace_profile: string | null }).workspace_profile ?? null,
          };
        }
      }
    }
  }

  let tenantAdmin: ProfileSnapshot["tenantAdmin"] = null;
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

  let demoTenantAdmin: ProfileSnapshot["demoTenantAdmin"] = null;
  if (demoFiUser) {
    const { data: admin } = await supabase
      .from("fi_tenant_admin_users")
      .select("admin_role, status")
      .eq("tenant_id", DEMO_TENANT_ID)
      .eq("fi_user_id", String((demoFiUser as { id: string }).id))
      .maybeSingle();
    if (admin) {
      demoTenantAdmin = {
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

  const tenantAdminRole = normalizeFiTenantAdminRole(tenantAdmin?.admin_role ?? null);
  const derivedWorkspaceProfile = resolveWorkspaceProfileKeyFromSignals({
    explicitWorkspaceProfile: fiStaff?.staff_metadata.workspace_profile,
    positionTypeDefaultWorkspaceProfile: positionType?.default_workspace_profile ?? null,
    featureTemplateWorkspaceProfile: featureTemplate?.workspace_profile ?? null,
    staffRole: fiStaff?.staff_role ?? null,
    tenantAdminRole,
    fiOsRole: osRow ? String((osRow as { os_role: string }).os_role) : null,
  });

  const staffKey =
    normalizeStaffRoleKey(fiStaff?.staff_role) ?? fiStaff?.staff_role?.trim().toLowerCase() ?? null;
  const landingPath = resolveFiOsPostLoginPathSuffix({
    osRole: osRow ? String((osRow as { os_role: string }).os_role) : null,
    staffRoleKey: staffKey,
    workspaceProfile: derivedWorkspaceProfile,
    tenantAdminRole,
  });

  return {
    auth: authData.user
      ? {
          email: authData.user.email ?? null,
          fi_role: typeof meta.fi_role === "string" ? meta.fi_role : null,
          fi_tenant_id: typeof meta.fi_tenant_id === "string" ? meta.fi_tenant_id : null,
        }
      : null,
    fiUser: fiUser
      ? {
          id: String((fiUser as { id: string }).id),
          role: String((fiUser as { role: string | null }).role ?? "member"),
          email: (fiUser as { email: string | null }).email,
        }
      : null,
    demoFiUser: demoFiUser
      ? {
          id: String((demoFiUser as { id: string }).id),
          role: String((demoFiUser as { role: string | null }).role ?? "member"),
          email: (demoFiUser as { email: string | null }).email,
        }
      : null,
    fiStaff,
    fiStaffMember,
    positionType,
    featureTemplate,
    tenantAdmin,
    demoTenantAdmin,
    fiOsIdentity: osRow ? { os_role: String((osRow as { os_role: string }).os_role) } : null,
    derivedWorkspaceProfile,
    landingPath,
  };
}

async function main(): Promise<void> {
  loadRepoEnvFiles();
  const commit = process.argv.includes("--commit");
  const supabase = supabaseAdmin();

  console.log("=== BEFORE ===");
  const before = await loadProfileSnapshot(supabase);
  console.log(JSON.stringify(before, null, 2));

  if (!before.auth) {
    console.error("FAIL: auth user missing");
    process.exit(1);
  }

  const planned = {
    auth: { fi_role: TARGET.authFiRole, fi_tenant_id: TENANT_ID },
    fi_users_evolved: before.fiUser
      ? { role: TARGET.fiUsersRole }
      : {
          insert: {
            tenant_id: TENANT_ID,
            email: EMAIL,
            role: TARGET.fiUsersRole,
            auth_user_id: AUTH_USER_ID,
          },
        },
    fi_staff_evolved: before.fiStaff
      ? {
          staff_role: TARGET.staffRole,
          full_name: TARGET.displayFullName,
          position_type_id: TARGET.positionTypeId,
          staff_metadata: scrubAdminStaffMetadata(before.fiStaff.staff_metadata),
        }
      : {
          insert: {
            staff_role: TARGET.staffRole,
            full_name: TARGET.displayFullName,
            email: EMAIL,
            position_type_id: TARGET.positionTypeId,
            staff_metadata: { workspace_profile: TARGET.workspaceProfile },
            default_timezone: TARGET.defaultTimezone,
            is_active: true,
          },
        },
    fi_staff_members: before.fiStaffMember
      ? {
          role_code: TARGET.staffRole,
          full_name: TARGET.displayFullName,
          first_name: TARGET.displayFirstName,
        }
      : "no active member row",
    fi_tenant_admin_users_evolved: before.tenantAdmin ? "DELETE row" : "none",
    demo_clinic: {
      fi_users: before.demoFiUser
        ? before.demoFiUser.role === "member"
          ? "already member"
          : { role: "member", note: "demote from tenant_backend" }
        : "none",
      fi_tenant_admin_users: before.demoTenantAdmin ? "DELETE clinic_admin/finance row" : "none",
    },
  };

  console.log("\n=== PLANNED CHANGES ===");
  console.log(JSON.stringify(planned, null, 2));

  const afterPreview = resolveWorkspaceProfileKeyFromSignals({
    explicitWorkspaceProfile: TARGET.workspaceProfile,
    positionTypeDefaultWorkspaceProfile: "doctor",
    featureTemplateWorkspaceProfile: "doctor",
    staffRole: TARGET.staffRole,
    tenantAdminRole: null,
    fiOsRole: before.fiOsIdentity?.os_role ?? null,
  });
  const afterLanding = resolveFiOsPostLoginPathSuffix({
    osRole: before.fiOsIdentity?.os_role ?? null,
    staffRoleKey: TARGET.staffRole,
    workspaceProfile: afterPreview,
    tenantAdminRole: null,
  });

  console.log("\nPost-fix workspace preview:", afterPreview);
  console.log("Post-fix landing preview:", afterLanding);

  if (before.fiStaffMember?.source_synced_at) {
    console.warn(
      "\nWARN: fi_staff_members last HR sync:",
      before.fiStaffMember.source_synced_at,
      "— iiohr may overwrite staff_role/full_name on next sync."
    );
  }

  if (!commit) {
    console.log("\nDRY-RUN complete. Re-run with --commit to apply.");
    return;
  }

  const { data: authData } = await supabase.auth.admin.getUserById(AUTH_USER_ID);
  const nextAuthMeta = {
    ...((authData.user?.user_metadata ?? {}) as Record<string, unknown>),
    fi_role: TARGET.authFiRole,
    fi_tenant_id: TENANT_ID,
  };
  const { error: authErr } = await supabase.auth.admin.updateUserById(AUTH_USER_ID, {
    user_metadata: nextAuthMeta,
  });
  if (authErr) throw new Error(`auth update: ${authErr.message}`);

  let evolvedUserId = before.fiUser?.id ?? null;
  if (!evolvedUserId) {
    const { data: inserted, error: insErr } = await supabase
      .from("fi_users")
      .insert({
        tenant_id: TENANT_ID,
        email: EMAIL,
        role: TARGET.fiUsersRole,
        auth_user_id: AUTH_USER_ID,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (insErr) throw new Error(`fi_users insert (Evolved): ${insErr.message}`);
    evolvedUserId = String((inserted as { id: string }).id);
  } else {
    const { error } = await supabase
      .from("fi_users")
      .update({ role: TARGET.fiUsersRole, updated_at: new Date().toISOString() })
      .eq("id", evolvedUserId)
      .eq("tenant_id", TENANT_ID);
    if (error) throw new Error(`fi_users update (Evolved): ${error.message}`);
  }

  if (before.fiStaff) {
    const nextMeta = scrubAdminStaffMetadata(before.fiStaff.staff_metadata);
    const { error: staffErr } = await supabase
      .from("fi_staff")
      .update({
        staff_role: TARGET.staffRole,
        full_name: TARGET.displayFullName,
        position_type_id: TARGET.positionTypeId,
        staff_metadata: nextMeta,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", before.fiStaff.id)
      .eq("tenant_id", TENANT_ID);
    if (staffErr) throw new Error(`fi_staff update: ${staffErr.message}`);
  } else {
    const { error: staffInsErr } = await supabase.from("fi_staff").insert({
      tenant_id: TENANT_ID,
      fi_user_id: evolvedUserId,
      full_name: TARGET.displayFullName,
      staff_role: TARGET.staffRole,
      email: EMAIL,
      position_type_id: TARGET.positionTypeId,
      staff_metadata: { workspace_profile: TARGET.workspaceProfile },
      default_timezone: TARGET.defaultTimezone,
      working_hours: {},
      is_active: true,
      updated_at: new Date().toISOString(),
    });
    if (staffInsErr) throw new Error(`fi_staff insert: ${staffInsErr.message}`);
  }

  if (before.fiStaffMember) {
    const { error: memberErr } = await supabase
      .from("fi_staff_members")
      .update({
        role_code: TARGET.staffRole,
        full_name: TARGET.displayFullName,
        first_name: TARGET.displayFirstName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", before.fiStaffMember.id);
    if (memberErr) throw new Error(`fi_staff_members update: ${memberErr.message}`);
  }

  if (before.tenantAdmin && evolvedUserId) {
    const { error: adminErr } = await supabase
      .from("fi_tenant_admin_users")
      .delete()
      .eq("tenant_id", TENANT_ID)
      .eq("fi_user_id", evolvedUserId);
    if (adminErr) throw new Error(`fi_tenant_admin_users delete (Evolved): ${adminErr.message}`);
  }

  if (before.demoFiUser) {
    if (before.demoFiUser.role !== "member") {
      const { error: demoUserErr } = await supabase
        .from("fi_users")
        .update({ role: "member", updated_at: new Date().toISOString() })
        .eq("id", before.demoFiUser.id)
        .eq("tenant_id", DEMO_TENANT_ID);
      if (demoUserErr) throw new Error(`fi_users demote (Demo): ${demoUserErr.message}`);
    }
    if (before.demoTenantAdmin) {
      const { error: demoAdminErr } = await supabase
        .from("fi_tenant_admin_users")
        .delete()
        .eq("tenant_id", DEMO_TENANT_ID)
        .eq("fi_user_id", before.demoFiUser.id);
      if (demoAdminErr) {
        throw new Error(`fi_tenant_admin_users delete (Demo): ${demoAdminErr.message}`);
      }
    }
  }

  console.log("\n=== AFTER ===");
  const after = await loadProfileSnapshot(supabase);
  console.log(JSON.stringify(after, null, 2));

  if (after.derivedWorkspaceProfile !== "doctor" || after.landingPath !== "/doctor") {
    console.error(
      `FAIL: expected workspace=doctor landing=/doctor; got workspace=${after.derivedWorkspaceProfile} landing=${after.landingPath}`
    );
    process.exit(1);
  }
  if (after.tenantAdmin || after.demoTenantAdmin) {
    console.error("FAIL: tenant admin rows still present");
    process.exit(1);
  }
  if (after.auth?.fi_tenant_id !== TENANT_ID || after.auth?.fi_role !== TARGET.authFiRole) {
    console.error("FAIL: auth metadata not pointing at Evolved member");
    process.exit(1);
  }

  console.log("\nPASS: Evolved doctor profile ready for", EMAIL);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
