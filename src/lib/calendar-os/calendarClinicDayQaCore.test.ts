import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  auditCalendarOsWorkflows,
  buildCalendarOsV2QaReport,
  detectCalendarOsFrictionPoints,
  formatCalendarOsV2QaReport,
  scoreCalendarOsProductionReadiness,
  scoreCalendarOsVsTimely,
  validateScenarioAHeavySurgeryDay,
  validateScenarioBSparseClinicDay,
  validateScenarioCFrontDeskWorkflow,
  validateScenarioDStressLoad,
} from "./calendarClinicDayQaCore";
import {
  scenarioAHeavySurgeryDay,
  scenarioBSparseClinicDay,
  scenarioCFrontDeskWorkflow,
  scenarioDStressLoadDay,
  evolvedQaStaffDirectory,
} from "./calendarClinicDayFixtures";
import { buildCalendarOsSparseContext } from "./calendarSparseContext";
import { evolvedQaRooms } from "./calendarClinicDayFixtures";

describe("Scenario A — heavy surgery day", () => {
  it("builds Evolved heavy surgery fixture", () => {
    const { bookings, dayKey } = scenarioAHeavySurgeryDay();
    const surgeries = bookings.filter(
      (b) => b.booking_type === "surgery" && !b.metadata?.team_support
    );
    assert.equal(dayKey, "2026-07-02");
    assert.ok(surgeries.length >= 2);
    assert.ok(bookings.some((b) => b.booking_type === "prp"));
    assert.ok(bookings.some((b) => b.booking_type === "follow_up"));
  });

  it("passes operational validation checks", () => {
    const result = validateScenarioAHeavySurgeryDay();
    assert.equal(result.scenario, "A");
    assert.ok(result.passed >= 7, `Expected ≥7 checks, got ${result.passed}/${result.total}`);
    assert.equal(result.pass, result.passed === result.total);
  });
});

describe("Scenario B — sparse clinic day", () => {
  it("builds sparse fixture with RDO staff", () => {
    const { bookings, staffDirectory } = scenarioBSparseClinicDay();
    assert.equal(bookings.length, 4);
    const rdo = staffDirectory.filter((s) => s.clinical_readiness?.block_reason === "RDO");
    assert.ok(rdo.length >= 4);
  });

  it("sparse context is useful on light schedule", () => {
    const { bookings, dayKey, staffDirectory } = scenarioBSparseClinicDay();
    const ctx = buildCalendarOsSparseContext({
      bookings,
      staffDirectory,
      rooms: evolvedQaRooms(),
      dayKeys: [dayKey],
    });
    assert.ok(ctx.suggestedActions.length >= 1);
    assert.ok(ctx.openRoomsCount >= 4);
    assert.equal(ctx.totalBookings, 4);
  });

  it("passes sparse day validation", () => {
    const result = validateScenarioBSparseClinicDay();
    assert.equal(result.scenario, "B");
    assert.equal(result.pass, result.passed === result.total);
  });
});

describe("Scenario C — front desk workflow", () => {
  it("exposes free doctor, nurse, and room targets", () => {
    const { freeDoctorIds, freeNurseIds, freeRoomIds } = scenarioCFrontDeskWorkflow();
    assert.ok(freeDoctorIds.length >= 1);
    assert.ok(freeNurseIds.length >= 2);
    assert.ok(freeRoomIds.length >= 3);
  });

  it("passes front desk workflow validation", () => {
    const result = validateScenarioCFrontDeskWorkflow();
    assert.equal(result.scenario, "C");
    assert.equal(result.pass, result.passed === result.total);
  });
});

describe("Scenario D — production stress load", () => {
  it("generates 50+ bookings across 15+ staff", () => {
    const { bookings, staffDirectory } = scenarioDStressLoadDay();
    assert.ok(bookings.length >= 50);
    assert.ok(staffDirectory.length >= 15);
  });

  it("passes stress validation within perf budget", () => {
    const result = validateScenarioDStressLoad();
    assert.equal(result.scenario, "D");
    assert.equal(result.pass, result.passed === result.total);
  });
});

describe("Workflow audit", () => {
  it("audits front desk, surgery coordinator, and clinic manager", () => {
    const audits = auditCalendarOsWorkflows();
    assert.equal(audits.length, 3);
    assert.ok(audits.some((a) => a.role === "front_desk"));
    assert.ok(audits.some((a) => a.role === "surgery_coordinator"));
    assert.ok(audits.some((a) => a.role === "clinic_manager"));
    for (const audit of audits) {
      assert.ok(audit.questions.length >= 4);
    }
  });
});

describe("Timely benchmark", () => {
  it("scores all ten categories", () => {
    const scores = scoreCalendarOsVsTimely();
    assert.equal(scores.length, 10);
    for (const s of scores) {
      assert.ok(s.timely >= 7 && s.timely <= 10);
      assert.ok(s.calendarOsV2 >= 7 && s.calendarOsV2 <= 10);
    }
    const opAware = scores.find((s) => s.category === "operational_awareness");
    assert.ok(opAware && opAware.calendarOsV2 > opAware.timely);
  });
});

describe("Friction detection", () => {
  it("lists known friction points with fix status", () => {
    const points = detectCalendarOsFrictionPoints();
    assert.ok(points.length >= 8);
    assert.ok(points.some((p) => p.fixApplied));
    assert.ok(points.some((p) => !p.fixApplied));
  });
});

describe("Production readiness", () => {
  it("builds full QA report", () => {
    const report = buildCalendarOsV2QaReport();
    assert.ok(report.strengths.length >= 3);
    assert.equal(report.scenarios.length, 4);
    assert.ok(report.productionReadinessScore >= 70);
    assert.ok(report.timelyBenchmark.length === 10);
    const md = formatCalendarOsV2QaReport(report);
    assert.ok(md.includes("# CalendarOS V2 QA Report"));
    assert.ok(md.includes("Comparison against Timely"));
  });

  it("scores production readiness from inputs", () => {
    const report = buildCalendarOsV2QaReport();
    const { score, ready } = scoreCalendarOsProductionReadiness({
      scenarios: report.scenarios,
      workflowAudits: report.workflowAudits,
      frictionPoints: report.frictionPoints,
    });
    assert.equal(score, report.productionReadinessScore);
    assert.equal(ready, report.productionReadinessReady);
  });
});

describe("Evolved staff directory", () => {
  it("includes named Evolved operational roles", () => {
    const staff = evolvedQaStaffDirectory();
    const names = staff.map((s) => s.full_name);
    assert.ok(names.includes("Dr Seetal"));
    assert.ok(names.includes("Nurse Jessie"));
    assert.ok(names.includes("Nurse Anna"));
    assert.ok(names.includes("Sandra"));
    assert.ok(names.includes("Jenefyer"));
    assert.ok(names.includes("Mia"));
  });
});