/**
 * CLI: fetch Evolved Perth IIOHR HR staff feed and sync into FI OS.
 *
 * Usage (from repo root):
 *   pnpm sync:iiohr-staff-feed -- --tenant evolved-hair
 *   pnpm sync:iiohr-staff-feed -- --tenant evolved-hair --commit
 *   pnpm sync:iiohr-staff-feed -- --tenant <uuid> --remote --commit
 *
 * `--tenant` accepts a fi_tenants slug (e.g. evolved-hair) or UUID.
 * Preview/dry-run by default; pass `--commit` to apply.
 * `--remote` POSTs to FI_BASE_URL (cron-style outbound); default is in-process via service role.
 * `--allow-empty` skips when the HR feed returns zero rows (like ALLOW_EMPTY_HR_SYNC=true).
 *
 * Requires `.env.local` / `.env` with at least:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   IIOHR_HR_PERTH_STAFF_FEED_URL (+ optional IIOHR_HR_PERTH_STAFF_FEED_KEY)
 *
 * Remote mode also requires FI_BASE_URL and IIOHR_HR_SYNC_SECRET.
 *
 * Prefer `pnpm sync:iiohr-staff-feed` — it preloads the server-only patch for CLI scripts.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { z } from "zod";

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

function parseArgs(argv: string[]): {
  tenant?: string;
  commit: boolean;
  remote: boolean;
  allowEmpty: boolean;
} {
  const out: {
    tenant?: string;
    commit: boolean;
    remote: boolean;
    allowEmpty: boolean;
  } = { commit: false, remote: false, allowEmpty: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tenant") out.tenant = argv[++i];
    else if (a === "--commit") out.commit = true;
    else if (a === "--remote") out.remote = true;
    else if (a === "--allow-empty") out.allowEmpty = true;
    else if (a === "--dry-run") out.commit = false;
    else if (a === "--help" || a === "-h") {
      console.log(`Usage: pnpm sync:iiohr-staff-feed -- --tenant <slug-or-uuid> [--commit] [--remote] [--allow-empty]`);
      process.exit(0);
    }
  }
  return out;
}

async function resolveTenantId(tenantArg: string): Promise<{ id: string; slug: string | null; name: string | null }> {
  const trimmed = tenantArg.trim();
  if (!trimmed) throw new Error("Missing --tenant value.");

  const supabase = supabaseAdmin();
  if (z.string().uuid().safeParse(trimmed).success) {
    const { data, error } = await supabase
      .from("fi_tenants")
      .select("id, slug, name")
      .eq("id", trimmed)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(`No fi_tenants row for id=${trimmed}.`);
    return {
      id: String(data.id),
      slug: data.slug != null ? String(data.slug) : null,
      name: data.name != null ? String(data.name) : null,
    };
  }

  const { data, error } = await supabase
    .from("fi_tenants")
    .select("id, slug, name")
    .eq("slug", trimmed)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error(`No fi_tenants row for slug=${trimmed}. Use a UUID or run scripts/resolve-evolved-tenant-id.ts.`);
  }
  return {
    id: String(data.id),
    slug: data.slug != null ? String(data.slug) : null,
    name: data.name != null ? String(data.name) : null,
  };
}

function printSummary(label: string, payload: unknown): void {
  console.log(`\n=== ${label} ===\n`);
  console.log(JSON.stringify(payload, null, 2));
}

async function runLocalSync(input: {
  tenantId: string;
  commit: boolean;
  allowEmpty: boolean;
}): Promise<number> {
  const { loadEvolvedPerthHrStaffRecordsForFiPush } = await import(
    "../src/lib/hr/loadEvolvedPerthHrStaffSnapshot.server"
  );
  const { mapIiohrHrStaffRecordsToFiSyncRows } = await import("../src/lib/hr/iiohrFiStaffSyncMapper");
  const { syncIiohrHrStaffForTenant } = await import("../src/lib/staffImport/iiohrHrStaffSync.server");
  const { logIiohrHrStaffImportReport } = await import("../src/lib/staffImport/iiohrHrStaffImportRunner");

  const hrRows = await loadEvolvedPerthHrStaffRecordsForFiPush();
  const rows = mapIiohrHrStaffRecordsToFiSyncRows(hrRows);

  if (rows.length === 0 && !input.allowEmpty) {
    console.error(
      "HR staff feed returned no rows; refusing sync (pass --allow-empty to no-op)."
    );
    return 1;
  }
  if (rows.length === 0) {
    console.log("HR staff feed returned no rows; sync skipped (--allow-empty).");
    return 0;
  }

  console.log(`Loaded ${hrRows.length} HR feed row(s); mapped ${rows.length} sync row(s).`);

  const summary = await syncIiohrHrStaffForTenant({
    tenantId: input.tenantId,
    payload: { rows },
    mode: input.commit ? "commit" : "preview",
    confirm: input.commit ? true : undefined,
    skipImportAuthCheck: true,
  });

  logIiohrHrStaffImportReport(summary.result);

  if (summary.result.workforceReconciliation) {
    console.log("\nWorkforce reconciliation:");
    console.log(JSON.stringify(summary.result.workforceReconciliation, null, 2));
  }

  if (!summary.result.ok) return 1;
  if (!input.commit) {
    console.log("\nPreview only. Re-run with --commit to apply changes.\n");
  }
  return 0;
}

async function runRemoteSync(input: {
  tenantId: string;
  commit: boolean;
  allowEmpty: boolean;
}): Promise<number> {
  const { loadEvolvedPerthHrStaffRecordsForFiPush } = await import(
    "../src/lib/hr/loadEvolvedPerthHrStaffSnapshot.server"
  );
  const { runScheduledIiohrHrStaffSyncCore } = await import(
    "../src/lib/hr/runScheduledIiohrHrStaffSyncCore"
  );
  const { pushStaffSyncToFi } = await import("../src/lib/hr/iiohrFiStaffSyncPush");

  const result = await runScheduledIiohrHrStaffSyncCore({
    tenantId: input.tenantId,
    allowEmptyFeed: input.allowEmpty,
    loadHrStaff: loadEvolvedPerthHrStaffRecordsForFiPush,
    pushFi: async (payload) =>
      pushStaffSyncToFi({
        ...payload,
        mode: input.commit ? "commit" : "preview",
        confirm: input.commit ? true : undefined,
        syncTrigger: "cli",
      }),
    syncSecretForScrub: process.env.IIOHR_HR_SYNC_SECRET?.trim(),
  });

  printSummary(input.commit ? "IIOHR staff feed remote sync (COMMIT)" : "IIOHR staff feed remote sync (PREVIEW)", result);

  if (!result.ok) {
    if (result.error) console.error(result.error);
    return 1;
  }
  if (!input.commit) {
    console.log("\nPreview only. Re-run with --commit to apply changes.\n");
  }
  return 0;
}

async function main(): Promise<void> {
  loadRepoEnvFiles();
  const args = parseArgs(process.argv);

  if (!args.tenant?.trim()) {
    console.error("Missing --tenant <slug-or-uuid>. Example: --tenant evolved-hair");
    console.error("Run with --help for usage.");
    process.exit(1);
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const tenant = await resolveTenantId(args.tenant);
  console.log(
    `Tenant: ${tenant.name ?? tenant.slug ?? tenant.id} (${tenant.slug ?? "no-slug"}) → ${tenant.id}`
  );
  console.log(`Mode: ${args.commit ? "commit" : "preview"} · Transport: ${args.remote ? "remote (FI_BASE_URL)" : "local (service role)"}`);

  const exitCode = args.remote
    ? await runRemoteSync({
        tenantId: tenant.id,
        commit: args.commit,
        allowEmpty: args.allowEmpty,
      })
    : await runLocalSync({
        tenantId: tenant.id,
        commit: args.commit,
        allowEmpty: args.allowEmpty,
      });

  process.exit(exitCode);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
