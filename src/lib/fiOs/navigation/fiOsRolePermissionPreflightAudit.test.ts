import assert from "node:assert/strict";
import test from "node:test";

import {
  filterFiOsPrimarySidebarItemsByFeatureAccess,
  resolveFiOsPrimarySidebarItems,
} from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";
import { resolveFiOsMinimalNavItems } from "@/src/lib/fiAdmin/fiOsMinimalNav";
import { buildDefaultFeatureAccessAllEnabled } from "@/src/config/fiFeatureAccessRegistry";
import {
  assertFiOsRolePermissionPreflightPassed,
  buildEffectiveFeatureAccessMapForScenario,
  buildFiOsRolePermissionPreflightReport,
  formatPermissionMatrixMarkdown,
  PREFLIGHT_ROLE_SCENARIOS,
  runFiOsRolePermissionPreflightAudit,
  summarizeFiOsRolePermissionPreflightAudit,
} from "@/src/lib/fiOs/navigation/fiOsRolePermissionPreflightAudit";
import {
  canApproveModule,
  canEditModule,
  canViewModule,
  computeEffectiveAccess,
  computeStaffAccessNavFeatureOverrides,
} from "@/src/lib/staffAccess/staffAccessCore";

const tenantId = "t-permission-preflight-1";
const base = `/fi-admin/${tenantId}`;

test("receptionist: six-slot rail, staff-safe More, no admin routes", () => {
  const scenario = PREFLIGHT_ROLE_SCENARIOS.find((s) => s.persona === "receptionist")!;
  const report = buildFiOsRolePermissionPreflightReport(tenantId, scenario);

  assert.match(report.matrixRow.primaryRail, /Today/);
  assert.match(report.matrixRow.primaryRail, /Front desk/);
  assert.match(report.matrixRow.primaryRail, /Team\(off\)/);
  assert.doesNotMatch(report.matrixRow.primaryRail, /Reports/);
  assert.equal(report.matrixRow.adminIntelligenceAccess, "none");
  assert.equal(report.matrixRow.teamAccess, "no");
  assert.equal(report.matrixRow.surgeryAccess, "no");

  assertFiOsRolePermissionPreflightPassed(report);
});

test("receptionist: team rail slot disabled when feature-filtered", () => {
  const scenario = PREFLIGHT_ROLE_SCENARIOS.find((s) => s.persona === "receptionist")!;
  const featureMap = buildEffectiveFeatureAccessMapForScenario(scenario);
  assert.ok(featureMap);
  assert.equal(featureMap!.get("staff"), false);
  assert.equal(featureMap!.get("analytics"), false);

  const raw = resolveFiOsPrimarySidebarItems(
    base,
    true,
    true,
    null,
    true,
    true,
    true,
    true,
    true,
    false,
    false
  );
  const sidebar = filterFiOsPrimarySidebarItemsByFeatureAccess(raw, featureMap);
  assert.ok(!sidebar.some((i) => i.id === "team"));
  assert.ok(!sidebar.some((i) => i.id === "reports"));

  const rail = resolveFiOsMinimalNavItems(base, sidebar);
  const teamRail = rail.find((i) => i.id === "team");
  const frontRail = rail.find((i) => i.id === "front-desk");
  assert.equal(teamRail?.kind, "link");
  assert.equal(frontRail?.kind, "link");
  if (teamRail?.kind === "link") assert.equal(teamRail.disabled, true);
  // Front desk stays available on rail when still present in sidebar
  if (frontRail?.kind === "link") assert.equal(frontRail.disabled, false);
});

test("receptionist: SA-1 blocks workforce and analytics modules", () => {
  const access = computeEffectiveAccess({ roleKey: "reception", grants: [] });
  assert.equal(canViewModule(access, "workforce_os"), false);
  assert.equal(canViewModule(access, "analytics_os"), false);
  assert.equal(canViewModule(access, "surgery_os"), false);
  assert.equal(canEditModule(access, "patient_os"), true);

  const overrides = computeStaffAccessNavFeatureOverrides(access);
  assert.equal(overrides.staff, false);
  assert.equal(overrides.analytics, false);
});

test("clinical staff/nurse: permitted surgery surfaces, no roster mutation", () => {
  const scenario = PREFLIGHT_ROLE_SCENARIOS.find((s) => s.persona === "clinical_staff")!;
  const report = buildFiOsRolePermissionPreflightReport(tenantId, scenario);
  const access = computeEffectiveAccess({ roleKey: "nurse", grants: [] });

  assert.equal(canViewModule(access, "surgery_os"), true);
  assert.equal(canEditModule(access, "workforce_os"), false);
  assert.equal(report.matrixRow.surgeryAccess, "workflow");

  assertFiOsRolePermissionPreflightPassed(report);
});

test("surgical assistant/technician: limited surgery pipeline in template", () => {
  const scenario = PREFLIGHT_ROLE_SCENARIOS.find((s) => s.persona === "surgical_assistant")!;
  const featureMap = buildEffectiveFeatureAccessMapForScenario(scenario);
  assert.ok(featureMap);
  assert.equal(featureMap!.get("surgery_pipeline"), false);
  assert.equal(featureMap!.get("procedure_day"), true);

  const report = buildFiOsRolePermissionPreflightReport(tenantId, scenario);
  assertFiOsRolePermissionPreflightPassed(report);
});

test("surgeon/doctor: surgery approve, no staff admin tools", () => {
  const scenario = PREFLIGHT_ROLE_SCENARIOS.find((s) => s.persona === "surgeon")!;
  const report = buildFiOsRolePermissionPreflightReport(tenantId, scenario);
  const access = computeEffectiveAccess({ roleKey: "doctor", grants: [] });

  assert.equal(canApproveModule(access, "surgery_os"), true);
  assert.equal(canEditModule(access, "workforce_os"), false);
  assert.equal(report.matrixRow.adminIntelligenceAccess, "none");

  assertFiOsRolePermissionPreflightPassed(report);
});

test("manager/clinic admin: team management and admin surfaces", () => {
  const scenario = PREFLIGHT_ROLE_SCENARIOS.find((s) => s.persona === "manager")!;
  const report = buildFiOsRolePermissionPreflightReport(tenantId, scenario);
  const access = computeEffectiveAccess({ roleKey: "manager", grants: [] });

  assert.equal(canEditModule(access, "workforce_os"), true);
  assert.equal(canViewModule(access, "analytics_os"), true);
  assert.equal(report.matrixRow.teamAccess, "manage");
  assert.equal(report.matrixRow.adminIntelligenceAccess, "admin surfaces");

  assertFiOsRolePermissionPreflightPassed(report);
});

test("finance admin: analytics and financial module access", () => {
  const scenario = PREFLIGHT_ROLE_SCENARIOS.find((s) => s.persona === "finance_admin")!;
  const report = buildFiOsRolePermissionPreflightReport(tenantId, scenario);
  const access = computeEffectiveAccess({ roleKey: "manager", grants: [] });

  assert.equal(canViewModule(access, "analytics_os"), true);
  assert.equal(canViewModule(access, "financial_os"), true);
  assert.equal(report.matrixRow.reportsAccess, "analytics");

  assertFiOsRolePermissionPreflightPassed(report);
});

test("platform admin: full access and admin More drawer surfaces", () => {
  const scenario = PREFLIGHT_ROLE_SCENARIOS.find((s) => s.persona === "platform_admin")!;
  const report = buildFiOsRolePermissionPreflightReport(tenantId, scenario);
  const access = computeEffectiveAccess({ roleKey: "platform_admin", grants: [] });

  assert.equal(canApproveModule(access, "workforce_os"), true);
  assert.equal(canApproveModule(access, "surgery_os"), true);
  assert.equal(report.matrixRow.adminIntelligenceAccess, "admin surfaces");

  assertFiOsRolePermissionPreflightPassed(report);
});

test("primary rail slots disabled when sidebar item filtered by feature access", () => {
  const raw = resolveFiOsPrimarySidebarItems(
    base,
    true,
    true,
    null,
    true,
    true,
    true,
    true,
    true,
    false,
    false
  );
  const allOff = buildDefaultFeatureAccessAllEnabled();
  allOff.set("staff", false);
  allOff.set("analytics", false);
  const filtered = filterFiOsPrimarySidebarItemsByFeatureAccess(raw, allOff);
  const rail = resolveFiOsMinimalNavItems(base, filtered);

  const team = rail.find((i) => i.id === "team");
  if (team?.kind === "link") assert.equal(team.disabled, true);
  assert.equal(
    rail.find((i) => (i.id as string) === "reports"),
    undefined
  );
});

test("mutation guards: reception cannot edit roster or staff access", () => {
  const access = computeEffectiveAccess({ roleKey: "reception", grants: [] });
  assert.equal(canEditModule(access, "workforce_os"), false);
});

test("mutation guards: manager can edit roster and onboarding paths", () => {
  const access = computeEffectiveAccess({ roleKey: "manager", grants: [] });
  assert.equal(canEditModule(access, "workforce_os"), true);
});

test("receptionist with roster.manage override passes capability preflight", () => {
  const report = buildFiOsRolePermissionPreflightReport(tenantId, {
    persona: "receptionist_roster_override",
    staffRoleKey: "reception",
    featureTemplateKey: "reception_default",
    workspaceProfile: "reception",
    staffAccessGrants: [
      {
        moduleKey: "workforce_os",
        tabKey: "roster",
        accessLevel: "edit",
        scope: "tenant",
        revokedAt: null,
      },
    ],
  });
  assertFiOsRolePermissionPreflightPassed(report);
  assert.equal(report.matrixRow.teamAccess, "roster override");
});

test("all standard role scenarios pass permission preflight audit", () => {
  const reports = runFiOsRolePermissionPreflightAudit(tenantId);
  assert.equal(reports.length, PREFLIGHT_ROLE_SCENARIOS.length);

  for (const report of reports) {
    assertFiOsRolePermissionPreflightPassed(report);
  }

  const summary = summarizeFiOsRolePermissionPreflightAudit(reports);
  assert.equal(summary.failedScenarios, 0);
  assert.equal(summary.passedScenarios, PREFLIGHT_ROLE_SCENARIOS.length);
  assert.equal(summary.matrix.length, PREFLIGHT_ROLE_SCENARIOS.length);
});

test("permission matrix markdown includes all roles", () => {
  const summary = summarizeFiOsRolePermissionPreflightAudit(
    runFiOsRolePermissionPreflightAudit(tenantId)
  );
  const md = formatPermissionMatrixMarkdown(summary);
  assert.match(md, /receptionist/);
  assert.match(md, /platform_admin/);
  assert.match(md, /Pass\/fail/);
  for (const scenario of PREFLIGHT_ROLE_SCENARIOS) {
    assert.match(md, new RegExp(scenario.persona));
  }
});
