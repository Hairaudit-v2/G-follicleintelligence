/**
 * Job locking test: concurrent run-model calls.
 * One should succeed, the other should get "already has running job" (or both get same idempotent result).
 * Run: npx tsx scripts/replay-job-lock-test.ts
 * Requires: dev server + completed case (run replay-test.ts first, or set FI_CASE_ID, FI_TENANT_ID)
 */
export {};

const BASE = process.env.FI_BASE_URL || "http://localhost:3000";

async function runModel(tenantId: string, caseId: string): Promise<unknown> {
  const r = await fetch(`${BASE}/api/tenants/${tenantId}/cases/${caseId}/run-model`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return r.json();
}

async function main() {
  const tenantId = process.env.FI_TENANT_ID;
  const caseId = process.env.FI_CASE_ID;
  if (!tenantId || !caseId) {
    console.log("Usage: FI_TENANT_ID=... FI_CASE_ID=... npx tsx scripts/replay-job-lock-test.ts");
    console.log("Or run replay-test.ts first to create a case, then use its IDs.");
    process.exit(1);
  }

  console.log("Concurrent run-model (2 parallel calls)...");
  const [r1, r2] = await Promise.all([
    runModel(tenantId, caseId),
    runModel(tenantId, caseId),
  ]);

  const ok1 = (r1 as { ok?: boolean }).ok;
  const ok2 = (r2 as { ok?: boolean }).ok;
  const report1 = (r1 as { reportId?: string }).reportId;
  const report2 = (r2 as { reportId?: string }).reportId;

  // Both should succeed (idempotent: same complete job) and return same report
  if (ok1 && ok2 && report1 && report2 && report1 === report2) {
    console.log("OK: Both returned same report (idempotent re-run)");
    return;
  }

  // Or one fails with "already has running job"
  const err1 = (r1 as { error?: string }).error;
  const err2 = (r2 as { error?: string }).error;
  if (
    (ok1 && !ok2 && err2?.includes("already has")) ||
    (!ok1 && ok2 && err1?.includes("already has"))
  ) {
    console.log("OK: One succeeded, one got 'already has running' (job lock)");
    return;
  }

  if (ok1 && ok2 && report1 !== report2) {
    throw new Error(`Conflicting reports: ${report1} vs ${report2}`);
  }

  throw new Error(`Unexpected: r1=${JSON.stringify(r1)} r2=${JSON.stringify(r2)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
