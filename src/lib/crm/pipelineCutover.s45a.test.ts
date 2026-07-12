/**
 * FI-UX-REBUILD-1 S4.5A — allowlisted `/crm` cutover contract (static + pure).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";

import { buildPipelinePresentation } from "@/src/lib/crm/pipelinePresentation";
import {
  comparePipelineTierIdentity,
  createPipelineRefreshCoordinator,
  normalizePipelineSearchParams,
} from "@/src/lib/crm/pipelineLoader";
import { resolvePipelineInitialView } from "@/src/lib/crm/pipelineQueryCompat";
import { isPipelineV1EnabledForTenant } from "@/src/lib/crm/pipelineRollout.server";
import type { CrmKanbanLeadCard, FiCrmLeadRow } from "@/src/lib/crm/types";

const CRM_PAGE = "app/(fi-admin)/fi-admin/[tenantId]/crm/page.tsx";
const CRM_LAYOUT = "app/(fi-admin)/fi-admin/[tenantId]/crm/layout.tsx";
const CRM_LEAD_DETAIL = "app/(fi-admin)/fi-admin/[tenantId]/crm/leads/[leadId]/page.tsx";
const LEADFLOW_PAGE = "app/(fi-admin)/fi-admin/[tenantId]/leadflow/page.tsx";
const CONVERSION_PAGE = "app/(fi-admin)/fi-admin/[tenantId]/consultation-conversion/page.tsx";
const PIPELINE_WS = "src/components/fi/crm/pipeline/PipelineWorkspace.tsx";
const PRIMARY_NAV = "src/lib/fiAdmin/fiOsShellPrimaryNav.ts";

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";
const ENV_KEY = "FI_PIPELINE_V1_TENANT_ALLOWLIST";

let savedEnv: string | undefined;

beforeEach(() => {
  savedEnv = process.env[ENV_KEY];
  delete process.env[ENV_KEY];
});

afterEach(() => {
  if (savedEnv === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = savedEnv;
});

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function leadRow(id: string): FiCrmLeadRow {
  return {
    id,
    tenant_id: TENANT_A,
    organisation_id: null,
    clinic_id: null,
    person_id: `p-${id}`,
    patient_id: null,
    case_id: null,
    current_stage_id: "stage-qualified",
    primary_owner_user_id: null,
    status: "open",
    priority: null,
    summary: "Enquiry",
    metadata: {},
    converted_person_id: null,
    converted_case_id: null,
    converted_at: null,
    converted_by_user_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function kanban(id: string): CrmKanbanLeadCard {
  return {
    lead: leadRow(id),
    stage: { id: "stage-qualified", slug: "qualified", label: "Qualified", sort_order: 20 },
    person: { id: `p-${id}`, metadata: {} },
    owner: null,
    patient: null,
    clinicalSummaryLine: null,
    norwoodScale: null,
    ludwigScale: null,
    primaryConcernLine: null,
    daysInStage: 1,
    stageEnteredAtIso: "2026-01-01T00:00:00.000Z",
    lastActivityAtIso: "2026-01-01T00:00:00.000Z",
    overdueTaskCount: 0,
    isHighValue: false,
  };
}

describe("S4.5A allowlist defaults", () => {
  it("defaults off and ignores platform-admin labels", async () => {
    assert.equal(await isPipelineV1EnabledForTenant(TENANT_A), false);
    process.env[ENV_KEY] = "fi_admin,platform_admin";
    assert.equal(await isPipelineV1EnabledForTenant(TENANT_A), false);
  });

  it("enables only exact approved tenant UUIDs", async () => {
    process.env[ENV_KEY] = TENANT_A;
    assert.equal(await isPipelineV1EnabledForTenant(TENANT_A), true);
    assert.equal(await isPipelineV1EnabledForTenant(TENANT_B), false);
  });
});

describe("S4.5A /crm route switch contract", () => {
  const page = read(CRM_PAGE);
  const layout = read(CRM_LAYOUT);
  const workspace = read(PIPELINE_WS);
  const leadDetail = read(CRM_LEAD_DETAIL);
  const leadflow = read(LEADFLOW_PAGE);
  const conversion = read(CONVERSION_PAGE);
  const nav = read(PRIMARY_NAV);

  it("enabled path mounts PipelineWorkspace via allowlist gate", () => {
    assert.match(page, /isPipelineV1EnabledForTenant/);
    assert.match(page, /loadPipelineShellPayload/);
    assert.match(page, /PipelineWorkspace/);
    assert.match(page, /refreshPipelinePresentation/);
    assert.match(page, /resolvePipelineInitialView/);
    assert.match(page, /onRefreshPresentation/);
  });

  it("disabled path retains legacy CRM loaders and views", () => {
    assert.match(page, /LeadFlowDashboard/);
    assert.match(page, /CrmKanbanBoard/);
    assert.match(page, /CrmLeadListTable/);
    assert.match(page, /loadCrmShellLeadsIndex/);
    assert.match(page, /loadCrmShellLeadsBoardIndex/);
    assert.match(page, /loadLeadFlowDashboardPayload/);
  });

  it("shell loader is only reached after the allowlist gate", () => {
    const gateCallIdx = page.indexOf("await isPipelineV1EnabledForTenant");
    const shellCallIdx = page.indexOf("await loadPipelineShellPayload");
    const legacyBoardCallIdx = page.indexOf("isBoard ? loadCrmShellLeadsBoardIndex");
    assert.ok(gateCallIdx >= 0);
    assert.ok(shellCallIdx > gateCallIdx);
    assert.ok(legacyBoardCallIdx > shellCallIdx);
    assert.match(page, /if \(pipelineEnabled\)/);
  });

  it("layout access gate remains unchanged", () => {
    assert.match(layout, /getCrmShellPageSession/);
    assert.match(layout, /assertStaffModuleAccess\(tenantId, "lead_flow", "read"\)/);
    assert.match(layout, /CalendarToastProvider/);
    assert.match(layout, /CrmLeadSlideOverProvider/);
  });

  it("PipelineWorkspace does not add a competing access gate", () => {
    assert.doesNotMatch(workspace, /assertStaffModuleAccess/);
    assert.doesNotMatch(workspace, /getCrmShellPageSession/);
    assert.doesNotMatch(workspace, /redirect\(/);
  });

  it("full hydration starts once via autoHydrateStartedRef and coordinator", () => {
    assert.match(workspace, /autoHydrateStartedRef/);
    assert.match(workspace, /pendingFullHydrations/);
    assert.match(workspace, /createPipelineRefreshCoordinator/);
    assert.match(workspace, /comparePipelineTierIdentity/);
    assert.doesNotMatch(workspace, /setInterval/);
    assert.doesNotMatch(workspace, /router\.refresh\(/);
  });

  it("identity mismatch retains shell and shows a nontechnical notice", () => {
    assert.match(workspace, /identity_mismatch/);
    assert.match(workspace, /Could not refresh\. Showing the last update\./);
    assert.match(workspace, /shell\/full identity mismatch/);
  });

  it("query compatibility maps follow_ups and legacy views", () => {
    assert.equal(resolvePipelineInitialView({ view: "follow_ups" }), "follow_ups");
    assert.equal(resolvePipelineInitialView({ view: "workspace" }), "board");
    assert.equal(resolvePipelineInitialView({ view: "list" }), "board");
    assert.match(page, /initialView=\{initialView\}/);
  });

  it("server-window filters are preserved into shell/full via shared searchParams", () => {
    assert.match(page, /resolvedSearchParams/);
    assert.match(page, /loadPipelineShellPayload\(tenantId, resolvedSearchParams\)/);
    assert.match(page, /refreshPipelinePresentation\(tenantId, resolvedSearchParams\)/);
    const normalized = normalizePipelineSearchParams({
      search: "smith",
      owner: TENANT_A,
      stage: TENANT_B,
      source: "website",
      page: "2",
      pageSize: "50",
    });
    assert.equal(normalized.search, "smith");
    assert.equal(normalized.owner, TENANT_A);
    assert.equal(normalized.stage, TENANT_B);
    assert.equal(normalized.source, "website");
  });

  it("lead detail route is unchanged and has no PipelineWorkspace swap", () => {
    assert.doesNotMatch(leadDetail, /PipelineWorkspace/);
    assert.doesNotMatch(leadDetail, /isPipelineV1EnabledForTenant/);
    assert.match(leadDetail, /getCrmShellPageSession/);
  });

  it("no Pipeline/legacy route redirects are added", () => {
    assert.doesNotMatch(page, /redirect\(/);
    assert.doesNotMatch(leadflow, /redirect\([\s\S]*crm/);
    assert.doesNotMatch(conversion, /redirect\([\s\S]*crm/);
    assert.match(nav, /follow-up-queue/);
    assert.match(nav, /consultation-conversion/);
    assert.match(nav, /leadflow/);
  });

  it("read-only and capability override remain adapter-driven", () => {
    assert.match(workspace, /PipelineReadOnlyNotice/);
    assert.match(workspace, /!permissions\.canMutate/);
    assert.match(workspace, /canCreateEnquiry/);
    assert.match(page, /canCreateEnquiry=\{shell\.permissions\.canCreateEnquiry\}/);
  });
});

describe("S4.5A shell/full identity apply semantics", () => {
  it("identity match permits swap", () => {
    const shell = buildPipelinePresentation({
      leads: [kanban("l1"), kanban("l2")],
      nowMs: Date.parse("2026-01-01T00:00:00.000Z"),
      base: `/fi-admin/${TENANT_A}`,
      permissions: { canMutate: true, canConvert: true },
    });
    const full = buildPipelinePresentation({
      leads: [kanban("l1"), kanban("l2")],
      nowMs: Date.parse("2026-01-01T00:00:01.000Z"),
      base: `/fi-admin/${TENANT_A}`,
      permissions: { canMutate: true, canConvert: true },
      tasksByLeadId: new Map(),
    });
    assert.equal(comparePipelineTierIdentity(shell, full).ok, true);
  });

  it("identity mismatch retains shell (no swap signal)", () => {
    const shell = buildPipelinePresentation({
      leads: [kanban("l1"), kanban("l2")],
      nowMs: Date.parse("2026-01-01T00:00:00.000Z"),
      base: `/fi-admin/${TENANT_A}`,
      permissions: { canMutate: true, canConvert: true },
    });
    const full = buildPipelinePresentation({
      leads: [kanban("l1")],
      nowMs: Date.parse("2026-01-01T00:00:01.000Z"),
      base: `/fi-admin/${TENANT_A}`,
      permissions: { canMutate: true, canConvert: true },
      tasksByLeadId: new Map(),
    });
    const identity = comparePipelineTierIdentity(shell, full);
    assert.equal(identity.ok, false);
  });

  it("refresh coordinator dedupes concurrent full loads", async () => {
    let calls = 0;
    const coordinator = createPipelineRefreshCoordinator(async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 5));
      return buildPipelinePresentation({
        leads: [kanban("l1")],
        nowMs: Date.now(),
        base: `/fi-admin/${TENANT_A}`,
        permissions: { canMutate: true, canConvert: true },
      });
    });
    await Promise.all([coordinator.refresh(), coordinator.refresh()]);
    assert.equal(calls, 1);
  });
});
