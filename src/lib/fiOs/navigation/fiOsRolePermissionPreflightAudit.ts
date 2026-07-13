/**
 * FI-UX-REBUILD D6G-G0 — role permission and nav access preflight (read-only).
 * Validates role permissions, workspace visibility, route gates, and mutation guards
 * before staff go-live navigation smoke testing (D6G-G).
 */

import type { FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";
import { isFiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";
import { resolveRequiredFiFeatureForTenantSuffix } from "@/src/config/fiRouteFeatureMap";
import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import {
  filterFiOsPrimarySidebarItemsByFeatureAccess,
  resolveFiOsPrimarySidebarItems,
} from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";
import {
  primaryRailSlotIds,
  resolveFiOsMinimalNavItems,
} from "@/src/lib/fiAdmin/fiOsMinimalNav";
import { mergeFeatureAccessWithOrganisationalLayers } from "@/src/lib/fi-os/organisationalProfile.merge";
import { parseFeatureAccessJsonObject } from "@/src/lib/fi-os/organisationalProfile.merge";
import { resolveFiFeatureRouteDecision } from "@/src/lib/fi-os/featureRouteGuardPolicy";
import { buildFiOsSidebarWorkflowSections } from "@/src/lib/fi-os/fiOsSidebarWorkflow";
import {
  GO_LIVE_FORBIDDEN_PRIMARY_RAIL_NAV_IDS,
  GO_LIVE_STAFF_HIDDEN_MORE_TERMS,
  isStaffHiddenMoreDirectLabel,
  GO_LIVE_ADMIN_D6_NAV_IDS,
} from "@/src/lib/fiOs/navigation/fiOsNavigationGoLiveAudit";
import {
  isPrimaryRailNavId,
  isStaffHiddenMoreDrawerLabel,
} from "@/src/lib/fiOs/navigation/fiOsNavigationRegroupingCore";
import type { FiTenantAdminRole } from "@/src/lib/tenantAdmin/tenantAdminRoles";
import {
  canApproveModule,
  canEditModule,
  canViewModule,
  computeEffectiveAccess,
  computeStaffAccessNavFeatureOverrides,
  moduleSatisfies,
  type StaffAccessGrantInput,
} from "@/src/lib/staffAccess/staffAccessCore";
import { staffCapabilitySatisfies } from "@/src/lib/staffAccess/staffCapabilityCore";
import { resolveTeamWorkspaceTabAccess } from "@/src/lib/staffAccess/staffTeamAccessCore";
import type { StaffAccessModuleKey, StaffRoleKey } from "@/src/lib/staffAccess/staffAccessRegistry";
import type { StaffCapabilityKey } from "@/src/lib/staffAccess/staffCapabilityRegistry";

/** Stage 3.5 feature template defaults (mirrors DB seed). */
export const PREFLIGHT_FEATURE_TEMPLATE_DEFAULTS: Record<
  string,
  Partial<Record<FiFeatureKey, boolean>>
> = {
  reception_default: parseFeatureAccessJsonObject({
    dashboard: true,
    calendar: true,
    patients: true,
    crm: true,
    consultations: false,
    cases: false,
    procedure_day: false,
    prescriptions: false,
    pathology: false,
    imaging: false,
    patient_twin: false,
    audit: false,
    analytics: false,
    academy: false,
    staff: false,
    settings: true,
    quick_actions: true,
    surgery_pipeline: false,
    my_workspace: true,
    attention_centre: true,
  }),
  nurse_default: parseFeatureAccessJsonObject({
    dashboard: true,
    calendar: true,
    patients: true,
    crm: false,
    consultations: false,
    cases: true,
    procedure_day: true,
    prescriptions: true,
    pathology: true,
    imaging: true,
    patient_twin: false,
    audit: false,
    analytics: false,
    academy: false,
    staff: false,
    settings: true,
    quick_actions: true,
    surgery_pipeline: true,
    my_workspace: true,
    attention_centre: true,
  }),
  technician_default: parseFeatureAccessJsonObject({
    dashboard: true,
    calendar: true,
    patients: true,
    crm: false,
    consultations: false,
    cases: true,
    procedure_day: true,
    prescriptions: false,
    pathology: true,
    imaging: true,
    patient_twin: false,
    audit: false,
    analytics: false,
    academy: false,
    staff: false,
    settings: true,
    quick_actions: true,
    surgery_pipeline: false,
    my_workspace: true,
    attention_centre: true,
  }),
  surgeon_default: parseFeatureAccessJsonObject({
    dashboard: true,
    calendar: true,
    patients: true,
    crm: false,
    consultations: true,
    cases: true,
    procedure_day: true,
    prescriptions: true,
    pathology: true,
    imaging: true,
    patient_twin: true,
    audit: true,
    analytics: false,
    academy: false,
    staff: false,
    settings: true,
    quick_actions: true,
    surgery_pipeline: true,
    my_workspace: true,
    attention_centre: true,
  }),
  doctor_default: parseFeatureAccessJsonObject({
    dashboard: true,
    calendar: true,
    patients: true,
    crm: false,
    consultations: true,
    cases: true,
    procedure_day: true,
    prescriptions: true,
    pathology: true,
    imaging: true,
    patient_twin: true,
    audit: false,
    analytics: false,
    academy: false,
    staff: false,
    settings: true,
    quick_actions: true,
    surgery_pipeline: true,
    my_workspace: true,
    attention_centre: true,
  }),
  clinic_manager_default: parseFeatureAccessJsonObject({
    dashboard: true,
    calendar: true,
    patients: true,
    crm: true,
    consultations: true,
    cases: true,
    procedure_day: true,
    prescriptions: true,
    pathology: true,
    imaging: true,
    patient_twin: false,
    audit: false,
    analytics: false,
    academy: false,
    staff: true,
    settings: true,
    quick_actions: true,
    surgery_pipeline: true,
    my_workspace: true,
    attention_centre: true,
  }),
  finance_admin_default: parseFeatureAccessJsonObject({
    dashboard: true,
    calendar: true,
    patients: true,
    crm: true,
    consultations: true,
    cases: true,
    procedure_day: false,
    prescriptions: false,
    pathology: false,
    imaging: false,
    patient_twin: false,
    audit: false,
    analytics: true,
    academy: false,
    staff: true,
    settings: true,
    quick_actions: true,
    surgery_pipeline: true,
    my_workspace: true,
    attention_centre: true,
  }),
};

/** Routes audited for Stage 2 feature + SA-1 module alignment. */
export const PREFLIGHT_PROTECTED_ROUTE_AUDITS: ReadonlyArray<{
  suffix: string;
  module: StaffAccessModuleKey | null;
  moduleLevel: "read" | "edit" | "approve";
  capability?: StaffCapabilityKey;
  adminOnly?: boolean;
}> = [
  { suffix: "front-desk", module: "clinic_os", moduleLevel: "read" },
  { suffix: "surgery", module: "surgery_os", moduleLevel: "read" },
  { suffix: "surgery/procedure-day", module: "surgery_os", moduleLevel: "read" },
  { suffix: "surgery/review", module: "surgery_os", moduleLevel: "read" },
  { suffix: "team", module: "workforce_os", moduleLevel: "read" },
  {
    suffix: "team/roster",
    module: "workforce_os",
    moduleLevel: "edit",
    capability: "roster.manage",
  },
  { suffix: "team/onboarding", module: "workforce_os", moduleLevel: "edit" },
  { suffix: "team/compliance", module: "workforce_os", moduleLevel: "read" },
  { suffix: "team/training", module: "workforce_os", moduleLevel: "read" },
  {
    suffix: "team/identity",
    module: "workforce_os",
    moduleLevel: "edit",
    capability: "team.identity.manage",
  },
  { suffix: "reports", module: "analytics_os", moduleLevel: "read" },
  { suffix: "reports/admin", module: null, moduleLevel: "read", adminOnly: true },
  { suffix: "intelligence/navigation-audit", module: null, moduleLevel: "read", adminOnly: true },
  { suffix: "surgery-os/intelligence", module: "surgery_os", moduleLevel: "read" },
  { suffix: "staff", module: "workforce_os", moduleLevel: "read" },
  { suffix: "financial-os", module: "financial_os", moduleLevel: "read" },
  { suffix: "audit", module: "audit_os", moduleLevel: "read" },
];

export type FiOsRolePermissionPreflightScenario = {
  persona: string;
  staffRoleKey: StaffRoleKey;
  featureTemplateKey: keyof typeof PREFLIGHT_FEATURE_TEMPLATE_DEFAULTS | null;
  workspaceProfile: FiWorkspaceProfileKey;
  /** Platform admin bypasses Stage 2 feature map (null = all visible). */
  bypassFeatureMap?: boolean;
  showNavigationAdminSurfaces?: boolean;
  showProcedureDayNav?: boolean;
  showTeamAdminSurfaces?: boolean;
  showReportsAdminSurfaces?: boolean;
  tenantBackendAdminRole?: FiTenantAdminRole | null;
  /** D6G-G0B explicit SA-1 tab/module grants (capability overrides). */
  staffAccessGrants?: readonly StaffAccessGrantInput[];
};

/** Standard role scenarios for D6G-G0 preflight. */
export const PREFLIGHT_ROLE_SCENARIOS: readonly FiOsRolePermissionPreflightScenario[] = [
  {
    persona: "receptionist",
    staffRoleKey: "reception",
    featureTemplateKey: "reception_default",
    workspaceProfile: "reception",
  },
  {
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
  },
  {
    persona: "clinical_staff",
    staffRoleKey: "nurse",
    featureTemplateKey: "nurse_default",
    workspaceProfile: "nurse",
    showProcedureDayNav: true,
  },
  {
    persona: "surgical_assistant",
    staffRoleKey: "nurse",
    featureTemplateKey: "technician_default",
    workspaceProfile: "nurse",
    showProcedureDayNav: true,
  },
  {
    persona: "surgeon",
    staffRoleKey: "doctor",
    featureTemplateKey: "surgeon_default",
    workspaceProfile: "surgeon",
    showProcedureDayNav: true,
  },
  {
    persona: "manager",
    staffRoleKey: "manager",
    featureTemplateKey: "clinic_manager_default",
    workspaceProfile: "clinic_manager",
    showNavigationAdminSurfaces: true,
    showProcedureDayNav: true,
    showTeamAdminSurfaces: true,
    showReportsAdminSurfaces: true,
    tenantBackendAdminRole: "clinic_admin",
  },
  {
    persona: "finance_admin",
    staffRoleKey: "manager",
    featureTemplateKey: "finance_admin_default",
    workspaceProfile: "director",
    tenantBackendAdminRole: "finance_admin",
  },
  {
    persona: "platform_admin",
    staffRoleKey: "platform_admin",
    featureTemplateKey: null,
    workspaceProfile: "platform_admin",
    bypassFeatureMap: true,
    showNavigationAdminSurfaces: true,
    showProcedureDayNav: true,
    showTeamAdminSurfaces: true,
    showReportsAdminSurfaces: true,
  },
] as const;

export type FiOsPermissionPreflightCheck = {
  id: string;
  passed: boolean;
  message: string;
  details?: string[];
};

export type FiOsPermissionMatrixRow = {
  role: string;
  primaryRail: string;
  frontDeskAccess: string;
  surgeryAccess: string;
  teamAccess: string;
  reportsAccess: string;
  adminIntelligenceAccess: string;
  mutationAccess: string;
  riskNotes: string[];
  pass: boolean;
};

export type FiOsRolePermissionPreflightReport = {
  tenantId: string;
  scenario: FiOsRolePermissionPreflightScenario;
  checks: FiOsPermissionPreflightCheck[];
  passed: boolean;
  matrixRow: FiOsPermissionMatrixRow;
};

export type FiOsRolePermissionPreflightSummary = {
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  matrix: FiOsPermissionMatrixRow[];
  scenarioResults: { persona: string; passed: boolean; failedCheckIds: string[] }[];
};

function tenantBase(tenantId: string): string {
  return `/fi-admin/${tenantId.trim().replace(/\/+$/, "")}`;
}

export function buildEffectiveFeatureAccessMapForScenario(
  scenario: FiOsRolePermissionPreflightScenario
): Map<FiFeatureKey, boolean> | null {
  if (scenario.bypassFeatureMap) return null;

  const templateDefaults =
    scenario.featureTemplateKey != null
      ? (PREFLIGHT_FEATURE_TEMPLATE_DEFAULTS[scenario.featureTemplateKey] ?? {})
      : {};

  const map = mergeFeatureAccessWithOrganisationalLayers({
    templateDefaults,
    staffOverrides: {},
  });

  const access = computeEffectiveAccess({
    roleKey: scenario.staffRoleKey,
    grants: [...(scenario.staffAccessGrants ?? [])],
  });
  const sa1Overrides = computeStaffAccessNavFeatureOverrides(access);
  for (const [key, value] of Object.entries(sa1Overrides)) {
    if (isFiFeatureKey(key) && value === false) {
      map.set(key, false);
    }
  }
  return map;
}

function resolveScenarioSidebar(base: string, scenario: FiOsRolePermissionPreflightScenario) {
  const showAdmin =
    scenario.showNavigationAdminSurfaces ||
    scenario.showTeamAdminSurfaces ||
    scenario.showReportsAdminSurfaces;
  const raw = resolveFiOsPrimarySidebarItems(
    base,
    true,
    true,
    scenario.tenantBackendAdminRole ?? null,
    true,
    true,
    true,
    true,
    true,
    showAdmin ?? false,
    showAdmin ?? false,
    undefined,
    showAdmin ?? false
  );
  const featureMap = buildEffectiveFeatureAccessMapForScenario(scenario);
  return filterFiOsPrimarySidebarItemsByFeatureAccess(raw, featureMap);
}

function resolveScenarioMoreSections(
  base: string,
  sidebar: ReturnType<typeof resolveScenarioSidebar>,
  scenario: FiOsRolePermissionPreflightScenario
) {
  return buildFiOsSidebarWorkflowSections(sidebar, scenario.workspaceProfile, {
    tenantBase: base,
    forCollapsedShell: true,
    showNavigationAdminSurfaces: scenario.showNavigationAdminSurfaces ?? false,
    showProcedureDayNav: scenario.showProcedureDayNav ?? false,
    showSurgeryAdminSurfaces: scenario.showNavigationAdminSurfaces ?? false,
    showTeamAdminSurfaces:
      scenario.showTeamAdminSurfaces ?? scenario.showNavigationAdminSurfaces ?? false,
    showReportsAdminSurfaces:
      scenario.showReportsAdminSurfaces ?? scenario.showNavigationAdminSurfaces ?? false,
    showSettingsAdminSurfaces:
      scenario.showNavigationAdminSurfaces ?? scenario.showReportsAdminSurfaces ?? false,
  });
}

function check(
  id: string,
  passed: boolean,
  message: string,
  details?: string[]
): FiOsPermissionPreflightCheck {
  return { id, passed, message, details };
}

function featureRouteAllowed(
  suffix: string,
  base: string,
  featureMap: Map<FiFeatureKey, boolean> | null,
  isTenantBackendAdmin: boolean
): boolean {
  const decision = resolveFiFeatureRouteDecision({
    pathname: `${base}/${suffix}`,
    tenantBase: base,
    featureAccessMap: featureMap,
    isActiveTenantBackendAdmin: isTenantBackendAdmin,
  });
  return decision.kind === "allow";
}

function auditPrimaryRail(
  base: string,
  sidebar: ReturnType<typeof resolveScenarioSidebar>
): FiOsPermissionPreflightCheck[] {
  const items = resolveFiOsMinimalNavItems(base, sidebar);
  const ids = items.map((i) => i.id);
  const checks: FiOsPermissionPreflightCheck[] = [];

  checks.push(
    check(
      "primary_rail_six_slots",
      ids.length === 6 && primaryRailSlotIds().length === 6,
      "Primary rail has exactly six slots"
    )
  );

  const forbiddenOnRail = sidebar.filter(
    (i) =>
      GO_LIVE_FORBIDDEN_PRIMARY_RAIL_NAV_IDS.includes(
        i.id as (typeof GO_LIVE_FORBIDDEN_PRIMARY_RAIL_NAV_IDS)[number]
      ) && isPrimaryRailNavId(i.id)
  );
  checks.push(
    check(
      "primary_rail_no_forbidden_modules",
      forbiddenOnRail.length === 0,
      "No workspace-only modules appear on primary rail",
      forbiddenOnRail.map((i) => i.id)
    )
  );

  const enabledWithoutSidebarTarget = items.filter((item) => {
    if (item.kind !== "link" || item.id === "today") return false;
    const navId =
      item.id === "calendar"
        ? "calendar"
        : item.id === "patients"
          ? "patients"
          : item.id === "front-desk"
            ? "front-desk"
            : item.id === "team"
              ? "team"
              : null;
    if (!navId) return false;
    const inSidebar = sidebar.some((s) => s.id === navId);
    return !inSidebar && item.disabled !== true;
  });
  checks.push(
    check(
      "primary_rail_disabled_when_filtered",
      enabledWithoutSidebarTarget.length === 0,
      "Primary rail slots are disabled when filtered from sidebar by permissions",
      enabledWithoutSidebarTarget.map((i) => i.id)
    )
  );

  return checks;
}

function isPermittedProcedureDayDirectLabel(
  label: string,
  showProcedureDayNav?: boolean
): boolean {
  return (
    showProcedureDayNav === true &&
    /^(procedure day|surgery day)\s*\(direct\)$/i.test(label.trim())
  );
}

function auditStaffMoreDrawer(
  sections: ReturnType<typeof resolveScenarioMoreSections>,
  scenario: FiOsRolePermissionPreflightScenario
): FiOsPermissionPreflightCheck[] {
  if (scenario.showNavigationAdminSurfaces) return [];

  const checks: FiOsPermissionPreflightCheck[] = [];
  const subLabels = sections.flatMap((s) =>
    s.items.flatMap((i) => i.subItems?.map((sub) => sub.label) ?? [])
  );
  const subIds = sections.flatMap((s) =>
    s.items.flatMap((i) => i.subItems?.map((sub) => sub.id) ?? [])
  );

  const staffSubLabels = subLabels.filter(
    (l) => !isPermittedProcedureDayDirectLabel(l, scenario.showProcedureDayNav)
  );

  const badLabels = staffSubLabels.filter(
    (l) => isStaffHiddenMoreDrawerLabel(l) || isStaffHiddenMoreDirectLabel(l)
  );
  checks.push(
    check(
      "staff_more_no_admin_labels",
      badLabels.length === 0,
      "Staff More drawer excludes admin/intelligence/direct labels",
      badLabels
    )
  );

  for (const term of GO_LIVE_STAFF_HIDDEN_MORE_TERMS) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "i");
    const matches = staffSubLabels.filter((l) => re.test(l));
    checks.push(
      check(
        `staff_more_excludes_${term.replace(/\s+/g, "_").toLowerCase()}`,
        matches.length === 0,
        `Staff More drawer excludes "${term}"`,
        matches
      )
    );
  }

  const adminD6Visible = GO_LIVE_ADMIN_D6_NAV_IDS.filter((id) => subIds.includes(id));
  checks.push(
    check(
      "staff_more_no_d6_intelligence",
      adminD6Visible.length === 0,
      "Staff More drawer hides D6 intelligence nav ids",
      adminD6Visible
    )
  );

  return checks;
}

function routeModuleAllowed(
  access: ReturnType<typeof computeEffectiveAccess>,
  route: (typeof PREFLIGHT_PROTECTED_ROUTE_AUDITS)[number]
): boolean {
  if (route.module == null) return true;
  if (route.capability && staffCapabilitySatisfies(access, route.capability)) {
    return true;
  }
  return moduleSatisfies(access, route.module, route.moduleLevel);
}

function auditRouteAccess(
  base: string,
  scenario: FiOsRolePermissionPreflightScenario,
  featureMap: Map<FiFeatureKey, boolean> | null
): FiOsPermissionPreflightCheck[] {
  const access = computeEffectiveAccess({
    roleKey: scenario.staffRoleKey,
    grants: [...(scenario.staffAccessGrants ?? [])],
  });
  const isBackendAdmin = scenario.tenantBackendAdminRole != null;
  const checks: FiOsPermissionPreflightCheck[] = [];

  for (const route of PREFLIGHT_PROTECTED_ROUTE_AUDITS) {
    if (route.adminOnly) {
      const allowedForStaff = !scenario.showNavigationAdminSurfaces;
      if (allowedForStaff) {
        checks.push(
          check(
            `route_${route.suffix.replace(/\//g, "_")}_staff_denied`,
            !featureRouteAllowed(route.suffix, base, featureMap, isBackendAdmin) ||
              scenario.showNavigationAdminSurfaces !== true,
            `Staff role should not pass feature route for admin-only ${route.suffix}`
          )
        );
      }
      continue;
    }

    const featureAllowed = featureRouteAllowed(route.suffix, base, featureMap, isBackendAdmin);
    const moduleAllowed = routeModuleAllowed(access, route);

    const expectedAllow = featureAllowed && moduleAllowed;
    const requiredFeature = resolveRequiredFiFeatureForTenantSuffix(route.suffix);
    const featureOn =
      featureMap === null || requiredFeature == null || featureMap.get(requiredFeature) !== false;

    checks.push(
      check(
        `route_gate_${route.suffix.replace(/\//g, "_")}`,
        expectedAllow === (featureOn && moduleAllowed),
        `Route ${route.suffix} gate aligns feature (${String(requiredFeature)}) and SA-1 (${route.module ?? "n/a"})`,
        expectedAllow !== (featureOn && moduleAllowed)
          ? [`feature=${String(featureAllowed)}, module=${String(moduleAllowed)}`]
          : undefined
      )
    );
  }

  return checks;
}

function auditCapabilityOverrides(
  scenario: FiOsRolePermissionPreflightScenario
): FiOsPermissionPreflightCheck[] {
  if (scenario.persona !== "receptionist_roster_override") {
    return [];
  }

  const access = computeEffectiveAccess({
    roleKey: scenario.staffRoleKey,
    grants: [...(scenario.staffAccessGrants ?? [])],
  });
  const tabAccess = resolveTeamWorkspaceTabAccess(access, { hrOsFullNav: false });
  const checks: FiOsPermissionPreflightCheck[] = [];

  checks.push(
    check(
      "capability_reception_roster_manage",
      staffCapabilitySatisfies(access, "roster.manage"),
      "Receptionist override grants roster.manage via tab grant"
    )
  );

  checks.push(
    check(
      "capability_reception_no_identity_admin",
      !staffCapabilitySatisfies(access, "team.identity.manage"),
      "Receptionist roster override does not grant identity admin"
    )
  );

  checks.push(
    check(
      "capability_reception_roster_tab_visible",
      tabAccess.visibleTabIds.includes("roster") && !tabAccess.visibleTabIds.includes("identity"),
      "Roster override exposes roster tab only (not identity)",
      tabAccess.visibleTabIds
    )
  );

  checks.push(
    check(
      "capability_reception_staff_nav_enabled",
      computeStaffAccessNavFeatureOverrides(access).staff !== false,
      "Roster override enables staff nav feature for Team workspace"
    )
  );

  return checks;
}

function auditMutationGuards(scenario: FiOsRolePermissionPreflightScenario): FiOsPermissionPreflightCheck[] {
  const access = computeEffectiveAccess({
    roleKey: scenario.staffRoleKey,
    grants: [...(scenario.staffAccessGrants ?? [])],
  });
  const checks: FiOsPermissionPreflightCheck[] = [];

  const rosterEdit = canEditModule(access, "workforce_os");
  const staffInvite = canEditModule(access, "workforce_os");
  const onboardingEdit = canEditModule(access, "workforce_os");
  const _surgeryEdit = canEditModule(access, "surgery_os");
  const surgeryApprove = canApproveModule(access, "surgery_os");
  const analyticsRead = canViewModule(access, "analytics_os");
  const auditRead = canViewModule(access, "audit_os");

  checks.push(
    check(
      "mutation_reception_no_roster_edit",
      scenario.persona !== "receptionist" || !rosterEdit,
      "Receptionist cannot edit roster (workforce_os edit)"
    )
  );

  checks.push(
    check(
      "mutation_reception_no_staff_admin",
      scenario.persona !== "receptionist" || !staffInvite,
      "Receptionist cannot manage staff access"
    )
  );

  checks.push(
    check(
      "mutation_nurse_no_roster_unless_manager",
      scenario.persona !== "clinical_staff" || !rosterEdit,
      "Clinical nurse cannot edit roster without workforce_os edit"
    )
  );

  checks.push(
    check(
      "mutation_surgeon_surgery_access",
      scenario.persona !== "surgeon" || surgeryApprove,
      "Surgeon can approve surgery_os mutations"
    )
  );

  checks.push(
    check(
      "mutation_surgeon_no_staff_admin",
      scenario.persona !== "surgeon" || !canEditModule(access, "workforce_os"),
      "Surgeon does not get workforce_os edit by default"
    )
  );

  checks.push(
    check(
      "mutation_manager_workforce_edit",
      scenario.persona !== "manager" || rosterEdit,
      "Manager can edit workforce_os (roster/staff)"
    )
  );

  checks.push(
    check(
      "mutation_manager_onboarding",
      scenario.persona !== "manager" || onboardingEdit,
      "Manager can edit onboarding (workforce_os)"
    )
  );

  checks.push(
    check(
      "mutation_finance_analytics",
      scenario.persona !== "finance_admin" || analyticsRead,
      "Finance admin can view analytics_os"
    )
  );

  checks.push(
    check(
      "mutation_platform_admin_full",
      scenario.persona !== "platform_admin" || canApproveModule(access, "workforce_os"),
      "Platform admin has full workforce_os access"
    )
  );

  checks.push(
    check(
      "mutation_clinical_no_audit_unless_permitted",
      !["clinical_staff", "surgical_assistant", "receptionist"].includes(scenario.persona) ||
        !auditRead,
      "General staff roles lack audit_os unless explicitly granted"
    )
  );

  checks.push(
    check(
      "mutation_reception_roster_override",
      scenario.persona !== "receptionist_roster_override" ||
        staffCapabilitySatisfies(access, "roster.manage"),
      "Receptionist with roster override can manage roster"
    )
  );

  checks.push(
    check(
      "mutation_reception_override_no_identity",
      scenario.persona !== "receptionist_roster_override" ||
        !staffCapabilitySatisfies(access, "team.identity.manage"),
      "Receptionist roster override does not grant identity manage"
    )
  );

  return checks;
}

function auditNavRouteConsistency(
  base: string,
  sections: ReturnType<typeof resolveScenarioMoreSections>,
  scenario: FiOsRolePermissionPreflightScenario,
  featureMap: Map<FiFeatureKey, boolean> | null
): FiOsPermissionPreflightCheck[] {
  const _access = computeEffectiveAccess({ roleKey: scenario.staffRoleKey, grants: [] });
  const isBackendAdmin = scenario.tenantBackendAdminRole != null;
  const mismatches: string[] = [];

  for (const section of sections) {
    for (const item of section.items) {
      for (const sub of item.subItems ?? []) {
        if (sub.featureKey && featureMap?.get(sub.featureKey) === false) {
          mismatches.push(`${sub.label}: feature ${sub.featureKey} off but visible in More`);
        }
        const hrefSuffix = sub.href.replace(base, "").replace(/^\//, "");
        if (!hrefSuffix) continue;
        const featureOk = featureRouteAllowed(hrefSuffix, base, featureMap, isBackendAdmin);
        if (!featureOk && !sub.label.includes("(direct)")) {
          mismatches.push(`${sub.label}: nav visible but feature route denies ${hrefSuffix}`);
        }
      }
    }
  }

  return [
    check(
      "nav_route_consistency",
      mismatches.length === 0,
      "Visible More drawer items map to accessible routes",
      mismatches.length ? mismatches : undefined
    ),
  ];
}

function buildMatrixRow(
  scenario: FiOsRolePermissionPreflightScenario,
  sidebar: ReturnType<typeof resolveScenarioSidebar>,
  sections: ReturnType<typeof resolveScenarioMoreSections>,
  checks: FiOsPermissionPreflightCheck[]
): FiOsPermissionMatrixRow {
  const access = computeEffectiveAccess({
    roleKey: scenario.staffRoleKey,
    grants: [...(scenario.staffAccessGrants ?? [])],
  });
  const rail = resolveFiOsMinimalNavItems(tenantBase("matrix"), sidebar);
  const railSummary = rail
    .filter((i) => i.kind === "link")
    .map((i) => (i.disabled ? `${i.label}(off)` : i.label))
    .join(" · ");

  const hasNav = (id: string) => sidebar.some((s) => s.id === id);
  const moreHas = (id: string) =>
    sections.some((s) => s.items.some((i) => i.id === id || i.subItems?.some((sub) => sub.id === id)));

  const riskNotes: string[] = [];
  if (scenario.persona === "receptionist" && hasNav("team")) {
    riskNotes.push("Team nav visible — verify tenant policy");
  }
  if (scenario.persona === "receptionist" && hasNav("reports")) {
    riskNotes.push("Reports nav visible — verify tenant policy");
  }
  if (!scenario.showNavigationAdminSurfaces && moreHas("staff-identity-audit")) {
    riskNotes.push("Identity audit link visible to staff");
  }

  return {
    role: scenario.persona,
    primaryRail: railSummary,
    frontDeskAccess: hasNav("front-desk") || moreHas("front-desk") ? "yes" : "no",
    surgeryAccess: canViewModule(access, "surgery_os") ? "workflow" : "no",
    teamAccess: staffCapabilitySatisfies(access, "roster.manage")
      ? canEditModule(access, "workforce_os")
        ? "manage"
        : "roster override"
      : canViewModule(access, "workforce_os")
        ? canEditModule(access, "workforce_os")
          ? "manage"
          : "limited"
        : "no",
    reportsAccess: canViewModule(access, "analytics_os")
      ? "analytics"
      : canViewModule(access, "audit_os")
        ? "quality"
        : "no",
    adminIntelligenceAccess: scenario.showNavigationAdminSurfaces ? "admin surfaces" : "none",
    mutationAccess: [
      canEditModule(access, "workforce_os") ? "roster/staff" : null,
      canApproveModule(access, "surgery_os") ? "surgery" : null,
      canViewModule(access, "analytics_os") ? "reports" : null,
    ]
      .filter(Boolean)
      .join(", ") || "read-only",
    riskNotes,
    pass: checks.every((c) => c.passed),
  };
}

/** Build a full preflight report for one role scenario. */
export function buildFiOsRolePermissionPreflightReport(
  tenantId: string,
  scenario: FiOsRolePermissionPreflightScenario
): FiOsRolePermissionPreflightReport {
  const base = tenantBase(tenantId);
  const featureMap = buildEffectiveFeatureAccessMapForScenario(scenario);
  const sidebar = resolveScenarioSidebar(base, scenario);
  const moreSections = resolveScenarioMoreSections(base, sidebar, scenario);

  const checks: FiOsPermissionPreflightCheck[] = [
    ...auditPrimaryRail(base, sidebar),
    ...auditStaffMoreDrawer(moreSections, scenario),
    ...auditRouteAccess(base, scenario, featureMap),
    ...auditCapabilityOverrides(scenario),
    ...auditMutationGuards(scenario),
    ...auditNavRouteConsistency(base, moreSections, scenario, featureMap),
  ];

  const matrixRow = buildMatrixRow(scenario, sidebar, moreSections, checks);

  return {
    tenantId,
    scenario,
    checks,
    passed: checks.every((c) => c.passed),
    matrixRow,
  };
}

/** Run preflight audit across all standard role scenarios. */
export function runFiOsRolePermissionPreflightAudit(
  tenantId: string,
  scenarios: readonly FiOsRolePermissionPreflightScenario[] = PREFLIGHT_ROLE_SCENARIOS
): FiOsRolePermissionPreflightReport[] {
  return scenarios.map((scenario) => buildFiOsRolePermissionPreflightReport(tenantId, scenario));
}

/** Summarize multi-scenario preflight results with permission matrix. */
export function summarizeFiOsRolePermissionPreflightAudit(
  reports: FiOsRolePermissionPreflightReport[]
): FiOsRolePermissionPreflightSummary {
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
    matrix: reports.map((r) => r.matrixRow),
    scenarioResults,
  };
}

/** Assert all checks pass — throws with first failure (for tests). */
export function assertFiOsRolePermissionPreflightPassed(
  report: FiOsRolePermissionPreflightReport
): void {
  const failed = report.checks.filter((c) => !c.passed);
  if (failed.length === 0) return;
  const first = failed[0]!;
  const detail = first.details?.length ? `: ${first.details.join(", ")}` : "";
  throw new Error(`[${report.scenario.persona}] ${first.id} — ${first.message}${detail}`);
}

/** Format permission matrix as markdown table (internal report). */
export function formatPermissionMatrixMarkdown(
  summary: FiOsRolePermissionPreflightSummary
): string {
  const headers = [
    "Role",
    "Primary rail",
    "Front Desk",
    "Surgery",
    "Team",
    "Reports",
    "Admin/intelligence",
    "Mutations",
    "Risk notes",
    "Pass/fail",
  ];
  const rows = summary.matrix.map((r) => [
    r.role,
    r.primaryRail,
    r.frontDeskAccess,
    r.surgeryAccess,
    r.teamAccess,
    r.reportsAccess,
    r.adminIntelligenceAccess,
    r.mutationAccess,
    r.riskNotes.join("; ") || "—",
    r.pass ? "PASS" : "FAIL",
  ]);
  const sep = "| " + headers.map(() => "---").join(" | ") + " |";
  const head = "| " + headers.join(" | ") + " |";
  const body = rows.map((row) => "| " + row.join(" | ") + " |").join("\n");
  return `# FI OS Role Permission Preflight Matrix (D6G-G0)\n\n${head}\n${sep}\n${body}\n`;
}
