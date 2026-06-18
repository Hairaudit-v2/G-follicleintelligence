import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildReceptionCloseoutSnapshot } from "@/src/lib/receptionOs/receptionDailyCloseoutModel";

const tenantId = "11111111-1111-4111-8111-111111111111";

describe("receptionDailyCloseoutModel", () => {
  it("builds checklist items for critical tasks, deposits, failed communications, and tomorrow patient", () => {
    const snapshot = buildReceptionCloseoutSnapshot({
      board: {
        tenantId,
        operationalDay: {
          calendarTimezone: "Australia/Perth",
          todayYmd: "2026-06-19",
          localStartIso: "2026-06-18T16:00:00.000Z",
          localEndIso: "2026-06-19T16:00:00.000Z",
        },
        outstandingDeposits: [
          {
            id: "dep-1",
            patientLabel: "Alex",
            context: "Deposit",
            amountExpected: 500,
            amountPaid: 0,
            currency: "AUD",
            dueDate: "2026-06-19",
            isOverdue: false,
            statusLabel: "Due",
            severity: "critical",
            hrefs: { patient: null, case: null, lead: null },
          },
        ],
        upcomingSurgeries: [],
        actionAlerts: [
          {
            id: "alert-1",
            kind: "no_follow_up_after_consultation",
            title: "No follow-up",
            detail: "Quote sent 5 days ago",
            severity: "warning",
            href: null,
          },
        ],
      },
      tasks: [
        {
          id: "task-1",
          title: "Blocked handover",
          description: null,
          sourceType: "system",
          severity: "blocked",
          status: "open",
          ownerFiUserId: null,
          dueAt: null,
          patientId: null,
          caseId: null,
          leadId: null,
          bookingId: null,
          paymentId: null,
          consultationId: null,
          sourceAlertKind: null,
          sourceRefId: null,
          resolutionNotes: null,
          internalNotes: null,
          snoozedUntil: null,
          createdAt: "2026-06-19T08:00:00.000Z",
          updatedAt: "2026-06-19T08:00:00.000Z",
        },
      ],
      failedCommunications: [
        {
          id: "del-1",
          channel: "sms",
          provider: "twilio",
          deliveryStatus: "failed",
          errorMessage: "Invalid number",
          sentAt: null,
          templateKey: "deposit_reminder",
          toAddress: "+6100",
          externalMessageId: null,
          leadId: "22222222-2222-4222-8222-222222222222",
          patientId: null,
          createdAt: "2026-06-19T09:00:00.000Z",
        },
      ],
      tomorrowFirstPatient: {
        bookingId: "book-1",
        patientLabel: "Sam",
        appointmentTime: "08:30",
        readinessLabel: "Review chart",
        href: `/fi-admin/${tenantId}/appointments?bookingId=book-1`,
      },
      canCloseDay: true,
    });

    assert.ok(snapshot.checklist.some((i) => i.itemKind === "unresolved_blocked_task"));
    assert.ok(snapshot.checklist.some((i) => i.itemKind === "unpaid_deposit_due_today"));
    assert.ok(snapshot.checklist.some((i) => i.itemKind === "consultation_no_next_action"));
    assert.ok(snapshot.checklist.some((i) => i.itemKind === "communication_failed"));
    assert.ok(snapshot.checklist.some((i) => i.itemKind === "tomorrow_first_patient_readiness"));
    assert.equal(snapshot.itemCounts.failed_communications, 1);
    assert.equal(snapshot.failedCommunications.length, 1);
  });

  it("reflects existing closeout state", () => {
    const snapshot = buildReceptionCloseoutSnapshot({
      board: {
        tenantId,
        operationalDay: {
          calendarTimezone: "Australia/Perth",
          todayYmd: "2026-06-19",
          localStartIso: "2026-06-18T16:00:00.000Z",
          localEndIso: "2026-06-19T16:00:00.000Z",
        },
        outstandingDeposits: [],
        upcomingSurgeries: [],
        actionAlerts: [],
      },
      tasks: [],
      failedCommunications: [],
      tomorrowFirstPatient: null,
      canCloseDay: false,
      existingCloseout: {
        id: "close-1",
        notes: "Handover complete",
        closedAt: "2026-06-19T17:00:00.000Z",
      },
    });

    assert.equal(snapshot.existingCloseoutId, "close-1");
    assert.equal(snapshot.existingCloseoutNotes, "Handover complete");
    assert.equal(snapshot.canCloseDay, false);
  });
});
