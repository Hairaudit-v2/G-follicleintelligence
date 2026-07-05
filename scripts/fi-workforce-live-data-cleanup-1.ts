/**
 * FI-WORKFORCE-LIVE-DATA-CLEANUP-1 — Evolved tenant Workforce/Roster live data hygiene.
 *
 * Reports (always, read-only):
 *   A. Lifecycle drift — fi_staff.is_active=true while HR lifecycle is terminated/archived.
 *   B. Duplicate staff groups by normalized name/email (canonical lifecycle resolver).
 *   C. Archived HR rows with stale employment_status='active'.
 *   D. Owner/manager-role staff stuck in pending_onboarding.
 *   E. Contradictory lifecycle rows (on_leave + archived_at set).
 *   F. Roster manage access per active staff (capability path + fi_users role path +
 *      tenant admin profiles) — who can actually edit the roster.
 *
 * Planned fixes (printed in dry-run; applied only with --execute):
 *   1. Sync fi_staff.is_active=false for four terminated+archived staff.
 *   2. Merge old Dr Seetal duplicate into the canonical IIOHR-linked record via the
 *      transaction-safe workforce_merge_staff_members RPC (no deletes; source becomes
 *      employment_status='merged' with merged_into pointing at the canonical row).
 *   3. Clear the stale employment_status='active' on the archived PAUL GREEN duplicate
 *      (set 'inactive' + reason). True merge is left to Duplicate Review — two candidate
 *      canonical "Paul" records exist, so the target must be a human decision.
 *
 * Review-only findings (never auto-fixed): Anita Cottee on_leave+archived contradiction,
 * Paul Green (owner) pending_onboarding.
 *
 * Every write is guarded by a precondition check on the current row state and emits a
 * fi_staff_member_audit_events row (source: fi_workforce_live_data_cleanup_1) with
 * before/after metadata. No hard deletes anywhere.
 *
 * Usage (dry-run by default):
 *   node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs \
 *     scripts/fi-workforce-live-data-cleanup-1.ts
 *   ... --execute            # apply the planned fixes
 *   ... --tenant-id=<uuid>   # override tenant (defaults to EVOLVED_PERTH_TENANT_ID)
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadRepoEnvFiles(): void {
  for (const name of [".env.local", ".env"] as const) {
    const p = resolve(process.cwd(), name);
    if (!existsSync(p)) continue;
    let raw = readFileSync(p, "utf8");
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const s = t.startsWith("export ") ? t.slice(7).trim() : t;
      const eq = s.indexOf("=");
      if (eq <= 0) continue;
      const key = s.slice(0, eq).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      let val = s.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}
loadRepoEnvFiles();

// Server modules are imported lazily inside loadServerModules() so the React.cache
// shim (react-cache-script-prelude) can install before they evaluate; CJS transform
// forbids top-level await.
type ServerModules = {
  supabaseAdmin: typeof import("@/lib/supabaseAdmin").supabaseAdmin;
  getStaffEffectiveAccessForStaffMember: typeof import("@/src/lib/staffAccess/staffAccess.server").getStaffEffectiveAccessForStaffMember;
  staffCapabilitySatisfies: typeof import("@/src/lib/staffAccess/staffCapabilityCore").staffCapabilitySatisfies;
  manageFiUserRoles: readonly string[];
  mergeStaffRecords: typeof import("@/src/lib/workforce/staffMerge.server").mergeStaffRecords;
  resolveCanonicalStaffLifecycleStatus: typeof import("@/src/lib/workforce-os/staffCanonicalLifecycle").resolveCanonicalStaffLifecycleStatus;
  resolveStaffDuplicateGroups: typeof import("@/src/lib/workforce-os/staffCanonicalLifecycle").resolveStaffDuplicateGroups;
};

let mods: ServerModules;

async function loadServerModules(): Promise<ServerModules> {
  await import("./lib/react-cache-script-prelude.mjs");
  const [supabase, staffAccess, capabilityCore, manageGate, staffMerge, canonical] =
    await Promise.all([
      import("@/lib/supabaseAdmin"),
      import("@/src/lib/staffAccess/staffAccess.server"),
      import("@/src/lib/staffAccess/staffCapabilityCore"),
      import("@/src/lib/workforce-os/staffStandardHoursManageGate.server"),
      import("@/src/lib/workforce/staffMerge.server"),
      import("@/src/lib/workforce-os/staffCanonicalLifecycle"),
    ]);
  return {
    supabaseAdmin: supabase.supabaseAdmin,
    getStaffEffectiveAccessForStaffMember: staffAccess.getStaffEffectiveAccessForStaffMember,
    staffCapabilitySatisfies: capabilityCore.staffCapabilitySatisfies,
    manageFiUserRoles: manageGate.STAFF_STANDARD_HOURS_MANAGE_FI_USER_ROLES,
    mergeStaffRecords: staffMerge.mergeStaffRecords,
    resolveCanonicalStaffLifecycleStatus: canonical.resolveCanonicalStaffLifecycleStatus,
    resolveStaffDuplicateGroups: canonical.resolveStaffDuplicateGroups,
  };
}

const AUDIT_SOURCE = "fi_workforce_live_data_cleanup_1";
const TICKET = "FI-WORKFORCE-LIVE-DATA-CLEANUP-1";

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

const EXECUTE = process.argv.includes("--execute");

// --- Planned fix targets (Evolved tenant; every write re-verifies current state first) ---

/** Fix 1: fi_staff.is_active=false — HR lifecycle terminated + archived, flag drifted. */
const IS_ACTIVE_SYNC_TARGETS = [
  { fiStaffId: "88daa5be-a7b0-400a-88e5-8b8fc4fb1ddc", expectName: "Clara Quinn" },
  { fiStaffId: "0b6b9ff2-4dc8-435f-9a62-de685103dd28", expectName: "Daniel Bullen" },
  { fiStaffId: "631ca59d-0c01-40f4-8137-acf9340ce6fc", expectName: "Hannah Anne Geneve" },
  { fiStaffId: "beeb8b74-d56f-4ee4-872f-cf184883af27", expectName: "Stacey Roberts" },
] as const;

/** Fix 2: merge old Dr Seetal duplicate (member ids, not fi_staff ids). */
const SEETAL_MERGE = {
  sourceMemberId: "fcaf4cd7-eb86-4dea-a29a-9c301c09fc61", // archived surgeon row (fi_staff ba6839c8)
  targetMemberId: "9087c9c3-e48d-4766-a87b-d42d0259a5b4", // canonical IIOHR contractor row (fi_staff 235062fc)
  expectName: "Dr Seetal",
} as const;

/** Fix 3: archived PAUL GREEN duplicate with stale employment_status='active'. */
const PAUL_GREEN_DUP = {
  memberId: "a7b17dbf-af69-42c2-a6c2-ed90b7a902e3", // fi_staff ff93d9e3
  expectName: "PAUL GREEN",
} as const;

type MemberRow = {
  id: string;
  fi_staff_id: string | null;
  full_name: string;
  email: string | null;
  role_code: string | null;
  employment_status: string;
  archived_at: string | null;
  merged_into: string | null;
  identity_source: string | null;
  created_at: string;
};

type StaffRow = {
  id: string;
  full_name: string;
  staff_role: string;
  email: string | null;
  is_active: boolean;
  fi_user_id: string | null;
  created_at: string;
};

function line(msg = ""): void {
  console.log(msg);
}

function heading(msg: string): void {
  line();
  line(`=== ${msg} ===`);
}

async function loadRows(tenantId: string): Promise<{ staff: StaffRow[]; members: MemberRow[] }> {
  const supabase = mods.supabaseAdmin();
  const [staffRes, memberRes] = await Promise.all([
    supabase
      .from("fi_staff")
      .select("id, full_name, staff_role, email, is_active, fi_user_id, created_at")
      .eq("tenant_id", tenantId)
      .order("full_name"),
    supabase
      .from("fi_staff_members")
      .select(
        "id, fi_staff_id, full_name, email, role_code, employment_status, archived_at, merged_into, identity_source, created_at"
      )
      .eq("tenant_id", tenantId)
      .order("full_name"),
  ]);
  if (staffRes.error) throw new Error(staffRes.error.message);
  if (memberRes.error) throw new Error(memberRes.error.message);
  return { staff: (staffRes.data ?? []) as StaffRow[], members: (memberRes.data ?? []) as MemberRow[] };
}

const OPERATIONALLY_INELIGIBLE = new Set([
  "terminated",
  "resigned",
  "contract_ended",
  "contract_expired",
]);

function reportSummary(staff: StaffRow[], members: MemberRow[]): void {
  const memberByFiStaffId = new Map(
    members.filter((m) => m.fi_staff_id).map((m) => [m.fi_staff_id!, m])
  );

  heading("A. Lifecycle drift (is_active=true but HR terminated/archived)");
  const drift = staff.filter((s) => {
    const m = memberByFiStaffId.get(s.id);
    if (!m) return false;
    return s.is_active && (OPERATIONALLY_INELIGIBLE.has(m.employment_status) || m.archived_at != null);
  });
  for (const s of drift) {
    const m = memberByFiStaffId.get(s.id)!;
    line(
      `  fi_staff ${s.id}  ${s.full_name}  is_active=true  employment_status=${m.employment_status}  archived=${m.archived_at != null}`
    );
  }
  if (!drift.length) line("  (none)");

  heading("B. Duplicate staff groups (normalized name/email)");
  const duplicates = mods.resolveStaffDuplicateGroups(
    staff.map((s) => {
      const m = memberByFiStaffId.get(s.id);
      return {
        id: s.id,
        fullName: s.full_name,
        email: s.email ?? m?.email ?? null,
        createdAt: s.created_at,
        lifecycleStatus: mods.resolveCanonicalStaffLifecycleStatus({
          isActive: s.is_active,
          employmentStatus: m?.employment_status ?? null,
          archivedAt: m?.archived_at ?? null,
        }),
        hrLinked: m?.identity_source === "iiohr_evolved_hr",
      };
    })
  );
  const staffById = new Map(staff.map((s) => [s.id, s]));
  for (const group of duplicates.groups) {
    const canonical = staffById.get(group.canonicalId);
    line(`  canonical: ${group.canonicalId}  ${canonical?.full_name ?? "?"} (${canonical?.staff_role ?? "?"})`);
    for (const dup of group.duplicateIds) {
      const row = staffById.get(dup);
      line(`    duplicate: ${dup}  ${row?.full_name ?? "?"} (${row?.staff_role ?? "?"}, is_active=${row?.is_active})`);
    }
  }
  if (!duplicates.groups.length) line("  (none)");

  heading("C. Archived HR rows with stale employment_status='active'");
  const staleArchived = members.filter(
    (m) => m.archived_at != null && m.employment_status === "active"
  );
  for (const m of staleArchived) {
    line(`  member ${m.id}  ${m.full_name}  archived_at=${m.archived_at}  employment_status=active`);
  }
  if (!staleArchived.length) line("  (none)");

  heading("D. Owner/manager-role staff stuck in pending_onboarding");
  const pendingLeadership = members.filter((m) => {
    if (m.employment_status !== "pending_onboarding") return false;
    const role = (m.role_code ?? staffById.get(m.fi_staff_id ?? "")?.staff_role ?? "").toLowerCase();
    return /owner|admin|manager|director|principal/.test(role);
  });
  for (const m of pendingLeadership) {
    line(`  member ${m.id}  ${m.full_name}  role=${m.role_code}  pending_onboarding`);
  }
  if (!pendingLeadership.length) line("  (none)");

  heading("E. Contradictory lifecycle rows (on_leave + archived)");
  const contradictions = members.filter(
    (m) => m.archived_at != null && m.employment_status === "on_leave"
  );
  for (const m of contradictions) {
    line(`  member ${m.id}  ${m.full_name}  on_leave AND archived_at=${m.archived_at}`);
  }
  if (!contradictions.length) line("  (none)");
}

async function reportRosterManageAccess(tenantId: string, staff: StaffRow[]): Promise<void> {
  heading("F. Roster manage access (who can edit the roster)");
  const supabase = mods.supabaseAdmin();

  const [usersRes, adminRes] = await Promise.all([
    supabase.from("fi_users").select("id, email, role").eq("tenant_id", tenantId),
    supabase
      .from("fi_tenant_admin_users")
      .select("fi_user_id, admin_role, status")
      .eq("tenant_id", tenantId)
      .eq("status", "active"),
  ]);
  if (usersRes.error) throw new Error(usersRes.error.message);
  if (adminRes.error) throw new Error(adminRes.error.message);

  const users = (usersRes.data ?? []) as { id: string; email: string | null; role: string | null }[];
  const adminByFiUserId = new Map(
    ((adminRes.data ?? []) as { fi_user_id: string; admin_role: string }[]).map((a) => [
      a.fi_user_id,
      a.admin_role,
    ])
  );
  const userById = new Map(users.map((u) => [u.id, u]));

  for (const s of staff.filter((r) => r.is_active)) {
    const access = await mods.getStaffEffectiveAccessForStaffMember(tenantId, s.id, s.staff_role);
    const capability = mods.staffCapabilitySatisfies(access, "roster.manage");
    const user = s.fi_user_id ? userById.get(s.fi_user_id) : null;
    const fiRole = (user?.role ?? "").toLowerCase();
    const fiRolePath = mods.manageFiUserRoles.includes(fiRole);
    const adminRole = user ? adminByFiUserId.get(user.id) : undefined;
    const adminPath = adminRole === "clinic_admin" || adminRole === "operations_admin";
    const canManage = capability || fiRolePath || adminPath;
    line(
      `  ${canManage ? "MANAGE " : "view   "} ${s.full_name.padEnd(28)} staff_role=${s.staff_role.padEnd(40)} login=${user?.email ?? "(no login)"}  via=${[
        capability ? "capability(role-template/grant)" : null,
        fiRolePath ? `fi_users:${fiRole}` : null,
        adminPath ? `tenant_admin:${adminRole}` : null,
      ]
        .filter(Boolean)
        .join("+") || "-"}`
    );
  }
  line();
  line(
    "  Targeted non-admin grant (if someone lacks manage): insert fi_staff_access_grants row"
  );
  line(
    "    { staff_member_id: <fi_staff.id>, module_key: 'workforce_os', tab_key: 'roster', access_level: 'edit', scope: 'tenant' }"
  );
  line(
    "  → grants exactly roster.manage + roster.standard_hours.manage (verified by staffCapabilityCore tests); no other modules."
  );
}

async function insertAudit(
  tenantId: string,
  staffMemberId: string,
  eventType: string,
  metadata: Record<string, unknown>
): Promise<void> {
  const supabase = mods.supabaseAdmin();
  const { error } = await supabase.from("fi_staff_member_audit_events").insert({
    tenant_id: tenantId,
    staff_member_id: staffMemberId,
    event_type: eventType,
    source: AUDIT_SOURCE,
    metadata: { ticket: TICKET, ...metadata },
  });
  if (error) throw new Error(`audit insert failed: ${error.message}`);
}

/**
 * Merge an already-archived duplicate member into the canonical record without the
 * merge RPC (which requires live rows and would re-point shifts into double-bookings).
 * Soft-cancels the duplicate's shifts, moves non-conflicting identity links, then marks
 * the member merged. No deletes; full audit trail.
 */
async function mergeArchivedDuplicate(
  tenantId: string,
  source: MemberRow,
  target: MemberRow
): Promise<void> {
  const supabase = mods.supabaseAdmin();
  const nowIso = () => new Date().toISOString();

  // a. Duplicate's live shifts (any scheduled shift on an archived duplicate is wrong).
  let sourceShifts: Array<{ id: string; starts_at: string; ends_at: string; status: string }> = [];
  if (source.fi_staff_id) {
    const { data, error } = await supabase
      .from("fi_staff_shifts")
      .select("id, starts_at, ends_at, status")
      .eq("tenant_id", tenantId)
      .eq("staff_id", source.fi_staff_id)
      .neq("status", "cancelled");
    if (error) throw new Error(error.message);
    sourceShifts = (data ?? []) as typeof sourceShifts;
  }
  for (const shift of sourceShifts) {
    line(
      `  ${EXECUTE ? "APPLY" : "PLAN "} UPDATE fi_staff_shifts SET status='cancelled' WHERE id='${shift.id}'  (${shift.starts_at} duplicate-record shift)`
    );
  }
  if (EXECUTE && sourceShifts.length) {
    const { error } = await supabase
      .from("fi_staff_shifts")
      .update({ status: "cancelled", updated_at: nowIso() })
      .eq("tenant_id", tenantId)
      .eq("staff_id", source.fi_staff_id!)
      .neq("status", "cancelled");
    if (error) throw new Error(error.message);
  }

  // b. Identity links → target, skipping (source_system, external_id) pairs it already has.
  const { data: linkRows, error: linkErr } = await supabase
    .from("fi_staff_identity_links")
    .select("id, source_system, external_id")
    .eq("tenant_id", tenantId)
    .eq("staff_member_id", source.id);
  if (linkErr) throw new Error(linkErr.message);
  const movedLinkIds: string[] = [];
  for (const raw of (linkRows ?? []) as Array<{ id: string; source_system: string; external_id: string }>) {
    const { count, error: existsErr } = await supabase
      .from("fi_staff_identity_links")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("staff_member_id", target.id)
      .eq("source_system", raw.source_system)
      .eq("external_id", raw.external_id);
    if (existsErr) throw new Error(existsErr.message);
    if ((count ?? 0) > 0) {
      line(`  SKIP identity link ${raw.source_system}/${raw.external_id}: target already linked`);
      continue;
    }
    line(
      `  ${EXECUTE ? "APPLY" : "PLAN "} UPDATE fi_staff_identity_links SET staff_member_id='${target.id}' WHERE id='${raw.id}'  (${raw.source_system})`
    );
    if (EXECUTE) {
      const { error } = await supabase
        .from("fi_staff_identity_links")
        .update({ staff_member_id: target.id, updated_at: nowIso() })
        .eq("tenant_id", tenantId)
        .eq("id", raw.id);
      if (error) throw new Error(error.message);
    }
    movedLinkIds.push(raw.id);
  }

  // c. Mark source member merged → target.
  line(
    `  ${EXECUTE ? "APPLY" : "PLAN "} UPDATE fi_staff_members SET employment_status='merged', merged_into='${target.id}' WHERE id='${source.id}'`
  );
  if (EXECUTE) {
    const { error } = await supabase
      .from("fi_staff_members")
      .update({
        employment_status: "merged",
        merged_into: target.id,
        merged_at: nowIso(),
        employment_status_reason: `${TICKET}: archived duplicate merged into canonical record`,
        employment_status_changed_at: nowIso(),
        updated_at: nowIso(),
      })
      .eq("tenant_id", tenantId)
      .eq("id", source.id)
      .is("merged_into", null);
    if (error) throw new Error(error.message);

    await insertAudit(tenantId, source.id, "workforce_staff_merged", {
      action: "archived_duplicate_targeted_merge",
      target_staff_member_id: target.id,
      cancelled_shift_ids: sourceShifts.map((s) => s.id),
      moved_identity_link_ids: movedLinkIds,
    });
    await insertAudit(tenantId, target.id, "workforce_staff_merged", {
      role: "merge_target",
      source_staff_member_id: source.id,
    });
  }
}

async function applyFixes(tenantId: string, staff: StaffRow[], members: MemberRow[]): Promise<void> {
  const supabase = mods.supabaseAdmin();
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const memberById = new Map(members.map((m) => [m.id, m]));
  const memberByFiStaffId = new Map(
    members.filter((m) => m.fi_staff_id).map((m) => [m.fi_staff_id!, m])
  );

  heading(`Fix 1 — sync fi_staff.is_active=false (${EXECUTE ? "EXECUTE" : "dry-run"})`);
  for (const target of IS_ACTIVE_SYNC_TARGETS) {
    const row = staffById.get(target.fiStaffId);
    const member = memberByFiStaffId.get(target.fiStaffId);
    if (!row) {
      line(`  SKIP ${target.expectName}: fi_staff ${target.fiStaffId} not found`);
      continue;
    }
    if (row.full_name.trim().toLowerCase() !== target.expectName.trim().toLowerCase()) {
      line(`  SKIP ${target.fiStaffId}: name mismatch (found "${row.full_name}")`);
      continue;
    }
    if (!row.is_active) {
      line(`  OK   ${row.full_name}: already is_active=false`);
      continue;
    }
    if (!member || (!OPERATIONALLY_INELIGIBLE.has(member.employment_status) && member.archived_at == null)) {
      line(`  SKIP ${row.full_name}: HR lifecycle no longer terminated/archived — re-review`);
      continue;
    }
    line(
      `  ${EXECUTE ? "APPLY" : "PLAN "} UPDATE fi_staff SET is_active=false WHERE id='${row.id}'  (${row.full_name}; HR=${member.employment_status})`
    );
    if (EXECUTE) {
      const { error } = await supabase
        .from("fi_staff")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("tenant_id", tenantId)
        .eq("id", row.id)
        .eq("is_active", true);
      if (error) throw new Error(error.message);
      await insertAudit(tenantId, member.id, "staff_profile_updated", {
        action: "sync_is_active_false_from_hr_lifecycle",
        fi_staff_id: row.id,
        before: { is_active: true },
        after: { is_active: false },
        hr_employment_status: member.employment_status,
        hr_archived_at: member.archived_at,
      });
    }
  }

  heading(`Fix 2 — merge old Dr Seetal duplicate (${EXECUTE ? "EXECUTE" : "dry-run"})`);
  {
    const source = memberById.get(SEETAL_MERGE.sourceMemberId);
    const target = memberById.get(SEETAL_MERGE.targetMemberId);
    const nameOk =
      source?.full_name.trim().toLowerCase() === SEETAL_MERGE.expectName.toLowerCase() &&
      target?.full_name.trim().toLowerCase() === SEETAL_MERGE.expectName.toLowerCase();
    if (!source || !target || !nameOk) {
      line("  SKIP: source/target member rows not found or names changed — re-verify ids");
    } else if (source.merged_into) {
      line(`  OK   already merged into ${source.merged_into}`);
    } else if (target.archived_at != null || target.employment_status !== "active") {
      line("  SKIP: canonical target is not active — re-review before merging");
    } else if (source.archived_at == null) {
      // Live source: use the canonical transaction-safe merge RPC.
      line(
        `  ${EXECUTE ? "APPLY" : "PLAN "} rpc workforce_merge_staff_members(source=${source.id}, target=${target.id})`
      );
      if (EXECUTE) {
        const result = await mods.mergeStaffRecords({
          tenantId,
          sourceStaffId: source.id,
          targetStaffId: target.id,
          mergedBy: null,
        });
        line(
          `         result ok=${result.ok} movedIdentityLinks=${result.movedIdentityLinks} archivedSourceFiStaff=${result.archivedSourceFiStaff}`
        );
      }
    } else {
      // Archived source: the merge RPC requires archived_at IS NULL on both rows, and
      // re-pointing the source's shifts would double-book — the canonical record already
      // holds identical standard-hours shifts. Targeted path instead:
      //   a. soft-cancel the source fi_staff's duplicate scheduled shifts (no deletes)
      //   b. move identity links that don't already exist on the target
      //   c. mark the source member merged → target (status/merged_into/merged_at)
      await mergeArchivedDuplicate(tenantId, source, target);
    }
  }

  heading(`Fix 3 — PAUL GREEN archived duplicate stale status (${EXECUTE ? "EXECUTE" : "dry-run"})`);
  {
    const member = memberById.get(PAUL_GREEN_DUP.memberId);
    if (!member || member.full_name.trim().toLowerCase() !== PAUL_GREEN_DUP.expectName.toLowerCase()) {
      line("  SKIP: member row not found or name changed — re-verify id");
    } else if (member.employment_status !== "active") {
      line(`  OK   employment_status already '${member.employment_status}'`);
    } else if (member.archived_at == null) {
      line("  SKIP: row is no longer archived — re-review");
    } else {
      line(
        `  ${EXECUTE ? "APPLY" : "PLAN "} UPDATE fi_staff_members SET employment_status='inactive' WHERE id='${member.id}'`
      );
      line(
        "         (merge target intentionally NOT auto-chosen: two candidate canonical Paul records — resolve in Duplicate Review)"
      );
      if (EXECUTE) {
        const now = new Date().toISOString();
        const { error } = await supabase
          .from("fi_staff_members")
          .update({
            employment_status: "inactive",
            employment_status_reason: `${TICKET}: archived duplicate record; stale 'active' status cleared`,
            employment_status_changed_at: now,
            updated_at: now,
          })
          .eq("tenant_id", tenantId)
          .eq("id", member.id)
          .eq("employment_status", "active");
        if (error) throw new Error(error.message);
        await insertAudit(tenantId, member.id, "staff_employment_status_changed", {
          action: "clear_stale_active_on_archived_duplicate",
          before: { employment_status: "active" },
          after: { employment_status: "inactive" },
        });
      }
    }
  }

  heading("Review-only findings (no automated change)");
  line("  - Anita Cottee: on_leave + archived_at set. If on maternity leave → clear archived_at");
  line("    via Workforce restore; if departed → process through Offboarding Centre.");
  line("  - Paul Green (owner): employment_status='pending_onboarding'. Complete onboarding in");
  line("    HR OS Onboarding Centre or set active via Manage Employment (owner should not be pending).");
}

async function main(): Promise<void> {
  const tenantId =
    arg("tenant-id")?.trim() || process.env.EVOLVED_PERTH_TENANT_ID?.trim() || "";
  if (!tenantId) {
    console.error("Missing --tenant-id= or EVOLVED_PERTH_TENANT_ID");
    process.exit(1);
  }

  line(`${TICKET} — tenant ${tenantId} — mode: ${EXECUTE ? "EXECUTE (writes enabled)" : "DRY-RUN (no writes)"}`);

  mods = await loadServerModules();

  const before = await loadRows(tenantId);
  line(`\n--- BEFORE: ${before.staff.length} fi_staff rows, ${before.members.length} fi_staff_members rows ---`);
  reportSummary(before.staff, before.members);
  await reportRosterManageAccess(tenantId, before.staff);

  await applyFixes(tenantId, before.staff, before.members);

  if (EXECUTE) {
    const after = await loadRows(tenantId);
    line(`\n--- AFTER ---`);
    reportSummary(after.staff, after.members);
  } else {
    line("\nDry-run complete. Re-run with --execute to apply the planned fixes above.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
