/**
 * S4.3 — pipeline UI helpers tests.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertStaffSafePipelineLabel,
  countActivePipelineFilters,
  emptyPipelineActiveFilters,
  filterPipelineColumns,
  formatPipelineDueLabel,
  pipelineCardActionLabel,
  pipelineHiddenLeadsNotice,
  pipelineSummaryTiles,
} from "@/src/lib/crm/pipelineUiHelpers";
import type {
  PipelineLeadCard,
  PipelinePresentationColumn,
  PipelinePresentationSummary,
} from "@/src/lib/crm/pipelinePresentation.types";

const NOW = Date.parse("2026-07-12T12:00:00.000Z");

function card(partial: Partial<PipelineLeadCard> & Pick<PipelineLeadCard, "leadId">): PipelineLeadCard {
  return {
    leadId: partial.leadId,
    person: partial.person ?? {
      personId: "p1",
      displayName: "Alex",
      patientId: null,
    },
    contact: partial.contact ?? {
      hasEmail: true,
      hasPhone: false,
      preferredChannel: "email",
    },
    owner: partial.owner ?? {
      userId: "u1",
      displayName: "Owner",
      unassigned: false,
    },
    source: partial.source ?? { key: "web", label: "Web", externalSystem: null },
    stage: partial.stage ?? {
      backendStageId: "s1",
      backendSlug: "qualified",
      backendLabel: "Qualified",
      staffColumnId: "qualified",
      staffColumnLabel: "Qualified",
      daysInStage: 1,
    },
    lifecycle: partial.lifecycle ?? { state: "active", warningCodes: [] },
    urgency: partial.urgency ?? { flags: [], highest: null, primaryLabel: null },
    nextAction: partial.nextAction ?? {
      kind: "none",
      label: "None",
      dueAtIso: null,
      overdue: false,
      sourceId: null,
    },
    followUps: partial.followUps ?? {
      openCount: 0,
      overdueCount: 0,
      dueTodayCount: 0,
      nextTaskId: null,
    },
    consultation: partial.consultation ?? {
      state: "none",
      nextBookingId: null,
      nextBookingAtIso: null,
      lastConsultationId: null,
    },
    conversion: partial.conversion ?? {
      state: "active",
      convertedAtIso: null,
      patientId: null,
      lostReason: null,
    },
    score: partial.score ?? { value: null, highValue: false },
    blockers: partial.blockers ?? [],
    primaryAction: partial.primaryAction ?? "open_lead",
    secondaryActions: partial.secondaryActions ?? [],
    links: partial.links ?? {
      lead: "/l",
      patient: null,
      calendar: "/c",
      consultation: null,
    },
  };
}

test("action labels are staff-safe", () => {
  assert.equal(pipelineCardActionLabel("move_stage"), "Move stage");
  assert.equal(pipelineCardActionLabel("mark_lost"), "Mark lost");
  assert.doesNotMatch(pipelineCardActionLabel("open_lead"), /leadflow|crm|kanban/i);
});

test("due labels use text not colour alone", () => {
  assert.match(
    formatPipelineDueLabel("2026-07-10T10:00:00.000Z", true, NOW) ?? "",
    /Overdue/
  );
  assert.match(
    formatPipelineDueLabel("2026-07-12T15:00:00.000Z", false, NOW) ?? "",
    /Due today/
  );
});

test("hidden lead notice is staff-safe", () => {
  const msg = pipelineHiddenLeadsNotice(10, 50, 40);
  assert.ok(msg);
  assert.match(msg!, /Showing 10 of 50/);
  assert.ok(!msg!.includes("orphan"));
  assert.ok(!msg!.includes("duplicate"));
});

test("filterPipelineColumns filters by unassigned and column", () => {
  const columns: PipelinePresentationColumn[] = [
    {
      id: "qualified",
      label: "Qualified",
      kind: "active",
      count: 2,
      collapsedByDefault: false,
      cards: [
        card({
          leadId: "a",
          owner: { userId: null, displayName: null, unassigned: true },
        }),
        card({
          leadId: "b",
          owner: { userId: "u", displayName: "U", unassigned: false },
        }),
      ],
    },
  ];
  const filtered = filterPipelineColumns(columns, {
    ...emptyPipelineActiveFilters(),
    unassignedOnly: true,
  });
  assert.equal(filtered[0]!.cards.length, 1);
  assert.equal(filtered[0]!.cards[0]!.leadId, "a");
});

test("summary tiles omit revenue", () => {
  const summary: PipelinePresentationSummary = {
    totalLeads: 3,
    active: 2,
    holding: 0,
    converted: 1,
    lost: 0,
    archived: 0,
    unassigned: 1,
    overdueFollowUps: 2,
    dueTodayFollowUps: 1,
    untouchedNew: 0,
    byColumn: {
      new: 0,
      contacting: 0,
      qualified: 2,
      consultation: 0,
      planning_quote: 0,
      booked_deposit: 0,
      converted: 1,
      nurture: 0,
      closed_lost: 0,
    },
  };
  const tiles = pipelineSummaryTiles(summary);
  assert.ok(tiles.every((t) => !/revenue|marketing|kpi/i.test(t.label)));
  assert.equal(countActivePipelineFilters(emptyPipelineActiveFilters()), 0);
});

test("staff-safe label guard strips technical terms", () => {
  assert.equal(assertStaffSafePipelineLabel("LeadFlow CRM Kanban"), "Pipeline Pipeline Board");
});
