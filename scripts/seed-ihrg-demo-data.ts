/**
 * IHRG-DEMO-1 — Demo Data Expansion Pack
 *
 * Idempotent seed for the International Hair Restoration Group demo tenant.
 * Populates the full FI operating system with profile-scaled synthetic data.
 *
 * Run (from repo root, with Supabase service role in env):
 *   pnpm tsx scripts/seed-ihrg-demo-data.ts --tenant ihrg-demo --profile alive
 *   npm run seed:ihrg-demo
 *
 * Profiles: light | standard | alive (default) | enterprise
 * Tenant aliases: ihrg-demo → ihrg-global (canonical slug)
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Production guard: set ALLOW_ENTERPRISE_DEMO_SEED=true when NODE_ENV=production.
 */
import { loadRepoEnvFiles } from "./lib/loadRepoEnvFiles.mjs";

import {
  parseIhrgDemoProfile,
  resolveIhrgDemoTenantSlug,
  seedIhrgDemoData,
} from "../src/lib/ihrg-demo/ihrgDemoSeed.server";

loadRepoEnvFiles();

function parseArgs(argv: string[]): { tenant: string; profile: string } {
  let tenant = "ihrg-demo";
  let profile = "alive";

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--tenant" && argv[i + 1]) {
      tenant = argv[++i];
      continue;
    }
    if (arg.startsWith("--tenant=")) {
      tenant = arg.slice("--tenant=".length);
      continue;
    }
    if (arg === "--profile" && argv[i + 1]) {
      profile = argv[++i];
      continue;
    }
    if (arg.startsWith("--profile=")) {
      profile = arg.slice("--profile=".length);
    }
  }

  return { tenant, profile };
}

function printSection(title: string, rows: Array<[string, number]>): void {
  console.log(`\n${title}`);
  for (const [label, value] of rows) {
    console.log(`  ${label}: ${value}`);
  }
}

function printResult(result: Awaited<ReturnType<typeof seedIhrgDemoData>>): void {
  console.log("IHRG demo seed — expansion pack");
  console.log("================================");
  console.log(`Tenant slug: ${result.tenantSlug}`);
  console.log(`Profile: ${result.profile}`);
  console.log(`Patients target: ${result.patientsTarget} (created ${result.createdPatients}, existing ${result.existingPatients})`);
  console.log(`Surgeries target: ${result.surgeriesTarget} (created ${result.createdSurgeries}, existing ${result.existingSurgeries})`);
  console.log(`OK: ${result.ok}`);
  if (result.error) {
    console.log(`Error: ${result.error}`);
  }

  printSection("Core OS", [
    ["Clinics created", result.createdClinics],
    ["Staff created", result.createdStaff],
    ["Consultations created", result.createdConsultations],
    ["Cases created", result.createdCases],
    ["Bookings created", result.createdBookings],
    ["Images created", result.createdImages],
    ["Invoices created", result.createdInvoices],
    ["Payments created", result.createdPayments],
  ]);

  printSection("Expansion pack", [
    ["CRM leads created", result.createdCrmLeads],
    ["CRM leads skipped (existing)", result.existingCrmLeads],
    ["LeadFlow leads created", result.createdLeadflowLeads],
    ["LeadFlow leads skipped (existing)", result.existingLeadflowLeads],
    ["CRM tasks created", result.createdCrmTasks],
    ["Calendar events created", result.createdCalendarEvents],
    ["Analytics events created", result.createdAnalyticsEvents],
    ["Reception tasks created", result.createdReceptionTasks],
    ["Competency projections created", result.createdCompetencyProjections],
  ]);

  if (result.warnings.length > 0) {
    console.log("\nWarnings:");
    for (const warning of result.warnings) {
      console.log(`  - ${warning}`);
    }
  }
}

async function main(): Promise<void> {
  const { tenant, profile: profileRaw } = parseArgs(process.argv.slice(2));
  const tenantSlug = resolveIhrgDemoTenantSlug(tenant);
  const profile = parseIhrgDemoProfile(profileRaw);

  console.log(`Seeding IHRG demo tenant "${tenantSlug}" with profile "${profile}"...`);

  const result = await seedIhrgDemoData({ tenantSlug, profile });
  printResult(result);

  if (!result.ok) {
    console.error("\nSeed failed");
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Seed failed with exception:");
  console.error(e instanceof Error ? e.message : e);
  if (e instanceof Error && e.stack) console.error(e.stack);
  process.exit(1);
});
