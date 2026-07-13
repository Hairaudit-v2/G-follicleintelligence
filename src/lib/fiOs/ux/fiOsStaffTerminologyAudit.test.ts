/**
 * FI-UX-REBUILD-1 S2 — Staff language audit over nav registries and hub labels.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { resolveFiOsPrimarySidebarItems } from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";
import { buildFrontDeskSidebarSubItems } from "@/src/lib/fiOs/frontDesk/frontDeskWorkspaceCore";
import {
  FI_OS_FRONT_DESK_LEGACY_ROUTES,
  FI_OS_FRONT_DESK_TABS,
} from "@/src/lib/fiOs/frontDesk/frontDeskWorkspaceCore";
import {
  buildSurgerySidebarSubItems,
  FI_OS_SURGERY_LEGACY_ROUTES,
  FI_OS_SURGERY_TABS,
} from "@/src/lib/fiOs/surgery/surgeryWorkspaceCore";
import {
  buildTeamSidebarSubItems,
  FI_OS_TEAM_LEGACY_ROUTES,
  FI_OS_TEAM_TABS,
} from "@/src/lib/fiOs/team/teamWorkspaceCore";
import {
  buildReportsSidebarSubItems,
  FI_OS_REPORTS_TABS,
} from "@/src/lib/fiOs/reports/reportsWorkspaceCore";
import {
  FI_OS_STAFF_TERMS,
  resolveApprovedStaffTerm,
  staffLabelHasProhibitedArchitectureLanguage,
} from "@/src/lib/fiOs/ux/fiOsStaffTerminology";

const TENANT = "11111111-1111-1111-1111-111111111111";
const BASE = `/fi-admin/${TENANT}`;

function collectLabels(items: { label: string; subItems?: { label: string }[] }[]): string[] {
  const out: string[] = [];
  for (const item of items) {
    out.push(item.label);
    for (const sub of item.subItems ?? []) {
      out.push(sub.label);
    }
  }
  return out;
}

test("terminology map resolves core legacy → approved terms", () => {
  assert.equal(resolveApprovedStaffTerm("ReceptionOS"), FI_OS_STAFF_TERMS.frontDesk);
  assert.equal(resolveApprovedStaffTerm("SurgeryOS"), FI_OS_STAFF_TERMS.surgery);
  assert.equal(resolveApprovedStaffTerm("WorkforceOS"), FI_OS_STAFF_TERMS.team);
  assert.equal(resolveApprovedStaffTerm("FinancialOS"), FI_OS_STAFF_TERMS.finances);
  assert.equal(resolveApprovedStaffTerm("Patient Twin"), FI_OS_STAFF_TERMS.healthRecord);
  assert.equal(resolveApprovedStaffTerm("LeadFlow"), FI_OS_STAFF_TERMS.pipeline);
  assert.equal(resolveApprovedStaffTerm("Procedure Day"), FI_OS_STAFF_TERMS.surgeryDay);
  assert.equal(resolveApprovedStaffTerm("Readiness Board"), FI_OS_STAFF_TERMS.readyForSurgery);
  assert.equal(resolveApprovedStaffTerm("Audit Intelligence"), FI_OS_STAFF_TERMS.qualityReview);
});

test("prohibited detector flags architecture language", () => {
  assert.equal(staffLabelHasProhibitedArchitectureLanguage("ReceptionOS"), true);
  assert.equal(staffLabelHasProhibitedArchitectureLanguage("SurgeryOS"), true);
  assert.equal(staffLabelHasProhibitedArchitectureLanguage("WorkforceOS"), true);
  assert.equal(staffLabelHasProhibitedArchitectureLanguage("FinancialOS"), true);
  assert.equal(staffLabelHasProhibitedArchitectureLanguage("PatientOS"), true);
  assert.equal(staffLabelHasProhibitedArchitectureLanguage("HR OS"), true);
  assert.equal(staffLabelHasProhibitedArchitectureLanguage("Patient Twin"), true);
  assert.equal(staffLabelHasProhibitedArchitectureLanguage("Digital Twin"), true);
  assert.equal(staffLabelHasProhibitedArchitectureLanguage("Command Centre"), true);
  assert.equal(staffLabelHasProhibitedArchitectureLanguage("Command Center"), true);
  assert.equal(staffLabelHasProhibitedArchitectureLanguage("Procedure Day"), true);
  assert.equal(staffLabelHasProhibitedArchitectureLanguage("Readiness Board"), true);
  assert.equal(staffLabelHasProhibitedArchitectureLanguage("Audit Intelligence"), true);
  assert.equal(staffLabelHasProhibitedArchitectureLanguage("Workforce Intelligence"), true);
  assert.equal(staffLabelHasProhibitedArchitectureLanguage("LeadFlow"), true);
});

test("prohibited detector allows approved operational labels", () => {
  assert.equal(staffLabelHasProhibitedArchitectureLanguage("Front desk"), false);
  assert.equal(staffLabelHasProhibitedArchitectureLanguage("Surgery"), false);
  assert.equal(staffLabelHasProhibitedArchitectureLanguage("Surgery day"), false);
  assert.equal(staffLabelHasProhibitedArchitectureLanguage("Ready for surgery"), false);
  assert.equal(staffLabelHasProhibitedArchitectureLanguage("Team"), false);
  assert.equal(staffLabelHasProhibitedArchitectureLanguage("Team overview"), false);
  assert.equal(staffLabelHasProhibitedArchitectureLanguage("Money"), false);
  assert.equal(staffLabelHasProhibitedArchitectureLanguage("Finances"), false);
  assert.equal(staffLabelHasProhibitedArchitectureLanguage("Insights"), false);
  assert.equal(staffLabelHasProhibitedArchitectureLanguage("Patients"), false);
  assert.equal(staffLabelHasProhibitedArchitectureLanguage("Health record"), false);
  assert.equal(staffLabelHasProhibitedArchitectureLanguage("Enquiries"), false);
  assert.equal(staffLabelHasProhibitedArchitectureLanguage("Quality review"), false);
  assert.equal(staffLabelHasProhibitedArchitectureLanguage("Overview"), false);
  assert.equal(staffLabelHasProhibitedArchitectureLanguage("Doctor overview"), false);
  assert.equal(staffLabelHasProhibitedArchitectureLanguage("Roster"), false);
});

test("primary staff sidebar labels have no architecture language", () => {
  const items = resolveFiOsPrimarySidebarItems(
    BASE,
    true,
    true,
    null,
    true,
    true,
    true,
    true,
    true,
    false,
    false,
    undefined,
    false
  );
  for (const label of collectLabels(items)) {
    assert.equal(
      staffLabelHasProhibitedArchitectureLanguage(label),
      false,
      `prohibited staff label: ${label}`
    );
  }
});

test("front desk hub + legacy labels are plain language", () => {
  for (const tab of FI_OS_FRONT_DESK_TABS) {
    assert.equal(staffLabelHasProhibitedArchitectureLanguage(tab.label), false, tab.label);
  }
  for (const route of FI_OS_FRONT_DESK_LEGACY_ROUTES) {
    assert.equal(staffLabelHasProhibitedArchitectureLanguage(route.label), false, route.label);
  }
  for (const sub of buildFrontDeskSidebarSubItems(TENANT)) {
    assert.equal(staffLabelHasProhibitedArchitectureLanguage(sub.label), false, sub.label);
  }
});

test("surgery hub + legacy labels use Surgery day / Ready for surgery", () => {
  const procedure = FI_OS_SURGERY_TABS.find((t) => t.id === "procedure-day");
  assert.equal(procedure?.label, FI_OS_STAFF_TERMS.surgeryDay);

  for (const tab of FI_OS_SURGERY_TABS) {
    assert.equal(staffLabelHasProhibitedArchitectureLanguage(tab.label), false, tab.label);
  }
  for (const route of FI_OS_SURGERY_LEGACY_ROUTES) {
    assert.equal(staffLabelHasProhibitedArchitectureLanguage(route.label), false, route.label);
  }
  const readiness = FI_OS_SURGERY_LEGACY_ROUTES.find((r) => r.id === "surgery-readiness-board");
  assert.equal(readiness?.label, FI_OS_STAFF_TERMS.readyForSurgery);

  const subs = buildSurgerySidebarSubItems(TENANT, {
    showProcedureDayNav: true,
    showSurgeryAdminSurfaces: false,
  });
  for (const sub of subs) {
    // Strip "(direct)" suffix for architecture check on base label.
    const baseLabel = sub.label.replace(/\s*\(direct\)\s*$/i, "").trim();
    assert.equal(staffLabelHasProhibitedArchitectureLanguage(baseLabel), false, sub.label);
  }
});

test("team hub labels are plain language", () => {
  for (const tab of FI_OS_TEAM_TABS) {
    assert.equal(staffLabelHasProhibitedArchitectureLanguage(tab.label), false, tab.label);
  }
  for (const route of FI_OS_TEAM_LEGACY_ROUTES) {
    assert.equal(staffLabelHasProhibitedArchitectureLanguage(route.label), false, route.label);
  }
  const subs = buildTeamSidebarSubItems(TENANT, {
    showHrOsNav: true,
    showTeamAdminSurfaces: false,
  });
  for (const sub of subs) {
    const baseLabel = sub.label.replace(/\s*\(direct\)\s*$/i, "").trim();
    assert.equal(staffLabelHasProhibitedArchitectureLanguage(baseLabel), false, sub.label);
  }
});

test("reports hub staff labels avoid architecture language", () => {
  for (const tab of FI_OS_REPORTS_TABS) {
    if (tab.id === "admin") continue; // admin tab may use technical wording later
    assert.equal(staffLabelHasProhibitedArchitectureLanguage(tab.label), false, tab.label);
  }
  const staffSubs = buildReportsSidebarSubItems(TENANT, {
    showAuditOsNav: true,
    showReportsAdminSurfaces: false,
  });
  for (const sub of staffSubs) {
    const baseLabel = sub.label.replace(/\s*\(direct\)\s*$/i, "").trim();
    assert.equal(staffLabelHasProhibitedArchitectureLanguage(baseLabel), false, sub.label);
  }
});

test("role-oriented nav smoke: receptionist, clinical, finance, manager labels stay plain", () => {
  // Receptionist-like: CRM off, bookings on, no HR, no procedure day
  const reception = resolveFiOsPrimarySidebarItems(
    BASE,
    false,
    true,
    null,
    false,
    false,
    false,
    false,
    false
  );
  assert.ok(reception.some((i) => i.id === "front-desk" && i.label === "Front desk"));
  assert.ok(!collectLabels(reception).some((l) => /ReceptionOS|Command Centre|LeadFlow/i.test(l)));

  // CRM operator
  const crm = resolveFiOsPrimarySidebarItems(BASE, true, true, null, false, true, false, false, false);
  const crmLabels = collectLabels(crm);
  assert.ok(crmLabels.some((l) => /Pipeline/i.test(l)));
  assert.ok(!crmLabels.some((l) => /Enquiries|LeadFlow|CRM|Kanban|Conversion board/i.test(l)));

  // Finance admin backend role blocks clinical
  const finance = resolveFiOsPrimarySidebarItems(
    BASE,
    false,
    true,
    "finance_admin",
    true,
    true,
    true,
    true,
    false
  );
  const finLabels = collectLabels(finance);
  assert.ok(finLabels.some((l) => l === "Money" || l === "Take payment" || l === "Payments"));
  assert.ok(!finLabels.some((l) => /FinancialOS/i.test(l)));

  // Manager with HR + procedure day
  const manager = resolveFiOsPrimarySidebarItems(
    BASE,
    true,
    true,
    null,
    true,
    true,
    true,
    true,
    true
  );
  const mgrLabels = collectLabels(manager);
  assert.ok(mgrLabels.some((l) => l === "Team"));
  assert.ok(mgrLabels.some((l) => l === "Reports" || l === "Insights" || /report/i.test(l)));
  assert.ok(!mgrLabels.some((l) => /WorkforceOS|AnalyticsOS|Procedure Day/i.test(l)));
  const surgerySubs = manager.find((i) => i.id === "surgery")?.subItems ?? [];
  assert.ok(
    surgerySubs.some((s) => s.label === FI_OS_STAFF_TERMS.surgeryDay),
    "manager with procedure day sees Surgery day"
  );
});
