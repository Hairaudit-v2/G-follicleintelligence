/**
 * FI-UX-REBUILD-1 S4.4 — pipeline dual-run comparison tests.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { buildPipelinePresentation } from "@/src/lib/crm/pipelinePresentation";
import type {
  PipelineCommunicationHintInput,
  PipelineTaskInput,
} from "@/src/lib/crm/pipelinePresentation.types";
import {
  comparePipelineDualRun,
  isPipelineDualRunReasonApproved,
  pipelineDualRunContainsPhi,
  PIPELINE_DUAL_RUN_APPROVED_REASONS,
} from "@/src/lib/crm/pipelineDualRunComparison";
import type { CrmKanbanLeadCard, FiCrmLeadRow } from "@/src/lib/crm/types";

const NOW_MS = Date.parse("2026-07-12T12:00:00.000Z");
const BASE = "/fi-admin/22222222-2222-4222-8222-222222222222";
const TENANT = "22222222-2222-4222-8222-222222222222";
const L1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const L2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const L3 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const U1 = "uuuuuuuu-uuuu-4uuu-8uuu-uuuuuuuuuuuu";

function leadRow(partial: Partial<FiCrmLeadRow> & Pick<FiCrmLeadRow, "id">): FiCrmLeadRow {
  return {
    id: partial.id,
    tenant_id: TENANT,
    organisation_id: null,
    clinic_id: null,
    person_id: partial.person_id ?? "person-1",
    patient_id: partial.patient_id ?? null,
    case_id: null,
    current_stage_id: partial.current_stage_id ?? "stage-1",
    primary_owner_user_id: partial.primary_owner_user_id ?? U1,
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

function kanban(partial: {
  id: string;
  slug?: string;
  ownerId?: string | null;
  status?: string;
  overdueTaskCount?: number;
  patientId?: string | null;
  convertedAt?: string | null;
}): CrmKanbanLeadCard {
  const slug = partial.slug ?? "qualified";
  return {
    lead: leadRow({
      id: partial.id,
      primary_owner_user_id: partial.ownerId === undefined ? U1 : partial.ownerId,
      status: partial.status ?? "open",
      patient_id: partial.patientId ?? null,
      converted_at: partial.convertedAt ?? null,
    }),
    stage: { id: `stage-${slug}`, slug, label: slug, sort_order: 20 },
    person: { id: "person-1", metadata: { display_name: "Test Person" } },
    owner: partial.ownerId ? { id: partial.ownerId, email: "owner@test.invalid" } : null,
    patient: partial.patientId ? { id: partial.patientId } : null,
    clinicalSummaryLine: null,
    norwoodScale: null,
    ludwigScale: null,
    primaryConcernLine: null,
    daysInStage: 1,
    stageEnteredAtIso: "2026-07-01T10:00:00.000Z",
    lastActivityAtIso: "2026-07-01T10:00:00.000Z",
    overdueTaskCount: partial.overdueTaskCount ?? 0,
    isHighValue: false,
  };
}

function buildPipeline(
  cards: CrmKanbanLeadCard[],
  opts?: {
    tasksByLeadId?: Map<string, PipelineTaskInput[]>;
    communicationsByLeadId?: Map<string, PipelineCommunicationHintInput[]>;
    sourceTotal?: number;
  }
) {
  return buildPipelinePresentation({
    leads: cards,
    tasksByLeadId: opts?.tasksByLeadId,
    communicationsByLeadId: opts?.communicationsByLeadId,
    nowMs: NOW_MS,
    base: BASE,
    permissions: { canMutate: true, canConvert: true, canBookConsultation: true },
    sourceTotal: opts?.sourceTotal,
  });
}

function compare(cards: CrmKanbanLeadCard[], pipeline: ReturnType<typeof buildPipeline>) {
  return comparePipelineDualRun({
    legacyCards: cards,
    legacyStages: [],
    pipeline,
    tenantId: TENANT,
    nowMs: NOW_MS,
  });
}

test("1 exact lead-ID parity passes", () => {
  const cards = [kanban({ id: L1 }), kanban({ id: L2, slug: "contacted" })];
  const pipeline = buildPipeline(cards);
  const result = compare(cards, pipeline);
  assert.equal(result.pass, true);
  assert.deepEqual(result.missingFromPipeline, []);
  assert.deepEqual(result.extraInPipeline, []);
});

test("2 missing lead fails", () => {
  const cards = [kanban({ id: L1 }), kanban({ id: L2 })];
  const pipeline = buildPipeline([kanban({ id: L1 })]);
  const result = compare(cards, pipeline);
  assert.equal(result.pass, false);
  assert.deepEqual(result.missingFromPipeline, [L2]);
});

test("3 extra lead fails", () => {
  const cards = [kanban({ id: L1 })];
  const pipeline = buildPipeline([kanban({ id: L1 }), kanban({ id: L2 })]);
  const result = compare(cards, pipeline);
  assert.equal(result.pass, false);
  assert.deepEqual(result.extraInPipeline, [L2]);
});

test("4 duplicate Pipeline card fails", () => {
  const cards = [kanban({ id: L1 })];
  const pipeline = buildPipeline(cards);
  const col = pipeline.columns.find((c) => c.cards.some((card) => card.leadId === L1))!;
  col.cards.push({ ...col.cards[0]! });
  col.count += 1;
  const result = compare(cards, pipeline);
  assert.equal(result.pass, false);
  assert.deepEqual(result.duplicatePipelineLeadIds, [L1]);
});

test("5 default backend-stage grouping passes as intentional", () => {
  const cards = [kanban({ id: L1, slug: "consult_scheduled" })];
  const pipeline = buildPipeline(cards);
  const result = compare(cards, pipeline);
  assert.equal(result.pass, true);
  const grouped = result.stageMismatches.find((m) => m.reason === "grouped_backend_stage");
  assert.ok(grouped || result.stageMismatches.every((m) => m.expected));
});

test("6 unknown-stage fallback is explicitly classified", () => {
  const cards = [kanban({ id: L1, slug: "totally_unknown_slug" })];
  const pipeline = buildPipeline(cards);
  const result = compare(cards, pipeline);
  const fallback = result.stageMismatches.find((m) => m.reason === "unknown_stage_fallback");
  assert.ok(fallback);
  assert.equal(fallback!.expected, true);
  assert.equal(result.pass, true);
});

test("7 unexplained stage mismatch fails", () => {
  const cards = [kanban({ id: L1, slug: "qualified" })];
  const pipeline = buildPipeline(cards);
  const card = pipeline.columns.flatMap((c) => c.cards).find((c) => c.leadId === L1)!;
  card.stage.staffColumnId = "new";
  const result = compare(cards, pipeline);
  assert.equal(result.pass, false);
  assert.ok(result.stageMismatches.some((m) => !m.expected));
});

test("8 owner mismatch fails", () => {
  const cards = [kanban({ id: L1, ownerId: U1 })];
  const pipeline = buildPipeline([kanban({ id: L1, ownerId: L2 })]);
  const result = compare(cards, pipeline);
  assert.equal(result.pass, false);
  assert.deepEqual(result.ownerMismatches, [L1]);
});

test("9 converted/lost mismatch fails", () => {
  const cards = [kanban({ id: L1, status: "open" })];
  const pipeline = buildPipeline([kanban({ id: L1, status: "lost" })]);
  const result = compare(cards, pipeline);
  assert.equal(result.pass, false);
  assert.ok(result.conversionMismatches.includes(L1));
});

test("10 overdue mismatch fails on full tier", () => {
  const cards = [kanban({ id: L1, overdueTaskCount: 2 })];
  const tasks = new Map<string, PipelineTaskInput[]>([
    [
      L1,
      [
        {
          taskId: "t1",
          leadId: L1,
          title: "Call",
          status: "open",
          dueAtIso: "2026-07-10T10:00:00.000Z",
          completedAtIso: null,
          assigneeUserId: null,
        },
      ],
    ],
  ]);
  const pipeline = buildPipeline(cards, { tasksByLeadId: tasks });
  assert.equal(pipeline.loadTier, "full");
  const result = compare(cards, pipeline);
  assert.equal(result.pass, false);
  assert.ok(result.overdueMismatches.includes(L1));
});

test("11 communication-hint ordering difference is intentional", () => {
  const cards = [kanban({ id: L1 })];
  const comms = new Map<string, PipelineCommunicationHintInput[]>([
    [
      L1,
      [
        {
          communicationId: "c1",
          leadId: L1,
          nextFollowUpAtIso: "2026-07-15T10:00:00.000Z",
        },
      ],
    ],
  ]);
  const pipeline = buildPipeline(cards, { communicationsByLeadId: comms });
  const result = compare(cards, pipeline);
  const hint = result.nextActionMismatches.find(
    (m) => m.reason === "communication_hint_after_task"
  );
  assert.ok(hint);
  assert.equal(hint!.expected, true);
  assert.equal(result.pass, true);
});

test("12 arbitrary expected difference without approved reason fails guard", () => {
  assert.equal(isPipelineDualRunReasonApproved("made_up_reason"), false);
  assert.equal(isPipelineDualRunReasonApproved("communication_hint_after_task"), true);
  for (const r of PIPELINE_DUAL_RUN_APPROVED_REASONS) {
    assert.equal(isPipelineDualRunReasonApproved(r), true);
  }
});

test("13 hidden count is reported", () => {
  const cards = [kanban({ id: L1 })];
  const pipeline = buildPipeline(cards, { sourceTotal: 50 });
  const result = compare(cards, pipeline);
  assert.equal(result.hiddenLeadCount, 49);
});

test("14 orphan task IDs are reported", () => {
  const cards = [kanban({ id: L1 })];
  const tasks = new Map<string, PipelineTaskInput[]>([
    [
      L3,
      [
        {
          taskId: "orphan-1",
          leadId: L3,
          title: "Orphan",
          status: "open",
          dueAtIso: null,
          completedAtIso: null,
          assigneeUserId: null,
        },
      ],
    ],
  ]);
  const pipeline = buildPipeline(cards, { tasksByLeadId: tasks });
  const result = compare(cards, pipeline);
  assert.deepEqual(result.orphanTaskIds, ["orphan-1"]);
});

test("15 diagnostics contain no PHI", () => {
  const cards = [kanban({ id: L1 })];
  const pipeline = buildPipeline(cards);
  const result = compare(cards, pipeline);
  assert.equal(pipelineDualRunContainsPhi(result), false);
});

test("16 repeated inputs return identical comparison output", () => {
  const cards = [kanban({ id: L1 }), kanban({ id: L2, slug: "new" })];
  const pipeline = buildPipeline(cards);
  const a = compare(cards, pipeline);
  const b = compare(cards, pipeline);
  assert.deepEqual(a, b);
});
