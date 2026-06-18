import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  alertSeverityForContext,
  alertSeverityRank,
  assertReceptionOsTenantRowScope,
  compareReceptionOsSeverity,
  depositIsOverdue,
  depositSeverity,
  mapConversionColumnToReceptionPipeline,
  RECEPTION_OS_PERSONA_WIDGET_DEFAULTS,
  resolveReceptionOsPersonaFromWorkspaceProfile,
  surgeryItemNeedsRiskAlert,
  surgeryReadinessSeverity,
  visibleWidgetsForReceptionOsRole,
} from "@/src/lib/receptionOs/receptionOsBoardModel";

describe("receptionOsBoardModel", () => {
  it("maps conversion columns to reception pipeline lanes", () => {
    assert.equal(
      mapConversionColumnToReceptionPipeline({
        conversionColumn: "consultation_booked",
        depositNeedsCollection: false,
        surgeryBooked: false,
      }),
      "consultation_booked",
    );
    assert.equal(
      mapConversionColumnToReceptionPipeline({
        conversionColumn: "quote_sent",
        depositNeedsCollection: true,
        surgeryBooked: false,
      }),
      "deposit_pending",
    );
  });

  it("detects overdue deposits by calendar day", () => {
    assert.equal(depositIsOverdue({ status: "pending", due_date: "2026-01-01" }, "2026-06-19"), true);
    assert.equal(depositIsOverdue({ status: "paid", due_date: "2026-01-01" }, "2026-06-19"), false);
    assert.equal(depositSeverity({ isOverdue: true, dueDate: "2026-01-01", todayYmd: "2026-06-19" }), "critical");
    assert.equal(depositSeverity({ isOverdue: false, dueDate: "2026-06-19", todayYmd: "2026-06-19" }), "warning");
  });

  it("scopes tenant rows strictly", () => {
    assert.doesNotThrow(() => assertReceptionOsTenantRowScope("aaa", "aaa", "fi_bookings"));
    assert.throws(() => assertReceptionOsTenantRowScope("aaa", "bbb", "fi_bookings"), /tenant scope violation/);
  });

  it("assigns persona-specific widget defaults", () => {
    assert.deepEqual(visibleWidgetsForReceptionOsRole("receptionist"), RECEPTION_OS_PERSONA_WIDGET_DEFAULTS.receptionist);
    assert.deepEqual(visibleWidgetsForReceptionOsRole("consultant"), RECEPTION_OS_PERSONA_WIDGET_DEFAULTS.consultant);
    assert.deepEqual(visibleWidgetsForReceptionOsRole("clinic_manager"), RECEPTION_OS_PERSONA_WIDGET_DEFAULTS.clinic_manager);
    assert.deepEqual(visibleWidgetsForReceptionOsRole("admin"), RECEPTION_OS_PERSONA_WIDGET_DEFAULTS.admin);

    assert.ok(!visibleWidgetsForReceptionOsRole("receptionist").includes("consultation_pipeline"));
    assert.ok(!visibleWidgetsForReceptionOsRole("receptionist").includes("outstanding_deposits"));
    assert.ok(visibleWidgetsForReceptionOsRole("consultant").includes("consultation_pipeline"));
    assert.ok(!visibleWidgetsForReceptionOsRole("consultant").includes("outstanding_deposits"));
    assert.ok(visibleWidgetsForReceptionOsRole("clinic_manager").includes("outstanding_deposits"));
  });

  it("maps workspace profiles to ReceptionOS personas", () => {
    assert.equal(resolveReceptionOsPersonaFromWorkspaceProfile("reception"), "receptionist");
    assert.equal(resolveReceptionOsPersonaFromWorkspaceProfile("consultant"), "consultant");
    assert.equal(resolveReceptionOsPersonaFromWorkspaceProfile("clinic_manager"), "clinic_manager");
    assert.equal(resolveReceptionOsPersonaFromWorkspaceProfile("director"), "admin");
  });

  it("detects surgery readiness risk and severity", () => {
    assert.equal(
      surgeryReadinessSeverity({
        readinessStatus: "High risk",
        paymentComplete: false,
        consentComplete: false,
        daysUntil: 2,
      }),
      "blocked",
    );
    assert.equal(
      surgeryReadinessSeverity({
        readinessStatus: "Needs attention",
        paymentComplete: false,
        consentComplete: true,
        daysUntil: 5,
      }),
      "warning",
    );
    assert.equal(surgeryItemNeedsRiskAlert({
      readinessStatus: "Ready",
      paymentComplete: true,
      consentComplete: true,
      daysUntil: 10,
    }), false);
    assert.equal(surgeryItemNeedsRiskAlert({
      readinessStatus: "Needs attention",
      paymentComplete: false,
      consentComplete: true,
      daysUntil: 5,
    }), true);
  });

  it("maps alert kinds to severities", () => {
    assert.equal(alertSeverityForContext({ kind: "missing_deposit", isOverdueDeposit: true }), "critical");
    assert.equal(alertSeverityForContext({ kind: "surgery_risk", surgeryReadinessStatus: "High risk" }), "blocked");
    assert.equal(alertSeverityForContext({ kind: "no_follow_up_after_consultation", daysSinceConsultation: 8 }), "critical");
  });

  it("ranks severities and alert kinds", () => {
    assert.ok(compareReceptionOsSeverity("warning", "blocked") > 0);
    assert.ok(alertSeverityRank("surgery_risk") > alertSeverityRank("missing_forms"));
  });
});
