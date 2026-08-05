#!/usr/bin/env node
/**
 * FI-TEAM-COHESION-B2.2c — move onboarding modules under team/onboarding (0 shims).
 * Usage: node scripts/team-cohesion/b2.2c-move-onboarding.mjs
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const FILES = [
  "onboardingTypes.ts",
  "onboardingInviteUrlCore.ts",
  "onboardingCentreCore.ts",
  "onboardingCentreCore.test.ts",
  "onboardingCentre.test.ts",
  "onboardingChecklist.server.ts",
  "onboardingPage.server.ts",
  "onboardingPageModel.test.ts",
  "onboardingInvitation.server.ts",
  "onboardingPinLayer.server.ts",
  "onboardingStaffCreateCore.ts",
  "onboardingStaffCreate.server.ts",
  "onboardingStaffCreate.test.ts",
];

for (const name of FILES) {
  const from = `src/lib/workforce/onboarding/${name}`;
  const to = `src/lib/team/onboarding/${name}`;
  const fromAbs = path.join(ROOT, from);
  const toAbs = path.join(ROOT, to);
  if (!fs.existsSync(fromAbs)) {
    if (fs.existsSync(toAbs)) {
      console.log(`skip (already moved): ${name}`);
      continue;
    }
    throw new Error(`Missing: ${from}`);
  }
  execFileSync("git", ["mv", from, to], { cwd: ROOT, stdio: "inherit" });
}

console.log("Moved", FILES.length, "onboarding modules.");
