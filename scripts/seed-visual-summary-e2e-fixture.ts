/**
 * Idempotent E2E fixture for ImagingOS patient visual summary workflow.
 *
 * Run (from repo root, with Supabase service role in env):
 *   npm run seed:visual-summary-e2e
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FI_E2E_TENANT_ID
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { seedVisualSummaryE2eFixture } from "../src/lib/imaging-os/visualSummaryE2eFixtureSeed.server";

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

async function main(): Promise<void> {
  const tenantId = process.env.FI_E2E_TENANT_ID?.trim();
  if (!tenantId) {
    console.error("Missing FI_E2E_TENANT_ID.");
    process.exit(1);
  }

  const result = await seedVisualSummaryE2eFixture({ tenantId });
  console.log("Visual summary E2E fixture:");
  console.log(JSON.stringify(result, null, 2));

  console.log("\nAdd to your e2e env:");
  for (const [key, value] of Object.entries(result.env)) {
    console.log(`${key}=${value}`);
  }

  if (result.warnings.length > 0) {
    console.log("\nWarnings:");
    for (const warning of result.warnings) {
      console.log(`  - ${warning}`);
    }
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});