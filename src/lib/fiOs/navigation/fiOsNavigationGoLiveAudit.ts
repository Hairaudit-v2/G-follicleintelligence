/**
 * FI-UX-REBUILD D6G-G — staff go-live navigation smoke audit (read-only).
 * Validates the six-slot primary rail, staff-safe More drawer, consolidated
 * workspaces, legacy deep links, and active-state mapping before staff go-live.
 */

import {
  getFiOsMinimalNavActiveId,
  primaryRailSlotIds,
  resolveFiOsMinimalNavItems,
  type FiOsMinimalNavItemId,
} from "@/src/lib/fiAdmin/fiOsMinimalNav";
import {
  FI_OS_QUICK_CREATE_ITEMS,
  resolveFiOsQuickCreateItems,
} from "@/src/lib/fiAdmin/fiOsQuickCreateItems";
import {
  getFiOsShellActiveSidebarId,
  resolveFiOsPrimarySidebarItems,
  type FiOsPrimarySidebarItem,
} from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";
import {
  buildFiOsSidebarWorkflowSections,
  type FiOsSidebarWorkflowSection,
} from "@/src/lib/fi-os/fiOsSidebarWorkflow";
import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import {
  FI_OS_FRONT_DESK_LEGACY_ROUTES,
  FI_OS_FRONT_DESK_NAV_ID,
  FI_OS_FRONT_DESK_TABS,
  buildFrontDeskSidebarSubItems,
} from "@/src/lib/fiOs/frontDesk/frontDeskWorkspaceCore";
import type { FiTenantAdminRole } from "@/src/lib/tenantAdmin/tenantAdminRoles";
import { labelHasLegacyModuleLanguage } from "@/src/lib/fiOs/navigation/fiOsNavigation1BDomainMap";
import {
  FI_OS_D6G_PRIMARY_RAIL_SLOT_IDS,
  FI_OS_D6_ADMIN_MORE_NAV_IDS,
  FI_OS_HIDDEN_MORE_SUB_ITEM_IDS,
  FI_OS_LEGACY_MORE_SUB_ITEM_IDS,
  isPrimaryRailNavId,
  isStaffHiddenMoreDrawerLabel,
} from "@/src/lib/fiOs/navigation/fiOsNavigationRegroupingCore";
import {
  FI_OS_REPORTS_ADMIN_LEGACY_ROUTES,
  FI_OS_REPORTS_LEGACY_ROUTES,
  FI_OS_REPORTS_NAV_ID,
  FI_OS_REPORTS_TABS,
  buildReportsSidebarSubItems,
  reportsSubItemUsesStaffFriendlyLabel,
} from "@/src/lib/fiOs/reports/reportsWorkspaceCore";
import {
  FI_OS_SURGERY_ADMIN_LEGACY_ROUTES,
  FI_OS_SURGERY_LEGACY_ROUTES,
  FI_OS_SURGERY_NAV_ID,
  FI_OS_SURGERY_TABS,
  buildSurgerySidebarSubItems,
  surgerySubItemUsesStaffFriendlyLabel,
} from "@/src/lib/fiOs/surgery/surgeryWorkspaceCore";
import {
  FI_OS_TEAM_ADMIN_LEGACY_ROUTES,
  FI_OS_TEAM_LEGACY_ROUTES,
  FI_OS_TEAM_NAV_ID,
  FI_OS_TEAM_TABS,
  buildTeamSidebarSubItems,
  teamSubItemUsesStaffFriendlyLabel,
} from "@/src/lib/fiOs/team/teamWorkspaceCore";

/** Canonical six-slot primary rail labels for staff-facing shell. */
export const GO_LIVE_PRIMARY_RAIL_LABELS = [
  "Today",
  "Calendar",
  "Patients",
  "Team",
  "Reports",
  "More",
] as const;

/** Module-heavy labels that must not appear on the primary rail. */
export const GO_LIVE_FORBIDDEN_PRIMARY_RAIL_LABEL_RE =
  /\b(front desk|surgery|analytics|intelligence|hr os|workforce|auditos|academy|procedure day|quality review|reception|tomorrow)\b/i;

/** Top-level nav ids that must not appear as primary rail rows. */
export const GO_LIVE_FORBIDDEN_PRIMARY_RAIL_NAV_IDS = [
  "front-desk",
  "operations-centre",
  "reception-os",
  "reception-board",
  "tomorrow-board",
  "surgery",
  "surgery-os",
  "cases",
  "analytics",
  "auditos",
  "hr-os",
  "workforce-os-hub",
  "academyos",
  "d6-presence",
  "d6-signal-learning",
  "d6-bake",
  "d6-navigation-audit",
] as const;

/** Staff More drawer must not expose labels matching these terms (word-boundary match). */
export const GO_LIVE_STAFF_HIDDEN_MORE_TERMS = [
  "engine",
  "signal learning",
  "intelligence validation",
  "navigation drift audit",
  "SurgeryOS",
  "WorkforceOS",
  "HR OS",
  "AuditOS",
  "AcademyOS",
  "Identity Audit",
  "outcome intelligence",
  "graft tray replay",
  "AI ops",
] as const;

/** Returns true when a More drawer label exposes a legacy direct deep link. */
export function isStaffHiddenMoreDirectLabel(label: string): boolean {
  return /\(direct\)/i.test(label.trim());
}

function staffHiddenMoreTermMatchesLabel(term: string, label: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(label.trim());
}

/** Admin-only D6 intelligence nav ids expected when admin surfaces are on. */
export const GO_LIVE_ADMIN_D6_NAV_IDS = [
  "d6-presence",
  "d6-signal-learning",
  "d6-bake",
  "d6-navigation-audit",
] as const;

/** Legacy route suffixes preserved for deep-link smoke (path after tenant base). */
export const GO_LIVE_LEGACY_ROUTE_SUFFIXES = [
  ...FI_OS_FRONT_DESK_LEGACY_ROUTES.map((r) => r.suffix),
  ...FI_OS_SURGERY_LEGACY_ROUTES.map((r) => r.suffix),
  ...FI_OS_SURGERY_ADMIN_LEGACY_ROUTES.map((r) => r.suffix),
  ...FI_OS_TEAM_LEGACY_ROUTES.map((r) => r.suffix),
  ...FI_OS_TEAM_ADMIN_LEGACY_ROUTES.map((r) => r.suffix),
  ...FI_OS_REPORTS_LEGACY_ROUTES.map((r) => r.suffix),
  ...FI_OS_REPORTS_ADMIN_LEGACY_ROUTES.map((r) => r.suffix),
] as const;

/** Consolidated workspace tab labels expected at go-live. */
export const GO_LIVE_WORKSPACE_TAB_LABELS = {
  frontDesk: FI_OS_FRONT_DESK_TABS.map((t) => t.label),
  surgery: FI_OS_SURGERY_TABS.map((t) => t.label),
  team: FI_OS_TEAM_TABS.map((t) => t.label),
  reports: FI_OS_REPORTS_TABS.map((t) => t.label),
} as const;

/** Minimal nav active-id expectations for consolidated and legacy routes. */
export const GO_LIVE_MINIMAL_NAV_ACTIVE_EXPECTATIONS: ReadonlyArray<{
  suffix: string;
  expected: FiOsMinimalNavItemId | null;
}> = [
  { suffix: "team", expected: "team" },
  { suffix: "team/staff", expected: "team" },
  { suffix: "workforce-os", expected: "team" },
  { suffix: "hr-os", expected: "team" },
  { suffix: "staff", expected: "team" },
  { suffix: "reports", expected: "reports" },
  { suffix: "reports/analytics", expected: "reports" },
  { suffix: "analytics", expected: "reports" },
  { suffix: "audit", expected: "reports" },
  { suffix: "intelligence/navigation-audit", expected: "reports" },
  { suffix: "front-desk", expected: null },
  { suffix: "front-desk/clinic-flow", expected: null },
  { suffix: "surgery", expected: null },
  { suffix: "surgery/cases", expected: null },
  { suffix: "operations", expected: null },
  { suffix: "reception-os", expected: null },
  { suffix: "surgery-os", expected: null },
  { suffix: "calendar", expected: "calendar" },
] as const;

/** Shell sidebar active-id expectations for consolidated workspace child routes. */
export const GO_LIVE_SHELL_ACTIVE_SIDEBAR_EXPECTATIONS: ReadonlyArray<{
  suffix: string;
  expectedNavId: string;
}> = [
  { suffix: "front-desk", expectedNavId: FI_OS_FRONT_DESK_NAV_ID },
  { suffix: "front-desk/clinic-flow", expectedNavId: FI_OS_FRONT_DESK_NAV_ID },
  { suffix: "front-desk/reception-board", expectedNavId: FI_OS_FRONT_DESK_NAV_ID },
  { suffix: "front-desk/tomorrow", expectedNavId: FI_OS_FRONT_DESK_NAV_ID },
  { suffix: "surgery", expectedNavId: FI_OS_SURGERY_NAV_ID },
  { suffix: "surgery/cases", expectedNavId: FI_OS_SURGERY_NAV_ID },
  { suffix: "surgery/review", expectedNavId: FI_OS_SURGERY_NAV_ID },
  { suffix: "team", expectedNavId: FI_OS_TEAM_NAV_ID },
  { suffix: "team/roster", expectedNavId: FI_OS_TEAM_NAV_ID },
  { suffix: "team/identity", expectedNavId: FI_OS_TEAM_NAV_ID },
  { suffix: "reports", expectedNavId: FI_OS_REPORTS_NAV_ID },
  { suffix: "reports/quality", expectedNavId: FI_OS_REPORTS_NAV_ID },
  { suffix: "operations", expectedNavId: "operations-centre" },
  { suffix: "reception-os", expectedNavId: "reception-os" },
  { suffix: "reception", expectedNavId: "reception-board" },
  { suffix: "tomorrow", expectedNavId: "tomorrow-board" },
  { suffix: "surgery-os", expectedNavId: "surgery-os" },
  { suffix: "cases", expectedNavId: "cases-worklist" },
  { suffix: "workforce-os", expectedNavId: "workforce-os-hub" },
  { suffix: "analytics", expectedNavId: "analytics-legacy" },
  { suffix: "intelligence/navigation-audit", expectedNavId: "d6-navigation-audit" },
] as const;

export type FiOsNavigationGoLiveRoleScenario = {
  persona: string;
  workspaceProfile: FiWorkspaceProfileKey;
  showNavigationAdminSurfaces: boolean;
  showProcedureDayNav?: boolean;
  showTeamAdminSurfaces?: boolean;
  showReportsAdminSurfaces?: boolean;
  tenantBackendAdminRole?: FiTenantAdminRole | null;
};

/** Role profiles for go-live smoke audit. */
export const GO_LIVE_NAV_ROLE_SCENARIOS: readonly FiOsNavigationGoLiveRoleScenario[] = [
  {
    persona: "receptionist",
    workspaceProfile: "reception",
    showNavigationAdminSurfaces: false,
  },
  {
    persona: "clinical_staff",
    workspaceProfile: "nurse",
    showNavigationAdminSurfaces: false,
  },
  {
    persona: "surgeon",
    workspaceProfile: "surgeon",
    showNavigationAdminSurfaces: false,
    showProcedureDayNav: true,
  },
  {
    persona: "manager",
    workspaceProfile: "clinic_manager",
    showNavigationAdminSurfaces: true,
    showProcedureDayNav: true,
    showTeamAdminSurfaces: true,
    showReportsAdminSurfaces: true,
    tenantBackendAdminRole: "clinic_admin",
  },
  {
    persona: "platform_admin",
    workspaceProfile: "platform_admin",
    showNavigationAdminSurfaces: true,
    showProcedureDayNav: true,
    showTeamAdminSurfaces: true,
    showReportsAdminSurfaces: true,
  },
] as const;

export type FiOsNavigationGoLiveCheck = {
  id: string;
  passed: boolean;
  message: string;
  details?: string[];
};

export type FiOsNavigationGoLiveAuditReport = {
  tenantId: string;
  scenario: FiOsNavigationGoLiveRoleScenario;
  checks: FiOsNavigationGoLiveCheck[];
  passed: boolean;
  primaryRailIds: string[];
  primaryRailLabels: string[];
  moreDrawerGroupIds: string[];
  moreDrawerTopLevelIds: string[];
  moreDrawerSubLabels: string[];
  moreDrawerSubIds: string[];
  workspaceTabLabels: Record<string, string[]>;
};

export type FiOsNavigationGoLiveAuditSummary = {
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  scenarioResults: { persona: string; passed: boolean; failedCheckIds: string[] }[];
};

/** Internal audit notes for go-live readiness (static reference). */
export const GO_LIVE_NAVIGATION_AUDIT_NOTES = `
FI-UX-REBUILD D6G-G — Staff go-live navigation smoke audit

Primary rail: Today · Calendar · Patients · Team · Reports · More (six slots)
Search/New: top bar only — not on primary rail
Consolidated workspaces: Front Desk, Surgery, Team, Reports (More drawer + tabs)
Staff More drawer: legacy direct links and admin/intelligence surfaces hidden
Admin More drawer: D6 intelligence, legacy direct links, and gated tabs visible
Legacy deep links: preserved in nav catalog; routes remain live
Calendar, quick-create, roster, staff access, HairAudit, ImagingOS, Surgery Intelligence,
and analytics-event behaviour: out of scope — must not change
`.trim();

function tenantBase(tenantId: string): string {
  return `/fi-admin/${tenantId.trim().replace(/\/+$/, "")}`;
}

function resolveSidebar(
  base: string,
  scenario: FiOsNavigationGoLiveRoleScenario
): FiOsPrimarySidebarItem[] {
  const showAdmin =
    scenario.showNavigationAdminSurfaces ||
    scenario.showTeamAdminSurfaces ||
    scenario.showReportsAdminSurfaces;
  return resolveFiOsPrimarySidebarItems(
    base,
    true,
    true,
    scenario.tenantBackendAdminRole ?? null,
    true,
    true,
    true,
    true,
    true,
    showAdmin,
    showAdmin
  );
}

function resolveMoreSections(
  base: string,
  sidebar: FiOsPrimarySidebarItem[],
  scenario: FiOsNavigationGoLiveRoleScenario
): FiOsSidebarWorkflowSection[] {
  return buildFiOsSidebarWorkflowSections(sidebar, scenario.workspaceProfile, {
    tenantBase: base,
    forCollapsedShell: true,
    showNavigationAdminSurfaces: scenario.showNavigationAdminSurfaces,
    showProcedureDayNav: scenario.showProcedureDayNav ?? false,
    showSurgeryAdminSurfaces: scenario.showNavigationAdminSurfaces,
    showTeamAdminSurfaces:
      scenario.showTeamAdminSurfaces ?? scenario.showNavigationAdminSurfaces,
    showReportsAdminSurfaces:
      scenario.showReportsAdminSurfaces ?? scenario.showNavigationAdminSurfaces,
  });
}

function flattenMoreSubIds(sections: FiOsSidebarWorkflowSection[]): string[] {
  return sections.flatMap((s) =>
    s.items.flatMap((i) => i.subItems?.map((sub) => sub.id) ?? [])
  );
}

function flattenMoreSubLabels(sections: FiOsSidebarWorkflowSection[]): string[] {
  return sections.flatMap((s) =>
    s.items.flatMap((i) => i.subItems?.map((sub) => sub.label) ?? [])
  );
}

function check(
  id: string,
  passed: boolean,
  message: string,
  details?: string[]
): FiOsNavigationGoLiveCheck {
  return { id, passed, message, details };
}

function auditPrimaryRail(
  base: string,
  sidebar: FiOsPrimarySidebarItem[]
): FiOsNavigationGoLiveCheck[] {
  const checks: FiOsNavigationGoLiveCheck[] = [];
  const items = resolveFiOsMinimalNavItems(base, sidebar);
  const ids = items.map((i) => i.id);
  const labels = items.map((i) => i.label);

  checks.push(
    check(
      "primary_rail_slot_count",
      ids.length === 6 && primaryRailSlotIds().length === 6,
      "Primary rail has exactly six slots"
    )
  );

  checks.push(
    check(
      "primary_rail_canonical_order",
      JSON.stringify(ids) === JSON.stringify([...FI_OS_D6G_PRIMARY_RAIL_SLOT_IDS]),
      "Primary rail slot ids match canonical order"
    )
  );

  checks.push(
    check(
      "primary_rail_canonical_labels",
      JSON.stringify(labels) === JSON.stringify([...GO_LIVE_PRIMARY_RAIL_LABELS]),
      "Primary rail labels are Today · Calendar · Patients · Team · Reports · More"
    )
  );

  const forbiddenLabels = labels.filter((l) => GO_LIVE_FORBIDDEN_PRIMARY_RAIL_LABEL_RE.test(l));
  checks.push(
    check(
      "primary_rail_no_module_labels",
      forbiddenLabels.length === 0,
      "Primary rail excludes module-heavy labels",
      forbiddenLabels.length ? forbiddenLabels : undefined
    )
  );

  const forbiddenNavOnRail = sidebar.filter(
    (i) =>
      GO_LIVE_FORBIDDEN_PRIMARY_RAIL_NAV_IDS.includes(
        i.id as (typeof GO_LIVE_FORBIDDEN_PRIMARY_RAIL_NAV_IDS)[number]
      ) && isPrimaryRailNavId(i.id)
  );
  checks.push(
    check(
      "primary_rail_no_forbidden_nav_ids",
      forbiddenNavOnRail.length === 0,
      "Forbidden nav ids are not on primary rail",
      forbiddenNavOnRail.length ? forbiddenNavOnRail.map((i) => i.id) : undefined
    )
  );

  checks.push(
    check(
      "primary_rail_no_search_new",
      !labels.some((l) => /^(search|new)$/i.test(l)),
      "Search and New are not on primary rail"
    )
  );

  const calendarRail = items.find((i) => i.id === "calendar");
  const calendarSidebar = sidebar.find((i) => i.id === "calendar");
  const calendarOk =
    calendarRail?.kind === "link" &&
    calendarRail.href === `${base}/calendar` &&
    calendarRail.disabled === (calendarSidebar?.disabled ?? false);
  checks.push(
    check(
      "calendar_route_unchanged",
      calendarOk,
      "Calendar route and disabled state unchanged on primary rail"
    )
  );

  return checks;
}

function isPermittedProcedureDayDirectLabel(
  label: string,
  showProcedureDayNav?: boolean
): boolean {
  return showProcedureDayNav === true && /^procedure day \(direct\)$/i.test(label.trim());
}

function auditStaffMoreDrawer(
  sections: FiOsSidebarWorkflowSection[],
  opts?: { showProcedureDayNav?: boolean }
): FiOsNavigationGoLiveCheck[] {
  const checks: FiOsNavigationGoLiveCheck[] = [];
  const subIds = flattenMoreSubIds(sections);
  const subLabels = flattenMoreSubLabels(sections);

  const staffSubLabels = subLabels.filter(
    (label) => !isPermittedProcedureDayDirectLabel(label, opts?.showProcedureDayNav)
  );

  const legacyVisible = [...FI_OS_LEGACY_MORE_SUB_ITEM_IDS].filter((id) => {
    if (id === "procedure-day-board") return false;
    return subIds.includes(id);
  });
  checks.push(
    check(
      "staff_more_hides_legacy_direct",
      legacyVisible.length === 0,
      "Staff More drawer hides legacy direct sub-items",
      legacyVisible.length ? legacyVisible : undefined
    )
  );

  const hiddenAdminVisible = [...FI_OS_HIDDEN_MORE_SUB_ITEM_IDS].filter((id) => {
    if (id === "procedure-day-board") return false;
    return subIds.includes(id);
  });
  checks.push(
    check(
      "staff_more_hides_admin_sub_items",
      hiddenAdminVisible.length === 0,
      "Staff More drawer hides admin-only sub-items",
      hiddenAdminVisible.length ? hiddenAdminVisible : undefined
    )
  );

  const directLabels = staffSubLabels.filter((label) => isStaffHiddenMoreDirectLabel(label));
  checks.push(
    check(
      "staff_more_hides_direct_suffix",
      directLabels.length === 0,
      'Staff More drawer excludes "(direct)" legacy deep-link labels',
      directLabels.length ? directLabels : undefined
    )
  );

  const badLabels = staffSubLabels.filter((label) => isStaffHiddenMoreDrawerLabel(label));
  checks.push(
    check(
      "staff_more_hides_forbidden_labels",
      badLabels.length === 0,
      "Staff More drawer excludes forbidden module/admin labels",
      badLabels.length ? badLabels : undefined
    )
  );

  for (const term of GO_LIVE_STAFF_HIDDEN_MORE_TERMS) {
    const matches = staffSubLabels.filter((l) => staffHiddenMoreTermMatchesLabel(term, l));
    checks.push(
      check(
        `staff_more_excludes_${term.replace(/\s+/g, "_").toLowerCase()}`,
        matches.length === 0,
        `Staff More drawer excludes "${term}" labels`,
        matches.length ? matches : undefined
      )
    );
  }

  return checks;
}

function auditAdminMoreDrawer(sections: FiOsSidebarWorkflowSection[]): FiOsNavigationGoLiveCheck[] {
  const checks: FiOsNavigationGoLiveCheck[] = [];
  const subIds = flattenMoreSubIds(sections);

  for (const d6Id of GO_LIVE_ADMIN_D6_NAV_IDS) {
    checks.push(
      check(
        `admin_more_includes_${d6Id}`,
        subIds.includes(d6Id),
        `Admin More drawer includes ${d6Id}`
      )
    );
  }

  const adminLegacyIds = [
    "reception-os",
    "surgery-os",
    "workforce-os-hub",
    "analytics-legacy",
    "staff-identity-audit",
  ];
  const missing = adminLegacyIds.filter((id) => !subIds.includes(id));
  checks.push(
    check(
      "admin_more_includes_legacy_direct",
      missing.length === 0,
      "Admin More drawer retains key legacy direct links",
      missing.length ? missing : undefined
    )
  );

  for (const d6Id of FI_OS_D6_ADMIN_MORE_NAV_IDS) {
    checks.push(
      check(
        `admin_d6_catalog_${d6Id}`,
        subIds.includes(d6Id),
        `Admin More includes D6 catalog entry ${d6Id}`
      )
    );
  }

  return checks;
}

function auditWorkspaceTabs(tenantId: string): FiOsNavigationGoLiveCheck[] {
  const checks: FiOsNavigationGoLiveCheck[] = [];

  const frontDeskSubs = buildFrontDeskSidebarSubItems(tenantId);
  const frontDeskTabIds = FI_OS_FRONT_DESK_TABS.map((t) => t.navSubItemId);
  checks.push(
    check(
      "workspace_front_desk_tabs",
      frontDeskTabIds.every((id) => frontDeskSubs.some((s) => s.id === id)),
      "Front Desk workspace tabs exist",
      GO_LIVE_WORKSPACE_TAB_LABELS.frontDesk
    )
  );

  const surgerySubs = buildSurgerySidebarSubItems(tenantId, {
    showProcedureDayNav: true,
    casesBlocked: false,
  });
  const surgeryTabIds = FI_OS_SURGERY_TABS.map((t) => t.navSubItemId);
  checks.push(
    check(
      "workspace_surgery_tabs",
      surgeryTabIds.every((id) => surgerySubs.some((s) => s.id === id)),
      "Surgery workspace tabs exist",
      GO_LIVE_WORKSPACE_TAB_LABELS.surgery
    )
  );

  const teamSubs = buildTeamSidebarSubItems(tenantId, { showHrOsNav: true });
  const teamTabIds = FI_OS_TEAM_TABS.map((t) => t.navSubItemId);
  checks.push(
    check(
      "workspace_team_tabs",
      teamTabIds.every((id) => teamSubs.some((s) => s.id === id)),
      "Team workspace tabs exist",
      GO_LIVE_WORKSPACE_TAB_LABELS.team
    )
  );

  const reportsSubs = buildReportsSidebarSubItems(tenantId, {
    showAuditOsNav: true,
    showReportsAdminSurfaces: true,
  });
  const reportsTabIds = FI_OS_REPORTS_TABS.map((t) => t.navSubItemId);
  checks.push(
    check(
      "workspace_reports_tabs",
      reportsTabIds.every((id) => reportsSubs.some((s) => s.id === id)),
      "Reports workspace tabs exist",
      GO_LIVE_WORKSPACE_TAB_LABELS.reports
    )
  );

  return checks;
}

function auditLegacyRouteCatalog(tenantId: string, base: string): FiOsNavigationGoLiveCheck[] {
  const checks: FiOsNavigationGoLiveCheck[] = [];

  const catalogs = [
    { name: "front_desk", subs: buildFrontDeskSidebarSubItems(tenantId), legacy: FI_OS_FRONT_DESK_LEGACY_ROUTES },
    {
      name: "surgery",
      subs: buildSurgerySidebarSubItems(tenantId, { showProcedureDayNav: true }),
      legacy: FI_OS_SURGERY_LEGACY_ROUTES,
    },
    {
      name: "team",
      subs: buildTeamSidebarSubItems(tenantId, { showHrOsNav: true }),
      legacy: FI_OS_TEAM_LEGACY_ROUTES,
    },
    {
      name: "reports",
      subs: buildReportsSidebarSubItems(tenantId, { showAuditOsNav: true, showReportsAdminSurfaces: true }),
      legacy: FI_OS_REPORTS_LEGACY_ROUTES,
    },
  ] as const;

  for (const { name, subs, legacy } of catalogs) {
    const subIds = new Set(subs.map((s) => s.id));
    const missing = legacy.filter((r) => !subIds.has(r.id)).map((r) => r.id);
    checks.push(
      check(
        `legacy_catalog_${name}`,
        missing.length === 0,
        `${name} legacy routes remain in nav catalog`,
        missing.length ? missing : undefined
      )
    );
  }

  const unresolved: string[] = [];
  for (const suffix of GO_LIVE_LEGACY_ROUTE_SUFFIXES) {
    const pathname = `${base}/${suffix}`;
    if (getFiOsShellActiveSidebarId(pathname, base) === null) {
      unresolved.push(suffix);
    }
  }
  checks.push(
    check(
      "legacy_routes_resolve_sidebar_id",
      unresolved.length === 0,
      "Legacy route suffixes resolve to sidebar nav ids",
      unresolved.length ? unresolved : undefined
    )
  );

  return checks;
}

function auditQuickCreateUnchanged(base: string): FiOsNavigationGoLiveCheck[] {
  const items = resolveFiOsQuickCreateItems(base, true, true);
  const expectedIds = FI_OS_QUICK_CREATE_ITEMS.map((d) => d.id);
  const actualIds = items.map((i) => i.id);
  return [
    check(
      "quick_create_catalog_unchanged",
      JSON.stringify(actualIds) === JSON.stringify(expectedIds),
      "Quick-create action catalog unchanged",
      actualIds
    ),
    check(
      "quick_create_consultation_navigable",
      items.find((i) => i.id === "consultation")?.enabled === true &&
        items.find((i) => i.id === "consultation")?.href === `${base}/consultations/new`,
      "Quick-create consultation action unchanged"
    ),
  ];
}

function auditActiveStateMapping(base: string): FiOsNavigationGoLiveCheck[] {
  const checks: FiOsNavigationGoLiveCheck[] = [];

  const minimalFailures: string[] = [];
  for (const { suffix, expected } of GO_LIVE_MINIMAL_NAV_ACTIVE_EXPECTATIONS) {
    const actual = getFiOsMinimalNavActiveId(`${base}/${suffix}`, base);
    if (actual !== expected) {
      minimalFailures.push(`${suffix}: expected ${String(expected)}, got ${String(actual)}`);
    }
  }
  checks.push(
    check(
      "minimal_nav_active_mapping",
      minimalFailures.length === 0,
      "Minimal nav active-id mapping covers consolidated and legacy routes",
      minimalFailures.length ? minimalFailures : undefined
    )
  );

  const shellFailures: string[] = [];
  for (const { suffix, expectedNavId } of GO_LIVE_SHELL_ACTIVE_SIDEBAR_EXPECTATIONS) {
    const actual = getFiOsShellActiveSidebarId(`${base}/${suffix}`, base);
    if (actual !== expectedNavId) {
      shellFailures.push(`${suffix}: expected ${expectedNavId}, got ${String(actual)}`);
    }
  }
  checks.push(
    check(
      "shell_sidebar_active_mapping",
      shellFailures.length === 0,
      "Shell sidebar active-id mapping covers workspace and legacy routes",
      shellFailures.length ? shellFailures : undefined
    )
  );

  return checks;
}

function auditStaffFacingLabels(tenantId: string): FiOsNavigationGoLiveCheck[] {
  const checks: FiOsNavigationGoLiveCheck[] = [];

  const surgeryStaff = buildSurgerySidebarSubItems(tenantId, { showSurgeryAdminSurfaces: false });
  const surgeryBad = surgeryStaff.filter(
    (s) => !surgerySubItemUsesStaffFriendlyLabel(s.label) || labelHasLegacyModuleLanguage(s.label)
  );
  checks.push(
    check(
      "staff_labels_surgery",
      surgeryBad.length === 0,
      "Surgery staff-facing sub-item labels pass audit",
      surgeryBad.map((s) => s.label)
    )
  );

  const teamStaff = buildTeamSidebarSubItems(tenantId, {
    showHrOsNav: true,
    showTeamAdminSurfaces: false,
  });
  const teamBad = teamStaff.filter(
    (s) => !teamSubItemUsesStaffFriendlyLabel(s.label) || labelHasLegacyModuleLanguage(s.label)
  );
  checks.push(
    check(
      "staff_labels_team",
      teamBad.length === 0,
      "Team staff-facing sub-item labels pass audit",
      teamBad.map((s) => s.label)
    )
  );

  const reportsStaff = buildReportsSidebarSubItems(tenantId, {
    showAuditOsNav: true,
    showReportsAdminSurfaces: false,
  });
  const reportsBad = reportsStaff.filter((s) => {
    if (s.id === "reports-quality" || s.id === "insights-legacy") return false;
    return !reportsSubItemUsesStaffFriendlyLabel(s.label) || labelHasLegacyModuleLanguage(s.label);
  });
  checks.push(
    check(
      "staff_labels_reports",
      reportsBad.length === 0,
      "Reports staff-facing sub-item labels pass audit",
      reportsBad.map((s) => s.label)
    )
  );

  return checks;
}

/** Build a full go-live audit report for one role scenario. */
export function buildFiOsNavigationGoLiveAuditReport(
  tenantId: string,
  scenario: FiOsNavigationGoLiveRoleScenario
): FiOsNavigationGoLiveAuditReport {
  const base = tenantBase(tenantId);
  const sidebar = resolveSidebar(base, scenario);
  const moreSections = resolveMoreSections(base, sidebar, scenario);
  const isAdmin = scenario.showNavigationAdminSurfaces;

  const checks: FiOsNavigationGoLiveCheck[] = [
    ...auditPrimaryRail(base, sidebar),
    ...(isAdmin
      ? auditAdminMoreDrawer(moreSections)
      : auditStaffMoreDrawer(moreSections, {
          showProcedureDayNav: scenario.showProcedureDayNav,
        })),
    ...auditWorkspaceTabs(tenantId),
    ...auditLegacyRouteCatalog(tenantId, base),
    ...auditQuickCreateUnchanged(base),
    ...auditActiveStateMapping(base),
    ...(isAdmin ? [] : auditStaffFacingLabels(tenantId)),
  ];

  const primaryRail = resolveFiOsMinimalNavItems(base, sidebar);

  return {
    tenantId,
    scenario,
    checks,
    passed: checks.every((c) => c.passed),
    primaryRailIds: primaryRail.map((i) => i.id),
    primaryRailLabels: primaryRail.map((i) => i.label),
    moreDrawerGroupIds: moreSections.map((s) => s.groupId),
    moreDrawerTopLevelIds: moreSections.flatMap((s) => s.items.map((i) => i.id)),
    moreDrawerSubLabels: flattenMoreSubLabels(moreSections),
    moreDrawerSubIds: flattenMoreSubIds(moreSections),
    workspaceTabLabels: {
      frontDesk: [...GO_LIVE_WORKSPACE_TAB_LABELS.frontDesk],
      surgery: [...GO_LIVE_WORKSPACE_TAB_LABELS.surgery],
      team: [...GO_LIVE_WORKSPACE_TAB_LABELS.team],
      reports: [...GO_LIVE_WORKSPACE_TAB_LABELS.reports],
    },
  };
}

/** Run go-live audit across all standard role scenarios. */
export function runFiOsNavigationGoLiveAudit(
  tenantId: string,
  scenarios: readonly FiOsNavigationGoLiveRoleScenario[] = GO_LIVE_NAV_ROLE_SCENARIOS
): FiOsNavigationGoLiveAuditReport[] {
  return scenarios.map((scenario) => buildFiOsNavigationGoLiveAuditReport(tenantId, scenario));
}

/** Summarize multi-scenario go-live audit results. */
export function summarizeFiOsNavigationGoLiveAudit(
  reports: FiOsNavigationGoLiveAuditReport[]
): FiOsNavigationGoLiveAuditSummary {
  const scenarioResults = reports.map((r) => ({
    persona: r.scenario.persona,
    passed: r.passed,
    failedCheckIds: r.checks.filter((c) => !c.passed).map((c) => c.id),
  }));
  const passedScenarios = scenarioResults.filter((s) => s.passed).length;
  return {
    totalScenarios: reports.length,
    passedScenarios,
    failedScenarios: reports.length - passedScenarios,
    scenarioResults,
  };
}

/** Assert all checks pass — throws with first failure message (for tests). */
export function assertFiOsNavigationGoLiveAuditPassed(
  report: FiOsNavigationGoLiveAuditReport
): void {
  const failed = report.checks.filter((c) => !c.passed);
  if (failed.length === 0) return;
  const first = failed[0]!;
  const detail = first.details?.length ? `: ${first.details.join(", ")}` : "";
  throw new Error(`[${report.scenario.persona}] ${first.id} — ${first.message}${detail}`);
}
