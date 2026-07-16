import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { GUIDED_ASSIST_TIPS } from "../src/lib/onboarding-os/guidedAssistCatalog";
import {
  buildGuidedAssistSessionPayload,
  computeGuidedAssistOnboardingPhase,
  expandGuidedAssistPageKeys,
  resolveEffectiveGuidedAssistEnabled,
  resolveGuidedAssistPageKey,
  selectGuidedAssistNextAction,
  selectGuidedAssistTips,
  summarizeGuidedAssistUsageEvents,
} from "../src/lib/onboarding-os/guidedAssistCore";
import {
  getEmptyStateTour,
  getContextualTips,
  resolveEmptyStateKey,
  resolveTimeOfDay,
} from "../src/lib/onboarding-os/getContextualTips";
import {
  getRoleFirstTips,
  mapViewerToGuidedAssistTodayRole,
  shouldUseRoleFirstTips,
} from "../src/lib/onboarding-os/getRoleFirstTips";
import {
  getRuleBasedNextBestActions,
  inferGuidedAssistExperienceLevel,
  tipBodyIsOperationallySafe,
  tipMatchesExperienceLevel,
} from "../src/lib/onboarding-os/getTieredAndContextualTips";
import {
  buildWeeklyProgressSummary,
  computeEngagementStreakUpdate,
  formatStreakMessage,
  resolveTeamHighlightFromCounts,
} from "../src/lib/onboarding-os/guidedAssistEngagementCore";
import {
  buildGuidedAssistRoleModeLabel,
  compareTipsByRoleGroupAndPriority,
  isClinicalTodayRole,
} from "../src/lib/onboarding-os/guidedAssistRoleMode";
import {
  isGuidedAssistDebugQueryActive,
  isGuidedAssistForceShowCookieActive,
} from "../src/lib/onboarding-os/guidedAssistForceShow";
import {
  GUIDED_ASSIST_AREA_LABELS,
  GUIDED_ASSIST_HIGH_OPEN_LEADS_THRESHOLD,
  GUIDED_ASSIST_ROLE_FIRST_VIEW_LIMIT,
  GUIDED_ASSIST_SAFETY_NOTICE,
  type GuidedAssistTipDefinition,
  type GuidedAssistUserPreferences,
} from "../src/lib/onboarding-os/guidedAssistTypes";

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

function prefs(
  partial: Partial<GuidedAssistUserPreferences> = {}
): GuidedAssistUserPreferences {
  return {
    assistEnabled: true,
    dismissedTipCodes: [],
    snoozedTips: {},
    todayHomeViews: 0,
    experienceLevelOverride: null,
    guideStartedAtIso: null,
    engagementStreakDays: 0,
    engagementLastActiveDateYmd: null,
    ...partial,
  };
}

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
        userPreferences: prefs({ assistEnabled: false }),
        isOnboardingPhase: true,
      }),
      false
    );
    assert.equal(
      resolveEffectiveGuidedAssistEnabled({
        tenantDefaults: { defaultEnabledDuringOnboarding: true, defaultAssistEnabled: false },
        userPreferences: prefs({ assistEnabled: null }),
        isOnboardingPhase: false,
      }),
      false
    );
    assert.equal(
      resolveEffectiveGuidedAssistEnabled({
        tenantDefaults: { defaultEnabledDuringOnboarding: true, defaultAssistEnabled: false },
        userPreferences: prefs({ assistEnabled: null }),
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
      prefs()
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
    const userPreferences = prefs({ assistEnabled: false });
    const payload = buildGuidedAssistSessionPayload({
      ctx: { ...BASE_CTX, pageKey: "calendar" },
      resolved: {
        assistEnabled: false,
        isOnboardingPhase: true,
        tenantDefaults: { defaultEnabledDuringOnboarding: true, defaultAssistEnabled: false },
        userPreferences,
      },
      userPreferences,
    });
    assert.equal(payload.safetyNotice, GUIDED_ASSIST_SAFETY_NOTICE);
    assert.equal(payload.tips.length, 0);
    assert.equal(payload.nextAction, null);
    assert.equal(payload.roleFirstActive, false);
    assert.equal(payload.nextBestActions.length, 0);
    assert.ok(payload.experienceLevel);
    assert.equal(payload.showReenableChrome, true);
    assert.match(payload.settingsHref, /settings\/clinic-guide$/);
    assert.equal(payload.userAssistOverride, false);
    assert.equal(payload.canManageTenantDefaults, true);
  });

  it("user override false forces assist off after setup; true forces on", () => {
    assert.equal(
      resolveEffectiveGuidedAssistEnabled({
        tenantDefaults: { defaultEnabledDuringOnboarding: true, defaultAssistEnabled: true },
        userPreferences: prefs({ assistEnabled: false }),
        isOnboardingPhase: false,
      }),
      false
    );
    assert.equal(
      resolveEffectiveGuidedAssistEnabled({
        tenantDefaults: { defaultEnabledDuringOnboarding: false, defaultAssistEnabled: false },
        userPreferences: prefs({ assistEnabled: true }),
        isOnboardingPhase: false,
      }),
      true
    );
  });

  it("summarizeGuidedAssistUsageEvents aggregates admin metrics", () => {
    const summary = summarizeGuidedAssistUsageEvents(
      BASE_CTX.tenantId,
      [
        { fi_user_id: "u1", event_kind: "tip_shown", guidance_area: "reception_os", guidance_code: "a" },
        { fi_user_id: "u1", event_kind: "tip_shown", guidance_area: "reception_os", guidance_code: "a" },
        { fi_user_id: "u1", event_kind: "tip_dismissed", guidance_area: "reception_os", guidance_code: "a" },
        { fi_user_id: "u2", event_kind: "assist_enabled", guidance_area: null, guidance_code: null },
      ],
      30
    );
    assert.equal(summary.totalEvents, 4);
    assert.equal(summary.uniqueUsers, 2);
    assert.equal(summary.tipsShown, 2);
    assert.equal(summary.tipsDismissed, 1);
    assert.equal(summary.assistEnabledUsers, 1);
    assert.equal(summary.topReliedTips[0]?.guidanceCode, "a");
    assert.equal(summary.topReliedTips[0]?.shownCount, 2);
    assert.equal(summary.topDismissedTips[0]?.count, 1);
    assert.equal(summary.reliantUsers[0]?.fiUserId, "u1");
    assert.equal(summary.reliantUsers[0]?.tipsShown, 2);
    assert.ok(summary.modulesNeedingGuidanceReview.includes("reception_os"));
  });

  it("catalog tips remain deterministic and operational", () => {
    assert.ok(GUIDED_ASSIST_TIPS.length >= 10);
    for (const tip of GUIDED_ASSIST_TIPS) {
      assert.ok(tip.code.length > 0);
      assert.ok(tip.title.length > 0);
      assert.ok(tip.body.length > 0);
      assert.ok(!/\b(diagnos|prescri|dosage|treatment plan)\b/i.test(tip.body));
      assert.ok(
        !/\b(ReceptionOS|SurgeryOS|FinancialOS|LeadFlow|OnboardingOS|WorkforceOS|AcademyOS|AnalyticsOS)\b/.test(
          tip.body
        ),
        tip.code
      );
      assert.ok(
        !/\b(ReceptionOS|SurgeryOS|FinancialOS|LeadFlow|OnboardingOS)\b/.test(tip.title),
        tip.code
      );
    }
    for (const label of Object.values(GUIDED_ASSIST_AREA_LABELS)) {
      assert.ok(!/OS\b/.test(label), label);
    }
  });

  it("expandGuidedAssistPageKeys maps legacy routes to new hubs", () => {
    assert.ok(expandGuidedAssistPageKeys("tomorrow").includes("front-desk"));
    assert.ok(expandGuidedAssistPageKeys("surgery-os").includes("surgery"));
    assert.ok(expandGuidedAssistPageKeys("leadflow").includes("crm"));
    assert.ok(expandGuidedAssistPageKeys("payments").includes("financial-os"));
  });

  it("front desk page surfaces front_desk tips for reception", () => {
    const tips = selectGuidedAssistTips(
      {
        ...BASE_CTX,
        workspaceProfileKey: "reception",
        tenantAdminRole: null,
        pageKey: "front-desk",
      },
      prefs()
    );
    assert.ok(tips.some((t) => t.code === "front_desk_today"));
    assert.ok(tips.every((t) => !/ReceptionOS/i.test(t.areaLabel)));
  });

  it("post-setup next action for reception is Front desk", () => {
    const action = selectGuidedAssistNextAction({
      ...BASE_CTX,
      workspaceProfileKey: "reception",
      tenantAdminRole: null,
      pageKey: "",
      setupFlags: {
        organisationCreated: true,
        clinicCreated: true,
        clinicSettingsComplete: true,
        firstCaseCreated: true,
      },
      isOnboardingPhase: false,
    });
    assert.ok(action);
    assert.equal(action?.code, "next_open_front_desk");
    assert.ok(action?.href.endsWith("/front-desk"));
  });

  it("role-first tips apply on Today for first N views only", () => {
    assert.equal(shouldUseRoleFirstTips({ pageKey: "", todayHomeViews: 0 }), true);
    assert.equal(
      shouldUseRoleFirstTips({
        pageKey: "",
        todayHomeViews: GUIDED_ASSIST_ROLE_FIRST_VIEW_LIMIT - 1,
      }),
      true
    );
    assert.equal(
      shouldUseRoleFirstTips({ pageKey: "", todayHomeViews: GUIDED_ASSIST_ROLE_FIRST_VIEW_LIMIT }),
      false
    );
    assert.equal(shouldUseRoleFirstTips({ pageKey: "calendar", todayHomeViews: 0 }), false);
    assert.equal(mapViewerToGuidedAssistTodayRole({ workspaceProfileKey: "reception" }), "reception");
    assert.equal(
      mapViewerToGuidedAssistTodayRole({
        workspaceProfileKey: "default",
        tenantAdminRole: "finance_admin",
      }),
      "finance"
    );

    const roleTips = getRoleFirstTips({
      todayRole: "reception",
      tenantId: BASE_CTX.tenantId,
      dismissedTipCodes: [],
    });
    assert.ok(roleTips.some((t) => t.code === "today_reception_front_desk"));
    assert.equal(roleTips[0]!.code, "today_reception_front_desk");

    const userPreferences = prefs({ todayHomeViews: 0 });
    const payload = buildGuidedAssistSessionPayload({
      ctx: {
        ...BASE_CTX,
        workspaceProfileKey: "reception",
        tenantAdminRole: null,
        pageKey: "",
      },
      resolved: {
        assistEnabled: true,
        isOnboardingPhase: true,
        tenantDefaults: { defaultEnabledDuringOnboarding: true, defaultAssistEnabled: false },
        userPreferences,
      },
      userPreferences,
    });
    assert.equal(payload.roleFirstActive, true);
    assert.equal(payload.shouldIncrementTodayHomeViews, true);
    assert.ok(payload.tips.some((t) => t.code === "today_reception_front_desk"));

    const afterPrefs = prefs({ todayHomeViews: GUIDED_ASSIST_ROLE_FIRST_VIEW_LIMIT });
    const afterWindow = buildGuidedAssistSessionPayload({
      ctx: {
        ...BASE_CTX,
        workspaceProfileKey: "reception",
        tenantAdminRole: null,
        pageKey: "",
      },
      resolved: {
        assistEnabled: true,
        isOnboardingPhase: false,
        tenantDefaults: { defaultEnabledDuringOnboarding: true, defaultAssistEnabled: true },
        userPreferences: afterPrefs,
      },
      userPreferences: afterPrefs,
    });
    assert.equal(afterWindow.roleFirstActive, false);
    assert.equal(afterWindow.shouldIncrementTodayHomeViews, false);
  });

  it("empty-state tour resolves for pipeline with zero leads", () => {
    const stats = {
      openLeadCount: 0,
      todayBookingCount: 0,
      openTaskCount: 0,
      openSurgeryCaseCount: 0,
      paymentRecordCount: 0,
      hourLocal: 10,
    };
    assert.equal(resolveEmptyStateKey("crm", stats), "pipeline_empty");
    const tour = getEmptyStateTour({
      pageKey: "crm",
      stats,
      tenantId: BASE_CTX.tenantId,
    });
    assert.ok(tour);
    assert.equal(tour!.emptyStateKey, "pipeline_empty");
    assert.ok(tour!.steps.length >= 3);
    assert.ok(!tour!.steps.some((s) => /diagnos|prescri/i.test(s.body)));
  });

  it("contextual tips use time of day and interpolate counts", () => {
    assert.equal(resolveTimeOfDay(9), "morning");
    assert.equal(resolveTimeOfDay(14), "afternoon");
    assert.equal(resolveTimeOfDay(19), "evening");
    const tips = getContextualTips({
      ctx: {
        tenantId: BASE_CTX.tenantId,
        pageKey: "",
        workspaceProfileKey: "reception",
        tenantAdminRole: null,
      },
      prefs: prefs(),
      stats: {
        openLeadCount: 3,
        todayBookingCount: 2,
        openTaskCount: 0,
        openSurgeryCaseCount: 0,
        paymentRecordCount: 1,
        hourLocal: 9,
      },
      timeOfDay: "morning",
    });
    assert.ok(tips.some((t) => t.code === "ctx_morning_front_desk"));
    const load = getContextualTips({
      ctx: {
        tenantId: BASE_CTX.tenantId,
        pageKey: "",
        workspaceProfileKey: "reception",
        tenantAdminRole: null,
      },
      prefs: prefs(),
      stats: {
        openLeadCount: 0,
        todayBookingCount: 5,
        openTaskCount: 0,
        openSurgeryCaseCount: 0,
        paymentRecordCount: 1,
        hourLocal: 11,
      },
      timeOfDay: "morning",
    });
    const bookingTip = load.find((t) => t.code === "ctx_today_bookings_load");
    assert.ok(bookingTip);
    assert.match(bookingTip!.body, /5/);
  });
});

describe("Clinic guide — experience tiers + next best action", () => {
  it("infers novice / intermediate / advanced from views + age", () => {
    const now = new Date("2026-07-17T12:00:00.000Z");
    assert.equal(
      inferGuidedAssistExperienceLevel({
        todayHomeViews: 2,
        guideStartedAtIso: "2026-07-10T00:00:00.000Z",
        experienceLevelOverride: null,
        now,
      }),
      "novice"
    );
    assert.equal(
      inferGuidedAssistExperienceLevel({
        todayHomeViews: 20,
        // ~107 days old, views between novice max and advanced min → intermediate
        guideStartedAtIso: "2026-04-01T00:00:00.000Z",
        experienceLevelOverride: null,
        now,
      }),
      "intermediate"
    );
    assert.equal(
      inferGuidedAssistExperienceLevel({
        todayHomeViews: 50,
        guideStartedAtIso: "2025-01-01T00:00:00.000Z",
        experienceLevelOverride: null,
        now,
      }),
      "advanced"
    );
    assert.equal(
      inferGuidedAssistExperienceLevel({
        todayHomeViews: 0,
        guideStartedAtIso: null,
        experienceLevelOverride: "advanced",
        now,
      }),
      "advanced"
    );
  });

  it("catalog experienceLevel filtering matches roles and tiers", () => {
    const noviceTip = GUIDED_ASSIST_TIPS.find((t) => t.code === "novice_today_orientation");
    const advancedTip = GUIDED_ASSIST_TIPS.find((t) => t.code === "advanced_search_shortcut");
    assert.ok(noviceTip && advancedTip);
    assert.equal(tipMatchesExperienceLevel(noviceTip!, "novice"), true);
    assert.equal(tipMatchesExperienceLevel(noviceTip!, "advanced"), false);
    assert.equal(tipMatchesExperienceLevel(advancedTip!, "advanced"), true);
    assert.equal(tipMatchesExperienceLevel(advancedTip!, "novice"), false);

    const doctorScales = GUIDED_ASSIST_TIPS.find((t) => t.code === "doctor_scales_shortcuts");
    assert.ok(doctorScales?.roles?.includes("doctor"));
    assert.ok(!/\b(diagnos|prescri|medical advice)\b/i.test(doctorScales!.body));
  });

  it("rule-based NBA: high leads → pipeline / batch photos by role", () => {
    const stats = {
      openLeadCount: GUIDED_ASSIST_HIGH_OPEN_LEADS_THRESHOLD + 2,
      todayBookingCount: 0,
      openTaskCount: 0,
      openSurgeryCaseCount: 0,
      paymentRecordCount: 1,
      hourLocal: 11,
    };
    const consultantNba = getRuleBasedNextBestActions({
      tenantId: BASE_CTX.tenantId,
      pageKey: "",
      todayRole: "consultant",
      experienceLevel: "advanced",
      stats,
      timeOfDay: "morning",
      maxActions: 2,
    });
    assert.ok(consultantNba.length >= 1);
    assert.ok(consultantNba.every((t) => t.isNextBestAction && t.suggestionSource === "rule_nba"));
    assert.ok(
      consultantNba.some(
        (t) =>
          t.code === "nba_high_leads_batch_photos" || t.code === "nba_high_leads_work_pipeline"
      )
    );
    assert.match(consultantNba[0]!.body, new RegExp(String(stats.openLeadCount)));

    const noviceNba = getRuleBasedNextBestActions({
      tenantId: BASE_CTX.tenantId,
      pageKey: "",
      todayRole: "consultant",
      experienceLevel: "novice",
      stats,
      timeOfDay: "morning",
      maxActions: 2,
    });
    assert.ok(noviceNba.some((t) => t.code === "nba_high_leads_work_pipeline"));
    assert.ok(!noviceNba.some((t) => t.code === "nba_high_leads_batch_photos"));
  });

  it("rule-based NBA: evening → close Money; open tasks → follow-ups", () => {
    const evening = getRuleBasedNextBestActions({
      tenantId: BASE_CTX.tenantId,
      pageKey: "",
      todayRole: "finance",
      experienceLevel: "intermediate",
      stats: {
        openLeadCount: 0,
        todayBookingCount: 0,
        openTaskCount: 0,
        openSurgeryCaseCount: 0,
        paymentRecordCount: 10,
        hourLocal: 18,
      },
      timeOfDay: "evening",
    });
    assert.ok(evening.some((t) => t.code === "nba_evening_close_money"));

    const tasks = getRuleBasedNextBestActions({
      tenantId: BASE_CTX.tenantId,
      pageKey: "",
      todayRole: "reception",
      experienceLevel: "intermediate",
      stats: {
        openLeadCount: 1,
        todayBookingCount: 0,
        openTaskCount: 4,
        openSurgeryCaseCount: 0,
        paymentRecordCount: 1,
        hourLocal: 14,
      },
      timeOfDay: "afternoon",
    });
    assert.ok(tasks.some((t) => t.code === "nba_open_tasks_followups"));
    assert.match(tasks.find((t) => t.code === "nba_open_tasks_followups")!.body, /4/);
  });

  it("doctor NBA is operational prep only", () => {
    const nba = getRuleBasedNextBestActions({
      tenantId: BASE_CTX.tenantId,
      pageKey: "",
      todayRole: "doctor",
      experienceLevel: "advanced",
      stats: {
        openLeadCount: 0,
        todayBookingCount: 3,
        openTaskCount: 0,
        openSurgeryCaseCount: 0,
        paymentRecordCount: 1,
        hourLocal: 9,
      },
      timeOfDay: "morning",
    });
    assert.ok(nba.some((t) => t.code === "nba_doctor_prep_list" || t.code === "nba_doctor_scales_ready"));
    for (const tip of nba) {
      assert.ok(tipBodyIsOperationallySafe(tip.body), tip.code);
    }
  });

  it("session payload includes experienceLevel + nextBestActions for high load Today", () => {
    const userPreferences = prefs({
      experienceLevelOverride: "advanced",
      todayHomeViews: 50,
    });
    const payload = buildGuidedAssistSessionPayload({
      ctx: {
        ...BASE_CTX,
        workspaceProfileKey: "consultant",
        tenantAdminRole: null,
        pageKey: "",
        setupFlags: {
          organisationCreated: true,
          clinicCreated: true,
          clinicSettingsComplete: true,
          firstCaseCreated: true,
        },
        isOnboardingPhase: false,
      },
      resolved: {
        assistEnabled: true,
        isOnboardingPhase: false,
        tenantDefaults: { defaultEnabledDuringOnboarding: true, defaultAssistEnabled: true },
        userPreferences,
      },
      userPreferences,
      clinicStats: {
        openLeadCount: 10,
        todayBookingCount: 2,
        openTaskCount: 1,
        openSurgeryCaseCount: 0,
        paymentRecordCount: 5,
        hourLocal: 10,
      },
    });
    assert.equal(payload.experienceLevel, "advanced");
    assert.ok(payload.nextBestActions.length >= 1);
    assert.ok(payload.nextBestActions.every((t) => t.suggestionSource === "rule_nba"));
    assert.ok(payload.tips.every((t) => tipBodyIsOperationallySafe(t.body)));
  });

  it("novice session prefers explanatory tips on Today", () => {
    const userPreferences = prefs({
      experienceLevelOverride: "novice",
      todayHomeViews: 1,
      guideStartedAtIso: new Date().toISOString(),
    });
    const payload = buildGuidedAssistSessionPayload({
      ctx: {
        ...BASE_CTX,
        workspaceProfileKey: "reception",
        tenantAdminRole: null,
        pageKey: "",
      },
      resolved: {
        assistEnabled: true,
        isOnboardingPhase: true,
        tenantDefaults: { defaultEnabledDuringOnboarding: true, defaultAssistEnabled: false },
        userPreferences,
      },
      userPreferences,
      clinicStats: {
        openLeadCount: 0,
        todayBookingCount: 0,
        openTaskCount: 0,
        openSurgeryCaseCount: 0,
        paymentRecordCount: 0,
        hourLocal: 10,
      },
    });
    assert.equal(payload.experienceLevel, "novice");
    assert.ok(
      payload.tips.some(
        (t) =>
          t.code === "novice_reception_workflow" ||
          t.code === "novice_today_orientation" ||
          t.code === "today_reception_front_desk"
      )
    );
    assert.ok(!payload.tips.some((t) => t.code === "advanced_search_shortcut"));
  });

  it("all catalog tips remain operationally safe", () => {
    for (const tip of GUIDED_ASSIST_TIPS) {
      assert.ok(tipBodyIsOperationallySafe(tip.body), tip.code);
      if (tip.isNextBestAction) {
        assert.ok(typeof tip.nextBestActionPriority === "number", tip.code);
      }
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

  it("adds experience_level override column", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20261021120001_guided_assist_experience_tier.sql"
    );
    const sql = fs.readFileSync(migrationPath, "utf8");
    assert.match(sql, /experience_level/);
    assert.match(sql, /novice/);
    assert.match(sql, /advanced/);
  });

  it("documents assist_enabled as user-controlled Clinic guide on/off", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20261022120001_guided_assist_enabled_docs.sql"
    );
    const sql = fs.readFileSync(migrationPath, "utf8");
    assert.match(sql, /assist_enabled/);
    assert.match(sql, /Per-user Clinic guide/);
  });

  it("engagement migration defines feedback table and streak columns", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20261023120001_guided_assist_engagement.sql"
    );
    const sql = fs.readFileSync(migrationPath, "utf8");
    assert.match(sql, /fi_guided_assist_feedback/);
    assert.match(sql, /engagement_streak_days/);
    assert.match(sql, /tip_feedback_helpful/);
    assert.match(sql, /tour_completed/);
  });
});

describe("Clinic guide — engagement boosters", () => {
  it("computes streak: first day, same day, consecutive, gap restart", () => {
    const first = computeEngagementStreakUpdate({
      currentStreakDays: 0,
      lastActiveDateYmd: null,
      todayYmd: "2026-07-17",
    });
    assert.equal(first.streakDays, 1);
    assert.equal(first.updated, true);

    const same = computeEngagementStreakUpdate({
      currentStreakDays: 3,
      lastActiveDateYmd: "2026-07-17",
      todayYmd: "2026-07-17",
    });
    assert.equal(same.streakDays, 3);
    assert.equal(same.updated, false);

    const next = computeEngagementStreakUpdate({
      currentStreakDays: 3,
      lastActiveDateYmd: "2026-07-16",
      todayYmd: "2026-07-17",
    });
    assert.equal(next.streakDays, 4);
    assert.equal(next.updated, true);
    assert.ok(next.message);

    const gap = computeEngagementStreakUpdate({
      currentStreakDays: 10,
      lastActiveDateYmd: "2026-07-10",
      todayYmd: "2026-07-17",
    });
    assert.equal(gap.streakDays, 1);
    assert.equal(gap.updated, true);
  });

  it("formats professional streak copy without game overload", () => {
    assert.equal(formatStreakMessage(1), null);
    assert.equal(formatStreakMessage(2), "2 days with the clinic guide");
    assert.match(formatStreakMessage(7) ?? "", /7-day/);
  });

  it("builds weekly progress summary labels", () => {
    const p = buildWeeklyProgressSummary({ completedCount: 3, goal: 5 });
    assert.equal(p.label, "3/5 clinic tips used this week");
    assert.equal(p.isComplete, false);
    const done = buildWeeklyProgressSummary({ completedCount: 8, goal: 5 });
    assert.equal(done.isComplete, true);
    assert.match(done.label, /^5\/5/);
  });

  it("resolves anonymized team highlight from tip counts", () => {
    const tip = GUIDED_ASSIST_TIPS.find((t) => t.code === "pipeline_enquiries");
    assert.ok(tip);
    const h = resolveTeamHighlightFromCounts([
      { guidanceCode: "pipeline_enquiries", count: 12 },
      { guidanceCode: "front_desk_today", count: 4 },
    ]);
    assert.ok(h);
    assert.equal(h!.tipCode, "pipeline_enquiries");
    assert.match(h!.label, /Most used tip this week/);
    assert.ok(!/OnboardingOS/i.test(h!.label));
  });

  it("session payload includes engagement block defaults", () => {
    const userPreferences = prefs({ engagementStreakDays: 7 });
    const payload = buildGuidedAssistSessionPayload({
      ctx: { ...BASE_CTX, pageKey: "" },
      resolved: {
        assistEnabled: true,
        isOnboardingPhase: true,
        tenantDefaults: { defaultEnabledDuringOnboarding: true, defaultAssistEnabled: false },
        userPreferences,
      },
      userPreferences,
    });
    assert.ok(payload.engagement);
    assert.equal(payload.engagement.streakDays, 7);
    assert.ok(payload.engagement.progress.label.includes("clinic tips"));
    assert.equal(payload.showReenableChrome, false);
  });
});

describe("Clinic guide — warm tone + clinical role prioritisation", () => {
  it("maps nurse profile to nurse today role (not reception)", () => {
    assert.equal(mapViewerToGuidedAssistTodayRole({ workspaceProfileKey: "nurse" }), "nurse");
    assert.equal(isClinicalTodayRole("nurse"), true);
    assert.equal(isClinicalTodayRole("doctor"), true);
    assert.equal(isClinicalTodayRole("reception"), false);
  });

  it("builds warm role mode labels for clinical staff", () => {
    assert.match(buildGuidedAssistRoleModeLabel({ todayRole: "doctor" }), /Doctor Mode/);
    assert.match(buildGuidedAssistRoleModeLabel({ todayRole: "nurse" }), /Nurse Mode/);
    assert.match(buildGuidedAssistRoleModeLabel({ todayRole: "consultant" }), /Consultant Mode/);
    assert.ok(!/OnboardingOS/i.test(buildGuidedAssistRoleModeLabel({ todayRole: "doctor" })));
  });

  it("prioritises clinical roleGroup tips for clinical viewers", () => {
    const clinical: GuidedAssistTipDefinition = {
      code: "c",
      area: "consultation_os",
      title: "Clinical",
      body: "Nav only.",
      pageKey: "",
      priority: 10,
      roleGroup: "clinical",
      roleScope: { anyRole: true },
      dismissible: true,
    };
    const core: GuidedAssistTipDefinition = {
      code: "a",
      area: "reception_os",
      title: "Core",
      body: "General.",
      pageKey: "",
      priority: 1,
      roleGroup: "core",
      roleScope: { anyRole: true },
      dismissible: true,
    };
    assert.ok(compareTipsByRoleGroupAndPriority(clinical, core, true) < 0);
    // Non-clinical: same band for core vs support; clinical sorts later
    assert.ok(compareTipsByRoleGroupAndPriority(clinical, core, false) > 0);
    const support: GuidedAssistTipDefinition = {
      ...core,
      code: "s",
      roleGroup: "support",
      priority: 1,
    };
    const coreLater: GuidedAssistTipDefinition = { ...core, priority: 5 };
    assert.ok(compareTipsByRoleGroupAndPriority(support, coreLater, false) < 0);
  });

  it("catalog includes warm clinical tips with operational guardrails", () => {
    const codes = [
      "clinical_patient_profile_nav",
      "clinical_imaging_upload_compare",
      "clinical_scales_workflow",
      "clinical_notes_timeline",
      "clinical_consult_prep",
      "clinical_followup_schedule",
      "clinical_rx_admin_ops",
      "today_nurse_day_flow",
      "today_doctor_clinical",
      "today_what_next",
    ];
    for (const code of codes) {
      const tip = GUIDED_ASSIST_TIPS.find((t) => t.code === code);
      assert.ok(tip, code);
      assert.ok(tipBodyIsOperationallySafe(tip!.body), code);
      assert.ok(!/OnboardingOS/i.test(tip!.body + tip!.title), code);
      // Allow disclaimer phrases that mention diagnostic/prescribe only in the negative.
      assert.ok(
        !/\b(diagnose|prescribes?|prescription for)\b/i.test(tip!.body),
        code
      );
    }
    const scales = GUIDED_ASSIST_TIPS.find((t) => t.code === "clinical_scales_workflow");
    assert.equal(scales?.roleGroup, "clinical");
    assert.match(scales!.body, /never scores|does not interpret|never/i);
  });

  it("doctor session surfaces clinical tips and role mode label", () => {
    const userPreferences = prefs({ todayHomeViews: 0 });
    const payload = buildGuidedAssistSessionPayload({
      ctx: {
        ...BASE_CTX,
        workspaceProfileKey: "doctor",
        tenantAdminRole: null,
        pageKey: "",
      },
      resolved: {
        assistEnabled: true,
        isOnboardingPhase: true,
        tenantDefaults: { defaultEnabledDuringOnboarding: true, defaultAssistEnabled: false },
        userPreferences,
      },
      userPreferences,
    });
    assert.equal(payload.todayRole, "doctor");
    assert.match(payload.roleModeLabel ?? "", /Doctor Mode/);
    assert.ok(
      payload.tips.some(
        (t) =>
          t.code === "today_doctor_clinical" ||
          t.code === "novice_doctor_day_list" ||
          t.code === "clinical_consult_prep"
      )
    );
    assert.ok(payload.tips.every((t) => tipBodyIsOperationallySafe(t.body)));
  });

  it("nurse role-first tips use nurse day flow", () => {
    const tips = getRoleFirstTips({
      todayRole: "nurse",
      tenantId: BASE_CTX.tenantId,
      dismissedTipCodes: [],
    });
    assert.ok(tips.some((t) => t.code === "today_nurse_day_flow"));
  });
});

describe("Clinic guide — admin force-show and debug", () => {
  it("parses force-show cookie and debug=guide query", () => {
    const tid = BASE_CTX.tenantId;
    assert.equal(isGuidedAssistForceShowCookieActive(tid, tid), true);
    assert.equal(isGuidedAssistForceShowCookieActive("other", tid), false);
    assert.equal(isGuidedAssistDebugQueryActive("debug=guide"), true);
    assert.equal(isGuidedAssistDebugQueryActive("?tab=1&debug=guide"), true);
    assert.equal(isGuidedAssistDebugQueryActive("debug=other"), false);
  });

  it("forceShow loads tips even when preference is off", () => {
    const userPreferences = prefs({ assistEnabled: false, todayHomeViews: 20 });
    const off = buildGuidedAssistSessionPayload({
      ctx: {
        ...BASE_CTX,
        workspaceProfileKey: "nurse",
        tenantAdminRole: null,
        pageKey: "",
        setupFlags: {
          organisationCreated: true,
          clinicCreated: true,
          clinicSettingsComplete: true,
          firstCaseCreated: true,
        },
        isOnboardingPhase: false,
      },
      resolved: {
        assistEnabled: false,
        isOnboardingPhase: false,
        tenantDefaults: { defaultEnabledDuringOnboarding: true, defaultAssistEnabled: false },
        userPreferences,
      },
      userPreferences,
      forceShowActive: false,
    });
    assert.equal(off.assistEnabled, false);
    assert.equal(off.guideVisible, false);
    assert.equal(off.tips.length, 0);

    const forced = buildGuidedAssistSessionPayload({
      ctx: {
        ...BASE_CTX,
        workspaceProfileKey: "nurse",
        tenantAdminRole: null,
        pageKey: "",
        setupFlags: {
          organisationCreated: true,
          clinicCreated: true,
          clinicSettingsComplete: true,
          firstCaseCreated: true,
        },
        isOnboardingPhase: false,
      },
      resolved: {
        assistEnabled: false,
        isOnboardingPhase: false,
        tenantDefaults: { defaultEnabledDuringOnboarding: true, defaultAssistEnabled: false },
        userPreferences,
      },
      userPreferences,
      forceShowActive: true,
      includeDebugInfo: true,
    });
    assert.equal(forced.assistEnabled, false);
    assert.equal(forced.forceShowActive, true);
    assert.equal(forced.guideVisible, true);
    assert.ok(forced.tips.length > 0);
    assert.ok(forced.debugInfo);
    assert.equal(forced.debugInfo!.forceShowActive, true);
    assert.equal(forced.debugInfo!.role, "nurse");
    assert.equal(forced.debugInfo!.clinicSetupComplete, true);
    // Preference counters must not advance under force-only
    assert.equal(forced.shouldIncrementTodayHomeViews, false);
  });
});
