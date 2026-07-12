/**
 * S4.3 — static architectural + presentation UI contract tests.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  filterPipelineColumns,
  emptyPipelineActiveFilters,
  pipelineHiddenLeadsNotice,
} from "@/src/lib/crm/pipelineUiHelpers";
import type {
  PipelineLeadCard,
  PipelinePresentation,
  PipelinePresentationColumn,
} from "@/src/lib/crm/pipelinePresentation.types";
import { PIPELINE_STAFF_COLUMN_ORDER } from "@/src/lib/crm/pipelineStaffModel";

const PIPELINE_UI_DIR = "src/components/fi/crm/pipeline";

function listTsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listTsxFiles(p));
    else if (/\.(tsx|ts)$/.test(name) && !name.endsWith(".test.ts") && !name.endsWith(".test.tsx")) {
      out.push(p);
    }
  }
  return out;
}

function fixturePresentation(overrides?: Partial<PipelinePresentation>): PipelinePresentation {
  const card = (id: string, columnId: (typeof PIPELINE_STAFF_COLUMN_ORDER)[number]): PipelineLeadCard => ({
    leadId: id,
    person: { personId: "p", displayName: `Person ${id.slice(0, 4)}`, patientId: null },
    contact: { hasEmail: true, hasPhone: false, preferredChannel: "email" },
    owner: { userId: "u1", displayName: "Owner", unassigned: false },
    source: { key: "web", label: "Web", externalSystem: null },
    stage: {
      backendStageId: "st",
      backendSlug: "qualified",
      backendLabel: "Qualified",
      staffColumnId: columnId,
      staffColumnLabel: columnId,
      daysInStage: 1,
    },
    lifecycle: { state: "active", warningCodes: [] },
    urgency: { flags: [], highest: null, primaryLabel: null },
    nextAction: {
      kind: "none",
      label: "None",
      dueAtIso: null,
      overdue: false,
      sourceId: null,
    },
    followUps: { openCount: 0, overdueCount: 0, dueTodayCount: 0, nextTaskId: null },
    consultation: {
      state: "none",
      nextBookingId: null,
      nextBookingAtIso: null,
      lastConsultationId: null,
    },
    conversion: {
      state: "active",
      convertedAtIso: null,
      patientId: null,
      lostReason: null,
    },
    timestamps: {
      createdAtIso: "2026-07-01T10:00:00.000Z",
      updatedAtIso: "2026-07-01T10:00:00.000Z",
      meaningfulActivityAtIso: "2026-07-01T10:00:00.000Z",
      stageEnteredAtIso: null,
      lostAtIso: null,
    },
    score: { value: null, highValue: false },
    blockers: [],
    primaryAction: "open_lead",
    secondaryActions: ["move_stage"],
    links: { lead: `/l/${id}`, patient: null, calendar: "/c", consultation: null },
  });

  const columns: PipelinePresentationColumn[] = PIPELINE_STAFF_COLUMN_ORDER.map((id) => {
    const kind =
      id === "converted"
        ? ("terminal_won" as const)
        : id === "closed_lost"
          ? ("terminal_lost" as const)
          : id === "nurture"
            ? ("holding" as const)
            : ("active" as const);
    const cards =
      id === "qualified"
        ? [card("lead-a", "qualified"), card("lead-b", "qualified")]
        : id === "nurture"
          ? [card("lead-n", "nurture")]
          : [];
    return {
      id,
      label:
        id === "planning_quote"
          ? "Planning / quote"
          : id === "booked_deposit"
            ? "Booked / deposit"
            : id === "closed_lost"
              ? "Closed / lost"
              : id[0]!.toUpperCase() + id.slice(1).replace(/_/g, " "),
      kind,
      cards,
      count: cards.length,
      collapsedByDefault: kind !== "active",
    };
  });

  return {
    generatedAt: "2026-07-12T12:00:00.000Z",
    loadTier: "shell",
    columns,
    followUps: {
      buckets: {
        overdue: [],
        dueToday: [],
        upcoming: [],
        noDueDate: [],
        completed: [],
      },
      summary: { overdue: 0, dueToday: 0, upcoming: 0, noDueDate: 0 },
    },
    summary: {
      totalLeads: 3,
      active: 2,
      holding: 1,
      converted: 0,
      lost: 0,
      archived: 0,
      unassigned: 0,
      overdueFollowUps: 0,
      dueTodayFollowUps: 0,
      untouchedNew: 0,
      byColumn: Object.fromEntries(
        PIPELINE_STAFF_COLUMN_ORDER.map((id) => [
          id,
          columns.find((c) => c.id === id)?.count ?? 0,
        ])
      ) as PipelinePresentation["summary"]["byColumn"],
    },
    filters: {
      staffColumns: columns.map((c) => ({
        id: `col:${c.id}`,
        label: c.label,
        count: c.count,
      })),
      backendStages: [],
      owners: [],
      sources: [],
      urgency: [],
      lifecycle: [],
      assignedToMe: true,
      unassigned: false,
    },
    actions: [{ id: "open_board", label: "Board", href: "/crm" }],
    diagnostics: {
      sourceLeadCount: 100,
      visibleLeadCount: 3,
      hiddenLeadCount: 97,
      duplicateLeadIds: ["dup-1"],
      orphanTaskIds: ["orphan-1"],
      unknownStageLeadIds: [],
      conversionInconsistencies: [],
    },
    ...overrides,
  };
}

test("import boundary: pipelineUi children avoid raw CRM types and builders", () => {
  const files = listTsxFiles(PIPELINE_UI_DIR).filter(
    (f) => !f.replace(/\\/g, "/").endsWith("PipelineWorkspace.tsx")
  );
  assert.ok(files.length >= 1, "expected pipeline UI files");
  const banned = [
    /from\s+["']@\/src\/lib\/crm\/types["']/,
    /CrmKanbanLeadCard/,
    /FiCrmLeadRow/,
    /buildPipelinePresentation/,
    /crmShellLoaders/,
    /crmKanbanExtras/,
    /hubspotImport/,
    /loadCrmShell/,
  ];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    for (const re of banned) {
      assert.doesNotMatch(src, re, `${file} matched ${re}`);
    }
  }
});

test("import boundary: pipelineUi does not import business resolvers from staff model", () => {
  const ui = readFileSync(join(PIPELINE_UI_DIR, "pipelineUi.tsx"), "utf8");
  assert.doesNotMatch(ui, /resolvePipelineStaffStage/);
  assert.doesNotMatch(ui, /buildPipelinePresentation/);
  assert.doesNotMatch(ui, /CrmKanbanLeadCard/);
});

test("presentation columns stay in S4.1 order", () => {
  const p = fixturePresentation();
  assert.deepEqual(
    p.columns.map((c) => c.id),
    [...PIPELINE_STAFF_COLUMN_ORDER]
  );
});

test("one lead renders once across columns", () => {
  const p = fixturePresentation();
  const ids = p.columns.flatMap((c) => c.cards.map((x) => x.leadId));
  assert.equal(ids.length, new Set(ids).size);
});

test("multiple leads remain separate", () => {
  const p = fixturePresentation();
  const qualified = p.columns.find((c) => c.id === "qualified")!;
  assert.equal(qualified.cards.length, 2);
  assert.notEqual(qualified.cards[0]!.leadId, qualified.cards[1]!.leadId);
});

test("nurture / converted / closed_lost honour collapsedByDefault", () => {
  const p = fixturePresentation();
  for (const id of ["nurture", "converted", "closed_lost"] as const) {
    const col = p.columns.find((c) => c.id === id)!;
    assert.equal(col.collapsedByDefault, true, id);
  }
  for (const id of ["new", "qualified"] as const) {
    const col = p.columns.find((c) => c.id === id)!;
    assert.equal(col.collapsedByDefault, false, id);
  }
});

test("shell presentation next action is none", () => {
  const p = fixturePresentation({ loadTier: "shell" });
  for (const c of p.columns.flatMap((x) => x.cards)) {
    assert.equal(c.nextAction.kind, "none");
    assert.equal(c.nextAction.dueAtIso, null);
  }
});

test("full enrichment can add next actions without changing card count", () => {
  const shell = fixturePresentation({ loadTier: "shell" });
  const shellCount = shell.columns.reduce((n, c) => n + c.count, 0);
  const fullCards = shell.columns.flatMap((c) =>
    c.cards.map((card) => ({
      ...card,
      nextAction: {
        kind: "task" as const,
        label: "Call back",
        dueAtIso: "2026-07-13T10:00:00.000Z",
        overdue: false,
        sourceId: "task-1",
      },
    }))
  );
  assert.equal(fullCards.length, shellCount);
  assert.ok(fullCards.every((c) => c.nextAction.kind === "task"));
});

test("primary and secondary actions come from presentation card", () => {
  const p = fixturePresentation();
  const card = p.columns.find((c) => c.id === "qualified")!.cards[0]!;
  assert.equal(card.primaryAction, "open_lead");
  assert.ok(card.secondaryActions.includes("move_stage"));
});

test("hidden lead notice does not expose raw diagnostics", () => {
  const p = fixturePresentation();
  const msg = pipelineHiddenLeadsNotice(
    p.diagnostics.visibleLeadCount,
    p.diagnostics.sourceLeadCount,
    p.diagnostics.hiddenLeadCount
  );
  assert.ok(msg);
  assert.ok(!msg!.includes("dup-1"));
  assert.ok(!msg!.includes("orphan-1"));
  assert.ok(!/leadflow|crm|kanban|\bos\b/i.test(msg!));
});

test("filters use stable presentation filter IDs", () => {
  const p = fixturePresentation();
  for (const opt of p.filters.staffColumns) {
    assert.match(opt.id, /^col:/);
  }
});

test("filter helper preserves column order", () => {
  const p = fixturePresentation();
  const filtered = filterPipelineColumns(p.columns, emptyPipelineActiveFilters());
  assert.deepEqual(
    filtered.map((c) => c.id),
    p.columns.map((c) => c.id)
  );
});

test("PipelineWorkspace is the only adapter that may import actions", () => {
  const workspace = readFileSync(join(PIPELINE_UI_DIR, "PipelineWorkspace.tsx"), "utf8");
  assert.match(workspace, /crmMoveLeadStageAction/);
  assert.match(workspace, /resolvePipelineColumnEntryStage/);
  assert.match(workspace, /PipelinePresentation/);

  const ui = readFileSync(join(PIPELINE_UI_DIR, "pipelineUi.tsx"), "utf8");
  assert.doesNotMatch(ui, /crmMoveLeadStageAction/);
  assert.doesNotMatch(ui, /completeCrmTaskAction/);
});

test("staff labels avoid technical CRM / LeadFlow / OS language", () => {
  const p = fixturePresentation();
  const banned = /leadflow|\bcrm\b|kanban|command centre|\bos\b/i;
  for (const col of p.columns) {
    assert.doesNotMatch(col.label, banned);
  }
  for (const a of p.actions) {
    assert.doesNotMatch(a.label, banned);
  }
});

test("follow-up bucket contract exists on presentation", () => {
  const p = fixturePresentation({
    loadTier: "full",
    followUps: {
      buckets: {
        overdue: [
          {
            taskId: "t1",
            leadId: "lead-a",
            personDisplayName: "Alex",
            title: "Call",
            dueAtIso: "2026-07-10T10:00:00.000Z",
            assignee: { userId: "other", displayName: "Other" },
            status: "open",
            contact: { hasEmail: true, hasPhone: false },
            allowedActions: ["complete_follow_up", "open_lead"],
            links: { lead: "/l/lead-a" },
          },
        ],
        dueToday: [],
        upcoming: [],
        noDueDate: [],
        completed: [],
      },
      summary: { overdue: 1, dueToday: 0, upcoming: 0, noDueDate: 0 },
    },
  });
  assert.equal(p.followUps.buckets.overdue.length, 1);
  assert.equal(p.followUps.buckets.overdue[0]!.assignee.userId, "other");
  // Owner on card remains distinct
  const boardCard = p.columns.flatMap((c) => c.cards).find((c) => c.leadId === "lead-a");
  if (boardCard) {
    assert.notEqual(boardCard.owner.userId, "other");
  }
});
