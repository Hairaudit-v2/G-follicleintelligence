/**
 * Idempotent seed: International Hair Restoration Group (IHRG) enterprise demo tenant,
 * 8 global clinics, franchise staff hierarchy, and synthetic patients/consultations.
 *
 * Run (from repo root, with Supabase service role in env):
 *   npm run seed:enterprise-demo
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Production guard: set ALLOW_ENTERPRISE_DEMO_SEED=true when NODE_ENV=production.
 *
 * Note: `tsx` does not read `.env.local` (Next.js does). This file loads `.env.local` then `.env`
 * from the repo root so the same keys work as with `npm run dev`.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { seedEnterpriseDemoTenant } from "../src/lib/enterprise-demo/enterpriseDemoSeed.server";

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

loadRepoEnvFiles();

function printResult(result: Awaited<ReturnType<typeof seedEnterpriseDemoTenant>>): void {
  console.log("Enterprise demo seed result:");
  console.log(JSON.stringify(result, null, 2));
  if (result.warnings.length > 0) {
    console.log("\nWarnings:");
    for (const warning of result.warnings) {
      console.log(`  - ${warning}`);
    }
  }
}

async function main(): Promise<void> {
  const result = await seedEnterpriseDemoTenant();
  printResult(result);
  if (!result.ok) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
