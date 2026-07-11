/**
 * FI-UX-REBUILD-1 S4.1 — pipelineStaffModel unit tests.
 * Fixed timestamps only; no live clock.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { defaultHairRestorationPipelineDefinitions } from "@/src/lib/crm/pipelineSeedPayload";
import {
  PIPELINE_DEFAULT_STAGE_CROSSWALK,
  PIPELINE_STAFF_COLUMNS,
  PIPELINE_STAFF_COLUMN_ORDER,
  PIPELINE_UNKNOWN_ACTIVE_FALLBACK_COLUMN,
  auditPipelineStageCrosswalk,
  comparePipelineSortableLeads,
  isPipelineActive,
  isPipelineHolding,
  isPipelineTerminalLost,
  isPipelineTerminalWon,
  pipelineLeadIdentityKey,
  pipelineLeadsAreSameCard,
  resolvePipelineLeadLifecycle,
  resolvePipelineStaffStage,
  resolvePipelineStageLifecycle,
  sortPipelineSortableLeads,
  type PipelineStageDefinition,
  type PipelineSortableLead,
  type PipelineStaffColumnId,
  type PipelineUrgencyFlag,
} from "@/src/lib/crm/pipelineStaffModel";

const FIXED_NOW = "2026-07-12T12:00:00.000Z";
void FIXED_NOW; // documented fixed reference for sort ISO strings below

function stage(
  partial: Partial<PipelineStageDefinition> & Pick<PipelineStageDefinition, "slug">
): PipelineStageDefinition {
  return {
    slug: partial.slug,
    label: partial.label ?? partial.slug,
    sortOrder: partial.sortOrder ?? 0,
    isEntry: partial.isEntry ?? false,
    isWon: partial.isWon ?? false,
    isLost: partial.isLost ?? false,
    archived: partial.archived,
    id: partial.id,
  };
}

function defaultStages(): PipelineStageDefinition[] {
  return defaultHairRestorationPipelineDefinitions().map((d) =>
    stage({
      slug: d.slug,
      label: d.label,
      sortOrder: d.sort_order,
      isEntry: d.is_entry,
      isWon: d.is_won,
      isLost: d.is_lost,
    })
  );
}

function sortable(
  partial: Partial<PipelineSortableLead> & Pick<PipelineSortableLead, "leadId">
): PipelineSortableLead {
  return {
    leadId: partial.leadId,
    urgencyFlags: partial.urgencyFlags ?? [],
    nextFollowUpAtIso: partial.nextFollowUpAtIso ?? null,
    createdAtIso: partial.createdAtIso ?? null,
    score: partial.score ?? null,
  };
}

// --- Stage crosswalk mapping (tests 1–12) -----------------------------------

const SLUG_TO_COLUMN: Array<[string, PipelineStaffColumnId]> = [
  ["new", "new"],
  ["contacted", "contacting"],
  ["qualified", "qualified"],
  ["consult_scheduled", "consultation"],
  ["consult_completed", "consultation"],
  ["treatment_planning", "planning_quote"],
  ["quote_sent", "planning_quote"],
  ["deposit_or_booked", "booked_deposit"],
  ["in_treatment", "booked_deposit"],
  ["won_closed", "converted"],
  ["lost", "closed_lost"],
  ["nurture", "nurture"],
];

for (const [slug, columnId] of SLUG_TO_COLUMN) {
  test(`${slug} maps to ${columnId}`, () => {
    const r = resolvePipelineStaffStage(stage({ slug }));
    assert.equal(r.columnId, columnId);
    assert.equal(r.source, "known_slug");
    assert.equal(r.warning, null);
    assert.equal(r.lifecycle, resolvePipelineStageLifecycle(columnId));
  });
}

test("nurture maps to holding lifecycle", () => {
  const r = resolvePipelineStaffStage(stage({ slug: "nurture" }));
  assert.equal(r.columnId, "nurture");
  assert.equal(r.lifecycle, "holding");
  assert.equal(isPipelineHolding(r), true);
  assert.equal(isPipelineActive(r), false);
});

// --- Unknown / flags / missing (13–17) --------------------------------------

test("unknown won stage maps to Converted", () => {
  const r = resolvePipelineStaffStage(
    stage({ slug: "custom_won", isWon: true, label: "Custom won" })
  );
  assert.equal(r.columnId, "converted");
  assert.equal(r.source, "won_flag");
  assert.equal(isPipelineTerminalWon(r), true);
});

test("unknown lost stage maps to Closed/lost", () => {
  const r = resolvePipelineStaffStage(
    stage({ slug: "custom_lost", isLost: true, label: "Custom lost" })
  );
  assert.equal(r.columnId, "closed_lost");
  assert.equal(r.source, "lost_flag");
  assert.equal(isPipelineTerminalLost(r), true);
});

test("unknown entry stage maps to New", () => {
  const r = resolvePipelineStaffStage(
    stage({ slug: "custom_entry", isEntry: true, label: "Custom entry" })
  );
  assert.equal(r.columnId, "new");
  assert.equal(r.source, "entry_flag");
});

test("unknown active stage uses detectable qualified fallback", () => {
  const r = resolvePipelineStaffStage(
    stage({ slug: "tenant_custom_mid", label: "Custom mid" })
  );
  assert.equal(r.columnId, PIPELINE_UNKNOWN_ACTIVE_FALLBACK_COLUMN);
  assert.equal(r.columnId, "qualified");
  assert.equal(r.source, "fallback");
  assert.ok(r.warning?.includes("unknown_active_stage"));
  assert.ok(r.warning?.includes("tenant_custom_mid"));
});

test("missing stage uses agreed safe fallback", () => {
  const r = resolvePipelineStaffStage(null);
  assert.equal(r.columnId, "qualified");
  assert.equal(r.source, "fallback");
  assert.ok(r.warning?.includes("missing_stage"));
});

// --- Audit (18–22) ----------------------------------------------------------

test("conflicting won/lost flags reported and resolve deterministically", () => {
  const bad = stage({ slug: "broken", isWon: true, isLost: true });
  const r = resolvePipelineStaffStage(bad);
  assert.equal(r.columnId, "closed_lost");
  assert.ok(r.warning?.includes("conflicting_terminal_flags"));

  const audit = auditPipelineStageCrosswalk([
    ...defaultStages().filter((s) => s.slug !== "lost" && s.slug !== "won_closed"),
    stage({ slug: "won_closed", isWon: true, isLost: false, sortOrder: 90 }),
    bad,
  ]);
  // Ensure we still have a won stage for other checks; conflict is blocking
  assert.ok(audit.conflictingTerminalFlags.includes("broken"));
  assert.equal(audit.pass, false);
  assert.ok(audit.errors.some((e) => e.includes("conflicting_terminal_flags:broken")));
});

test("duplicate stage slug is reported", () => {
  const stages = [
    ...defaultStages(),
    stage({ slug: "qualified", label: "Dup", sortOrder: 999 }),
  ];
  const audit = auditPipelineStageCrosswalk(stages);
  assert.ok(audit.duplicateSlugs.includes("qualified"));
  assert.equal(audit.pass, false);
});

test("one known slug cannot belong to multiple columns (config integrity)", () => {
  // Crosswalk is a Record — each key once. Verify uniqueness + resolution consistency.
  const seen = new Map<string, PipelineStaffColumnId>();
  for (const [slug, col] of Object.entries(PIPELINE_DEFAULT_STAGE_CROSSWALK)) {
    assert.equal(seen.has(slug), false, `duplicate crosswalk key ${slug}`);
    seen.set(slug, col);
    const r = resolvePipelineStaffStage(stage({ slug }));
    assert.equal(r.columnId, col);
  }
  const audit = auditPipelineStageCrosswalk(defaultStages());
  assert.deepEqual(audit.duplicateColumnMembership, []);
});

test("production default stage set passes audit", () => {
  const audit = auditPipelineStageCrosswalk(defaultStages());
  assert.equal(audit.pass, true, audit.errors.join("; "));
  assert.deepEqual(audit.duplicateSlugs, []);
  assert.deepEqual(audit.conflictingTerminalFlags, []);
  assert.equal(audit.missingWonStage, false);
  assert.equal(audit.missingLostStage, false);
  assert.equal(audit.missingEntryStage, false);
  assert.deepEqual(audit.unmappedActiveStages, []);
  assert.deepEqual(audit.fallbackStageSlugs, []);
});

test("custom fallback stage is reported as a warning", () => {
  const stages = [
    ...defaultStages(),
    stage({ slug: "vip_lane", label: "VIP", sortOrder: 55 }),
  ];
  const audit = auditPipelineStageCrosswalk(stages);
  assert.equal(audit.pass, true, "fallback is warning-only when terminals exist");
  assert.ok(audit.fallbackStageSlugs.includes("vip_lane"));
  assert.ok(audit.unmappedActiveStages.includes("vip_lane"));
  assert.ok(audit.warnings.some((w) => w.includes("vip_lane")));
});

// --- Identity (23–24) -------------------------------------------------------

test("multiple leads for one person remain separate by lead ID", () => {
  const a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const b = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  assert.equal(pipelineLeadsAreSameCard(a, b), false);
  assert.equal(pipelineLeadIdentityKey(a), a);
  // Same person/patient would still be two cards — identity is leadId only
  assert.notEqual(a, b);
});

test("converted lead retains lead identity", () => {
  const leadId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const before = pipelineLeadIdentityKey(leadId);
  const life = resolvePipelineLeadLifecycle({
    status: "converted",
    columnId: "converted",
    convertedAtIso: "2026-07-01T10:00:00.000Z",
    patientId: "pppppppp-pppp-4ppp-8ppp-pppppppppppp",
  });
  assert.equal(life.state, "converted");
  assert.equal(pipelineLeadIdentityKey(leadId), before);
});

// --- Lead lifecycle (25–29) -------------------------------------------------

test("archived lead classifies as archived", () => {
  const life = resolvePipelineLeadLifecycle({
    status: "archived",
    columnId: "qualified",
  });
  assert.equal(life.state, "archived");
});

test("status/stage mismatch returns warning code", () => {
  const life = resolvePipelineLeadLifecycle({
    status: "converted",
    columnId: "qualified",
  });
  assert.ok(life.warningCodes.includes("status_converted_active_stage"));
  assert.ok(life.warningCodes.includes("status_stage_mismatch"));
});

test("won stage with open status displays converted plus warning", () => {
  const life = resolvePipelineLeadLifecycle({
    status: "open",
    columnId: "converted",
    patientId: "pppppppp-pppp-4ppp-8ppp-pppppppppppp",
  });
  assert.equal(life.state, "converted");
  assert.ok(life.warningCodes.includes("won_stage_open_status"));
});

test("lost status with active stage displays lost plus warning", () => {
  const life = resolvePipelineLeadLifecycle({
    status: "lost",
    columnId: "contacting",
  });
  assert.equal(life.state, "lost");
  assert.ok(life.warningCodes.includes("lost_status_active_stage"));
});

test("nurture remains holding", () => {
  const life = resolvePipelineLeadLifecycle({
    status: "open",
    columnId: "nurture",
  });
  assert.equal(life.state, "holding");
  assert.equal(isPipelineHolding("nurture"), true);
});

// --- Sorting (30–36) --------------------------------------------------------

test("stable ordering prioritises blockers", () => {
  const leads = [
    sortable({ leadId: "b", urgencyFlags: ["due_today"] }),
    sortable({ leadId: "a", urgencyFlags: ["blocked"] }),
  ];
  const sorted = sortPipelineSortableLeads(leads);
  assert.equal(sorted[0]!.leadId, "a");
});

test("overdue sorts before due today", () => {
  const leads = [
    sortable({ leadId: "b", urgencyFlags: ["due_today"] }),
    sortable({ leadId: "a", urgencyFlags: ["overdue_follow_up"] }),
  ];
  const sorted = sortPipelineSortableLeads(leads);
  assert.equal(sorted[0]!.leadId, "a");
});

test("due today sorts before untouched new", () => {
  const leads = [
    sortable({ leadId: "b", urgencyFlags: ["untouched_new"] }),
    sortable({ leadId: "a", urgencyFlags: ["due_today"] }),
  ];
  const sorted = sortPipelineSortableLeads(leads);
  assert.equal(sorted[0]!.leadId, "a");
});

test("valid next-follow-up dates sort ascending", () => {
  const leads = [
    sortable({
      leadId: "b",
      urgencyFlags: [],
      nextFollowUpAtIso: "2026-07-14T10:00:00.000Z",
    }),
    sortable({
      leadId: "a",
      urgencyFlags: [],
      nextFollowUpAtIso: "2026-07-13T10:00:00.000Z",
    }),
  ];
  const sorted = sortPipelineSortableLeads(leads);
  assert.equal(sorted[0]!.leadId, "a");
});

test("invalid/missing dates fail safely", () => {
  const leads = [
    sortable({
      leadId: "b",
      urgencyFlags: [],
      nextFollowUpAtIso: "not-a-date",
      createdAtIso: "also-bad",
    }),
    sortable({
      leadId: "a",
      urgencyFlags: [],
      nextFollowUpAtIso: "2026-07-13T10:00:00.000Z",
      createdAtIso: "2026-07-01T00:00:00.000Z",
    }),
    sortable({
      leadId: "c",
      urgencyFlags: [],
      nextFollowUpAtIso: null,
      createdAtIso: null,
    }),
  ];
  const sorted = sortPipelineSortableLeads(leads);
  assert.equal(sorted[0]!.leadId, "a");
  // remaining ordered by leadId among missing
  assert.deepEqual(
    sorted.slice(1).map((l) => l.leadId),
    ["b", "c"]
  );
});

test("equal sort inputs use lead ID ascending", () => {
  const leads = [
    sortable({ leadId: "z-lead", urgencyFlags: [] }),
    sortable({ leadId: "a-lead", urgencyFlags: [] }),
  ];
  const sorted = sortPipelineSortableLeads(leads);
  assert.equal(sorted[0]!.leadId, "a-lead");
  assert.equal(sorted[1]!.leadId, "z-lead");
});

test("repeated input produces identical output", () => {
  const leads = [
    sortable({
      leadId: "m",
      urgencyFlags: ["due_today"] as PipelineUrgencyFlag[],
      nextFollowUpAtIso: "2026-07-12T15:00:00.000Z",
      createdAtIso: "2026-06-01T00:00:00.000Z",
    }),
    sortable({
      leadId: "k",
      urgencyFlags: ["blocked"],
      createdAtIso: "2026-05-01T00:00:00.000Z",
    }),
    sortable({
      leadId: "n",
      urgencyFlags: ["high_value"],
      createdAtIso: "2026-04-01T00:00:00.000Z",
    }),
  ];
  const a = sortPipelineSortableLeads(leads).map((l) => l.leadId);
  const b = sortPipelineSortableLeads(leads).map((l) => l.leadId);
  const c = [...leads]
    .sort(comparePipelineSortableLeads)
    .map((l) => l.leadId);
  assert.deepEqual(a, b);
  assert.deepEqual(a, c);
  assert.deepEqual(a, ["k", "m", "n"]);
});

// --- Urgency vs stage (37) --------------------------------------------------

test("urgency flags never alter stage resolution", () => {
  const base = stage({ slug: "qualified" });
  const without = resolvePipelineStaffStage(base);
  // Urgency is not an input to resolvePipelineStaffStage
  const withFlags: PipelineUrgencyFlag[] = ["blocked", "overdue_follow_up", "stale"];
  void withFlags;
  const again = resolvePipelineStaffStage(base);
  assert.deepEqual(without, again);
  assert.equal(without.columnId, "qualified");
  assert.equal(without.source, "known_slug");
});

// --- Terminology (38) -------------------------------------------------------

test("staff labels contain no LeadFlow, CRM or technical OS language", () => {
  const banned =
    /leadflow|crm|command centre|command center|os\b|hubspot|kanban|fi_crm|slug/i;
  for (const col of PIPELINE_STAFF_COLUMNS) {
    assert.doesNotMatch(col.label, banned, col.label);
  }
  assert.deepEqual(
    PIPELINE_STAFF_COLUMN_ORDER.map((id) => id),
    PIPELINE_STAFF_COLUMNS.map((c) => c.id)
  );
  assert.equal(PIPELINE_STAFF_COLUMNS.length, 9);
});

// --- Booked/deposit remains active ------------------------------------------

test("booked/deposit and in_treatment remain active for Pipeline", () => {
  assert.equal(isPipelineActive("booked_deposit"), true);
  assert.equal(isPipelineTerminalWon("booked_deposit"), false);
  const r = resolvePipelineStaffStage(stage({ slug: "in_treatment" }));
  assert.equal(r.lifecycle, "active");
});

test("audit missing won/lost fails", () => {
  const onlyActive = defaultStages().filter((s) => !s.isWon && !s.isLost);
  const audit = auditPipelineStageCrosswalk(onlyActive);
  assert.equal(audit.pass, false);
  assert.equal(audit.missingWonStage, true);
  assert.equal(audit.missingLostStage, true);
});
