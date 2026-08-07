/**
 * Package B — seed Follicle Demo Clinic (single-clinic guided demo).
 *
 * Usage:
 *   npm run seed:follicle-demo-clinic
 *
 * Requires Supabase service role env. Production needs ALLOW_ENTERPRISE_DEMO_SEED=true.
 */
import { loadRepoEnvFiles } from "./lib/loadRepoEnvFiles.mjs";
import { seedFollicleDemoClinic } from "../src/lib/clinic-demo/clinicDemoSeed.server";

loadRepoEnvFiles();

async function main(): Promise<void> {
  console.log("Seeding Follicle Demo Clinic (Package B)...");
  const result = await seedFollicleDemoClinic();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
