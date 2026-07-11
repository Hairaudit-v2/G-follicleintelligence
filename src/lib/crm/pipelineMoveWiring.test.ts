/**
 * S4.3C — mutation wiring contract tests (pure resolution + call shape).
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { defaultHairRestorationPipelineDefinitions } from "@/src/lib/crm/pipelineSeedPayload";
import {
  resolvePipelineColumnEntryStage,
  type PipelineMoveStageDefinition,
} from "@/src/lib/crm/pipelineMoveTarget";
import type { PipelineStaffColumnId } from "@/src/lib/crm/pipelineStaffModel";

function stages(): PipelineMoveStageDefinition[] {
  return defaultHairRestorationPipelineDefinitions().map((d) => ({
    id: `uuid-${d.slug}`,
    slug: d.slug,
    label: d.label,
    sortOrder: d.sort_order,
    isEntry: d.is_entry,
    isWon: d.is_won,
    isLost: d.is_lost,
  }));
}

test("move stage resolves real stage ID never staff column ID", () => {
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
    const r = resolvePipelineColumnEntryStage(col, stages());
    assert.equal(r.ok, true, col);
    if (r.ok) {
      assert.notEqual(r.stageId, col);
      assert.ok(r.stageId.startsWith("uuid-"));
      // Simulated mutation body
      const body = { toStageId: r.stageId, source: "pipeline_workspace" };
      assert.equal(body.toStageId, r.stageId);
      assert.notEqual(body.toStageId, col);
    }
  }
});

test("terminal columns are not ordinary move destinations", () => {
  for (const col of ["converted", "closed_lost"] as const) {
    const r = resolvePipelineColumnEntryStage(col, stages());
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error, "terminal_column_requires_special_action");
  }
});

test("injected move runner receives only real stage IDs", async () => {
  const calls: Array<{ leadId: string; toStageId: string }> = [];
  const moveLeadStage = async (
    _tenantId: string,
    leadId: string,
    body: { toStageId: string }
  ) => {
    calls.push({ leadId, toStageId: body.toStageId });
    return { ok: true as const };
  };

  const r = resolvePipelineColumnEntryStage("consultation", stages());
  assert.equal(r.ok, true);
  if (!r.ok) return;

  const result = await moveLeadStage("tenant", "lead-1", { toStageId: r.stageId });
  assert.equal(result.ok, true);
  assert.equal(calls[0]!.toStageId, "uuid-consult_scheduled");
  assert.notEqual(calls[0]!.toStageId, "consultation");
});

test("missing destination disables rather than guessing", () => {
  const r = resolvePipelineColumnEntryStage("consultation", [
    {
      id: "only-qualified",
      slug: "qualified",
      label: "Qualified",
      sortOrder: 20,
      isEntry: false,
      isWon: false,
      isLost: false,
    },
  ]);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, "no_backend_stage_for_column");
});
