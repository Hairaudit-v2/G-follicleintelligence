/**
 * B2.2c architectural enforcement: onboarding invite ↔ PIN cycle must stay broken.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const INVITATION = "src/lib/team/onboarding/onboardingInvitation.server.ts";
const PIN_LAYER = "src/lib/team/onboarding/onboardingPinLayer.server.ts";
const PIN_SETUP = "src/lib/team/onboarding/onboardingPinSetup.server.ts";
const INVITE_ACCEPT = "src/lib/team/onboarding/onboardingInvitationAccept.server.ts";

function importsOf(rel: string): string {
  return readFileSync(rel, "utf8");
}

test("B2.2c: invitation send/load imports pinSetup leaf only (not pinLayer)", () => {
  const src = importsOf(INVITATION);
  assert.match(src, /onboardingPinSetup\.server/);
  assert.doesNotMatch(src, /onboardingPinLayer\.server/);
  assert.doesNotMatch(src, /onboardingInvitationAccept\.server/);
});

test("B2.2c: pinLayer complete imports invitationAccept leaf (not invitation send module)", () => {
  const src = importsOf(PIN_LAYER);
  assert.match(src, /onboardingInvitationAccept\.server/);
  assert.doesNotMatch(src, /from ["']\.\/onboardingInvitation\.server["']/);
  assert.doesNotMatch(src, /from ["']@\/src\/lib\/team\/onboarding\/onboardingInvitation\.server["']/);
});

test("B2.2c: pinSetup leaf has no invitation imports", () => {
  const src = importsOf(PIN_SETUP);
  assert.doesNotMatch(src, /onboardingInvitation/);
  assert.doesNotMatch(src, /onboardingPinLayer/);
});

test("B2.2c: invitationAccept leaf has no PIN imports", () => {
  const src = importsOf(INVITE_ACCEPT);
  assert.doesNotMatch(src, /onboardingPin/);
  assert.doesNotMatch(src, /createOnboardingPinSetupToken/);
});
