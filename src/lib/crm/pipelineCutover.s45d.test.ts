/**
 * FI-UX-REBUILD-1 S4.5D — one Pipeline door navigation consolidation contract.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  getFiOsShellActiveSidebarId,
  resolveFiOsPrimarySidebarItems,
} from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";
import { resolveFiOsQuickCreateItems } from "@/src/lib/fiAdmin/fiOsQuickCreateItems";
import { buildFiOsSidebarWorkflowSections } from "@/src/lib/fi-os/fiOsSidebarWorkflow";
import { primaryRailSlotIds } from "@/src/lib/fiAdmin/fiOsMinimalNav";
import { staffLabelHasProhibitedArchitectureLanguage } from "@/src/lib/fiOs/ux/fiOsStaffTerminology";

const PRIMARY_NAV = "src/lib/fiAdmin/fiOsShellPrimaryNav.ts";
const LEADFLOW_PAGE = "app/(fi-admin)/fi-admin/[tenantId]/leadflow/page.tsx";
const CONVERSION_PAGE = "app/(fi-admin)/fi-admin/[tenantId]/consultation-conversion/page.tsx";
const CRM_PAGE = "app/(fi-admin)/fi-admin/[tenantId]/crm/page.tsx";
const FI_ADMIN_TENANT_NAV = "src/components/fi-admin/FiAdminTenantNav.tsx";
const PIPELINE_WS = "src/components/fi/crm/pipeline/PipelineWorkspace.tsx";

const TENANT = "c2615b95-b707-4485-aa5f-be8f78ec868a";
const BASE = `/fi-admin/${TENANT}`;

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function legacyCrmFallbackSource(): string {
  const page = read(CRM_PAGE);
  const marker = "const session = await getCrmShellPageSession(tenantId)";
  const idx = page.indexOf(marker);
  assert.ok(idx >= 0, "legacy /crm fallback branch");
  return page.slice(idx);
}

function sidebarItems(showCrm = true) {
  return resolveFiOsPrimarySidebarItems(BASE, showCrm, true);
}

function morePipelineItems() {
  const sections = buildFiOsSidebarWorkflowSections(sidebarItems(), "consultant", {
    tenantBase: BASE,
    forCollapsedShell: true,
  });
  return sections.find((s) => s.groupId === "PIPELINE")?.items ?? [];
}

function assertLegacyRedirectToCrm(pageSource: string, routeLabel: string) {
  assert.match(pageSource, /redirect\(/, `${routeLabel} must redirect`);
  assert.match(pageSource, /\/crm/, `${routeLabel} must target /crm`);
}

describe("S4.5D one Pipeline door", () => {
  it("1 exactly one visible Pipeline primary entry", () => {
    const items = sidebarItems();
    const pipeline = items.filter((i) => i.id === "crm" && !i.disabled);
    assert.equal(pipeline.length, 1);
    assert.equal(pipeline[0]!.label, "Pipeline");
  });

  it("2 Pipeline href is /crm", () => {
    const crm = sidebarItems().find((i) => i.id === "crm");
    assert.ok(crm?.href.endsWith("/crm"));
  });

  it("3 internal navigation id remains crm", () => {
    assert.match(read(PRIMARY_NAV), /id:\s*"crm"/);
  });

  it("4-7 no duplicate Enquiries, CRM workspace, Follow-ups peer, or Conversion board nav", () => {
    const items = sidebarItems();
    const labels = items.map((i) => i.label);
    const ids = items.map((i) => i.id);
    assert.ok(!labels.includes("Enquiries"));
    assert.ok(!labels.includes("Follow-ups"));
    assert.ok(!labels.includes("Conversion board"));
    assert.equal(ids.includes("follow-up-queue"), false);
    const crm = items.find((i) => i.id === "crm");
    assert.equal(crm?.subItems?.length ?? 0, 0);
    const consult = items.find((i) => i.id === "consultations");
    assert.ok(!consult?.subItems?.some((s) => s.id === "consultation-conversion-board"));
  });

  it("8-9 Board and Follow-ups remain in-page tabs", () => {
    const ui = read(PIPELINE_WS);
    assert.match(ui, /PipelineViewTabs/);
    assert.match(ui, /Board/);
    assert.match(ui, /Follow-ups/);
  });

  it("10-16 active-route mapping covers Pipeline contexts", () => {
    const routes = [
      `${BASE}/crm`,
      `${BASE}/crm?view=board`,
      `${BASE}/crm?view=follow_ups`,
      `${BASE}/crm?view=workspace`,
      `${BASE}/crm?view=list`,
      `${BASE}/crm/leads/lead-1`,
      `${BASE}/leadflow`,
      `${BASE}/consultation-conversion`,
    ];
    for (const route of routes) {
      assert.equal(getFiOsShellActiveSidebarId(route, BASE), "crm", route);
    }
  });

  it("17 More drawer contains one Pipeline entry", () => {
    const pipeline = morePipelineItems();
    assert.deepEqual(pipeline.map((i) => i.id), ["crm"]);
    assert.equal(pipeline[0]!.label, "Pipeline");
  });

  it("20 primary rail count unchanged at six slots", () => {
    assert.equal(primaryRailSlotIds().length, 6);
    const railIds = new Set(["today", "calendar", "patients", "front-desk", "team", "more"]);
    assert.deepEqual([...primaryRailSlotIds()].sort(), [...railIds].sort());
  });

  it("21-24 role gating unchanged — no Pipeline without CRM shell access", () => {
    const denied = resolveFiOsPrimarySidebarItems(BASE, false, true);
    const crm = denied.find((i) => i.id === "crm");
    assert.ok(crm?.disabled);
  });

  it("26 New enquiry quick-create remains available", () => {
    const items = resolveFiOsQuickCreateItems(BASE, true, true);
    const lead = items.find((i) => i.id === "lead");
    assert.equal(lead?.label, "New enquiry");
    assert.equal(lead?.enabled, true);
    assert.ok(lead?.href.includes("/crm"));
  });

  it("27-28 lead links remain on /crm/leads/[id]", () => {
    const breadcrumbs = read("src/components/fi/crm/detail/CrmLeadDetailBreadcrumbs.tsx");
    assert.match(breadcrumbs, /\/crm`/);
    assert.match(breadcrumbs, /Pipeline/);
  });

  it("29-32 staff chrome avoids CRM, LeadFlow, Kanban, Conversion board labels in primary nav", () => {
    for (const item of sidebarItems()) {
      assert.equal(staffLabelHasProhibitedArchitectureLanguage(item.label), false, item.label);
      assert.ok(!/\bCRM\b/i.test(item.label));
      assert.ok(!/\bLeadFlow\b/i.test(item.label));
      assert.ok(!/\bKanban\b/i.test(item.label));
      assert.ok(!/Conversion board/i.test(item.label));
    }
  });

  it("legacy routes soft-redirect to Pipeline; /crm stays canonical", () => {
    assertLegacyRedirectToCrm(read(LEADFLOW_PAGE), "/leadflow");
    assertLegacyRedirectToCrm(read(CONVERSION_PAGE), "/consultation-conversion");
    assert.doesNotMatch(read(CRM_PAGE), /redirect\(/);
  });

  it("crm page metadata uses Pipeline label", () => {
    assert.match(read(CRM_PAGE), /title:\s*"Pipeline"/);
  });

  it("legacy /crm fallback avoids prohibited staff terminology", () => {
    const legacy = legacyCrmFallbackSource();
    assert.match(legacy, /Board view/);
    assert.match(legacy, /Back to Pipeline/);
    assert.doesNotMatch(legacy, /Conversion board/);
    assert.doesNotMatch(legacy, /Enquiries workspace/);
    assert.doesNotMatch(legacy, /CRM workspace/);
  });

  it("FiAdminTenantNav exposes one Pipeline entry without duplicate enquiry doors", () => {
    const nav = read(FI_ADMIN_TENANT_NAV);
    const pipelineGroup = nav.slice(nav.indexOf('id: "leadflow"'));
    assert.match(pipelineGroup, /label: "Pipeline"/);
    assert.equal((pipelineGroup.match(/href: `\$\{base\}\/crm`/g) ?? []).length, 1);
    assert.doesNotMatch(pipelineGroup, /label: "Enquiries"/);
    assert.doesNotMatch(pipelineGroup, /label: "Follow-ups"/);
    assert.doesNotMatch(pipelineGroup, /consultation-conversion/);
  });
});
