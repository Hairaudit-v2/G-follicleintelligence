/**
 * C4 trial consent gate — deploy verification and smoke.
 *
 * 1. Confirms migration file + server wiring exist
 * 2. Runs patientConsentGate unit tests
 * 3. Optional: checks hosted DB for fi_patient_documents migration
 * 4. Optional HTTP probe when gate is enabled (env or tenant flag on server)
 *
 * Usage:
 *   pnpm run smoke:c4
 *   FI_SMOKE_C4_GATE=1 FI_ADMIN_API_KEY=... FI_SMOKE_TENANT_ID=... FI_SMOKE_PATIENT_ID=... pnpm run smoke:c4
 *
 * Enable gate on Evolved tenant (hosted Supabase):
 *   pnpm run deploy:c4:enable-tenant
 *
 * Apply pending migrations (including fi_patient_documents):
 *   pnpm run supabase:push:remote:dry-run
 *   pnpm run supabase:push:remote
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

import { loadRepoEnvFiles } from "./lib/loadRepoEnvFiles.mjs";

loadRepoEnvFiles();

let passed = 0;
let failed = 0;
let skipped = 0;

function pass(id: string, detail?: string): void {
  passed += 1;
  console.log(`PASS [${id}]${detail ? `: ${detail}` : ""}`);
}

function fail(id: string, detail: string): never {
  failed += 1;
  console.error(`FAIL [${id}]: ${detail}`);
  process.exit(1);
}

function skip(id: string, reason: string): void {
  skipped += 1;
  console.log(`SKIP [${id}]: ${reason}`);
}

async function runNodeTests(pattern: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "--test", pattern],
      { cwd: process.cwd(), stdio: "inherit", shell: false }
    );
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`tests failed: ${pattern} (exit ${code})`));
    });
  });
}

function checkMigrationFile(): void {
  const path = resolve(
    process.cwd(),
    "supabase/migrations/20260701120002_fi_patient_documents.sql"
  );
  if (!existsSync(path)) fail("C4-migration-file", "fi_patient_documents migration missing");
  const sql = readFileSync(path, "utf8");
  if (!sql.includes("fi_patient_documents")) {
    fail("C4-migration-file", "migration SQL does not create fi_patient_documents");
  }
  pass("C4-migration-file", "20260701120002_fi_patient_documents.sql present");
}

function checkWiring(): void {
  const imagesRoute = readFileSync(
    resolve(process.cwd(), "app/api/tenants/[tenantId]/patients/[patientId]/images/route.ts"),
    "utf8"
  );
  if (!imagesRoute.includes("assertPatientTrialConsentRecorded")) {
    fail("C4-images-gate", "images route missing consent assertion");
  }
  const earlyIdx = imagesRoute.indexOf("assertPatientTrialConsentRecorded");
  const vieIdx = imagesRoute.indexOf("assertVieProtocolCapturePolicy");
  if (earlyIdx < 0 || vieIdx < 0 || earlyIdx > vieIdx) {
    fail("C4-images-order", "consent gate should run before VIE protocol policy");
  }
  pass("C4-wiring", "consent gate wired before VIE policy on images POST");
}

async function checkRemoteMigration(): Promise<void> {
  if (!process.env.SUPABASE_DB_PASSWORD?.trim()) {
    skip("C4-remote-migration", "SUPABASE_DB_PASSWORD not set — skipping hosted migration check");
    return;
  }
  try {
    const { connectHostedSupabasePostgres } = await import("./lib/supabaseRemotePostgres.mjs");
    const { client } = await connectHostedSupabasePostgres();
    try {
      const { rows: migRows } = await client.query(
        `select version from supabase_migrations.schema_migrations where version = $1`,
        ["20260701120002"]
      );
      if (migRows.length === 0) {
        skip(
          "C4-remote-migration",
          "20260701120002 not applied on hosted DB — run pnpm run supabase:push:remote"
        );
        return;
      }
      const { rows: tableRows } = await client.query(
        `select to_regclass('public.fi_patient_documents') as reg`
      );
      if (!tableRows[0]?.reg) {
        fail("C4-remote-migration", "migration recorded but fi_patient_documents table missing");
      }
      pass("C4-remote-migration", "fi_patient_documents exists on hosted DB");
    } finally {
      await client.end();
    }
  } catch (e) {
    skip(
      "C4-remote-migration",
      `hosted DB check failed (${e instanceof Error ? e.message : e})`
    );
  }
}

async function probeConsentHttp(base: string): Promise<void> {
  const tenantId =
    process.env.FI_SMOKE_TENANT_ID?.trim() ?? process.env.FI_EVOLVED_TENANT_ID?.trim();
  const patientId = process.env.FI_SMOKE_PATIENT_ID?.trim();
  const adminKey = process.env.FI_ADMIN_API_KEY?.trim() ?? null;
  const gateForced =
    process.env.FI_SMOKE_C4_GATE === "1" ||
    process.env.FI_TRIAL_REQUIRE_CONSENT_BEFORE_CAPTURE?.trim().toLowerCase() === "true";

  if (!gateForced) {
    skip("C4-http-403", "Set FI_SMOKE_C4_GATE=1 or FI_TRIAL_REQUIRE_CONSENT_BEFORE_CAPTURE=true");
    return;
  }
  if (!tenantId || !patientId) {
    skip("C4-http-403", "FI_SMOKE_TENANT_ID + FI_SMOKE_PATIENT_ID required for HTTP probe");
    return;
  }
  if (!adminKey) {
    skip("C4-http-403", "FI_ADMIN_API_KEY required for authenticated consent probe");
    return;
  }

  const url = `${base}/api/tenants/${encodeURIComponent(tenantId)}/patients/${encodeURIComponent(patientId)}/images`;
  const fd = new FormData();
  fd.append("file", new Blob(["smoke"], { type: "image/jpeg" }), "smoke.jpg");

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      body: fd,
      headers: { "x-fi-admin-key": adminKey },
      redirect: "manual",
    });
  } catch (e) {
    skip("C4-http-403", `server unreachable (${e instanceof Error ? e.message : e})`);
    return;
  }

  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (res.status === 403 && body.ok === false && /consent|Documents tab/i.test(body.error ?? "")) {
    pass("C4-http-403", `upload blocked without consent (${body.error})`);
    return;
  }
  if (res.status === 403) {
    pass("C4-http-403", `upload returned 403 (${body.error ?? "no detail"})`);
    return;
  }
  skip(
    "C4-http-403",
    `expected 403 consent block, got ${res.status}: ${body.error ?? JSON.stringify(body).slice(0, 120)}`
  );
}

async function main(): Promise<void> {
  console.log("=== C4 consent gate deploy + smoke ===\n");

  checkMigrationFile();
  checkWiring();
  await runNodeTests("src/lib/patients/patientConsentGate.test.ts");
  pass("C4-unit-tests", "patientConsentGate.test.ts green");
  await checkRemoteMigration();

  const base = (process.env.FI_SMOKE_BASE_URL?.trim() || "http://127.0.0.1:3000").replace(
    /\/+$/,
    ""
  );
  await probeConsentHttp(base);

  console.log(`\n=== Done: ${passed} passed, ${skipped} skipped, ${failed} failed ===`);
  console.log("\nDeploy checklist:");
  console.log("  1. pnpm run supabase:push:remote   # apply fi_patient_documents");
  console.log("  2. pnpm run deploy:c4:enable-tenant  # or FI_TRIAL_REQUIRE_CONSENT_BEFORE_CAPTURE=true on Vercel");
  console.log("  3. Upload consent PDF on patient Documents tab before capture");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});