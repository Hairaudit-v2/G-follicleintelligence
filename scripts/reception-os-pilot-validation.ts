/**
 * ReceptionOS Phase 6 — pilot data validation for clinic go-live (Evolved Hair).
 *
 * Usage:
 *   node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs scripts/reception-os-pilot-validation.ts
 *
 * Required env:
 *   FI_SMOKE_TENANT_ID or RECEPTION_OS_PILOT_TENANT_ID — tenant UUID
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (local or deployed DB)
 *
 * Never prints secret values.
 */
import { runReceptionOsPilotValidation } from "../src/lib/receptionOs/receptionOsPilotValidation.server";

function tenantId(): string {
  const t =
    process.env.RECEPTION_OS_PILOT_TENANT_ID?.trim() ||
    process.env.FI_SMOKE_TENANT_ID?.trim() ||
    process.env.EVOLVED_PERTH_TENANT_ID?.trim();
  if (!t) {
    console.error("Missing RECEPTION_OS_PILOT_TENANT_ID, FI_SMOKE_TENANT_ID, or EVOLVED_PERTH_TENANT_ID");
    process.exit(1);
  }
  return t;
}

async function main(): Promise<void> {
  const tid = tenantId();
  console.log(`ReceptionOS pilot validation → tenant ${tid}`);
  console.log("---");

  const report = await runReceptionOsPilotValidation(tid);

  for (const check of report.checks) {
    const tag = check.severity.toUpperCase();
    console.log(`${tag} [${check.id}] ${check.label}`);
    console.log(`      ${check.detail}`);
  }

  console.log("---");
  console.log(
    `Summary: ${report.summary.pass} pass, ${report.summary.warn} warn, ${report.summary.fail} fail · readyForPilot=${report.readyForPilot}`,
  );

  if (!report.readyForPilot) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Validation failed.");
  process.exit(1);
});
