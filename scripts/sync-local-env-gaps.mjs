#!/usr/bin/env node
/**
 * Patch .env.local with audit fixes (no secret values printed).
 * Usage: node scripts/sync-local-env-gaps.mjs
 */
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));
const envPath = resolve(repoRoot, ".env.local");

if (!existsSync(envPath)) {
  console.error(".env.local not found");
  process.exit(1);
}

let raw = readFileSync(envPath, "utf8");
const lines = raw.split(/\r?\n/);

function parseKeys(text) {
  const keys = new Set();
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq > 0) keys.add(t.slice(0, eq).trim());
  }
  return keys;
}

const keys = parseKeys(raw);
const machineIngestKey = randomBytes(48).toString("base64url");

// Drop duplicate / incorrect FI_BASE_URL and placeholder HR cron secret.
const filtered = [];
let fiBaseKept = false;
for (const line of lines) {
  const t = line.trim();
  if (t.startsWith("FI_BASE_URL=")) {
    if (t.includes("/fi-admin")) continue;
    if (fiBaseKept) continue;
    fiBaseKept = true;
    filtered.push("FI_BASE_URL=https://follicleintelligence.ai");
    continue;
  }
  if (t.startsWith("FI_HR_SYNC_CRON_SECRET=your_hr_sync_cron_secret")) continue;
  filtered.push(line);
}

const append = [];
if (!keys.has("FI_MACHINE_INGEST_MASTER_KEY")) {
  append.push(
    "",
    "# Machine ingest HMAC master key (≥32 chars in production).",
    `FI_MACHINE_INGEST_MASTER_KEY=${machineIngestKey}`
  );
}
if (!keys.has("FI_IMAGING_AI_ANALYSIS_CRON_SECRET")) {
  append.push(
    "# Optional alias for /api/cron/fi-imaging-ai-analysis (CRON_SECRET also accepted).",
    "# FI_IMAGING_AI_ANALYSIS_CRON_SECRET="
  );
}
if (!keys.has("FI_REMINDERS_LIVE_DELIVERY")) {
  append.push("# Local dev: explicit live-delivery toggle (false = staging-safe).", "FI_REMINDERS_LIVE_DELIVERY=false");
}

const next = [...filtered, ...append].join("\n").replace(/\n{3,}/g, "\n\n");
writeFileSync(envPath, next.endsWith("\n") ? next : `${next}\n`, "utf8");

console.log("Updated .env.local:");
console.log("- deduplicated FI_BASE_URL (site root, no /fi-admin)");
console.log("- removed placeholder FI_HR_SYNC_CRON_SECRET (CRON_SECRET is used)");
if (!keys.has("FI_MACHINE_INGEST_MASTER_KEY")) console.log("- added FI_MACHINE_INGEST_MASTER_KEY");
if (!keys.has("FI_REMINDERS_LIVE_DELIVERY")) console.log("- added FI_REMINDERS_LIVE_DELIVERY=false");