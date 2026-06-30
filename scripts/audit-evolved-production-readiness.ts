#!/usr/bin/env tsx
/**
 * Read-only Evolved production readiness audit for P0 operator closure.
 * Safe output: redacts emails, never prints secrets.
 *
 * Usage: npx tsx scripts/audit-evolved-production-readiness.ts
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
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
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
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  return `${local[0]}***@${domain}`;
}

function isSeedEmail(email: string | null | undefined): boolean {
  return String(email ?? "").toLowerCase().endsWith("@follicleintelligence.local");
}

loadRepoEnvFiles();

async function main(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const evolvedEnv = process.env.EVOLVED_PERTH_TENANT_ID?.trim() ?? "";
  const smokeTenant = process.env.FI_SMOKE_TENANT_ID?.trim() ?? "";
  const baseUrl = process.env.FI_BASE_URL?.trim() ?? process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "";

  console.log("Evolved production readiness audit (read-only)");
  console.log("---");
  console.log(`Supabase host: ${supabaseUrl ? new URL(supabaseUrl).host : "(missing)"}`);
  console.log(`FI_BASE_URL: ${baseUrl || "(missing)"}`);
  console.log(`EVOLVED_PERTH_TENANT_ID set: ${evolvedEnv ? "yes" : "no"}`);
  console.log(`FI_SMOKE_TENANT_ID set: ${smokeTenant ? "yes" : "no"}`);
  if (evolvedEnv && smokeTenant && evolvedEnv !== smokeTenant) {
    console.log("WARN: EVOLVED_PERTH_TENANT_ID !== FI_SMOKE_TENANT_ID");
  }
  console.log("---");

  const supabase = supabaseAdmin();

  const { data: allTenants, error: tenantErr } = await supabase
    .from("fi_tenants")
    .select("id, slug, name")
    .in("slug", ["evolved", "evolved-hair"])
    .order("slug");
  if (tenantErr) {
    console.error(`FAIL: fi_tenants query — ${tenantErr.message}`);
    process.exit(1);
  }

  const evolvedCandidates = (allTenants ?? []) as { id: string; slug: string; name: string }[];
  if (!evolvedCandidates.length) {
    console.error("FAIL: no fi_tenants rows for evolved / evolved-hair");
    process.exit(1);
  }

  const envTenant = evolvedEnv
    ? evolvedCandidates.find((t) => t.id === evolvedEnv)
    : undefined;
  const slugEvolved = evolvedCandidates.find((t) => t.slug === "evolved");
  const slugEvolvedHair = evolvedCandidates.find((t) => t.slug === "evolved-hair");

  console.log("Evolved tenant candidates:");
  for (const t of evolvedCandidates) {
    const markers = [
      t.id === evolvedEnv ? "EVOLVED_PERTH_TENANT_ID" : null,
      t.slug === "evolved" ? "provision script default" : null,
    ]
      .filter(Boolean)
      .join(", ");
    console.log(`  ${t.slug}: ${t.id} (${t.name})${markers ? ` [${markers}]` : ""}`);
  }

  const primary = envTenant ?? slugEvolvedHair ?? slugEvolved;
  if (!primary) {
    console.error("FAIL: could not resolve primary Evolved tenant");
    process.exit(1);
  }

  if (evolvedEnv && !envTenant) {
    console.log(`WARN: EVOLVED_PERTH_TENANT_ID (${evolvedEnv}) not found among evolved tenants`);
  } else if (evolvedEnv && envTenant) {
    console.log(`PASS: EVOLVED_PERTH_TENANT_ID matches ${envTenant.slug}`);
  }

  const tid = primary.id;
  console.log(`Auditing primary tenant: ${primary.slug} (${primary.name})`);

  const { data: users, error: usersErr } = await supabase
    .from("fi_users")
    .select("id, email, role, auth_user_id")
    .eq("tenant_id", tid)
    .order("email");
  if (usersErr) {
    console.error(`FAIL: fi_users query — ${usersErr.message}`);
    process.exit(1);
  }

  const fiUsers = (users ?? []) as {
    id: string;
    email: string | null;
    role: string | null;
    auth_user_id: string | null;
  }[];

  const linkedReal = fiUsers.filter((u) => u.auth_user_id && !isSeedEmail(u.email));
  const linkedSeed = fiUsers.filter((u) => u.auth_user_id && isSeedEmail(u.email));
  const unlinked = fiUsers.filter((u) => !u.auth_user_id);

  console.log("---");
  console.log(`fi_users total: ${fiUsers.length}`);
  console.log(`  linked real operators: ${linkedReal.length}`);
  console.log(`  linked seed users: ${linkedSeed.length}`);
  console.log(`  unlinked: ${unlinked.length}`);

  for (const u of linkedReal) {
    console.log(
      `  REAL ${u.role ?? "unknown"} id=${u.id.slice(0, 8)}… auth=${u.auth_user_id?.slice(0, 8)}… email=${redactEmail(u.email)}`
    );
  }
  const unlinkedReal = unlinked.filter((u) => !isSeedEmail(u.email));
  for (const u of unlinkedReal.slice(0, 15)) {
    console.log(
      `  UNLINKED ${u.role ?? "unknown"} id=${u.id.slice(0, 8)}… email=${redactEmail(u.email)}`
    );
  }
  if (unlinkedReal.length > 15) {
    console.log(`  … and ${unlinkedReal.length - 15} more unlinked real users`);
  }
  for (const u of unlinked.filter(isSeedEmail).slice(0, 5)) {
    console.log(
      `  UNLINKED seed ${u.role ?? "unknown"} id=${u.id.slice(0, 8)}… email=${redactEmail(u.email)}`
    );
  }

  const { count: staffCount, error: staffErr } = await supabase
    .from("fi_staff")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tid);
  if (staffErr) {
    console.error(`WARN: fi_staff count — ${staffErr.message}`);
  } else {
    console.log(`fi_staff rows: ${staffCount ?? 0}`);
  }

  const { count: linkedStaff, error: linkedStaffErr } = await supabase
    .from("fi_staff")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .not("fi_user_id", "is", null);
  if (!linkedStaffErr) {
    console.log(`fi_staff with fi_user_id: ${linkedStaff ?? 0}`);
  }

  const roleCounts = new Map<string, number>();
  for (const u of fiUsers) {
    const r = u.role ?? "unknown";
    roleCounts.set(r, (roleCounts.get(r) ?? 0) + 1);
  }
  console.log(`fi_users by role: ${[...roleCounts.entries()].map(([r, n]) => `${r}=${n}`).join(", ")}`);

  const { data: adminUsers, error: adminErr } = await supabase
    .from("fi_tenant_admin_users")
    .select("id, admin_role, status, fi_user_id")
    .eq("tenant_id", tid);
  if (!adminErr) {
    console.log(`fi_tenant_admin_users: ${adminUsers?.length ?? 0}`);
  }

  const { data: syncRuns, error: syncErr } = await supabase
    .from("fi_staff_sync_runs")
    .select("id, status, finished_at, rows_sent")
    .eq("tenant_id", tid)
    .order("finished_at", { ascending: false })
    .limit(3);
  if (!syncErr && syncRuns?.length) {
    console.log("---");
    console.log("Recent HR sync runs:");
    for (const r of syncRuns as { id: string; status: string; finished_at: string | null; rows_sent: number | null }[]) {
      console.log(`  ${r.finished_at ?? "pending"} status=${r.status} rows=${r.rows_sent ?? 0}`);
    }
  }

  console.log("---");
  const blkSec05Ready = linkedReal.length >= 2;
  console.log(`BLK-SEC-05 ready (≥2 real linked operators): ${blkSec05Ready ? "YES" : "NO"} (${linkedReal.length}/2)`);
  if (!blkSec05Ready) {
    console.log("Next: provision operators with scripts/provision-evolved-operator.ts");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});