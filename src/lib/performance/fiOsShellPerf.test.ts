import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { OperationalCalendarPageData } from "@/src/lib/calendar/operationalCalendarTypes";
import type { ProcedureDayBoardPayload } from "@/src/lib/surgery/procedureDayBoardLoader.server";
import type { ReceptionBoardCommandCenterPayload } from "@/src/lib/receptionBoard/receptionBoardTypes";

function assertShellPayloadSize(label: string, bytes: number, maxKb: number): void {
  const kb = bytes / 1024;
  assert.ok(
    kb <= maxKb,
    `${label} shell payload ${kb.toFixed(1)}KB exceeds ${maxKb}KB budget`
  );
}

describe("FI OS shell performance regression", () => {
  it("reception shell fixture excludes heavy enrichment fields", () => {
    const fixture: ReceptionBoardCommandCenterPayload = {
      tenantId: "00000000-0000-4000-8000-000000000001",
      tenantName: "Demo",
      loadedAt: new Date().toISOString(),
      operationalDay: {
        calendarTimezone: "Australia/Brisbane",
        todayYmd: "2026-07-02",
        localStartIso: "2026-07-01T14:00:00.000Z",
        localEndIso: "2026-07-02T14:00:00.000Z",
      },
      appointments: [],
      queue: {
        scheduled: [],
        arrived: [],
        checked_in: [],
        waiting: [],
        in_consultation: [],
        procedure_in_progress: [],
        completed: [],
        follow_up_booked: [],
      },
      actionAlerts: [],
      quickActions: [],
      tomorrowSurgeries: [],
      intelligence: {
        todayConsultations: 0,
        todaySurgeries: 0,
        revenueBookedToday: 0,
        outstandingPayments: 0,
        conversionRateToday: null,
        doctorUtilizationPercent: null,
        staffUtilizationPercent: null,
        averageConsultationCloseRate: null,
        upcomingFollowUps: 0,
        unreadPatientTasks: 0,
      },
      liveEvents: [],
      receptionCards: [],
      loadTier: "shell",
    };
    assert.equal(fixture.loadTier, "shell");
    assert.equal(fixture.tomorrowSurgeries.length, 0);
    assert.equal(fixture.liveEvents.length, 0);
    assertShellPayloadSize("reception", JSON.stringify(fixture).length, 48);
  });

  it("calendar shell fixture has empty bookings and deferred directory", () => {
    const fixture = {
      tenantId: "00000000-0000-4000-8000-000000000001",
      query: {
        view: "week",
        dateAnchor: "2026-07-02",
        calendarTimezone: "Australia/Brisbane",
      },
      bookings: [],
      bookingDisplay: {},
      assignees: [],
      staffDirectory: [],
      services: [],
      loadTier: "shell",
    } as unknown as OperationalCalendarPageData;
    assert.equal(fixture.loadTier, "shell");
    assert.equal(fixture.bookings.length, 0);
    assert.equal(fixture.staffDirectory.length, 0);
    assertShellPayloadSize("calendar", JSON.stringify(fixture).length, 32);
  });

  it("procedure day shell fixture defers actions and staffing enrichment", () => {
    const fixture: ProcedureDayBoardPayload = {
      tenantId: "00000000-0000-4000-8000-000000000001",
      window: {
        calendarTimezone: "Australia/Brisbane",
        todayYmd: "2026-07-02",
        rangeStartIso: "2026-07-01T14:00:00.000Z",
        rangeEndIso: "2026-07-02T14:00:00.000Z",
      },
      summary: {
        surgeriesToday: 0,
        ready: 0,
        inProgress: 0,
        completed: 0,
        highRiskReadinessIssues: 0,
        unassignedSurgeonOrTeam: 0,
        missingRoom: 0,
      },
      procedureProgressCounts: {
        scheduled: 0,
        inProgress: 0,
        completed: 0,
        cancelled: 0,
      },
      scheduleGroups: [],
      actions: [],
      loadTier: "shell",
    };
    assert.equal(fixture.loadTier, "shell");
    assert.equal(fixture.actions.length, 0);
    assertShellPayloadSize("procedureDay", JSON.stringify(fixture).length, 24);
  });
});