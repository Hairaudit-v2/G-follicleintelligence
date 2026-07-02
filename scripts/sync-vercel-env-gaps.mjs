#!/usr/bin/env node
/**
 * Apply audit gap fixes on Vercel: add missing module env vars, remove orphans.
 * Idempotent — skips vars that already exist for the target environment.
 *
 * Usage: node scripts/sync-vercel-env-gaps.mjs
 */
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));

function runVercel(args, { input } = {}) {
  const r = spawnSync("npx", ["vercel", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    input,
    shell: true,
    stdio: input ? ["pipe", "pipe", "pipe"] : "pipe",
  });
  return { ok: r.status === 0, stdout: r.stdout ?? "", stderr: r.stderr ?? "", status: r.status };
}

function listEnvNames(environment) {
  const r = runVercel(["env", "ls", environment]);
  if (!r.ok) throw new Error(`vercel env ls ${environment} failed: ${r.stderr || r.stdout}`);
  const names = new Set();
  for (const line of r.stdout.split(/\r?\n/)) {
    const m = line.trim().match(/^([A-Z][A-Z0-9_]+)\s+/);
    if (m) names.add(m[1]);
  }
  return names;
}

function addEnv(name, value, environments) {
  let anyAdded = false;
  for (const env of environments) {
    if (listEnvNames(env).has(name)) {
      console.log(`skip ${name} (${env} — already set)`);
      continue;
    }
    const r = runVercel([
      "env",
      "add",
      name,
      env,
      "--value",
      value,
      "--yes",
      "--sensitive",
    ]);
    if (!r.ok) {
      console.error(`FAIL add ${name} → ${env}: ${r.stderr || r.stdout}`);
      continue;
    }
    console.log(`added ${name} → ${env}`);
    anyAdded = true;
  }
  return anyAdded ? "added" : "skipped";
}

function removeEnv(name, environment) {
  if (!listEnvNames(environment).has(name)) {
    console.log(`skip remove ${name} (${environment} — not present)`);
    return "skipped";
  }
  const r = runVercel(["env", "rm", name, environment, "--yes"]);
  if (!r.ok) {
    console.error(`FAIL rm ${name} ${environment}: ${r.stderr || r.stdout}`);
    return "failed";
  }
  console.log(`removed ${name} from ${environment}`);
  return "removed";
}

function secret(bytes = 48) {
  return randomBytes(bytes).toString("base64url");
}

function readLocalEnvValue(key) {
  const p = resolve(repoRoot, ".env.local");
  if (!existsSync(p)) return null;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    if (t.slice(0, eq).trim() === key) return t.slice(eq + 1).trim();
  }
  return null;
}

const machineIngestKey = readLocalEnvValue("FI_MACHINE_INGEST_MASTER_KEY") ?? secret(48);

const additions = [
  {
    name: "FI_MACHINE_INGEST_MASTER_KEY",
    value: machineIngestKey,
    environments: ["production", "preview"],
  },
  {
    name: "RECEPTION_OS_COMMUNICATION_DRY_RUN",
    value: "false",
    environments: ["production"],
  },
  {
    name: "RECEPTION_OS_EMAIL_SEND_ENABLED",
    value: "false",
    environments: ["production", "preview"],
  },
  {
    name: "RECEPTION_OS_SMS_SEND_ENABLED",
    value: "false",
    environments: ["production", "preview"],
  },
  {
    name: "RECEPTION_OS_DEMO_MODE",
    value: "false",
    environments: ["production", "preview"],
  },
  {
    name: "RECEPTION_OS_DEMO_MASK_AMOUNTS",
    value: "false",
    environments: ["production", "preview"],
  },
  {
    name: "FI_REMINDERS_LIVE_DELIVERY",
    value: "true",
    environments: ["production"],
  },
  {
    name: "FI_REMINDERS_LIVE_DELIVERY",
    value: "false",
    environments: ["preview"],
  },
  {
    name: "RECEPTION_OS_COMMUNICATION_DRY_RUN",
    value: "true",
    environments: ["preview"],
  },
  {
    name: "FI_GOOGLE_CALENDAR_SYNC_CRON_DISABLED",
    value: "0",
    environments: ["production", "preview"],
  },
  {
    name: "WORKFORCE_COMPLIANCE_CRON_SECRET",
    value: secret(24),
    environments: ["production", "preview"],
  },
];

const removals = ["FI_EMAIL_ENABLED", "FI_EMAIL_FROM", "FI_EMAIL_REPLY_TO"];

console.log("=== Syncing Vercel env gaps ===\n");

let addedMachineIngest = false;
for (const item of additions) {
  const result = addEnv(item.name, item.value, item.environments);
  if (item.name === "FI_MACHINE_INGEST_MASTER_KEY" && result === "added") {
    addedMachineIngest = true;
  }
}

for (const name of removals) {
  removeEnv(name, "production");
  removeEnv(name, "preview");
}

if (addedMachineIngest) {
  console.log("\nNOTE: FI_MACHINE_INGEST_MASTER_KEY was newly generated for Vercel.");
  console.log("Add the same value to .env.local (written by sync-local-env-gaps.mjs).");
}

console.log("\nDone. Re-pull with: npx vercel env pull .env.vercel.production --environment=production --yes");