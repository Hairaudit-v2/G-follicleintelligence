/**
 * CLI: import IIOHR HR staff rows into FI OS (dry-run by default).
 *
 * Usage (from repo root):
 *   npx tsx scripts/import-iiohr-hr-staff.ts --tenant <uuid> --file <path.json> [--commit] [--admin-key <key>]
 *
 * JSON file: either `[{ "external_staff_id", "email", ... }, ...]` or `{ "rows": [ ... ] }`.
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (same as other scripts).
 * Auth: pass `--admin-key` or set `FI_ADMIN_API_KEY` in `.env` / `.env.local`.
 *
 * `tsx` does not load `.env.local` automatically — this script loads `.env.local` then `.env`.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  logIiohrHrStaffImportReport,
  runIiohrHrStaffImport,
} from "../src/lib/staffImport/iiohrHrStaffImportRunner";

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
  tenantId?: string;
  file?: string;
  commit: boolean;
  adminKey?: string;
} {
  const out: { tenantId?: string; file?: string; commit: boolean; adminKey?: string } = { commit: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tenant") out.tenantId = argv[++i];
    else if (a === "--file") out.file = argv[++i];
    else if (a === "--commit") out.commit = true;
    else if (a === "--admin-key") out.adminKey = argv[++i];
  }
  return out;
}

async function main(): Promise<void> {
  loadRepoEnvFiles();
  const args = parseArgs(process.argv);
  if (!args.tenantId?.trim()) {
    console.error("Missing --tenant <uuid>.");
    process.exit(1);
  }
  if (!args.file?.trim()) {
    console.error("Missing --file <path.json>.");
    process.exit(1);
  }

  const fp = resolve(process.cwd(), args.file.trim());
  if (!existsSync(fp)) {
    console.error(`File not found: ${fp}`);
    process.exit(1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(fp, "utf8")) as unknown;
  } catch {
    console.error("Invalid JSON in input file.");
    process.exit(1);
  }

  const rows = Array.isArray(parsed) ? parsed : (parsed as { rows?: unknown }).rows;
  if (!Array.isArray(rows)) {
    console.error('JSON must be an array of rows or an object with a "rows" array.');
    process.exit(1);
  }

  const adminKey = args.adminKey?.trim() || process.env.FI_ADMIN_API_KEY?.trim() || undefined;
  if (!adminKey) {
    console.error("Provide --admin-key or set FI_ADMIN_API_KEY for staff import (service role alone is not enough).");
    process.exit(1);
  }

  const result = await runIiohrHrStaffImport({
    tenantId: args.tenantId.trim(),
    rows,
    commit: args.commit,
    confirm: args.commit ? true : undefined,
    adminKey,
  });

  logIiohrHrStaffImportReport(result);

  if (!result.ok) {
    process.exit(1);
  }
  if (!args.commit) {
    console.log("Dry-run only. Re-run with --commit to apply changes.\n");
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
