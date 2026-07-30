/**
 * Load .env.local, ensure production admin e2e vars, map to demo vars for shared fixtures,
 * then run HubSpot production smoke + a short authenticated prod surface smoke.
 * Never prints secrets.
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { loadRepoEnvFiles } from "./lib/loadRepoEnvFiles.mjs";

loadRepoEnvFiles(process.cwd());

// Prefer production admin; fall back only if already set as demo.
if (!process.env.FI_E2E_DEMO_ADMIN_EMAIL?.trim() && process.env.FI_E2E_PRODUCTION_ADMIN_EMAIL?.trim()) {
  process.env.FI_E2E_DEMO_ADMIN_EMAIL = process.env.FI_E2E_PRODUCTION_ADMIN_EMAIL.trim();
}
if (
  !process.env.FI_E2E_DEMO_ADMIN_PASSWORD?.trim() &&
  process.env.FI_E2E_PRODUCTION_ADMIN_PASSWORD?.trim()
) {
  process.env.FI_E2E_DEMO_ADMIN_PASSWORD = process.env.FI_E2E_PRODUCTION_ADMIN_PASSWORD.trim();
}

if (!process.env.FI_E2E_BASE_URL?.trim()) {
  process.env.FI_E2E_BASE_URL = "https://follicleintelligence.ai";
}

const required = [
  "FI_E2E_BASE_URL",
  "FI_E2E_TENANT_ID",
  "FI_E2E_PRODUCTION_ADMIN_EMAIL",
  "FI_E2E_PRODUCTION_ADMIN_PASSWORD",
];
const missing = required.filter((k) => !process.env[k]?.trim());
if (missing.length) {
  console.error("[smoke] Missing required env:", missing.join(", "));
  process.exit(1);
}

console.log("[smoke] baseURL host:", process.env.FI_E2E_BASE_URL.replace(/^https?:\/\//, "").slice(0, 48));
console.log("[smoke] tenant set:", Boolean(process.env.FI_E2E_TENANT_ID?.trim()));
console.log(
  "[smoke] production admin email set:",
  Boolean(process.env.FI_E2E_PRODUCTION_ADMIN_EMAIL?.trim())
);
console.log("[smoke] patient fixture:", Boolean(process.env.FI_E2E_PATIENT_ID?.trim()));

function run(cmd, args, label) {
  console.log(`\n[smoke] === ${label} ===`);
  console.log("[smoke]", cmd, args.join(" "));
  const r = spawnSync(cmd, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    shell: true,
  });
  if (r.status !== 0) {
    console.error(`[smoke] FAILED: ${label} (exit ${r.status})`);
    process.exit(r.status ?? 1);
  }
  console.log(`[smoke] OK: ${label}`);
}

// 1) Official production read-only HubSpot suite (uses PRODUCTION_ADMIN_*)
run(
  "npx",
  ["playwright", "test", "-c", "playwright.hubspot-production-smoke.config.ts"],
  "HubSpot production smoke"
);

// 2) Operational day authenticated surfaces (uses DEMO_* mapped from PRODUCTION_*)
run(
  "npx",
  [
    "playwright",
    "test",
    "--project=chromium-authenticated",
    "e2e/fi-operational-day.spec.ts",
    "e2e/fi-trust-golden-patient-spine.spec.ts",
  ],
  "Authenticated operational + golden patient spine"
);

// 3) Focused product smoke for guide / patient / calendar (inline file if present)
const focused = resolve(process.cwd(), "e2e/fi-prod-feature-smoke.spec.ts");
try {
  const { existsSync } = await import("node:fs");
  if (existsSync(focused)) {
    run(
      "npx",
      ["playwright", "test", "--project=chromium-authenticated", "e2e/fi-prod-feature-smoke.spec.ts"],
      "Feature smoke (guide / journey / scheduling)"
    );
  } else {
    console.log("[smoke] Skip focused feature smoke (spec not present yet)");
  }
} catch {
  /* ignore */
}

console.log("\n[smoke] All requested suites finished successfully.");
