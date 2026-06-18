import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildReceptionOsDailyBrief } from "@/src/lib/receptionOs/receptionDailyBriefModel";
import type { ReceptionOsBoardPayload } from "@/src/lib/receptionOs/receptionOsBoardModel.types";
import type { ReceptionTaskRow } from "@/src/lib/receptionOs/receptionTasks.types";

const boardStub: Pick<
  ReceptionOsBoardPayload,
  "todaysPatients" | "outstandingDeposits" | "upcomingSurgeries" | "actionAlerts"
> = {
  todaysPatients: [{ id: "1" } as never, { id: "2" } as never],
  outstandingDeposits: [{ isOverdue: true } as never, { isOverdue: false } as never],
  upcomingSurgeries: [{ severity: "critical" } as never, { severity: "info" } as never],
  actionAlerts: [
    { kind: "no_follow_up_after_consultation", severity: "warning" } as never,
    { kind: "missing_deposit", severity: "critical" } as never,
    { kind: "surgery_risk", severity: "blocked" } as never,
  ],
};

const openTasks: ReceptionTaskRow[] = [
  {
    id: "t1",
    tenant_id: "aaa",
    title: "Task",
    description: null,
    source_type: "payment",
    severity: "warning",
    status: "open",
    owner_fi_user_id: null,
    due_at: null,
    patient_id: null,
    case_id: null,
    lead_id: null,
    booking_id: null,
    payment_id: null,
    consultation_id: null,
    source_alert_kind: null,
    source_ref_id: null,
    resolution_notes: null,
    internal_notes: null,
    snoozed_until: null,
    metadata: {},
    created_by_fi_user_id: null,
    resolved_by_fi_user_id: null,
    dismissed_by_fi_user_id: null,
    created_at: "",
    updated_at: "",
    resolved_at: null,
    dismissed_at: null,
  },
];

describe("buildReceptionOsDailyBrief", () => {
  it("summarises patients, deposits, surgery risk, follow-ups, alerts, and risk", () => {
    const brief = buildReceptionOsDailyBrief(boardStub, openTasks);
    assert.equal(brief.todayPatientCount, 2);
    assert.equal(brief.outstandingDepositCount, 2);
    assert.equal(brief.overdueDepositCount, 1);
    assert.equal(brief.surgeryNext14Count, 2);
    assert.equal(brief.surgeryRiskCount, 1);
    assert.equal(brief.followUpNeededCount, 1);
    assert.equal(brief.openTaskCount, 1);
    assert.equal(brief.alertsBySeverity.blocked, 1);
    assert.equal(brief.alertsBySeverity.critical, 1);
    assert.equal(brief.alertsBySeverity.warning, 1);
    assert.ok(["warning", "critical", "blocked"].includes(brief.projectedOperationalRisk));
    assert.ok(brief.summaryLines.some((l) => l.includes("2 patients")));
  });
});
