#!/usr/bin/env tsx
/**
 * FI-TRUST-LANDING-AND-SPINE-1 — staff identity mapping completeness audit (read-only).
 *
 * For a tenant, every active login-capable operator should have:
 *   fi_users (auth_user_id) → fi_staff (fi_user_id) → SA-1 role template and/or grants
 *
 * Usage:
 *   npx tsx scripts/audit-staff-mapping-completeness.ts
 *   FI_SMOKE_TENANT_ID=<uuid> npx tsx scripts/audit-staff-mapping-completeness.ts
 *
 * Exit 1 when any linked real operator is missing fi_staff or has zero grants and no template.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { supabaseAdmin } from "../lib/supabaseAdmin";

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
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

function redactEmail(email: string | null | undefined): string {
  const e = String(email ?? "").trim();
  if (!e) return "(no email)";
  const at = e.indexOf("@");
  if (at <= 1) return "***";
  return `${e[0]}***@${e.slice(at + 1)}`;
}

function isSeedEmail(email: string | null | undefined): boolean {
  return String(email ?? "")
    .toLowerCase()
    .endsWith("@follicleintelligence.local");
}

loadRepoEnvFiles();

async function main(): Promise<void> {
  const supabase = supabaseAdmin();
  const envTenant =
    process.env.FI_SMOKE_TENANT_ID?.trim() ||
    process.env.EVOLVED_PERTH_TENANT_ID?.trim() ||
    "";

  let tid = envTenant;
  if (!tid) {
    const { data: evolved } = await supabase
      .from("fi_tenants")
      .select("id, slug")
      .in("slug", ["evolved", "evolved-hair"])
      .order("slug")
      .limit(1)
      .maybeSingle();
    tid = evolved ? String((evolved as { id: string }).id) : "";
  }

  if (!tid) {
    console.error("FAIL: set FI_SMOKE_TENANT_ID or EVOLVED_PERTH_TENANT_ID");
    process.exit(1);
  }

  console.log("Staff mapping completeness audit (read-only)");
  console.log(`tenant_id=${tid}`);
  console.log("---");

  const { data: users, error: usersErr } = await supabase
    .from("fi_users")
    .select("id, email, role, auth_user_id")
    .eq("tenant_id", tid);
  if (usersErr) {
    console.error(`FAIL: fi_users — ${usersErr.message}`);
    process.exit(1);
  }

  const fiUsers = (users ?? []) as {
    id: string;
    email: string | null;
    role: string | null;
    auth_user_id: string | null;
  }[];

  const operators = fiUsers.filter((u) => u.auth_user_id && !isSeedEmail(u.email));
  const { data: staffRows } = await supabase
    .from("fi_staff")
    .select("id, fi_user_id, staff_role, is_active, employment_status")
    .eq("tenant_id", tid);

  const staffByUser = new Map<string, { id: string; staff_role: string | null }>();
  for (const row of staffRows ?? []) {
    const r = row as {
      id: string;
      fi_user_id: string | null;
      staff_role: string | null;
      is_active?: boolean;
    };
    if (r.fi_user_id) staffByUser.set(String(r.fi_user_id), { id: r.id, staff_role: r.staff_role });
  }

  const staffIds = [...staffByUser.values()].map((s) => s.id);
  const grantCountByStaff = new Map<string, number>();
  if (staffIds.length) {
    const { data: grants } = await supabase
      .from("fi_staff_access_grants")
      .select("staff_id")
      .eq("tenant_id", tid)
      .in("staff_id", staffIds)
      .is("revoked_at", null);
    for (const g of grants ?? []) {
      const sid = String((g as { staff_id: string }).staff_id);
      grantCountByStaff.set(sid, (grantCountByStaff.get(sid) ?? 0) + 1);
    }
  }

  const { count: templateCount } = await supabase
    .from("fi_staff_role_templates")
    .select("id", { count: "exact", head: true })
    .or(`tenant_id.eq.${tid},tenant_id.is.null`);

  let missingStaff = 0;
  let missingAccess = 0;

  for (const u of operators) {
    const staff = staffByUser.get(u.id);
    if (!staff) {
      missingStaff += 1;
      console.log(
        `MISSING_STAFF email=${redactEmail(u.email)} fi_user=${u.id.slice(0, 8)}… role=${u.role ?? "?"}`
      );
      continue;
    }
    const grants = grantCountByStaff.get(staff.id) ?? 0;
    const hasRole = Boolean(staff.staff_role?.trim());
    if (!hasRole && grants === 0 && (templateCount ?? 0) === 0) {
      missingAccess += 1;
      console.log(
        `MISSING_ACCESS email=${redactEmail(u.email)} fi_staff=${staff.id.slice(0, 8)}… (no role, grants, or templates)`
      );
    } else {
      console.log(
        `OK email=${redactEmail(u.email)} staff_role=${staff.staff_role ?? "(none)"} grants=${grants}`
      );
    }
  }

  console.log("---");
  console.log(`operators_with_login: ${operators.length}`);
  console.log(`missing_fi_staff: ${missingStaff}`);
  console.log(`missing_access_signal: ${missingAccess}`);
  console.log(`tenant_or_global_templates: ${templateCount ?? 0}`);

  if (missingStaff > 0 || missingAccess > 0) {
    console.error("FAIL: staff mapping incomplete for one or more operators");
    process.exit(1);
  }
  console.log("PASS: all linked operators have fi_staff mapping");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
