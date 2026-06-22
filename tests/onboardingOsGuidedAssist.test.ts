import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { GUIDED_ASSIST_TIPS } from "../src/lib/onboarding-os/guidedAssistCatalog";
import {
  buildGuidedAssistSessionPayload,
  computeGuidedAssistOnboardingPhase,
  resolveEffectiveGuidedAssistEnabled,
  resolveGuidedAssistPageKey,
  selectGuidedAssistNextAction,
  selectGuidedAssistTips,
  summarizeGuidedAssistUsageEvents,
} from "../src/lib/onboarding-os/guidedAssistCore";
import { GUIDED_ASSIST_SAFETY_NOTICE } from "../src/lib/onboarding-os/guidedAssistTypes";

const BASE_CTX = {
  tenantId: "00000000-0000-4000-8000-000000000001",
  workspaceProfileKey: "clinic_manager" as const,
  tenantAdminRole: "clinic_admin" as const,
  setupFlags: {
    organisationCreated: true,
    clinicCreated: true,
    clinicSettingsComplete: false,
    firstCaseCreated: false,
  },
  isOnboardingPhase: true,
};

describe("OnboardingOS Phase D — guided assist core", () => {
  it("resolveGuidedAssistPageKey strips tenant base and query", () => {
    const base = "/fi-admin/tenant-1";
    assert.equal(
      resolveGuidedAssistPageKey("/fi-admin/tenant-1/calendar?view=week", base),
      "calendar"
    );
    assert.equal(resolveGuidedAssistPageKey("/fi-admin/tenant-1/", base), "");
  });

  it("resolveEffectiveGuidedAssistEnabled prefers user override", () => {
    assert.equal(
      resolveEffectiveGuidedAssistEnabled({
        tenantDefaults: { defaultEnabledDuringOnboarding: true, defaultAssistEnabled: false },
        userPreferences: { assistEnabled: false, dismissedTipCodes: [], snoozedTips: {} },
        isOnboardingPhase: true,
      }),
      false
    );
    assert.equal(
      resolveEffectiveGuidedAssistEnabled({
        tenantDefaults: { defaultEnabledDuringOnboarding: true, defaultAssistEnabled: false },
        userPreferences: { assistEnabled: null, dismissedTipCodes: [], snoozedTips: {} },
        isOnboardingPhase: false,
      }),
      false
    );
    assert.equal(
      resolveEffectiveGuidedAssistEnabled({
        tenantDefaults: { defaultEnabledDuringOnboarding: true, defaultAssistEnabled: false },
        userPreferences: { assistEnabled: null, dismissedTipCodes: [], snoozedTips: {} },
        isOnboardingPhase: true,
      }),
      true
    );
  });

  it("computeGuidedAssistOnboardingPhase is false when setup checklist complete", () => {
    assert.equal(
      computeGuidedAssistOnboardingPhase({
        organisationCreated: true,
        clinicCreated: true,
        clinicSettingsComplete: true,
        firstCaseCreated: true,
      }),
      false
    );
    assert.equal(
      computeGuidedAssistOnboardingPhase({
        organisationCreated: true,
        clinicCreated: true,
        clinicSettingsComplete: true,
        firstCaseCreated: false,
      }),
      true
    );
  });

  it("selectGuidedAssistTips is page-aware and role-aware", () => {
    const tips = selectGuidedAssistTips(
      {
        ...BASE_CTX,
        pageKey: "configuration",
      },
      { assistEnabled: true, dismissedTipCodes: [], snoozedTips: {} }
    );
    assert.ok(tips.some((t) => t.code === "onboarding_configuration_hub"));
    assert.ok(tips.every((t) => !t.body.toLowerCase().includes("prescribe")));
  });

  it("selectGuidedAssistNextAction returns setup next step", () => {
    const action = selectGuidedAssistNextAction({
      ...BASE_CTX,
      pageKey: "",
    });
    assert.ok(action);
    assert.equal(action?.code, "next_complete_configuration");
    assert.ok(action?.href.includes("/configuration"));
  });

  it("buildGuidedAssistSessionPayload includes safety notice and respects disabled assist", () => {
    const payload = buildGuidedAssistSessionPayload({
      ctx: { ...BASE_CTX, pageKey: "calendar" },
      resolved: {
        assistEnabled: false,
        isOnboardingPhase: true,
        tenantDefaults: { defaultEnabledDuringOnboarding: true, defaultAssistEnabled: false },
        userPreferences: { assistEnabled: false, dismissedTipCodes: [], snoozedTips: {} },
      },
      userPreferences: { assistEnabled: false, dismissedTipCodes: [], snoozedTips: {} },
    });
    assert.equal(payload.safetyNotice, GUIDED_ASSIST_SAFETY_NOTICE);
    assert.equal(payload.tips.length, 0);
    assert.equal(payload.nextAction, null);
  });

  it("summarizeGuidedAssistUsageEvents aggregates admin metrics", () => {
    const summary = summarizeGuidedAssistUsageEvents(
      BASE_CTX.tenantId,
      [
        { fi_user_id: "u1", event_kind: "tip_shown", guidance_area: "reception_os", guidance_code: "a" },
        { fi_user_id: "u1", event_kind: "tip_dismissed", guidance_area: "reception_os", guidance_code: "a" },
        { fi_user_id: "u2", event_kind: "assist_enabled", guidance_area: null, guidance_code: null },
      ],
      30
    );
    assert.equal(summary.totalEvents, 3);
    assert.equal(summary.uniqueUsers, 2);
    assert.equal(summary.tipsShown, 1);
    assert.equal(summary.tipsDismissed, 1);
    assert.equal(summary.assistEnabledUsers, 1);
  });

  it("catalog tips remain deterministic and operational", () => {
    assert.ok(GUIDED_ASSIST_TIPS.length >= 10);
    for (const tip of GUIDED_ASSIST_TIPS) {
      assert.ok(tip.code.length > 0);
      assert.ok(tip.title.length > 0);
      assert.ok(tip.body.length > 0);
      assert.ok(!/\b(diagnos|prescri|dosage|treatment plan)\b/i.test(tip.body));
    }
  });
});

describe("OnboardingOS Phase D — migration", () => {
  it("defines fi_guided_assist_preferences and fi_guided_assist_events", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260922120007_onboarding_os_phase_d_guided_assist_mode.sql"
    );
    const sql = fs.readFileSync(migrationPath, "utf8");
    assert.match(sql, /create table if not exists public\.fi_guided_assist_preferences/);
    assert.match(sql, /create table if not exists public\.fi_guided_assist_events/);
    assert.match(sql, /default_enabled_during_onboarding/);
    assert.match(sql, /tip_dismissed/);
  });
});
