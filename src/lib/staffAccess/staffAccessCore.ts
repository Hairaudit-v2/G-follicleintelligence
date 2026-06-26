/**
 * SA-1 — Adaptive Staff Access & Entitlements Engine: pure core.
 *
 * Deterministic merge + decision logic with no I/O. The server layer
 * (`staffAccess.server.ts`) loads role templates, grants, and admin overrides from the
 * database, then calls into here. Keeping this pure makes the policy unit-testable.
 *
 * Effective access = role template defaults
 *   + explicit staff grants (override template; revoked grants excluded)
 *   + tenant-admin / platform-admin override (admin on everything).
 */

import {
  accessLevelRank,
  accessLevelSatisfies,
  isStaffAccessModuleKey,
  STAFF_ACCESS_MODULE_KEYS,
  STAFF_ROLE_TEMPLATE_DEFAULTS,
  type StaffAccessEntry,
  type StaffAccessLevel,
  type StaffAccessModuleKey,
  type StaffAccessScope,
  type StaffRoleKey,
} from "./staffAccessRegistry";

export type EffectiveAccessSource = "role" | "grant" | "override";

export type EffectiveModuleAccess = {
  module: StaffAccessModuleKey;
  level: StaffAccessLevel;
  scope: StaffAccessScope;
  source: EffectiveAccessSource;
  /** Per-tab overrides (tab_key → access), present only when a grant targets a tab. */
  tabs: Record<
    string,
    { level: StaffAccessLevel; scope: StaffAccessScope; source: EffectiveAccessSource }
  >;
};

export type EffectiveAccessMap = Record<StaffAccessModuleKey, EffectiveModuleAccess>;

/** One row from `fi_staff_access_grants` (already filtered to a single staff member). */
export type StaffAccessGrantInput = {
  moduleKey: string;
  tabKey: string | null;
  accessLevel: StaffAccessLevel;
  scope: StaffAccessScope;
  /** When set, the grant is revoked and MUST be ignored. */
  revokedAt: string | null;
};

export type RoleTemplateMap = Partial<Record<StaffAccessModuleKey, StaffAccessEntry>>;

/**
 * Resolve the role template defaults for a role. Prefers a supplied (DB-loaded) map and
 * falls back to the static registry baseline. Unknown role → empty (no access).
 */
export function resolveRoleTemplate(
  roleKey: StaffRoleKey | null,
  dbTemplate?: RoleTemplateMap | null
): RoleTemplateMap {
  if (dbTemplate && Object.keys(dbTemplate).length > 0) return dbTemplate;
  if (!roleKey) return {};
  return STAFF_ROLE_TEMPLATE_DEFAULTS[roleKey] ?? {};
}

function emptyModuleAccess(module: StaffAccessModuleKey): EffectiveModuleAccess {
  return { module, level: "none", scope: "tenant", source: "role", tabs: {} };
}

export type ComputeEffectiveAccessInput = {
  roleKey: StaffRoleKey | null;
  /** DB-loaded role template (optional). Falls back to the registry baseline. */
  roleTemplate?: RoleTemplateMap | null;
  grants: StaffAccessGrantInput[];
  /** Tenant admin or platform admin → admin on every module regardless of role/grants. */
  isAdminOverride?: boolean;
};

/**
 * Compute the full effective access map for one staff member.
 *
 * Precedence (low → high): role template < explicit grant < admin override.
 * Explicit grants override the template even when they LOWER access (e.g. an
 * explicit `none` grant suppresses a module the role would otherwise allow).
 */
export function computeEffectiveAccess(input: ComputeEffectiveAccessInput): EffectiveAccessMap {
  const template = resolveRoleTemplate(input.roleKey ?? null, input.roleTemplate);

  const map = {} as EffectiveAccessMap;
  for (const moduleKey of STAFF_ACCESS_MODULE_KEYS) {
    const fromRole = template[moduleKey];
    map[moduleKey] = fromRole
      ? { module: moduleKey, level: fromRole.level, scope: fromRole.scope, source: "role", tabs: {} }
      : emptyModuleAccess(moduleKey);
  }

  // Apply explicit grants (skip revoked). Grants override the template value directly.
  for (const grant of input.grants) {
    if (grant.revokedAt) continue;
    if (!isStaffAccessModuleKey(grant.moduleKey)) continue;
    const moduleKey = grant.moduleKey;
    const entry = map[moduleKey];

    if (grant.tabKey && grant.tabKey.trim()) {
      entry.tabs[grant.tabKey.trim()] = {
        level: grant.accessLevel,
        scope: grant.scope,
        source: "grant",
      };
      // A tab grant also lifts the module to at least readable so the tab is reachable.
      if (accessLevelRank(grant.accessLevel) > accessLevelRank(entry.level)) {
        // do not downgrade module via a tab grant; only ensure visibility
      }
      if (entry.level === "none" && accessLevelRank(grant.accessLevel) > 0) {
        entry.level = "read";
        entry.scope = grant.scope;
        entry.source = "grant";
      }
      continue;
    }

    entry.level = grant.accessLevel;
    entry.scope = grant.scope;
    entry.source = "grant";
  }

  // Admin override wins over everything.
  if (input.isAdminOverride) {
    for (const moduleKey of STAFF_ACCESS_MODULE_KEYS) {
      map[moduleKey] = { module: moduleKey, level: "admin", scope: "tenant", source: "override", tabs: {} };
    }
  }

  return map;
}

/** Effective access for a single module (defaults to `none` when absent). */
export function getModuleAccess(
  access: EffectiveAccessMap,
  module: StaffAccessModuleKey
): EffectiveModuleAccess {
  return access[module] ?? emptyModuleAccess(module);
}

export function canViewModule(access: EffectiveAccessMap, module: StaffAccessModuleKey): boolean {
  return accessLevelSatisfies(getModuleAccess(access, module).level, "read");
}

export function canEditModule(access: EffectiveAccessMap, module: StaffAccessModuleKey): boolean {
  return accessLevelSatisfies(getModuleAccess(access, module).level, "edit");
}

export function canApproveModule(
  access: EffectiveAccessMap,
  module: StaffAccessModuleKey
): boolean {
  return accessLevelSatisfies(getModuleAccess(access, module).level, "approve");
}

/**
 * Whether a tab within a module is reachable at the required level.
 * A tab inherits the module level unless an explicit tab grant raises/lowers it.
 */
export function canAccessTab(
  access: EffectiveAccessMap,
  module: StaffAccessModuleKey,
  tabKey: string,
  required: StaffAccessLevel = "read"
): boolean {
  const entry = getModuleAccess(access, module);
  const tab = entry.tabs[tabKey?.trim() ?? ""];
  const level = tab ? tab.level : entry.level;
  return accessLevelSatisfies(level, required);
}

/** Generic predicate used by route guards. */
export function moduleSatisfies(
  access: EffectiveAccessMap,
  module: StaffAccessModuleKey,
  required: StaffAccessLevel
): boolean {
  return accessLevelSatisfies(getModuleAccess(access, module).level, required);
}

export type StaffNavModule = {
  module: StaffAccessModuleKey;
  level: StaffAccessLevel;
  scope: StaffAccessScope;
};

/**
 * Filter a module map to the modules the staff member may at least view, in registry order.
 * Used to build dynamic navigation (blocked modules are excluded, not just hidden).
 */
export function getVisibleStaffNavigation(access: EffectiveAccessMap): StaffNavModule[] {
  const out: StaffNavModule[] = [];
  for (const moduleKey of STAFF_ACCESS_MODULE_KEYS) {
    const entry = getModuleAccess(access, moduleKey);
    if (accessLevelSatisfies(entry.level, "read")) {
      out.push({ module: moduleKey, level: entry.level, scope: entry.scope });
    }
  }
  return out;
}

/** Serialisable snapshot of effective access (for audit `previous_access` / `new_access`). */
export function summariseEffectiveAccess(
  access: EffectiveAccessMap
): Record<
  string,
  { level: StaffAccessLevel; scope: StaffAccessScope; source: EffectiveAccessSource }
> {
  const out: Record<
    string,
    { level: StaffAccessLevel; scope: StaffAccessScope; source: EffectiveAccessSource }
  > = {};
  for (const moduleKey of STAFF_ACCESS_MODULE_KEYS) {
    const e = getModuleAccess(access, moduleKey);
    if (e.level !== "none") out[moduleKey] = { level: e.level, scope: e.scope, source: e.source };
  }
  return out;
}
