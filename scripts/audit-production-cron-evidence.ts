#!/usr/bin/env tsx
/**
 * BLK-SEC-02 — production cron + secrets evidence probe (read-only env audit; cron GET/POST with Bearer).
 * Never prints secret values. Writes redacted summary to stdout (pipe to attachments/).
 *
 * Usage:
 *   npx tsx scripts/audit-production-cron-evidence.ts
 *   npx tsx scripts/audit-production-cron-evidence.ts > docs/production/evidence/attachments/blk-sec-02-cron-probes-2026-06-30.txt
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { normalizeFiDeploymentBaseUrl } from "../src/lib/env/fiDeploymentBaseUrl";

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

const INSECURE_FLAGS = [
  "FI_ALLOW_INSECURE_API",
  "FI_ALLOW_ADMIN_KEY_QUERY",
  "FI_ENABLE_DEV_ADMIN_ACCESS",
  "SKIP_ENV_VALIDATION",
] as const;

const CRON_SECRET_KEYS = [
  "CRON_SECRET",
  "FI_REMINDER_CRON_SECRET",
  "FI_HR_SYNC_CRON_SECRET",
  "FINANCIAL_OS_CRON_SECRET",
  "FI_PAYMENTS_CRON_SECRET",
  "IIOHR_HR_SYNC_SECRET",
] as const;

const EVOLVED_CHAIN_KEYS = [
  "EVOLVED_PERTH_TENANT_ID",
  "FI_BASE_URL",
  "IIOHR_HR_PERTH_STAFF_FEED_URL",
  "NEXT_PUBLIC_SITE_URL",
] as const;

function secretAudit(key: string): string {
  const raw = process.env[key]?.trim() ?? "";
  if (!raw) return "absent";
  if (raw.length < 16) return `present len=${raw.length} FAIL(<16)`;
  if (/^(your_|changeme|placeholder|xxxxxxxx)/i.test(raw)) return `present len=${raw.length} WARN(placeholder)`;
  return `present len=${raw.length} OK`;
}

function baseUrl(): string {
  const raw =
    process.env.FI_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "https://www.follicleintelligence.ai";
  return normalizeFiDeploymentBaseUrl(raw);
}

function pickCronBearer(): string | null {
  const candidates = [
    process.env.CRON_SECRET,
    process.env.FI_REMINDER_CRON_SECRET,
    process.env.FINANCIAL_OS_CRON_SECRET,
    process.env.FI_HR_SYNC_CRON_SECRET,
  ];
  for (const c of candidates) {
    const v = c?.trim();
    if (v && v.length >= 16 && !/^your_/i.test(v)) return v;
  }
  return null;
}

async function probe(
  label: string,
  path: string,
  bearer: string,
  method: "GET" | "POST" = "GET"
): Promise<void> {
  const url = `${baseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const started = Date.now();
  let status = 0;
  let snippet = "";
  try {
    const res = await fetch(url, {
      method,
      headers: { authorization: `Bearer ${bearer}` },
      redirect: "manual",
    });
    status = res.status;
    const text = await res.text();
    snippet = text.slice(0, 200).replace(/\s+/g, " ");
  } catch (e) {
    snippet = e instanceof Error ? e.message : "fetch_error";
  }
  const ms = Date.now() - started;
  const verdict = status === 200 ? "PASS" : status === 401 || status === 503 ? "AUTH_FAIL" : "CHECK";
  console.log(`${verdict} [${label}] ${method} ${path} → ${status} (${ms}ms) body=${snippet}`);
}

async function probeWrongSecret(label: string, path: string): Promise<void> {
  const url = `${baseUrl()}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: "Bearer wrong-cron-secret-probe-zzzzzzzz" },
    redirect: "manual",
  });
  const ok = res.status === 401 || res.status === 403 || res.status === 503;
  console.log(`${ok ? "PASS" : "FAIL"} [${label}] wrong-secret → ${res.status}`);
}

async function main(): Promise<void> {
  loadRepoEnvFiles();

  const runAt = new Date().toISOString();
  const host = baseUrl();
  const evolvedTid = process.env.EVOLVED_PERTH_TENANT_ID?.trim() ?? "(unset)";

  console.log("BLK-SEC-02 production cron + secrets evidence probe");
  console.log(`Run at (UTC): ${runAt}`);
  console.log(`Target host: ${host}`);
  console.log(`EVOLVED_PERTH_TENANT_ID: ${evolvedTid}`);
  console.log("---");
  console.log("§ Secret presence (values redacted)");
  for (const key of CRON_SECRET_KEYS) {
    console.log(`  ${key}: ${secretAudit(key)}`);
  }
  console.log("---");
  console.log("§ Evolved / platform chain (non-secret)");
  for (const key of EVOLVED_CHAIN_KEYS) {
    const v = process.env[key]?.trim();
    console.log(`  ${key}: ${v ? (key.includes("URL") ? v : `${v.slice(0, 8)}…`) : "absent"}`);
  }
  console.log("---");
  console.log("§ Insecure dev flags (local copy — production must be absent)");
  for (const key of INSECURE_FLAGS) {
    const v = process.env[key]?.trim();
    console.log(`  ${key}: ${v ? `SET=${v} WARN` : "absent OK"}`);
  }
  console.log("---");

  const bearer = pickCronBearer();
  if (!bearer) {
    console.log("FAIL: no valid-length CRON_SECRET / FI_REMINDER_CRON_SECRET in runner env");
    process.exit(1);
  }

  console.log("§ Cron auth probes (Bearer from local ops copy — proves production accepts Vercel-style auth)");
  await probeWrongSecret("E4 reminder wrong-secret", "/api/cron/fi-reminder-jobs");
  await probe("E4 fi-reminder-jobs", "/api/cron/fi-reminder-jobs", bearer, "POST");

  await probeWrongSecret("E5 HR wrong-secret", "/api/cron/iiohr-hr-perth-staff-sync");
  await probe("E5 iiohr-hr-perth-staff-sync", "/api/cron/iiohr-hr-perth-staff-sync", bearer, "GET");

  await probe("A health iiohr-hr-staff-sync authed", "/api/health/iiohr-hr-staff-sync", bearer, "GET");

  const finDry = `dryRun=1&tenantId=${encodeURIComponent(evolvedTid)}`;
  await probe(
    "E6 financial-os deposit_overdue dryRun",
    `/api/cron/financial-os/automation?job=deposit_overdue&${finDry}`,
    bearer,
    "GET"
  );
  await probe(
    "E6 clearance-snapshots dryRun",
    `/api/cron/financial-os/clearance-snapshots?horizonDays=14&${finDry}`,
    bearer,
    "GET"
  );

  console.log("---");
  console.log("§ E8 reminder worker posture (code/doc)");
  console.log("  Active path: Vercel cron POST/GET /api/cron/fi-reminder-jobs (vercel.json */5)");
  console.log("  Supabase Edge fi-reminder-processor: documentation-only delegator — NOT scheduled in production");
  console.log("  Verdict: single worker = Next.js Vercel cron");
  console.log("---");
  console.log("§ E9 fi-payments/reminders schedule");
  console.log("  Not in vercel.json — Accepted risk: Stripe invoices not live at Evolved go-live");
  console.log("---");
  console.log("Probe complete (no secret values logged).");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : "probe failed");
  process.exit(1);
});