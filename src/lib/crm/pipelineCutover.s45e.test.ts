/**
 * FI-UX-REBUILD-1 S4.5E — legacy pipeline route redirect contract.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  getFiOsShellActiveSidebarId,
  resolveFiOsPrimarySidebarItems,
} from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";

const LEADFLOW_PAGE = "app/(fi-admin)/fi-admin/[tenantId]/leadflow/page.tsx";
const CONVERSION_PAGE = "app/(fi-admin)/fi-admin/[tenantId]/consultation-conversion/page.tsx";
const CRM_PAGE = "app/(fi-admin)/fi-admin/[tenantId]/crm/page.tsx";
const CONSULTATION_PRESENTATION = "src/lib/fiAdmin/consultationPresentation.ts";

const TENANT = "c2615b95-b707-4485-aa5f-be8f78ec868a";
const BASE = `/fi-admin/${TENANT}`;

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function assertLegacyRedirectToCrm(pageSource: string, routeLabel: string) {
  assert.match(pageSource, /redirect\(/, `${routeLabel} must redirect`);
  assert.match(pageSource, /\/crm/, `${routeLabel} must target /crm`);
  assert.doesNotMatch(
    pageSource,
    /LeadFlowOperatorDashboard|ConsultationConversionBoard|loadLeadFlowOperatorDashboardPayload|loadConsultationConversionBoardPayload/,
    `${routeLabel} must not render legacy dashboard`
  );
  assert.doesNotMatch(pageSource, /searchParams/, `${routeLabel} must not forward query params`);
}

describe("S4.5E legacy pipeline redirects", () => {
  it("1-2 /leadflow and /consultation-conversion redirect to /crm", () => {
    assertLegacyRedirectToCrm(read(LEADFLOW_PAGE), "/leadflow");
    assertLegacyRedirectToCrm(read(CONVERSION_PAGE), "/consultation-conversion");
  });

  it("3 tenant id preserved in redirect target", () => {
    for (const page of [LEADFLOW_PAGE, CONVERSION_PAGE]) {
      assert.match(read(page), /encodeURIComponent\(tid\)/);
      assert.match(read(page), /\/fi-admin\/\$\{/);
    }
  });

  it("4-5 query params dropped — plain /crm target only", () => {
    for (const page of [LEADFLOW_PAGE, CONVERSION_PAGE]) {
      const source = read(page);
      assert.doesNotMatch(source, /\?view=/);
      assert.doesNotMatch(source, /searchParams/);
    }
  });

  it("6-7 /crm does not redirect back to legacy routes", () => {
    const crm = read(CRM_PAGE);
    assert.doesNotMatch(crm, /redirect\([\s\S]*leadflow/);
    assert.doesNotMatch(crm, /redirect\([\s\S]*consultation-conversion/);
  });

  it("17 active nav maps legacy routes to Pipeline (crm)", () => {
    for (const route of [`${BASE}/leadflow`, `${BASE}/consultation-conversion`, `${BASE}/crm`]) {
      assert.equal(getFiOsShellActiveSidebarId(route, BASE), "crm", route);
    }
  });

  it("18 legacy pages no longer import dashboard loaders", () => {
    assert.doesNotMatch(read(LEADFLOW_PAGE), /from "@\/src\/components/);
    assert.doesNotMatch(read(CONVERSION_PAGE), /from "@\/src\/components/);
  });

  it("active consultation dashboards link to /crm not /consultation-conversion", () => {
    const presentation = read(CONSULTATION_PRESENTATION);
    assert.doesNotMatch(presentation, /\/consultation-conversion/);
    assert.ok((presentation.match(/`\$\{base\}\/crm`/g) ?? []).length >= 5);
  });

  it("14 /crm page does not redirect — lead detail route unchanged", () => {
    const crm = read(CRM_PAGE);
    assert.doesNotMatch(crm, /redirect\(/);
    assert.match(
      read("app/(fi-admin)/fi-admin/[tenantId]/crm/leads/[leadId]/page.tsx"),
      /CrmLeadDetailPageView/
    );
  });

  it("21-24 role gating unchanged — Pipeline nav still CRM-shell gated", () => {
    const denied = resolveFiOsPrimarySidebarItems(BASE, false, true);
    const crm = denied.find((i) => i.id === "crm");
    assert.ok(crm?.disabled);
  });
});
