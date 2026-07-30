/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.5 — UI pure logic + architecture acceptance proofs.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  canAccessPilotControlNav,
  canAccessPilotControlOverview,
  canShowClinicalSummary,
  canShowExportControl,
  canShowFinancialSummary,
  canShowPauseRecommendation,
  canShowTechnicalSummary,
  shouldSuppressPatientSafeSummary,
  uiContainsForbiddenMutationControl,
} from "./pilotControlUiAccess";
import {
  activityDateRangeIso,
  clampActivityRangeDays,
  coerceDisplayedHealthVerdict,
  formatRateOrDash,
  formatReadinessLabel,
  healthBannerCopy,
  readinessLooksReady,
  readinessMustNotLookReady,
  registerDimensionDisplay,
  severitySortRank,
} from "./pilotControlFormatters";
import {
  isAllowlistedPatientFilterKey,
  parsePatientFiltersFromSearchParams,
  patientFiltersToQuery,
  resetPatientFilters,
  scrubUnknownFilterKeys,
} from "./pilotControlFilters";
import {
  columnsForViewport,
  defaultRegisterColumnsForRole,
  MOBILE_REQUIRED_COLUMNS,
} from "./pilotControlRoleColumns";
import { buildOverviewMetricCards, metricCardsContainSensitiveValues } from "./pilotControlMetrics";
import { EMPTY_COHORT_MESSAGE, PILOT_CONTROL_REFRESH_MS } from "./pilotControlUiConstants";
import { sortAttentionQueue } from "@/src/components/pilotControl/PilotAttentionQueue";
import type { PilotBlockerListItem } from "../api/pilotControlApiTypes";
import type { PilotControlOverview } from "../api/pilotControlApiTypes";

function sampleOverview(overrides?: Partial<PilotControlOverview>): PilotControlOverview {
  return {
    programme: {
      id: "prog-1",
      key: "evolved-controlled-pilot",
      name: "Evolved Controlled Pilot",
      status: "planned",
      realPatientInvitesEnabled: false,
      enrolmentCounts: {
        candidate: 0,
        approved: 0,
        invited: 0,
        activated: 0,
        active: 0,
        paused: 0,
        completed: 0,
        withdrawn: 0,
        excluded: 0,
      },
    },
    cohort: {
      totalApproved: 0,
      invited: 0,
      activated: 0,
      active: 0,
      paused: 0,
      completed: 0,
      withdrawn: 0,
    },
    readiness: {
      notStarted: 0,
      inProgress: 0,
      attentionRequired: 0,
      blocked: 0,
      ready: 0,
      completed: 0,
    },
    blockers: {
      openBySeverity: { info: 0, attention: 0, high: 0, critical: 0 },
      oldestOpenAgeSeconds: 0,
      overduePatientActions: 0,
      overdueClinicActions: 0,
      unresolvedIdentityIssues: 0,
      unresolvedFinancialIntegrityIssues: 0,
      unresolvedClinicalSafetyIssues: 0,
      blockersRequiringPilotPause: 0,
    },
    actions: {
      patientOwnedOpen: 0,
      clinicOwnedOpen: 0,
      unassignedOpen: 0,
      overduePatient: 0,
      overdueClinic: 0,
    },
    app: {
      invited: 0,
      activated: 0,
      activationRate: null,
      inactivePatients: 0,
      pushAvailable: 0,
      pushUnavailable: 0,
    },
    health: {
      verdict: "AMBER",
      score: 40,
      reasons: ["insufficient_evidence"],
      criticalFailClosed: false,
      expansionRecommendation: "insufficient_evidence",
      ruleVersion: "1A.1.0",
    },
    urgentItems: [],
    generatedAt: "2026-07-30T07:42:00.000Z",
    ...overrides,
  };
}

// —— Access / roles ——

test("1A.5 access: authorised roles can open overview", () => {
  assert.equal(canAccessPilotControlOverview("director"), true);
  assert.equal(canAccessPilotControlOverview("reception"), true);
  assert.equal(canAccessPilotControlOverview("clinical"), true);
  assert.equal(canAccessPilotControlOverview("finance"), true);
  assert.equal(canAccessPilotControlNav("director"), true);
});

test("1A.5 access: null role cannot open overview (server denial model)", () => {
  assert.equal(canAccessPilotControlOverview(null), false);
  assert.equal(canAccessPilotControlNav(undefined), false);
});

test("1A.5 access: export and pause gated to overview_full roles", () => {
  assert.equal(canShowExportControl("director"), true);
  assert.equal(canShowPauseRecommendation("director"), true);
  assert.equal(canShowExportControl("reception"), false);
  assert.equal(canShowPauseRecommendation("reception"), false);
});

test("1A.5 access: clinical/finance/technical summary scopes", () => {
  assert.equal(canShowClinicalSummary("clinical"), true);
  assert.equal(canShowClinicalSummary("reception"), false);
  assert.equal(canShowFinancialSummary("finance"), true);
  assert.equal(canShowFinancialSummary("clinical"), false);
  assert.equal(canShowTechnicalSummary("technical"), true);
  assert.equal(canShowFinancialSummary("technical"), false);
});

// —— Empty cohort / health ——

test("1A.5 empty cohort: insufficient evidence; never GREEN", () => {
  const coerced = coerceDisplayedHealthVerdict({
    verdict: "GREEN",
    expansionRecommendation: "insufficient_evidence",
    totalApproved: 0,
    realPatientInvitesEnabled: false,
  });
  assert.equal(coerced.verdict, "AMBER");
  assert.equal(coerced.forceInsufficientEvidence, true);
  const copy = healthBannerCopy({
    verdict: coerced.verdict,
    expansionRecommendation: "insufficient_evidence",
    forceInsufficientEvidence: true,
  });
  assert.match(copy.title, /Insufficient live pilot evidence/i);
  assert.match(EMPTY_COHORT_MESSAGE, /Real patient invitations remain disabled/i);
  assert.doesNotMatch(EMPTY_COHORT_MESSAGE, /Everything is healthy|100% ready/i);
});

test("1A.5 health banner copy for GREEN / AMBER / RED", () => {
  assert.match(healthBannerCopy({ verdict: "GREEN" }).title, /healthy/i);
  assert.match(healthBannerCopy({ verdict: "AMBER" }).body, /hold/i);
  assert.match(healthBannerCopy({ verdict: "RED" }).title, /pause/i);
});

test("1A.5 metrics: zero denominator shows em dash not 0%", () => {
  assert.equal(formatRateOrDash(null), "—");
  assert.equal(formatRateOrDash(undefined), "—");
  const cards = buildOverviewMetricCards(sampleOverview());
  const rate = cards.find((c) => c.key === "activationRate");
  assert.equal(rate?.value, "—");
  assert.equal(metricCardsContainSensitiveValues(cards), false);
  assert.ok(cards.some((c) => c.approximate));
});

// —— Readiness display ——

test("1A.5 readiness: unknown does not look ready", () => {
  assert.equal(formatReadinessLabel("unknown"), "Unknown");
  assert.equal(readinessLooksReady("unknown"), false);
  assert.equal(readinessMustNotLookReady("unknown"), true);
  assert.equal(readinessLooksReady("ready"), true);
  const dim = registerDimensionDisplay("unknown");
  assert.equal(dim.label, "Not evaluated in register");
  assert.equal(dim.isReady, false);
  assert.equal(dim.approximate, true);
});

test("1A.5 readiness: not applicable is not failure styling cue", () => {
  assert.equal(formatReadinessLabel("not_applicable"), "Not applicable");
  assert.equal(readinessMustNotLookReady("not_applicable"), true);
});

// —— Filters / search ——

test("1A.5 filters: invalid keys scrubbed; allowlist enforced", () => {
  assert.equal(isAllowlistedPatientFilterKey("status"), true);
  assert.equal(isAllowlistedPatientFilterKey("DROP TABLE"), false);
  const scrubbed = scrubUnknownFilterKeys(
    { programmeId: "p1", status: "active", evil: "1", "page;drop": "x" },
    "patients"
  );
  assert.deepEqual(Object.keys(scrubbed).sort(), ["programmeId", "status"]);
});

test("1A.5 filters: URL parse + reset + page size clamp", () => {
  const parsed = parsePatientFiltersFromSearchParams(
    { programmeId: "p1", page: "2", pageSize: "999", search: "a".repeat(200) },
    "fallback"
  );
  assert.equal(parsed.pageSize, 100);
  assert.equal(parsed.search?.length, 80);
  const q = patientFiltersToQuery(parsed);
  assert.equal(q.page, "2");
  assert.ok(!("evil" in q));
  const reset = resetPatientFilters("p1");
  assert.equal(reset.page, 1);
  assert.equal(reset.status, undefined);
});

// —— Sort / attention ——

test("1A.5 blockers: critical sorts first then oldest", () => {
  const items = [
    {
      id: "1",
      severity: "attention",
      ageSeconds: 99999,
      patientId: "a",
      enrolmentId: "e",
      category: "documents",
      dimension: "patient",
      title: "A",
      summary: "",
      recommendedNextAction: "x",
      state: "open",
      ownership: { ownerType: "reception" },
      escalation: { level: "none", escalated: false },
      firstDetectedAt: "",
      lastConfirmedAt: "",
      sourceModule: "documents",
      evaluatedAt: "",
    },
    {
      id: "2",
      severity: "critical",
      ageSeconds: 10,
      patientId: "b",
      enrolmentId: "e",
      category: "identity",
      dimension: "identity",
      title: "B",
      summary: "",
      recommendedNextAction: "y",
      state: "open",
      ownership: { ownerType: "technical" },
      escalation: { level: "director", escalated: true, requiresPilotPause: true },
      firstDetectedAt: "",
      lastConfirmedAt: "",
      sourceModule: "identity",
      evaluatedAt: "",
    },
    {
      id: "3",
      severity: "critical",
      ageSeconds: 500,
      patientId: "c",
      enrolmentId: "e",
      category: "identity",
      dimension: "identity",
      title: "C",
      summary: "",
      recommendedNextAction: "z",
      state: "open",
      ownership: { ownerType: "technical" },
      escalation: { level: "director", escalated: true },
      firstDetectedAt: "",
      lastConfirmedAt: "",
      sourceModule: "identity",
      evaluatedAt: "",
    },
  ] as PilotBlockerListItem[];
  const ordered = sortAttentionQueue(items);
  assert.equal(ordered[0].id, "3");
  assert.equal(ordered[1].id, "2");
  assert.ok(severitySortRank("critical") < severitySortRank("high"));
});

test("1A.5 blockers: identity suppresses patient-safe summary", () => {
  assert.equal(shouldSuppressPatientSafeSummary("identity"), true);
  assert.equal(shouldSuppressPatientSafeSummary("consent"), false);
});

test("1A.5 UI: no mutation controls in allowed label set", () => {
  assert.equal(uiContainsForbiddenMutationControl(["Refresh", "Export", "Close"]), false);
  assert.equal(uiContainsForbiddenMutationControl(["Resolve blocker"]), true);
  assert.equal(uiContainsForbiddenMutationControl(["Invite patient"]), true);
});

// —— Role columns / responsive ——

test("1A.5 register: role-specific default columns", () => {
  const reception = defaultRegisterColumnsForRole("reception").map((c) => c.id);
  assert.ok(reception.includes("appActivation"));
  assert.ok(!reception.includes("pathology"));
  const clinical = defaultRegisterColumnsForRole("clinical").map((c) => c.id);
  assert.ok(clinical.includes("pathology"));
  assert.ok(clinical.includes("consent"));
  const finance = defaultRegisterColumnsForRole("finance").map((c) => c.id);
  assert.ok(finance.includes("reconciliation"));
  const director = defaultRegisterColumnsForRole("director").map((c) => c.id);
  assert.ok(director.includes("pilotPause"));
});

test("1A.5 responsive: mobile preserves severity/owner-critical columns", () => {
  const cols = columnsForViewport(defaultRegisterColumnsForRole("director"), "mobile");
  const ids = cols.map((c) => c.id);
  for (const req of ["patient", "blockerSeverity", "primaryBlocker"] as const) {
    assert.ok(
      ids.includes(req) || MOBILE_REQUIRED_COLUMNS.includes(req),
      `expected mobile to retain ${req}`
    );
  }
  assert.ok(ids.includes("patient"));
});

// —— Activity range ——

test("1A.5 activity: presets respect 31-day cap", () => {
  assert.equal(clampActivityRangeDays(90), 31);
  assert.equal(clampActivityRangeDays(0), 1);
  const r = activityDateRangeIso("30d");
  assert.equal(r.days, 30);
  assert.ok(r.from < r.to);
});

// —— Refresh intervals ——

test("1A.5 refresh: intervals are low-frequency (no rapid polling)", () => {
  assert.ok(PILOT_CONTROL_REFRESH_MS.overview >= 60_000);
  assert.ok(PILOT_CONTROL_REFRESH_MS.blockers >= 60_000);
  assert.ok(PILOT_CONTROL_REFRESH_MS.patients >= 60_000);
});

// —— Architecture guards ——

function walkTsx(dir: string, acc: string[] = []): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const name of names) {
    const p = join(dir, name);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walkTsx(p, acc);
    else if (name.endsWith(".tsx") || name.endsWith(".ts")) acc.push(p);
  }
  return acc;
}

test("1A.5 architecture: UI components do not import readiness/blocker engines or DB clients", () => {
  const root = join(process.cwd(), "src", "components", "pilotControl");
  const files = walkTsx(root);
  assert.ok(files.length > 0, "expected pilotControl components");
  const forbidden = [
    /from\s+["']@\/src\/lib\/pilotControl\/readiness\//,
    /from\s+["']@\/src\/lib\/pilotControl\/blockers\//,
    /evaluatePilotPatient/,
    /supabaseAdmin/,
    /createClient/,
    /from\s+["']@\/lib\/supabase/,
  ];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    for (const re of forbidden) {
      assert.equal(re.test(src), false, `${file} matched ${re}`);
    }
  }
});

test("1A.5 architecture: hooks do not import engines", () => {
  const root = join(process.cwd(), "src", "hooks", "pilotControl");
  const files = walkTsx(root);
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    assert.equal(/pilotControl\/readiness\//.test(src), false, file);
    assert.equal(/pilotControl\/blockers\//.test(src), false, file);
    assert.equal(/supabaseAdmin/.test(src), false, file);
  }
});

test("1A.5 architecture: client fetch targets only /api/pilot-control", () => {
  const client = readFileSync(
    join(process.cwd(), "src", "lib", "pilotControl", "ui", "pilotControlClient.ts"),
    "utf8"
  );
  const constants = readFileSync(
    join(process.cwd(), "src", "lib", "pilotControl", "ui", "pilotControlUiConstants.ts"),
    "utf8"
  );
  assert.match(constants, /\/api\/pilot-control/);
  assert.match(client, /PILOT_CONTROL_API_BASE/);
  assert.doesNotMatch(client, /\.from\(\s*["']fi_/);
  assert.doesNotMatch(client, /supabaseAdmin/);
});

test("1A.5 planned programme sample renders AMBER insufficient evidence metrics", () => {
  const cards = buildOverviewMetricCards(sampleOverview());
  assert.equal(cards.find((c) => c.key === "approved")?.value, "0");
  const coerced = coerceDisplayedHealthVerdict({
    verdict: sampleOverview().health.verdict,
    expansionRecommendation: sampleOverview().health.expansionRecommendation,
    totalApproved: 0,
    realPatientInvitesEnabled: false,
  });
  assert.equal(coerced.forceInsufficientEvidence, true);
});
