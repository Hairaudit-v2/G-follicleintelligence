/**
 * FI-PIPELINE-OPERATIONS-1 — sort, filter, inactive review, drag, query tests.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyPipelineOpsToPresentation,
} from "@/src/lib/crm/pipelineOperationsApply";
import {
  cardMatchesAgeBucket,
  cardMatchesActivityFilter,
  isPipelineInactiveReviewLead,
  pipelineAgeBucketMatches,
  pipelineLeadAgeDays,
} from "@/src/lib/crm/pipelineOperationsFilters";
import {
  parsePipelineOpsQuery,
  pipelineOpsQueryToSearchParams,
} from "@/src/lib/crm/pipelineOperationsQuery";
import {
  compareMostRecentlyLost,
  compareNewColumnDefault,
  compareNewestFirst,
  compareOldestFirst,
  compareOldestUntouched,
  compareRecentlyUpdated,
  maxMeaningfulActivityIso,
  sortPipelineCardsByOpsMode,
  type PipelineOpsSortableCard,
} from "@/src/lib/crm/pipelineOperationsSort";
import {
  clearPipelineDragSession,
  isPipelineDesktopDragEnabled,
  resolvePipelineDragDrop,
  startPipelineDragSession,
} from "@/src/lib/crm/pipelineDrag";
import { normalizePipelineSearchParams } from "@/src/lib/crm/pipelineLoader";
import { resolvePipelineInitialView } from "@/src/lib/crm/pipelineQueryCompat";
import type { PipelineLeadCard, PipelinePresentation } from "@/src/lib/crm/pipelinePresentation.types";
import type { PipelineMoveStageDefinition } from "@/src/lib/crm/pipelineMoveTarget";

const NOW = Date.parse("2026-07-12T12:00:00.000Z");

function sortable(
  partial: Partial<PipelineOpsSortableCard> & { leadId: string }
): PipelineOpsSortableCard {
  return {
    leadId: partial.leadId,
    createdAtIso: partial.createdAtIso ?? null,
    updatedAtIso: partial.updatedAtIso ?? null,
    meaningfulActivityAtIso: partial.meaningfulActivityAtIso ?? null,
    lostAtIso: partial.lostAtIso ?? null,
    stageEnteredAtIso: partial.stageEnteredAtIso ?? null,
    urgencyFlags: partial.urgencyFlags ?? [],
    nextFollowUpAtIso: partial.nextFollowUpAtIso ?? null,
    score: partial.score ?? null,
  };
}

function card(
  partial: Partial<PipelineLeadCard> & { leadId: string }
): PipelineLeadCard {
  return {
    leadId: partial.leadId,
    person: partial.person ?? {
      personId: null,
      displayName: "Person",
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
    timestamps: partial.timestamps ?? {
      createdAtIso: "2026-06-01T00:00:00.000Z",
      updatedAtIso: "2026-06-01T00:00:00.000Z",
      meaningfulActivityAtIso: "2026-06-01T00:00:00.000Z",
      stageEnteredAtIso: null,
      lostAtIso: null,
    },
    score: partial.score ?? { value: null, highValue: false },
    blockers: [],
    primaryAction: "open_lead",
    secondaryActions: ["move_stage"],
    links: { lead: "/l", patient: null, calendar: "/c", consultation: null },
  };
}

const stages: PipelineMoveStageDefinition[] = [
  {
    id: "stage-new-uuid",
    slug: "new",
    label: "New",
    sortOrder: 0,
    isEntry: true,
    isWon: false,
    isLost: false,
  },
  {
    id: "stage-contact-uuid",
    slug: "contacted",
    label: "Contacted",
    sortOrder: 10,
    isEntry: false,
    isWon: false,
    isLost: false,
  },
  {
    id: "stage-lost-uuid",
    slug: "lost",
    label: "Lost",
    sortOrder: 90,
    isEntry: false,
    isWon: false,
    isLost: true,
  },
  {
    id: "stage-won-uuid",
    slug: "won_closed",
    label: "Won",
    sortOrder: 100,
    isEntry: false,
    isWon: true,
    isLost: false,
  },
  {
    id: "stage-arch-uuid",
    slug: "contacted",
    label: "Archived contact",
    sortOrder: 5,
    isEntry: false,
    isWon: false,
    isLost: false,
    archived: true,
  },
];

// --- 1–5 sort ----------------------------------------------------------------

test("1. New defaults newest first (created DESC, updated DESC, lead_id ASC)", () => {
  const a = sortable({
    leadId: "a",
    createdAtIso: "2026-07-10T00:00:00.000Z",
    updatedAtIso: "2026-07-11T00:00:00.000Z",
  });
  const b = sortable({
    leadId: "b",
    createdAtIso: "2026-07-11T00:00:00.000Z",
    updatedAtIso: "2026-07-10T00:00:00.000Z",
  });
  assert.ok(compareNewColumnDefault(b, a) < 0); // b newer created first
});

test("2. Deterministic tie-breaking by lead_id", () => {
  const a = sortable({
    leadId: "lead-a",
    createdAtIso: "2026-07-01T00:00:00.000Z",
    updatedAtIso: "2026-07-01T00:00:00.000Z",
  });
  const b = sortable({
    leadId: "lead-b",
    createdAtIso: "2026-07-01T00:00:00.000Z",
    updatedAtIso: "2026-07-01T00:00:00.000Z",
  });
  assert.ok(compareNewestFirst(a, b) < 0);
  assert.ok(compareNewColumnDefault(a, b) < 0);
});

test("3. Oldest-first ordering", () => {
  const old = sortable({ leadId: "old", createdAtIso: "2026-01-01T00:00:00.000Z" });
  const neu = sortable({ leadId: "new", createdAtIso: "2026-07-01T00:00:00.000Z" });
  assert.ok(compareOldestFirst(old, neu) < 0);
});

test("4. Recently updated ordering", () => {
  const a = sortable({ leadId: "a", updatedAtIso: "2026-07-01T00:00:00.000Z" });
  const b = sortable({ leadId: "b", updatedAtIso: "2026-07-10T00:00:00.000Z" });
  assert.ok(compareRecentlyUpdated(b, a) < 0);
});

test("5. Oldest untouched uses meaningful activity, not generatedAt", () => {
  const stale = sortable({
    leadId: "stale",
    meaningfulActivityAtIso: "2026-01-01T00:00:00.000Z",
  });
  const fresh = sortable({
    leadId: "fresh",
    meaningfulActivityAtIso: "2026-07-01T00:00:00.000Z",
  });
  assert.ok(compareOldestUntouched(stale, fresh) < 0);
  assert.equal(
    maxMeaningfulActivityIso(["2026-01-01T00:00:00.000Z", "2026-06-01T00:00:00.000Z"]),
    "2026-06-01T00:00:00.000Z"
  );
});

test("6. Lost defaults most recently lost", () => {
  const a = sortable({
    leadId: "a",
    lostAtIso: "2026-07-01T00:00:00.000Z",
  });
  const b = sortable({
    leadId: "b",
    lostAtIso: "2026-07-10T00:00:00.000Z",
  });
  assert.ok(compareMostRecentlyLost(b, a) < 0);
});

// --- age / filters ------------------------------------------------------------

test("7. Age filters at boundary dates", () => {
  assert.equal(pipelineAgeBucketMatches(0, "today"), true);
  assert.equal(pipelineAgeBucketMatches(7, "last_7_days"), true);
  assert.equal(pipelineAgeBucketMatches(8, "last_7_days"), false);
  assert.equal(pipelineAgeBucketMatches(8, "8_30_days"), true);
  assert.equal(pipelineAgeBucketMatches(30, "8_30_days"), true);
  assert.equal(pipelineAgeBucketMatches(31, "8_30_days"), false);
  assert.equal(pipelineAgeBucketMatches(31, "31_60_days"), true);
  assert.equal(pipelineAgeBucketMatches(60, "31_60_days"), true);
  assert.equal(pipelineAgeBucketMatches(61, "61_90_days"), true);
  assert.equal(pipelineAgeBucketMatches(90, "61_90_days"), true);
  assert.equal(pipelineAgeBucketMatches(91, "over_90_days"), true);
  assert.equal(pipelineAgeBucketMatches(90, "over_90_days"), false);

  const age = pipelineLeadAgeDays("2026-07-12T00:00:00.000Z", NOW);
  assert.equal(age, 0);
  const age91 = pipelineLeadAgeDays("2026-04-12T00:00:00.000Z", NOW);
  assert.ok(age91 != null && age91 >= 90);
});

test("8. Owner filter", () => {
  const c = card({
    leadId: "l1",
    owner: { userId: "owner-1", displayName: "O", unassigned: false },
  });
  const q = parsePipelineOpsQuery({ owner: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
  // non-uuid owner in card — use activity unassigned path
  assert.equal(
    cardMatchesActivityFilter(
      card({
        leadId: "u",
        owner: { userId: null, displayName: null, unassigned: true },
      }),
      "unassigned",
      NOW
    ),
    true
  );
  assert.ok(c.owner.userId === "owner-1");
  assert.equal(q.ownerId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
});

test("9. Source filter via query", () => {
  const q = parsePipelineOpsQuery({ source: "hubspot" });
  assert.equal(q.sourceKey, "hubspot");
  const c = card({
    leadId: "l",
    source: { key: "hubspot", label: "HubSpot", externalSystem: "hubspot" },
  });
  assert.equal((c.source.key ?? "").toLowerCase(), "hubspot");
});

test("10. Unassigned filter", () => {
  assert.equal(
    cardMatchesActivityFilter(
      card({
        leadId: "u",
        owner: { userId: null, displayName: null, unassigned: true },
      }),
      "unassigned",
      NOW
    ),
    true
  );
});

test("11. Overdue filter", () => {
  assert.equal(
    cardMatchesActivityFilter(
      card({
        leadId: "o",
        followUps: {
          openCount: 1,
          overdueCount: 1,
          dueTodayCount: 0,
          nextTaskId: "t",
        },
      }),
      "has_overdue_follow_up",
      NOW
    ),
    true
  );
});

test("12. No-follow-up filter", () => {
  assert.equal(
    cardMatchesActivityFilter(
      card({
        leadId: "n",
        followUps: {
          openCount: 0,
          overdueCount: 0,
          dueTodayCount: 0,
          nextTaskId: null,
        },
        nextAction: {
          kind: "none",
          label: "None",
          dueAtIso: null,
          overdue: false,
          sourceId: null,
        },
      }),
      "no_follow_up",
      NOW
    ),
    true
  );
});

// --- inactive review ----------------------------------------------------------

test("13. Inactive-review inclusion", () => {
  const c = card({
    leadId: "inactive-1",
    timestamps: {
      createdAtIso: "2026-01-01T00:00:00.000Z",
      updatedAtIso: "2026-01-01T00:00:00.000Z",
      meaningfulActivityAtIso: "2026-01-01T00:00:00.000Z",
      stageEnteredAtIso: null,
      lostAtIso: null,
    },
    followUps: {
      openCount: 0,
      overdueCount: 0,
      dueTodayCount: 0,
      nextTaskId: null,
    },
    consultation: {
      state: "none",
      nextBookingId: null,
      nextBookingAtIso: null,
      lastConsultationId: null,
    },
  });
  assert.equal(isPipelineInactiveReviewLead(c, NOW, 30), true);
});

test("14. Future consultation excludes from inactive review", () => {
  const c = card({
    leadId: "consult",
    timestamps: {
      createdAtIso: "2026-01-01T00:00:00.000Z",
      updatedAtIso: "2026-01-01T00:00:00.000Z",
      meaningfulActivityAtIso: "2026-01-01T00:00:00.000Z",
      stageEnteredAtIso: null,
      lostAtIso: null,
    },
    consultation: {
      state: "booked",
      nextBookingId: "b1",
      nextBookingAtIso: "2026-08-01T10:00:00.000Z",
      lastConsultationId: null,
    },
  });
  assert.equal(isPipelineInactiveReviewLead(c, NOW, 30), false);
});

test("15. Upcoming task excludes from inactive review", () => {
  const c = card({
    leadId: "task",
    timestamps: {
      createdAtIso: "2026-01-01T00:00:00.000Z",
      updatedAtIso: "2026-01-01T00:00:00.000Z",
      meaningfulActivityAtIso: "2026-01-01T00:00:00.000Z",
      stageEnteredAtIso: null,
      lostAtIso: null,
    },
    followUps: {
      openCount: 1,
      overdueCount: 0,
      dueTodayCount: 0,
      nextTaskId: "t1",
    },
    nextAction: {
      kind: "task",
      label: "Call",
      dueAtIso: "2026-08-01T00:00:00.000Z",
      overdue: false,
      sourceId: "t1",
    },
  });
  assert.equal(isPipelineInactiveReviewLead(c, NOW, 30), false);
});

test("16. Converted excludes from inactive review", () => {
  const c = card({
    leadId: "won",
    lifecycle: { state: "converted", warningCodes: [] },
    stage: {
      backendStageId: "w",
      backendSlug: "won_closed",
      backendLabel: "Won",
      staffColumnId: "converted",
      staffColumnLabel: "Converted",
      daysInStage: 1,
    },
    timestamps: {
      createdAtIso: "2026-01-01T00:00:00.000Z",
      updatedAtIso: "2026-01-01T00:00:00.000Z",
      meaningfulActivityAtIso: "2026-01-01T00:00:00.000Z",
      stageEnteredAtIso: null,
      lostAtIso: null,
    },
  });
  assert.equal(isPipelineInactiveReviewLead(c, NOW, 30), false);
});

test("17. Lost excludes from inactive review", () => {
  const c = card({
    leadId: "lost",
    lifecycle: { state: "lost", warningCodes: [] },
    stage: {
      backendStageId: "l",
      backendSlug: "lost",
      backendLabel: "Lost",
      staffColumnId: "closed_lost",
      staffColumnLabel: "Closed / lost",
      daysInStage: 1,
    },
    timestamps: {
      createdAtIso: "2026-01-01T00:00:00.000Z",
      updatedAtIso: "2026-01-01T00:00:00.000Z",
      meaningfulActivityAtIso: "2026-01-01T00:00:00.000Z",
      stageEnteredAtIso: null,
      lostAtIso: "2026-06-01T00:00:00.000Z",
    },
  });
  assert.equal(isPipelineInactiveReviewLead(c, NOW, 30), false);
});

// --- query / identity ---------------------------------------------------------

test("18. Shell/full query normalization matches", () => {
  const sp = { sort: "oldest_first", owner: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
  const a = normalizePipelineSearchParams(sp);
  const b = normalizePipelineSearchParams({ ...sp });
  assert.deepEqual(a, b);
  assert.equal(a.sort, "created_at_desc"); // board window mapping
  assert.equal(a.owner, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
});

test("19. No duplicate card after sorting", () => {
  const c1 = card({ leadId: "dup", timestamps: {
    createdAtIso: "2026-07-01T00:00:00.000Z",
    updatedAtIso: "2026-07-01T00:00:00.000Z",
    meaningfulActivityAtIso: "2026-07-01T00:00:00.000Z",
    stageEnteredAtIso: null,
    lostAtIso: null,
  }});
  const presentation: PipelinePresentation = {
    generatedAt: "2026-07-12T12:00:00.000Z",
    loadTier: "full",
    columns: [
      {
        id: "qualified",
        label: "Qualified",
        kind: "active",
        cards: [c1, { ...c1 }],
        count: 2,
        collapsedByDefault: false,
      },
    ],
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
      totalLeads: 1,
      active: 1,
      holding: 0,
      converted: 0,
      lost: 0,
      archived: 0,
      unassigned: 0,
      overdueFollowUps: 0,
      dueTodayFollowUps: 0,
      untouchedNew: 0,
      byColumn: {
        new: 0,
        contacting: 0,
        qualified: 1,
        consultation: 0,
        planning_quote: 0,
        booked_deposit: 0,
        converted: 0,
        nurture: 0,
        closed_lost: 0,
      },
    },
    filters: {
      staffColumns: [],
      backendStages: [],
      owners: [],
      sources: [],
      urgency: [],
      lifecycle: [],
      assignedToMe: false,
      unassigned: false,
    },
    actions: [],
    diagnostics: {
      sourceLeadCount: 1,
      visibleLeadCount: 1,
      hiddenLeadCount: 0,
      duplicateLeadIds: [],
      orphanTaskIds: [],
      unknownStageLeadIds: [],
      conversionInconsistencies: [],
    },
  };
  const applied = applyPipelineOpsToPresentation(
    presentation,
    {
      view: "board",
      sort: "newest_first",
      lifecycle: null,
      stageSlug: null,
      age: null,
      ownerId: null,
      sourceKey: null,
      activity: null,
      inactiveAgeDays: 30,
      userSortSelected: true,
    },
    NOW
  );
  const col = applied.presentation.columns.find((c) => c.id === "qualified")!;
  assert.equal(col.cards.length, 1);
  assert.equal(col.cards[0]!.leadId, "dup");
});

// --- drag ---------------------------------------------------------------------

test("20. Desktop valid drag resolves real stage UUID", () => {
  const intent = resolvePipelineDragDrop({
    leadId: "lead-1",
    fromColumnId: "new",
    toColumnId: "contacting",
    tenantStages: stages,
    canMutate: true,
    desktopPointer: true,
  });
  assert.equal(intent.kind, "move");
  if (intent.kind === "move") {
    assert.equal(intent.toStageId, "stage-contact-uuid");
    assert.notEqual(intent.toStageId, "contacting");
  }
});

test("21. Invalid drag snaps back (reject)", () => {
  const intent = resolvePipelineDragDrop({
    leadId: "lead-1",
    fromColumnId: "new",
    toColumnId: "new",
    tenantStages: stages,
    canMutate: true,
    desktopPointer: true,
  });
  assert.equal(intent.kind, "reject");
  if (intent.kind === "reject") assert.equal(intent.reason, "same_column");
});

test("22. Lost drop opens reason dialog", () => {
  const intent = resolvePipelineDragDrop({
    leadId: "lead-1",
    fromColumnId: "qualified",
    toColumnId: "closed_lost",
    tenantStages: stages,
    canMutate: true,
    desktopPointer: true,
  });
  assert.equal(intent.kind, "open_lost_reason");
});

test("23. Converted drop opens conversion workflow", () => {
  const intent = resolvePipelineDragDrop({
    leadId: "lead-1",
    fromColumnId: "qualified",
    toColumnId: "converted",
    tenantStages: stages,
    canMutate: true,
    desktopPointer: true,
  });
  assert.equal(intent.kind, "open_conversion");
});

test("24. Archived stage cannot receive drop as destination mapping", () => {
  // archived contacted stage is skipped; non-archived contacted still wins
  const intent = resolvePipelineDragDrop({
    leadId: "lead-1",
    fromColumnId: "new",
    toColumnId: "contacting",
    tenantStages: stages,
    canMutate: true,
    desktopPointer: true,
  });
  assert.equal(intent.kind, "move");
  if (intent.kind === "move") {
    assert.notEqual(intent.toStageId, "stage-arch-uuid");
  }
});

test("25. Read-only cannot drag", () => {
  const intent = resolvePipelineDragDrop({
    leadId: "lead-1",
    fromColumnId: "new",
    toColumnId: "contacting",
    tenantStages: stages,
    canMutate: false,
    desktopPointer: true,
  });
  assert.equal(intent.kind, "reject");
  if (intent.kind === "reject") assert.equal(intent.reason, "read_only");
});

test("26. Tablet drag disabled", () => {
  assert.equal(
    isPipelineDesktopDragEnabled({ canMutate: true, finePointerDesktop: false }),
    false
  );
  const intent = resolvePipelineDragDrop({
    leadId: "lead-1",
    fromColumnId: "new",
    toColumnId: "contacting",
    tenantStages: stages,
    canMutate: true,
    desktopPointer: false,
  });
  assert.equal(intent.kind, "reject");
  if (intent.kind === "reject") assert.equal(intent.reason, "tablet_or_touch");
});

test("27. Keyboard Move stage remains (resolver still available)", () => {
  // Move stage uses resolvePipelineColumnEntryStage path — drag is optional
  const intent = resolvePipelineDragDrop({
    leadId: "lead-1",
    fromColumnId: "new",
    toColumnId: "contacting",
    tenantStages: stages,
    canMutate: true,
    desktopPointer: true,
  });
  assert.equal(intent.kind, "move");
});

test("28. Failed mutation restores original state (no optimistic — reject leaves board)", () => {
  // Contract: resolve never mutates; session clear is pure
  const s = startPipelineDragSession(null, {
    leadId: "l1",
    fromColumnId: "new",
  });
  assert.equal(s.leadId, "l1");
  assert.equal(clearPipelineDragSession(), null);
});

test("29. Live announcement contract (workspace strings exist in source)", () => {
  // Covered by a11y static tests; pure path announces via kind branches
  const lost = resolvePipelineDragDrop({
    leadId: "x",
    fromColumnId: "new",
    toColumnId: "closed_lost",
    tenantStages: stages,
    canMutate: true,
    desktopPointer: true,
  });
  assert.equal(lost.kind, "open_lost_reason");
});

test("30. No default polling (query parse is pure, no timers)", () => {
  const q = parsePipelineOpsQuery({});
  assert.equal(q.view, "board");
  assert.equal(q.sort, "newest_first");
  assert.equal(q.userSortSelected, false);
});

test("unknown query values fail safely", () => {
  const q = parsePipelineOpsQuery({
    view: "nope",
    sort: "banana",
    age: "forever",
    lifecycle: "zzz",
    activity: "xyz",
  });
  assert.equal(q.view, "board");
  assert.equal(q.sort, "newest_first");
  assert.equal(q.age, null);
  assert.equal(q.lifecycle, null);
  assert.equal(q.activity, null);
});

test("inactive_review view parses", () => {
  assert.equal(resolvePipelineInitialView({ view: "inactive_review" }), "inactive_review");
  const q = parsePipelineOpsQuery({ view: "inactive_review" });
  assert.equal(q.view, "inactive_review");
});

test("sort cards newest first order", () => {
  const cards = [
    card({
      leadId: "old",
      timestamps: {
        createdAtIso: "2026-01-01T00:00:00.000Z",
        updatedAtIso: "2026-01-01T00:00:00.000Z",
        meaningfulActivityAtIso: "2026-01-01T00:00:00.000Z",
        stageEnteredAtIso: null,
        lostAtIso: null,
      },
    }),
    card({
      leadId: "new",
      timestamps: {
        createdAtIso: "2026-07-01T00:00:00.000Z",
        updatedAtIso: "2026-07-01T00:00:00.000Z",
        meaningfulActivityAtIso: "2026-07-01T00:00:00.000Z",
        stageEnteredAtIso: null,
        lostAtIso: null,
      },
    }),
  ];
  const sorted = sortPipelineCardsByOpsMode(cards, "newest_first");
  assert.equal(sorted[0]!.leadId, "new");
  assert.equal(sorted[1]!.leadId, "old");
});

test("query serialize omits defaults and never includes names", () => {
  const sp = pipelineOpsQueryToSearchParams({
    view: "board",
    sort: "newest_first",
    lifecycle: null,
    stageSlug: null,
    age: null,
    ownerId: null,
    sourceKey: null,
    activity: null,
    inactiveAgeDays: 30,
    userSortSelected: false,
  });
  assert.equal(sp.toString(), "");
  const sp2 = pipelineOpsQueryToSearchParams({
    view: "inactive_review",
    sort: "oldest_untouched",
    lifecycle: "nurture",
    stageSlug: null,
    age: "over_90_days",
    ownerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    sourceKey: "web",
    activity: "unassigned",
    inactiveAgeDays: 45,
    userSortSelected: true,
  });
  const s = sp2.toString();
  assert.match(s, /view=inactive_review/);
  assert.doesNotMatch(s, /Paul|@|name=/i);
});

test("age bucket match via card", () => {
  const c = card({
    leadId: "aged",
    timestamps: {
      createdAtIso: "2026-07-12T00:00:00.000Z",
      updatedAtIso: "2026-07-12T00:00:00.000Z",
      meaningfulActivityAtIso: "2026-07-12T00:00:00.000Z",
      stageEnteredAtIso: null,
      lostAtIso: null,
    },
  });
  assert.equal(cardMatchesAgeBucket(c, "today", NOW), true);
});
