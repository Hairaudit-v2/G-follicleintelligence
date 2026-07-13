#!/usr/bin/env tsx
/**
 * Reclassify + profile-fix for roslynhrichards@outlook.com as Evolved receptionist.
 * Dry-run by default; pass --commit to apply.
 *
 *   node scripts/run-with-system-ca.mjs tsx scripts/reclassify-evolved-roslyn-to-receptionist.ts
 *   node scripts/run-with-system-ca.mjs tsx scripts/reclassify-evolved-roslyn-to-receptionist.ts --commit
 *   node scripts/run-with-system-ca.mjs tsx scripts/reclassify-evolved-roslyn-to-receptionist.ts --profile-only --commit
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { supabaseAdmin } from "../lib/supabaseAdmin";
import { resolveWorkspaceProfileKeyFromSignals } from "../src/lib/fi-os/workspaceProfileDerivation";
import { resolveFiOsPostLoginPathSuffix } from "../src/lib/fiOs/fiOsRoleLandingCore";
import { normalizeStaffRoleKey } from "../src/lib/staffAccess/staffAccessRegistry";
import { isCrmShellNavRole, isCrmShellNavStaffRole } from "../src/lib/crm/crmGatePolicy";
import { normalizeFiTenantAdminRole } from "../src/lib/tenantAdmin/tenantAdminRoles";

const AUTH_USER_ID = "092216fb-6afb-42d2-afc0-bcbf6f30ba2b";
const TENANT_ID = "c2615b95-b707-4485-aa5f-be8f78ec868a";
const EMAIL = "roslynhrichards@outlook.com";
/** Global Evolved position type: RECEPTION → default_workspace_profile reception */
const RECEPTION_POSITION_TYPE_ID = "c21dc31e-6286-4fbf-8f9d-48900c908918";

const TARGET = {
  authFiRole: "member",
  /** Match Jesika Watts (`crm_operator`) for reception CRM shell access. */
  fiUsersRole: "crm_operator",
  staffRole: "reception",
  displayFullName: "Roslyn Helen Richards",
  displayFirstName: "Roslyn",
  workspaceProfile: "reception",
  positionTypeId: RECEPTION_POSITION_TYPE_ID,
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
  fiOsIdentity: { os_role: string } | null;
  derivedWorkspaceProfile: string;
  landingPath: string;
  crmShellAccess: boolean;
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

  const crmShellAccess =
    isCrmShellNavRole(fiUser ? String((fiUser as { role: string }).role) : null) ||
    isCrmShellNavStaffRole(fiStaff?.staff_role ?? null);

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
    fiStaff,
    fiStaffMember,
    positionType,
    featureTemplate,
    tenantAdmin,
    fiOsIdentity: osRow ? { os_role: String((osRow as { os_role: string }).os_role) } : null,
    derivedWorkspaceProfile,
    landingPath,
    crmShellAccess,
  };
}

async function main(): Promise<void> {
  loadRepoEnvFiles();
  const commit = process.argv.includes("--commit");
  const profileOnly = process.argv.includes("--profile-only");
  const supabase = supabaseAdmin();

  console.log("=== BEFORE ===");
  const before = await loadProfileSnapshot(supabase);
  console.log(JSON.stringify(before, null, 2));

  if (!before.fiUser || !before.fiStaff) {
    console.error("FAIL: missing fi_users or fi_staff row");
    process.exit(1);
  }

  const planned = {
    auth: profileOnly ? "unchanged" : { fi_role: TARGET.authFiRole, fi_tenant_id: TENANT_ID },
    fi_users: profileOnly ? "unchanged" : { role: TARGET.fiUsersRole },
    fi_staff: {
      staff_role: TARGET.staffRole,
      full_name: TARGET.displayFullName,
      position_type_id: TARGET.positionTypeId,
      staff_metadata: scrubAdminStaffMetadata(before.fiStaff.staff_metadata),
    },
    fi_staff_members: before.fiStaffMember
      ? {
          role_code: TARGET.staffRole,
          full_name: TARGET.displayFullName,
          first_name: TARGET.displayFirstName,
        }
      : "no active member row",
    fi_tenant_admin_users: before.tenantAdmin ? "DELETE row" : "none",
  };

  console.log("\n=== PLANNED CHANGES ===");
  console.log(JSON.stringify(planned, null, 2));

  const afterPreview = resolveWorkspaceProfileKeyFromSignals({
    explicitWorkspaceProfile: TARGET.workspaceProfile,
    positionTypeDefaultWorkspaceProfile: "reception",
    featureTemplateWorkspaceProfile: null,
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
  const afterCrm =
    isCrmShellNavRole(TARGET.fiUsersRole) || isCrmShellNavStaffRole(TARGET.staffRole);

  console.log("\nPost-fix workspace preview:", afterPreview);
  console.log("Post-fix landing preview:", afterLanding);
  console.log("Post-fix CRM shell access:", afterCrm);

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

  if (!profileOnly && before.auth) {
    const { data: authData } = await supabase.auth.admin.getUserById(AUTH_USER_ID);
    const nextMeta = {
      ...((authData.user?.user_metadata ?? {}) as Record<string, unknown>),
      fi_role: TARGET.authFiRole,
      fi_tenant_id: TENANT_ID,
    };
    const { error } = await supabase.auth.admin.updateUserById(AUTH_USER_ID, {
      user_metadata: nextMeta,
    });
    if (error) throw new Error(`auth update: ${error.message}`);
  }

  if (!profileOnly) {
    const { error } = await supabase
      .from("fi_users")
      .update({ role: TARGET.fiUsersRole, updated_at: new Date().toISOString() })
      .eq("id", before.fiUser.id)
      .eq("tenant_id", TENANT_ID);
    if (error) throw new Error(`fi_users update: ${error.message}`);
  }

  const nextMeta = scrubAdminStaffMetadata(before.fiStaff.staff_metadata);
  const { error: staffErr } = await supabase
    .from("fi_staff")
    .update({
      staff_role: TARGET.staffRole,
      full_name: TARGET.displayFullName,
      position_type_id: TARGET.positionTypeId,
      staff_metadata: nextMeta,
      updated_at: new Date().toISOString(),
    })
    .eq("id", before.fiStaff.id)
    .eq("tenant_id", TENANT_ID);
  if (staffErr) throw new Error(`fi_staff update: ${staffErr.message}`);

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

  if (before.tenantAdmin) {
    const { error: adminErr } = await supabase
      .from("fi_tenant_admin_users")
      .delete()
      .eq("tenant_id", TENANT_ID)
      .eq("fi_user_id", before.fiUser.id);
    if (adminErr) throw new Error(`fi_tenant_admin_users delete: ${adminErr.message}`);
  }

  console.log("\n=== AFTER ===");
  const after = await loadProfileSnapshot(supabase);
  console.log(JSON.stringify(after, null, 2));
  console.log("\nPASS: profile updates applied for", EMAIL);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
