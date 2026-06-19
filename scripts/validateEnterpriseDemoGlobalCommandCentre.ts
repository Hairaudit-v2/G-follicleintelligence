/**
 * TITAN Phase 1I — Global Command Centre demo-readiness validation.
 *
 * Usage:
 *   node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs scripts/validateEnterpriseDemoGlobalCommandCentre.ts
 *
 * Optional env:
 *   TITAN_DEMO_TENANT_ID — tenant UUID (defaults to ihrg-global slug lookup)
 *
 * Required env:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { runGlobalCommandCentreDemoValidation } from "../src/lib/enterprise-demo/enterpriseDemoGlobalCommandCentreValidation.server";
import {
  TITAN_GLOBAL_COMMAND_CENTRE_ROUTES,
  buildTenantGlobalCommandCentreRoutes,
} from "../src/lib/enterprise-demo/enterpriseDemoGlobalCommandCentreValidationModel";

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
  const tenantKey = process.env.TITAN_DEMO_TENANT_ID?.trim() || "ihrg-global";
  console.log(`TITAN Global Command Centre validation → ${tenantKey}`);
  console.log("---");

  const report = await runGlobalCommandCentreDemoValidation(tenantKey);

  for (const check of report.checks) {
    console.log(`${check.severity.toUpperCase()} [${check.id}] ${check.label}`);
    console.log(`      ${check.detail}`);
  }

  console.log("---");
  console.log("Route map (after tenant resolve):");
  console.log(`  Friendly dashboard:     ${TITAN_GLOBAL_COMMAND_CENTRE_ROUTES.friendlyDashboard}`);
  console.log(`  Friendly presentation:  ${TITAN_GLOBAL_COMMAND_CENTRE_ROUTES.friendlyPresentation}`);
  const routes = buildTenantGlobalCommandCentreRoutes(report.tenantId);
  console.log(`  Tenant dashboard:       ${routes.dashboard}`);
  console.log(`  Tenant presentation:    ${routes.presentation}`);
  console.log(`  Query redirect:         ${routes.presentationQueryRedirect}`);
  console.log("---");
  console.log(
    `Summary: ${report.summary.pass} pass, ${report.summary.warn} warn, ${report.summary.fail} fail · readyForDemo=${report.readyForDemo}`
  );

  if (!report.readyForDemo) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Validation failed.");
  process.exit(1);
});
