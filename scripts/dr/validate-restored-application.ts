#!/usr/bin/env tsx
/**
 * FI-SECURITY-RESTORE-DRILL-1 application validator.
 *
 * This wrapper only runs against a restored non-production app/project. It
 * reuses existing smoke infrastructure and keeps mutation mode opt-in.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const PRODUCTION_PROJECT_REF = "iqqvzgxoimxchhcnbzxl";

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  let raw = readFileSync(path, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim().replace(/^export\s+/, "");
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), ".env.restore-drill.local"));
loadEnvFile(resolve(process.cwd(), ".env.restore-drill"));

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function projectRefFromUrl(rawUrl: string): string {
  const host = new URL(rawUrl).host.toLowerCase();
  const match = /^([a-z0-9-]+)\.supabase\.co$/.exec(host);
  return match?.[1] ?? host;
}

function assertSafety(): string {
  if (process.env.FI_DRILL_CONFIRM_NON_PRODUCTION !== "YES") {
    throw new Error("Refusing to run: set FI_DRILL_CONFIRM_NON_PRODUCTION=YES");
  }
  const expectedRef = requiredEnv("FI_DRILL_EXPECTED_PROJECT_REF");
  const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const ref = projectRefFromUrl(url);
  if (expectedRef === PRODUCTION_PROJECT_REF || ref === PRODUCTION_PROJECT_REF) {
    throw new Error("Refusing to run against production Supabase project");
  }
  if (ref !== expectedRef) {
    throw new Error(`Supabase URL ref ${ref} does not match expected drill ref ${expectedRef}`);
  }
  requiredEnv("FI_BASE_URL");
  requiredEnv("FI_SMOKE_TENANT_ID");
  return ref;
}

function forcedSafeEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    RECEPTION_OS_COMMUNICATION_DRY_RUN: "true",
    RECEPTION_OS_EMAIL_SEND_ENABLED: "false",
    RECEPTION_OS_SMS_SEND_ENABLED: "false",
    FI_PAYMENT_PROVIDER: "manual",
    FI_PAYMENTS_ENABLED: "false",
    FI_REMINDERS_LIVE_DELIVERY: "false",
    FI_REMINDERS_TEST_SEND: "false",
    PATHOLOGY_EMAIL_INGESTION_ENABLED: "false",
    PATHOLOGY_EXTRACTION_ENABLED: "false",
    PATHOLOGY_AUTO_DRAFT_ENABLED: "false",
    GENERIC_CLINIC_EMAIL_INGESTION_ENABLED: "false",
    FI_ACCOUNTING_LIVE_PUSH: "0",
    FI_GOOGLE_CALENDAR_SYNC_CRON_DISABLED: "1",
  };
}

function runCheck(name: string, command: string, args: string[], env: NodeJS.ProcessEnv) {
  const startedAtUtc = new Date().toISOString();
  const proc = spawnSync(command, args, { stdio: "inherit", env });
  return {
    name,
    command: [command, ...args].join(" "),
    startedAtUtc,
    finishedAtUtc: new Date().toISOString(),
    status: proc.status,
    pass: proc.status === 0,
  };
}

async function main(): Promise<void> {
  const projectRef = assertSafety();
  const env = forcedSafeEnv();

  const results = [
    runCheck("read_only_operational_day", process.execPath, ["scripts/run-fi-operational-day-smoke.mjs"], env),
  ];

  if (process.env.FI_DRILL_RUN_MUTATION_SMOKE === "YES") {
    if (process.env.FI_OPERATIONAL_SMOKE_ALLOW_MUTATIONS !== "1") {
      throw new Error(
        "Mutation smoke requested, but FI_OPERATIONAL_SMOKE_ALLOW_MUTATIONS=1 is not set"
      );
    }
    results.push(
      runCheck(
        "restored_environment_mutation_smoke",
        process.execPath,
        ["scripts/run-fi-operational-day-smoke.mjs", "--execute"],
        { ...env, FI_OPERATIONAL_SMOKE_ALLOW_MUTATIONS: "1" }
      )
    );
  }

  const evidence = {
    drill: "FI-SECURITY-RESTORE-DRILL-1",
    generatedAtUtc: new Date().toISOString(),
    projectRef,
    baseUrl: process.env.FI_BASE_URL,
    tenantId: process.env.FI_SMOKE_TENANT_ID,
    sideEffectControls: {
      receptionDryRun: env.RECEPTION_OS_COMMUNICATION_DRY_RUN,
      emailSend: env.RECEPTION_OS_EMAIL_SEND_ENABLED,
      smsSend: env.RECEPTION_OS_SMS_SEND_ENABLED,
      paymentProvider: env.FI_PAYMENT_PROVIDER,
      paymentsEnabled: env.FI_PAYMENTS_ENABLED,
      remindersLiveDelivery: env.FI_REMINDERS_LIVE_DELIVERY,
      googleCalendarCronDisabled: env.FI_GOOGLE_CALENDAR_SYNC_CRON_DISABLED,
    },
    results,
    verdict: results.every((r) => r.pass) ? "PASS" : "FAIL",
  };

  const outDir = resolve(process.cwd(), "docs/security/restore-drill-evidence");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = resolve(outDir, `restored-application-${projectRef}-${stamp}.json`);
  writeFileSync(outPath, JSON.stringify(evidence, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ verdict: evidence.verdict, projectRef, evidencePath: outPath }, null, 2));

  if (evidence.verdict !== "PASS") process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
