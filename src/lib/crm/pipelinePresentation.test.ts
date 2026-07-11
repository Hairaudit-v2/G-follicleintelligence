/**
 * FI-UX-REBUILD-1 S4.2 — pipeline presentation builder tests.
 * Fixed UUIDs and timestamps only.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildPipelinePresentation,
  resolveConsultationSummary,
} from "@/src/lib/crm/pipelinePresentation";
import type {
  PipelineCommunicationHintInput,
  PipelineConsultationInput,
  PipelineTaskInput,
} from "@/src/lib/crm/pipelinePresentation.types";
import type { CrmKanbanLeadCard, FiCrmLeadRow } from "@/src/lib/crm/types";
import { PIPELINE_STAFF_COLUMNS } from "@/src/lib/crm/pipelineStaffModel";

const NOW_MS = Date.parse("2026-07-12T12:00:00.000Z");
const BASE = "/fi-admin/22222222-2222-4222-8222-222222222222";
const L1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const L2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const T1 = "t1111111-1111-4111-8111-111111111111";
const T2 = "t2222222-2222-4222-8222-222222222222";
const T3 = "t3333333-3333-4333-8333-333333333333";
const P1 = "pppppppp-pppp-4ppp-8ppp-pppppppppppp";
const U1 = "uuuuuuuu-uuuu-4uuu-8uuu-uuuuuuuuuuuu";

function leadRow(
  partial: Partial<FiCrmLeadRow> & Pick<FiCrmLeadRow, "id">
): FiCrmLeadRow {
  return {
    id: partial.id,
    tenant_id: "22222222-2222-4222-8222-222222222222",
    organisation_id: null,
    clinic_id: null,
    person_id: partial.person_id ?? "person-1",
    patient_id: partial.patient_id ?? null,
    case_id: null,
    current_stage_id: partial.current_stage_id ?? "stage-1",
    primary_owner_user_id: partial.primary_owner_user_id ?? null,
    status: partial.status ?? "open",
    priority: partial.priority ?? null,
    summary: partial.summary ?? "Enquiry",
    metadata: partial.metadata ?? {},
    converted_person_id: null,
    converted_case_id: null,
    converted_at: partial.converted_at ?? null,
    converted_by_user_id: null,
    created_at: partial.created_at ?? "2026-07-01T10:00:00.000Z",
    updated_at: partial.updated_at ?? "2026-07-01T10:00:00.000Z",
  };
}

function kanban(
  partial: {
    id: string;
    slug?: string;
    stageLabel?: string;
    status?: string;
    ownerId?: string | null;
    ownerEmail?: string | null;
    personId?: string;
    personMeta?: Record<string, unknown>;
    patientId?: string | null;
    convertedAt?: string | null;
    priority?: string | null;
    metadata?: Record<string, unknown>;
    daysInStage?: number | null;
    overdueTaskCount?: number;
    isHighValue?: boolean;
    createdAt?: string;
    updatedAt?: string;
    lastActivityAtIso?: string;
    summary?: string;
  }
): CrmKanbanLeadCard {
  const slug = partial.slug ?? "qualified";
  return {
    lead: leadRow({
      id: partial.id,
      person_id: partial.personId ?? "person-1",
      patient_id: partial.patientId ?? null,
      primary_owner_user_id: partial.ownerId === undefined ? U1 : partial.ownerId,
      status: partial.status ?? "open",
      priority: partial.priority ?? null,
      metadata: partial.metadata ?? {},
      converted_at: partial.convertedAt ?? null,
      created_at: partial.createdAt ?? "2026-07-01T10:00:00.000Z",
      updated_at: partial.updatedAt ?? "2026-07-01T10:00:00.000Z",
      summary: partial.summary ?? "Enquiry",
    }),
    stage: {
      id: `stage-${slug}`,
      slug,
      label: partial.stageLabel ?? slug,
      sort_order: 20,
    },
    person: {
      id: partial.personId ?? "person-1",
      metadata: partial.personMeta ?? { full_name: "Alex Example", email: "a@example.com" },
    },
    owner:
      (partial.ownerId === undefined ? U1 : partial.ownerId)
        ? {
            id: (partial.ownerId === undefined ? U1 : partial.ownerId) as string,
            email: partial.ownerEmail ?? "owner@example.com",
          }
        : null,
    patient: partial.patientId ? { id: partial.patientId } : null,
    clinicalSummaryLine: null,
    norwoodScale: null,
    ludwigScale: null,
    primaryConcernLine: null,
    daysInStage: partial.daysInStage ?? 2,
    stageEnteredAtIso: "2026-07-10T10:00:00.000Z",
    lastActivityAtIso: partial.lastActivityAtIso ?? "2026-07-11T10:00:00.000Z",
    overdueTaskCount: partial.overdueTaskCount ?? 0,
    isHighValue: partial.isHighValue ?? false,
  };
}

function task(
  partial: Partial<PipelineTaskInput> & Pick<PipelineTaskInput, "taskId" | "leadId">
): PipelineTaskInput {
  return {
    taskId: partial.taskId,
    leadId: partial.leadId,
    title: partial.title ?? "Follow up",
    dueAtIso: partial.dueAtIso ?? null,
    completedAtIso: partial.completedAtIso ?? null,
    status: partial.status ?? "open",
    assigneeUserId: partial.assigneeUserId ?? null,
    assigneeDisplayName: partial.assigneeDisplayName ?? null,
  };
}

function build(
  leads: CrmKanbanLeadCard[],
  extra?: Partial<Parameters<typeof buildPipelinePresentation>[0]>
) {
  return buildPipelinePresentation({
    leads,
    nowMs: NOW_MS,
    base: BASE,
    permissions: { canMutate: true, canConvert: true, canBookConsultation: true },
    ...extra,
  });
}

function allCards(p: ReturnType<typeof build>) {
  return p.columns.flatMap((c) => c.cards);
}

function findCard(p: ReturnType<typeof build>, id: string) {
  return allCards(p).find((c) => c.leadId === id) ?? null;
}

// --- Core card minting ------------------------------------------------------

test("1. one lead produces one card", () => {
  const p = build([kanban({ id: L1 })]);
  assert.equal(allCards(p).length, 1);
  assert.equal(allCards(p)[0]!.leadId, L1);
  assert.equal(p.loadTier, "shell");
});

test("2. duplicate lead input produces one card plus diagnostic", () => {
  const older = kanban({ id: L1, updatedAt: "2026-07-01T10:00:00.000Z", slug: "new" });
  const newer = kanban({
    id: L1,
    updatedAt: "2026-07-10T10:00:00.000Z",
    slug: "qualified",
  });
  const p = build([older, newer]);
  assert.equal(allCards(p).length, 1);
  assert.deepEqual(p.diagnostics.duplicateLeadIds, [L1]);
  assert.equal(findCard(p, L1)!.stage.backendSlug, "qualified");
});

test("3. duplicate enrichment cannot create a card", () => {
  const tasks = new Map<string, PipelineTaskInput[]>([
    [L2, [task({ taskId: T1, leadId: L2 })]],
  ]);
  const p = build([kanban({ id: L1 })], { tasksByLeadId: tasks });
  assert.equal(allCards(p).length, 1);
  assert.ok(p.diagnostics.orphanTaskIds.includes(T1));
  assert.equal(findCard(p, L2), null);
});

// --- Tasks / next action ----------------------------------------------------

test("4. multiple tasks enrich one card", () => {
  const tasks = new Map([
    [
      L1,
      [
        task({ taskId: T1, leadId: L1, dueAtIso: "2026-07-13T10:00:00.000Z" }),
        task({ taskId: T2, leadId: L1, dueAtIso: "2026-07-14T10:00:00.000Z" }),
      ],
    ],
  ]);
  const p = build([kanban({ id: L1 })], { tasksByLeadId: tasks });
  const c = findCard(p, L1)!;
  assert.equal(c.followUps.openCount, 2);
  assert.equal(c.followUps.nextTaskId, T1);
});

test("5. earliest open dated task wins", () => {
  const tasks = new Map([
    [
      L1,
      [
        task({ taskId: T2, leadId: L1, dueAtIso: "2026-07-15T10:00:00.000Z", title: "Later" }),
        task({ taskId: T1, leadId: L1, dueAtIso: "2026-07-13T10:00:00.000Z", title: "Soon" }),
      ],
    ],
  ]);
  const p = build([kanban({ id: L1 })], { tasksByLeadId: tasks });
  const c = findCard(p, L1)!;
  assert.equal(c.nextAction.kind, "task");
  assert.equal(c.nextAction.sourceId, T1);
  assert.equal(c.nextAction.label, "Soon");
});

test("6. equal task dates use task ID", () => {
  const due = "2026-07-13T10:00:00.000Z";
  const tasks = new Map([
    [
      L1,
      [
        task({ taskId: T2, leadId: L1, dueAtIso: due }),
        task({ taskId: T1, leadId: L1, dueAtIso: due }),
      ],
    ],
  ]);
  const p = build([kanban({ id: L1 })], { tasksByLeadId: tasks });
  assert.equal(findCard(p, L1)!.nextAction.sourceId, T1);
});

test("7. task with no date follows dated tasks", () => {
  const tasks = new Map([
    [
      L1,
      [
        task({ taskId: T2, leadId: L1, dueAtIso: null, title: "No date" }),
        task({ taskId: T1, leadId: L1, dueAtIso: "2026-07-13T10:00:00.000Z", title: "Dated" }),
      ],
    ],
  ]);
  const p = build([kanban({ id: L1 })], { tasksByLeadId: tasks });
  assert.equal(findCard(p, L1)!.nextAction.sourceId, T1);
  assert.equal(findCard(p, L1)!.nextAction.kind, "task");
});

test("8. communication hint cannot override task", () => {
  const tasks = new Map([
    [L1, [task({ taskId: T1, leadId: L1, dueAtIso: "2026-07-13T10:00:00.000Z" })]],
  ]);
  const comms = new Map<string, PipelineCommunicationHintInput[]>([
    [
      L1,
      [
        {
          communicationId: "c1",
          leadId: L1,
          nextFollowUpAtIso: "2026-07-10T10:00:00.000Z",
        },
      ],
    ],
  ]);
  const p = build([kanban({ id: L1 })], {
    tasksByLeadId: tasks,
    communicationsByLeadId: comms,
  });
  assert.equal(findCard(p, L1)!.nextAction.kind, "task");
  assert.equal(findCard(p, L1)!.nextAction.sourceId, T1);
});

test("9. communication hint used when no stronger action exists", () => {
  const comms = new Map<string, PipelineCommunicationHintInput[]>([
    [
      L1,
      [
        {
          communicationId: "c1",
          leadId: L1,
          nextFollowUpAtIso: "2026-07-14T10:00:00.000Z",
        },
      ],
    ],
  ]);
  const p = build([kanban({ id: L1 })], {
    tasksByLeadId: new Map([[L1, []]]),
    communicationsByLeadId: comms,
  });
  const c = findCard(p, L1)!;
  assert.equal(c.nextAction.kind, "communication_hint");
  assert.equal(c.nextAction.sourceId, "c1");
});

test("10. completed task not selected", () => {
  const tasks = new Map([
    [
      L1,
      [
        task({
          taskId: T1,
          leadId: L1,
          dueAtIso: "2026-07-10T10:00:00.000Z",
          completedAtIso: "2026-07-11T10:00:00.000Z",
          title: "Done",
        }),
        task({
          taskId: T2,
          leadId: L1,
          dueAtIso: "2026-07-15T10:00:00.000Z",
          title: "Open",
        }),
      ],
    ],
  ]);
  const p = build([kanban({ id: L1 })], { tasksByLeadId: tasks });
  assert.equal(findCard(p, L1)!.nextAction.sourceId, T2);
});

test("11. overdue state derives from canonical task rules", () => {
  const tasks = new Map([
    [
      L1,
      [task({ taskId: T1, leadId: L1, dueAtIso: "2026-07-10T10:00:00.000Z" })],
    ],
  ]);
  const p = build([kanban({ id: L1 })], { tasksByLeadId: tasks });
  const c = findCard(p, L1)!;
  assert.equal(c.nextAction.overdue, true);
  assert.equal(c.followUps.overdueCount, 1);
  assert.ok(c.urgency.flags.includes("overdue_follow_up"));
});

test("12. one task appears in one bucket", () => {
  const tasks = new Map([
    [
      L1,
      [
        task({ taskId: T1, leadId: L1, dueAtIso: "2026-07-10T10:00:00.000Z" }),
        task({ taskId: T2, leadId: L1, dueAtIso: "2026-07-12T15:00:00.000Z" }),
        task({ taskId: T3, leadId: L1, dueAtIso: "2026-07-20T10:00:00.000Z" }),
      ],
    ],
  ]);
  const p = build([kanban({ id: L1 })], { tasksByLeadId: tasks });
  const ids = [
    ...p.followUps.buckets.overdue,
    ...p.followUps.buckets.dueToday,
    ...p.followUps.buckets.upcoming,
    ...p.followUps.buckets.noDueDate,
    ...p.followUps.buckets.completed,
  ].map((i) => i.taskId);
  assert.equal(ids.length, 3);
  assert.equal(new Set(ids).size, 3);
  assert.equal(p.followUps.buckets.overdue.map((i) => i.taskId).join(), T1);
  assert.equal(p.followUps.buckets.dueToday.map((i) => i.taskId).join(), T2);
  assert.equal(p.followUps.buckets.upcoming.map((i) => i.taskId).join(), T3);
});

test("13. orphan task is reported and creates no card", () => {
  const tasks = new Map([
    [L2, [task({ taskId: T1, leadId: L2 })]],
  ]);
  const p = build([kanban({ id: L1 })], { tasksByLeadId: tasks });
  assert.deepEqual(p.diagnostics.orphanTaskIds, [T1]);
  assert.equal(allCards(p).length, 1);
});

// --- Consultation -----------------------------------------------------------

test("14. multiple consultations remain one card", () => {
  const consults = new Map<string, PipelineConsultationInput[]>([
    [
      L1,
      [
        {
          bookingId: "b1",
          startAtIso: "2026-07-01T10:00:00.000Z",
          status: "completed",
        },
        {
          bookingId: "b2",
          startAtIso: "2026-07-20T10:00:00.000Z",
          status: "scheduled",
        },
      ],
    ],
  ]);
  const p = build([kanban({ id: L1 })], {
    tasksByLeadId: new Map(),
    consultationsByLeadId: consults,
  });
  assert.equal(allCards(p).length, 1);
  assert.equal(findCard(p, L1)!.consultation.state, "booked");
});

test("15. future consultation beats completed past consultation", () => {
  const s = resolveConsultationSummary(
    [
      {
        bookingId: "old",
        startAtIso: "2026-07-01T10:00:00.000Z",
        status: "completed",
        consultationId: "c-old",
      },
      {
        bookingId: "new",
        startAtIso: "2026-07-20T10:00:00.000Z",
        status: "confirmed",
      },
    ],
    NOW_MS
  );
  assert.equal(s.state, "booked");
  assert.equal(s.nextBookingId, "new");
  assert.equal(s.lastConsultationId, "c-old");
});

test("16. no-show followed by future booking resolves to booked", () => {
  const s = resolveConsultationSummary(
    [
      {
        bookingId: "ns",
        startAtIso: "2026-07-05T10:00:00.000Z",
        status: "no_show",
      },
      {
        bookingId: "rebook",
        startAtIso: "2026-07-18T10:00:00.000Z",
        status: "scheduled",
      },
    ],
    NOW_MS
  );
  assert.equal(s.state, "booked");
  assert.equal(s.nextBookingId, "rebook");
});

test("17. cancelled-only consultation resolves to cancelled", () => {
  const s = resolveConsultationSummary(
    [
      {
        bookingId: "cx",
        startAtIso: "2026-07-05T10:00:00.000Z",
        status: "cancelled",
        cancelledAtIso: "2026-07-04T10:00:00.000Z",
      },
    ],
    NOW_MS
  );
  assert.equal(s.state, "cancelled");
  assert.equal(s.nextBookingId, null);
});

// --- Conversion / lifecycle -------------------------------------------------

test("18. converted lead links patient", () => {
  const p = build([
    kanban({
      id: L1,
      slug: "won_closed",
      status: "converted",
      patientId: P1,
      convertedAt: "2026-07-08T10:00:00.000Z",
    }),
  ]);
  const c = findCard(p, L1)!;
  assert.equal(c.lifecycle.state, "converted");
  assert.equal(c.conversion.patientId, P1);
  assert.ok(c.links.patient?.includes(P1));
  assert.ok(c.secondaryActions.includes("open_patient") || c.primaryAction === "open_patient");
});

test("19. converted lead without patient produces warning", () => {
  const p = build([
    kanban({
      id: L1,
      slug: "won_closed",
      status: "converted",
      patientId: null,
      convertedAt: "2026-07-08T10:00:00.000Z",
    }),
  ]);
  const c = findCard(p, L1)!;
  assert.equal(c.lifecycle.state, "converted");
  assert.ok(c.lifecycle.warningCodes.includes("converted_stage_without_patient"));
  assert.ok(
    p.diagnostics.conversionInconsistencies.some(
      (x) => x.leadId === L1 && x.kind === "converted_stage_without_patient"
    )
  );
});

test("20. lost lead retains reason", () => {
  const p = build([
    kanban({
      id: L1,
      slug: "lost",
      status: "lost",
      metadata: { lost_reason: "Budget" },
    }),
  ]);
  const c = findCard(p, L1)!;
  assert.equal(c.lifecycle.state, "lost");
  assert.equal(c.conversion.lostReason, "Budget");
});

// --- Owner ------------------------------------------------------------------

test("21. lead owner and task assignee remain separate", () => {
  const tasks = new Map([
    [
      L1,
      [
        task({
          taskId: T1,
          leadId: L1,
          dueAtIso: "2026-07-13T10:00:00.000Z",
          assigneeUserId: "assignee-other",
          assigneeDisplayName: "Other Staff",
        }),
      ],
    ],
  ]);
  const p = build([kanban({ id: L1, ownerId: U1, ownerEmail: "owner@example.com" })], {
    tasksByLeadId: tasks,
  });
  const c = findCard(p, L1)!;
  assert.equal(c.owner.userId, U1);
  assert.notEqual(c.owner.userId, "assignee-other");
  const item = p.followUps.buckets.upcoming[0]!;
  assert.equal(item.assignee.userId, "assignee-other");
});

test("22. missing owner becomes Unassigned", () => {
  const p = build([kanban({ id: L1, ownerId: null })]);
  const c = findCard(p, L1)!;
  assert.equal(c.owner.unassigned, true);
  assert.ok(c.urgency.flags.includes("unassigned"));
});

test("23. multiple leads for one person remain separate", () => {
  const p = build([
    kanban({ id: L1, personId: "same-person", slug: "new" }),
    kanban({ id: L2, personId: "same-person", slug: "qualified" }),
  ]);
  assert.equal(allCards(p).length, 2);
  assert.ok(findCard(p, L1));
  assert.ok(findCard(p, L2));
});

// --- Stage / lifecycle columns ---------------------------------------------

test("24. unknown stage uses S4.1 fallback and diagnostic", () => {
  const p = build([kanban({ id: L1, slug: "tenant_custom_lane" })]);
  const c = findCard(p, L1)!;
  assert.equal(c.stage.staffColumnId, "qualified");
  assert.ok(p.diagnostics.unknownStageLeadIds.includes(L1));
});

test("25. nurture remains holding", () => {
  const p = build([kanban({ id: L1, slug: "nurture" })]);
  const c = findCard(p, L1)!;
  assert.equal(c.lifecycle.state, "holding");
  assert.equal(c.stage.staffColumnId, "nurture");
  const col = p.columns.find((x) => x.id === "nurture")!;
  assert.equal(col.kind, "holding");
  assert.equal(col.collapsedByDefault, true);
});

test("26. converted remains terminal won", () => {
  const p = build([
    kanban({
      id: L1,
      slug: "won_closed",
      status: "converted",
      patientId: P1,
      convertedAt: "2026-07-08T10:00:00.000Z",
    }),
  ]);
  const col = p.columns.find((x) => x.id === "converted")!;
  assert.equal(col.kind, "terminal_won");
  assert.equal(findCard(p, L1)!.lifecycle.state, "converted");
});

test("27. lost remains terminal lost", () => {
  const p = build([kanban({ id: L1, slug: "lost", status: "lost" })]);
  const col = p.columns.find((x) => x.id === "closed_lost")!;
  assert.equal(col.kind, "terminal_lost");
  assert.equal(findCard(p, L1)!.lifecycle.state, "lost");
});

test("28. archived follows agreed visibility (excluded from columns)", () => {
  const p = build([
    kanban({ id: L1, slug: "qualified", status: "archived" }),
    kanban({ id: L2, slug: "qualified", status: "open" }),
  ]);
  assert.equal(findCard(p, L1), null);
  assert.ok(findCard(p, L2));
  assert.equal(p.summary.archived, 1);
  assert.equal(p.summary.totalLeads, 1);
});

// --- Blockers / actions / sort ---------------------------------------------

test("29. strongest blocker wins deterministically", () => {
  const p = build([
    kanban({
      id: L1,
      ownerId: null,
      personMeta: { full_name: "No Contact" },
    }),
  ]);
  const c = findCard(p, L1)!;
  assert.ok(c.blockers.length >= 2);
  assert.equal(c.blockers[0]!.severity, "blocker");
  assert.equal(c.blockers[0]!.kind, "no_contact");
  assert.equal(c.urgency.highest, "blocker");
});

test("30. secondary blockers remain", () => {
  const p = build([
    kanban({
      id: L1,
      ownerId: null,
      personMeta: { full_name: "No Contact" },
    }),
  ]);
  const kinds = findCard(p, L1)!.blockers.map((b) => b.kind);
  assert.ok(kinds.includes("no_contact"));
  assert.ok(kinds.includes("no_owner"));
});

test("31. read-only actions are navigation-only", () => {
  const p = build([kanban({ id: L1, patientId: P1 })], {
    permissions: { canMutate: false, canConvert: false },
  });
  const c = findCard(p, L1)!;
  assert.equal(c.primaryAction, "open_lead");
  for (const a of [c.primaryAction, ...c.secondaryActions]) {
    assert.ok(a === "open_lead" || a === "open_patient");
  }
});

test("32. mutating actions respect permissions", () => {
  const p = build([kanban({ id: L1 })], {
    permissions: { canMutate: true, canConvert: false, canBookConsultation: false },
  });
  const acts = [findCard(p, L1)!.primaryAction, ...findCard(p, L1)!.secondaryActions];
  assert.ok(acts.includes("contact"));
  assert.ok(!acts.includes("convert"));
  assert.ok(!acts.includes("book_consultation"));
});

test("33. complete follow-up requires an open task", () => {
  const withTask = build([kanban({ id: L1 })], {
    tasksByLeadId: new Map([
      [L1, [task({ taskId: T1, leadId: L1, dueAtIso: "2026-07-13T10:00:00.000Z" })]],
    ]),
  });
  assert.ok(
    [withTask.columns[0] && findCard(withTask, L1)!.primaryAction, ...findCard(withTask, L1)!.secondaryActions].includes(
      "complete_follow_up"
    )
  );

  const noTask = build([kanban({ id: L1 })], {
    tasksByLeadId: new Map([[L1, []]]),
  });
  const acts = [findCard(noTask, L1)!.primaryAction, ...findCard(noTask, L1)!.secondaryActions];
  assert.ok(!acts.includes("complete_follow_up"));
});

test("34. equal card priority uses S4.1 lead-ID fallback", () => {
  const p = build([
    kanban({ id: L2, slug: "qualified", createdAt: "2026-07-01T10:00:00.000Z" }),
    kanban({ id: L1, slug: "qualified", createdAt: "2026-07-01T10:00:00.000Z" }),
  ]);
  const col = p.columns.find((c) => c.id === "qualified")!;
  assert.equal(col.cards[0]!.leadId, L1);
  assert.equal(col.cards[1]!.leadId, L2);
});

test("35. invalid dates fail safely", () => {
  const tasks = new Map([
    [
      L1,
      [
        task({ taskId: T1, leadId: L1, dueAtIso: "not-a-date" }),
        task({ taskId: T2, leadId: L1, dueAtIso: "2026-07-13T10:00:00.000Z" }),
      ],
    ],
  ]);
  const p = build([kanban({ id: L1 })], { tasksByLeadId: tasks });
  assert.equal(findCard(p, L1)!.nextAction.sourceId, T2);
});

test("36. source truncation reports hidden count", () => {
  const p = build([kanban({ id: L1 }), kanban({ id: L2 })], {
    sourceTotal: 50,
  });
  assert.equal(p.diagnostics.sourceLeadCount, 50);
  assert.equal(p.diagnostics.visibleLeadCount, 2);
  assert.equal(p.diagnostics.hiddenLeadCount, 48);
});

test("37. empty input returns valid empty presentation", () => {
  const p = build([]);
  assert.equal(p.columns.length, 9);
  assert.equal(allCards(p).length, 0);
  assert.equal(p.summary.totalLeads, 0);
  assert.equal(p.followUps.summary.overdue, 0);
  assert.equal(p.diagnostics.visibleLeadCount, 0);
});

test("38. repeated input produces identical output", () => {
  const leads = [
    kanban({ id: L1, slug: "new" }),
    kanban({ id: L2, slug: "qualified", isHighValue: true }),
  ];
  const tasks = new Map([
    [L1, [task({ taskId: T1, leadId: L1, dueAtIso: "2026-07-10T10:00:00.000Z" })]],
  ]);
  const a = build(leads, { tasksByLeadId: tasks });
  const b = build(leads, { tasksByLeadId: tasks });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("39. diagnostics contain IDs/counts only", () => {
  const p = build(
    [
      kanban({
        id: L1,
        personMeta: { full_name: "Secret Name", email: "secret@example.com", phone: "555" },
        slug: "tenant_x",
      }),
    ],
    {
      tasksByLeadId: new Map([[L2, [task({ taskId: T1, leadId: L2 })]]]),
      sourceTotal: 10,
    }
  );
  const d = JSON.stringify(p.diagnostics);
  assert.ok(!d.includes("Secret Name"));
  assert.ok(!d.includes("secret@example.com"));
  assert.ok(!d.includes("555"));
  assert.ok(d.includes(L1) || p.diagnostics.unknownStageLeadIds.includes(L1));
});

test("40. staff labels contain no LeadFlow, technical CRM or OS terminology", () => {
  const banned = /leadflow|\bcrm\b|command centre|command center|\bos\b/i;
  for (const col of PIPELINE_STAFF_COLUMNS) {
    assert.doesNotMatch(col.label, banned);
  }
  const p = build([kanban({ id: L1 })]);
  for (const col of p.columns) {
    assert.doesNotMatch(col.label, banned);
  }
  for (const a of p.actions) {
    assert.doesNotMatch(a.label, banned);
  }
});

test("shell tier does not claim next follow-up date", () => {
  const p = build([kanban({ id: L1, overdueTaskCount: 3 })]);
  assert.equal(p.loadTier, "shell");
  const c = findCard(p, L1)!;
  assert.equal(c.nextAction.kind, "none");
  assert.equal(c.nextAction.dueAtIso, null);
  assert.equal(c.followUps.overdueCount, 3);
});

test("booking before undated task matches deriveCrmLeadNextAction order", () => {
  const tasks = new Map([
    [L1, [task({ taskId: T1, leadId: L1, dueAtIso: null, title: "Call sometime" })]],
  ]);
  const consults = new Map<string, PipelineConsultationInput[]>([
    [
      L1,
      [
        {
          bookingId: "b1",
          startAtIso: "2026-07-20T10:00:00.000Z",
          status: "scheduled",
        },
      ],
    ],
  ]);
  const p = build([kanban({ id: L1 })], {
    tasksByLeadId: tasks,
    consultationsByLeadId: consults,
  });
  assert.equal(findCard(p, L1)!.nextAction.kind, "appointment");
});

test("nine staff columns always present", () => {
  const p = build([]);
  assert.deepEqual(
    p.columns.map((c) => c.id),
    PIPELINE_STAFF_COLUMNS.map((c) => c.id)
  );
});
