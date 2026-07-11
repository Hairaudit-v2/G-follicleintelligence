/**
 * S4.3A — grouped column destination resolver tests.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { defaultHairRestorationPipelineDefinitions } from "@/src/lib/crm/pipelineSeedPayload";
import {
  pipelineMoveableStaffColumns,
  resolvePipelineColumnEntryStage,
  type PipelineMoveStageDefinition,
} from "@/src/lib/crm/pipelineMoveTarget";
import type { PipelineStaffColumnId } from "@/src/lib/crm/pipelineStaffModel";

function fromDefaults(): PipelineMoveStageDefinition[] {
  return defaultHairRestorationPipelineDefinitions().map((d) => ({
    id: `stage-uuid-${d.slug}`,
    slug: d.slug,
    label: d.label,
    sortOrder: d.sort_order,
    isEntry: d.is_entry,
    isWon: d.is_won,
    isLost: d.is_lost,
  }));
}

function stage(
  partial: Partial<PipelineMoveStageDefinition> &
    Pick<PipelineMoveStageDefinition, "id" | "slug">
): PipelineMoveStageDefinition {
  return {
    id: partial.id,
    slug: partial.slug,
    label: partial.label ?? partial.slug,
    sortOrder: partial.sortOrder ?? 0,
    isEntry: partial.isEntry ?? false,
    isWon: partial.isWon ?? false,
    isLost: partial.isLost ?? false,
    archived: partial.archived,
  };
}

test("1. consultation resolves to consult_scheduled", () => {
  const r = resolvePipelineColumnEntryStage("consultation", fromDefaults());
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.slug, "consult_scheduled");
    assert.equal(r.stageId, "stage-uuid-consult_scheduled");
    assert.equal(r.columnId, "consultation");
  }
});

test("2. planning/quote resolves to treatment_planning", () => {
  const r = resolvePipelineColumnEntryStage("planning_quote", fromDefaults());
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.slug, "treatment_planning");
    assert.equal(r.stageId, "stage-uuid-treatment_planning");
  }
});

test("3. booked/deposit resolves to deposit_or_booked", () => {
  const r = resolvePipelineColumnEntryStage("booked_deposit", fromDefaults());
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.slug, "deposit_or_booked");
    assert.equal(r.stageId, "stage-uuid-deposit_or_booked");
  }
});

test("4. lowest sort order wins", () => {
  const stages = [
    stage({ id: "later", slug: "consult_completed", sortOrder: 40 }),
    stage({ id: "earlier", slug: "consult_scheduled", sortOrder: 30 }),
  ];
  const r = resolvePipelineColumnEntryStage("consultation", stages);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.stageId, "earlier");
    assert.equal(r.slug, "consult_scheduled");
  }
});

test("5. equal sort order uses slug then stage ID", () => {
  // Same sort order: slug asc then stage id asc (quote_sent before treatment_planning).
  const equal = [
    stage({ id: "id-b", slug: "quote_sent", sortOrder: 50 }),
    stage({ id: "id-a", slug: "treatment_planning", sortOrder: 50 }),
  ];
  const r = resolvePipelineColumnEntryStage("planning_quote", equal);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.slug, "quote_sent");
    assert.equal(r.stageId, "id-b");
  }
});

test("6. custom tenant stages mapping to a column resolve safely", () => {
  // Custom stage with isEntry maps to new
  const stages = [
    stage({ id: "custom-entry-uuid", slug: "inbound_web", sortOrder: 0, isEntry: true }),
  ];
  const r = resolvePipelineColumnEntryStage("new", stages);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.stageId, "custom-entry-uuid");
    assert.equal(r.slug, "inbound_web");
  }
});

test("7. archived stage is ignored", () => {
  const stages = [
    stage({
      id: "arch",
      slug: "consult_scheduled",
      sortOrder: 10,
      archived: true,
    }),
    stage({ id: "live", slug: "consult_completed", sortOrder: 40 }),
  ];
  const r = resolvePipelineColumnEntryStage("consultation", stages);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.stageId, "live");
});

test("8. missing destination returns an error", () => {
  const r = resolvePipelineColumnEntryStage("consultation", [
    stage({ id: "q", slug: "qualified", sortOrder: 20 }),
  ]);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.error, "no_backend_stage_for_column");
    assert.equal(r.columnId, "consultation");
  }
});

test("9. converted requires Convert action", () => {
  const r = resolvePipelineColumnEntryStage("converted", fromDefaults());
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.error, "terminal_column_requires_special_action");
    assert.equal(r.columnId, "converted");
  }
});

test("10. closed/lost requires Mark lost", () => {
  const r = resolvePipelineColumnEntryStage("closed_lost", fromDefaults());
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.error, "terminal_column_requires_special_action");
  }
});

test("11. resolver always returns a real tenant stage ID", () => {
  for (const col of pipelineMoveableStaffColumns()) {
    const r = resolvePipelineColumnEntryStage(col, fromDefaults());
    assert.equal(r.ok, true, col);
    if (r.ok) {
      assert.ok(r.stageId.startsWith("stage-uuid-"));
      assert.ok(r.stageId.length > 10);
    }
  }
});

test("12. staff-column IDs are never returned as backend IDs", () => {
  const cols: PipelineStaffColumnId[] = [
    "new",
    "contacting",
    "qualified",
    "consultation",
    "planning_quote",
    "booked_deposit",
    "nurture",
  ];
  for (const col of cols) {
    const r = resolvePipelineColumnEntryStage(col, fromDefaults());
    if (r.ok) {
      assert.notEqual(r.stageId, col);
      assert.notEqual(r.stageId, r.columnId);
    }
  }
});

test("13. input order does not change output", () => {
  const a = fromDefaults();
  const b = [...fromDefaults()].reverse();
  const ra = resolvePipelineColumnEntryStage("consultation", a);
  const rb = resolvePipelineColumnEntryStage("consultation", b);
  assert.deepEqual(ra, rb);
});

test("14. S4.1 fallback stages are not used as intentional destinations", () => {
  // Unknown active slug falls back to qualified column in S4.1 presentation,
  // but must not be selected as the Qualified destination when known stages exist.
  const stages = [
    stage({ id: "fallback-custom", slug: "weird_lane", sortOrder: 1 }),
    stage({ id: "real-qualified", slug: "qualified", sortOrder: 20 }),
  ];
  const r = resolvePipelineColumnEntryStage("qualified", stages);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.stageId, "real-qualified");
    assert.equal(r.slug, "qualified");
  }
});

test("expected default destinations for all moveable columns", () => {
  const expected: Record<string, string> = {
    new: "new",
    contacting: "contacted",
    qualified: "qualified",
    consultation: "consult_scheduled",
    planning_quote: "treatment_planning",
    booked_deposit: "deposit_or_booked",
    nurture: "nurture",
  };
  for (const [col, slug] of Object.entries(expected)) {
    const r = resolvePipelineColumnEntryStage(col as PipelineStaffColumnId, fromDefaults());
    assert.equal(r.ok, true, col);
    if (r.ok) assert.equal(r.slug, slug, col);
  }
});
