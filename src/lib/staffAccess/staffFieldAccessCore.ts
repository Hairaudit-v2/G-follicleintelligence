/**
 * SA-2 — Field-Level Permission Engine: pure core.
 *
 * Deterministic field-permission decision logic with no I/O. The server layer
 * (`staffFieldAccess.server.ts`) resolves the SA-1 module access map plus the field templates
 * and field grants from the database, then calls into here. Keeping this pure makes the policy
 * unit-testable.
 *
 * ── How SA-2 relates to SA-1 ────────────────────────────────────────────────────────────────
 * Field access is a SECOND gate INSIDE module access. It never replaces SA-1:
 *
 *   1. SA-1 decides whether the person can open the MODULE at all (none/read/edit/approve/admin).
 *   2. SA-2 decides, inside a module they can open, what they can do with each FIELD
 *      (hidden/masked/summary/read/edit/approve/export).
 *
 * Field access is always CLAMPED to module access: it can never exceed it. If a person cannot
 * view PatientOS, they cannot read `patient.medical_history` even if a field grant says `export`.
 *
 * ── Precedence (low → high) ─────────────────────────────────────────────────────────────────
 *   field default (per-field masking + sensitivity rule)
 *     < role field template
 *       < explicit active staff field grant (revoked grants ignored)
 *         < admin / platform override
 *   …then the whole result is clamped down to the SA-1 module ceiling.
 *
 * ── Why `export` is separate ────────────────────────────────────────────────────────────────
 * Reading or editing a value in-app is materially different from extracting it (CSV/PDF/API).
 * `export` is the highest, independent level and is NOT implied by read/edit/approve. It requires
 * an explicit `export` grant (within an export-capable module) or an admin override.
 */

import { type StaffAccessLevel, type StaffAccessModuleKey } from "./staffAccessRegistry";
import {
  EXPORT_FORBIDDEN_MODULES,
  SENSITIVITY_DEFAULT_HIDDEN,
  STAFF_ACCESS_FIELDS,
  STAFF_FIELD_PERMISSION_LEVELS,
  getStaffFieldDefinition,
  type RoleFieldTemplateMap,
  type StaffFieldDefinition,
  type StaffFieldMaskingStrategy,
  type StaffFieldPermissionLevel,
} from "./staffFieldAccessRegistry";

export type EffectiveFieldSource = "default" | "role" | "grant" | "override";

export type StaffFieldScope = "tenant" | "clinic" | "own" | "assigned";

// ---------------------------------------------------------------------------
// Rank / normalise helpers
// ---------------------------------------------------------------------------

/** Coerce an arbitrary value into a known field permission level (defaults to `hidden`). */
export function normalizeFieldPermissionLevel(v: unknown): StaffFieldPermissionLevel {
  const s = String(v ?? "").trim();
  return (STAFF_FIELD_PERMISSION_LEVELS as readonly string[]).includes(s)
    ? (s as StaffFieldPermissionLevel)
    : "hidden";
}

/** Numeric rank of a field permission level (0 = hidden … 6 = export). Unknown → 0. */
export function fieldPermissionRank(
  level: StaffFieldPermissionLevel | string | null | undefined
): number {
  const idx = STAFF_FIELD_PERMISSION_LEVELS.indexOf(
    String(level ?? "hidden") as StaffFieldPermissionLevel
  );
  return idx < 0 ? 0 : idx;
}

/** True when `level` is at least as strong as `required`. */
export function fieldPermissionSatisfies(
  level: StaffFieldPermissionLevel | string | null | undefined,
  required: StaffFieldPermissionLevel
): boolean {
  return fieldPermissionRank(level) >= fieldPermissionRank(required);
}

/** The weaker of two field permission levels (used for clamping to a ceiling). */
function minFieldPermission(
  a: StaffFieldPermissionLevel,
  b: StaffFieldPermissionLevel
): StaffFieldPermissionLevel {
  return fieldPermissionRank(a) <= fieldPermissionRank(b) ? a : b;
}

/**
 * The strongest field permission a module-access level permits. Field access is clamped to this.
 *   none → hidden, read → read, edit → edit, approve → approve, admin → export.
 */
export function moduleFieldCeiling(moduleLevel: StaffAccessLevel): StaffFieldPermissionLevel {
  switch (moduleLevel) {
    case "admin":
      return "export";
    case "approve":
      return "approve";
    case "edit":
      return "edit";
    case "read":
      return "read";
    default:
      return "hidden";
  }
}

/** Map a field's default masking strategy to a starting permission level. */
function maskingToPermission(strategy: StaffFieldMaskingStrategy): StaffFieldPermissionLevel {
  switch (strategy) {
    case "visible":
      return "read";
    case "masked":
      return "masked";
    case "summary_only":
      return "summary";
    case "hidden":
    default:
      return "hidden";
  }
}

/**
 * The field's baseline permission BEFORE any role template / grant. Financial and identity
 * sensitivity force `hidden` even when the field's own masking strategy is `visible`.
 */
function fieldBaselinePermission(field: StaffFieldDefinition): StaffFieldPermissionLevel {
  if (SENSITIVITY_DEFAULT_HIDDEN.has(field.sensitivity)) return "hidden";
  return maskingToPermission(field.defaultMaskingStrategy);
}

// ---------------------------------------------------------------------------
// Grant merge
// ---------------------------------------------------------------------------

/** One row from `fi_staff_field_access_grants` (already filtered to a single staff member). */
export type StaffFieldGrantInput = {
  moduleKey: string;
  fieldKey: string;
  permissionLevel: StaffFieldPermissionLevel;
  scope: StaffFieldScope;
  /** When set, the grant is revoked and MUST be ignored. */
  revokedAt: string | null;
};

export type MergedFieldEntry = {
  level: StaffFieldPermissionLevel;
  scope: StaffFieldScope;
  source: "role" | "grant";
};

/**
 * Merge role field templates with explicit grants into a per-field map (before module clamping).
 * Templates form the baseline; active (non-revoked) grants override them. Revoked grants are
 * ignored entirely.
 */
export function mergeRoleFieldTemplatesWithGrants(
  roleTemplate: RoleFieldTemplateMap,
  grants: StaffFieldGrantInput[]
): Record<string, MergedFieldEntry> {
  const out: Record<string, MergedFieldEntry> = {};
  for (const [fieldKey, level] of Object.entries(roleTemplate)) {
    out[fieldKey] = {
      level: normalizeFieldPermissionLevel(level),
      scope: "tenant",
      source: "role",
    };
  }
  for (const g of grants) {
    if (g.revokedAt) continue; // revoked grants never apply
    const fieldKey = g.fieldKey?.trim();
    if (!fieldKey) continue;
    out[fieldKey] = {
      level: normalizeFieldPermissionLevel(g.permissionLevel),
      scope: g.scope,
      source: "grant",
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Effective field permission
// ---------------------------------------------------------------------------

export type EffectiveFieldPermission = {
  moduleKey: StaffAccessModuleKey;
  fieldKey: string;
  /** Final, module-clamped permission level. */
  level: StaffFieldPermissionLevel;
  scope: StaffFieldScope;
  source: EffectiveFieldSource;
  sensitivity: StaffFieldDefinition["sensitivity"];
  /** The strategy a renderer should apply (derived from {@link level}). */
  maskingStrategy: StaffFieldMaskingStrategy;
  /** The desired (pre-clamp) level before being capped to module access. */
  requestedLevel: StaffFieldPermissionLevel;
  /** True when the module ceiling lowered the requested level (admin warning). */
  clamped: boolean;
  /** The SA-1 module level that produced the ceiling. */
  moduleLevel: StaffAccessLevel;
};

export type GetEffectiveFieldPermissionInput = {
  field: StaffFieldDefinition;
  /** SA-1 effective module access level for the field's module. */
  moduleLevel: StaffAccessLevel;
  /** Merged template/grant entry for this field, if any. */
  merged?: MergedFieldEntry | null;
  /** Tenant-admin / platform-admin → export everywhere (unless module forbids export). */
  isAdminOverride?: boolean;
};

/**
 * Resolve the effective, module-clamped permission for ONE field.
 *
 * Order: baseline → role/grant override → admin override → clamp to module ceiling.
 */
export function getEffectiveFieldPermission(
  input: GetEffectiveFieldPermissionInput
): EffectiveFieldPermission {
  const { field, moduleLevel, merged } = input;
  const ceiling = moduleFieldCeiling(moduleLevel);
  const exportForbidden = EXPORT_FORBIDDEN_MODULES.has(field.moduleKey);

  let requested: StaffFieldPermissionLevel;
  let scope: StaffFieldScope = "tenant";
  let source: EffectiveFieldSource;

  if (input.isAdminOverride) {
    // Admin override: export everywhere unless the module forbids export (then cap at approve).
    requested = exportForbidden ? "approve" : "export";
    source = "override";
  } else if (merged) {
    // Explicit role template or grant wins over the field baseline.
    requested = merged.level;
    scope = merged.scope;
    source = merged.source;
  } else if (moduleLevel === "admin") {
    // Module-admins (e.g. owner) get export on fields with no explicit template entry.
    requested = exportForbidden ? "approve" : "export";
    source = "role";
  } else {
    requested = fieldBaselinePermission(field);
    source = "default";
  }

  // Admin override bypasses the module ceiling (they hold module-admin everywhere). Everyone
  // else is clamped: field access can NEVER exceed module access.
  const level = input.isAdminOverride ? requested : minFieldPermission(requested, ceiling);
  const clamped =
    !input.isAdminOverride && fieldPermissionRank(requested) > fieldPermissionRank(ceiling);

  return {
    moduleKey: field.moduleKey,
    fieldKey: field.fieldKey,
    level,
    scope,
    source,
    sensitivity: field.sensitivity,
    maskingStrategy: getFieldMaskingStrategy(level),
    requestedLevel: requested,
    clamped,
    moduleLevel,
  };
}

export type EffectiveFieldAccessMap = Record<string, EffectiveFieldPermission>;

export type ComputeEffectiveFieldAccessInput = {
  /** SA-1 effective module level per module (`none` for modules with no access). */
  moduleLevels: Partial<Record<StaffAccessModuleKey, StaffAccessLevel>>;
  roleTemplate?: RoleFieldTemplateMap | null;
  grants?: StaffFieldGrantInput[];
  isAdminOverride?: boolean;
  /** Restrict the computation to one module's fields (optional optimisation). */
  onlyModule?: StaffAccessModuleKey;
};

/**
 * Compute the effective field permission for every registered field (or one module's fields),
 * given the SA-1 module levels plus this person's field templates and grants.
 */
export function computeEffectiveFieldAccess(
  input: ComputeEffectiveFieldAccessInput
): EffectiveFieldAccessMap {
  const merged = mergeRoleFieldTemplatesWithGrants(input.roleTemplate ?? {}, input.grants ?? []);
  const out: EffectiveFieldAccessMap = {};
  for (const field of STAFF_ACCESS_FIELDS) {
    if (input.onlyModule && field.moduleKey !== input.onlyModule) continue;
    const moduleLevel = input.moduleLevels[field.moduleKey] ?? "none";
    out[field.fieldKey] = getEffectiveFieldPermission({
      field,
      moduleLevel,
      merged: merged[field.fieldKey] ?? null,
      isAdminOverride: input.isAdminOverride,
    });
  }
  return out;
}

/** Effective permission for a single field key (defaults to hidden when unknown/absent). */
export function getFieldPermission(
  access: EffectiveFieldAccessMap,
  fieldKey: string
): EffectiveFieldPermission {
  const found = access[fieldKey];
  if (found) return found;
  const def = getStaffFieldDefinition(fieldKey);
  return {
    moduleKey: (def?.moduleKey ?? "patient_os") as StaffAccessModuleKey,
    fieldKey,
    level: "hidden",
    scope: "tenant",
    source: "default",
    sensitivity: def?.sensitivity ?? "standard",
    maskingStrategy: "hidden",
    requestedLevel: "hidden",
    clamped: false,
    moduleLevel: "none",
  };
}

// ---------------------------------------------------------------------------
// Predicates
// ---------------------------------------------------------------------------

/** Can the person see the REAL value of this field (read or above)? */
export function canViewField(
  level: StaffFieldPermissionLevel | string | null | undefined
): boolean {
  return fieldPermissionSatisfies(level, "read");
}

export function canEditField(
  level: StaffFieldPermissionLevel | string | null | undefined
): boolean {
  return fieldPermissionSatisfies(level, "edit");
}

export function canApproveField(
  level: StaffFieldPermissionLevel | string | null | undefined
): boolean {
  return fieldPermissionSatisfies(level, "approve");
}

/** Export is independent: it requires an explicit `export` level (or admin override upstream). */
export function canExportField(
  level: StaffFieldPermissionLevel | string | null | undefined
): boolean {
  return fieldPermissionSatisfies(level, "export");
}

/** True when the value must be transformed before render (hidden / masked / summary). */
export function shouldMaskField(
  level: StaffFieldPermissionLevel | string | null | undefined
): boolean {
  return fieldPermissionRank(level) < fieldPermissionRank("read");
}

/** Render strategy implied by a permission level. */
export function getFieldMaskingStrategy(
  level: StaffFieldPermissionLevel | string | null | undefined
): StaffFieldMaskingStrategy {
  const norm = normalizeFieldPermissionLevel(level);
  if (norm === "hidden") return "hidden";
  if (norm === "masked") return "masked";
  if (norm === "summary") return "summary_only";
  return "visible";
}

/**
 * Filter a list of field keys to those the person may at least view (read or above), preserving
 * order. Used to build field-aware UI / payloads.
 */
export function filterFieldsByAccess(
  fieldKeys: string[],
  access: EffectiveFieldAccessMap
): string[] {
  return fieldKeys.filter((k) => canViewField(getFieldPermission(access, k).level));
}

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

export const DEFAULT_MASKED_VALUE = "Restricted";
export const DEFAULT_SUMMARY_VALUE = "Summary only";

export type RedactValueOptions = {
  /** Replacement for `masked` fields. Default "Restricted". */
  maskedValue?: unknown;
  /** Replacement for `summary` fields when no specific summary is provided. Default "Summary only". */
  summaryValue?: unknown;
  /** Value to use for `hidden` fields. Default null. */
  hiddenValue?: unknown;
};

/**
 * Transform a single value according to a permission level:
 *   hidden  → hiddenValue (default null)
 *   masked  → maskedValue (default "Restricted")
 *   summary → provided summary, else summaryValue (default "Summary only")
 *   read/edit/approve/export → the original value
 *
 * Pure: never mutates the input.
 */
export function redactValueByFieldPermission<V>(
  value: V,
  level: StaffFieldPermissionLevel,
  opts?: RedactValueOptions & { summary?: unknown }
): V | unknown {
  const norm = normalizeFieldPermissionLevel(level);
  if (norm === "hidden") return opts?.hiddenValue ?? null;
  if (norm === "masked") return opts?.maskedValue ?? DEFAULT_MASKED_VALUE;
  if (norm === "summary") {
    return opts?.summary ?? opts?.summaryValue ?? DEFAULT_SUMMARY_VALUE;
  }
  return value;
}

export type RedactObjectOptions = RedactValueOptions & {
  /** Per-field-key safe summary values used when a field resolves to `summary`. */
  summaries?: Record<string, unknown>;
  /** When true, `hidden` fields are deleted from the clone instead of set to `hiddenValue`. */
  omitHidden?: boolean;
};

/**
 * Redact an object's properties based on field-level access. Returns a SHALLOW CLONE — the
 * original object is never mutated.
 *
 * @param source   the object to redact
 * @param mapping  field-key → object property names, e.g.
 *   {
 *     "patient.identity": ["first_name", "last_name", "date_of_birth"],
 *     "patient.contact_details": ["email", "phone"],
 *     "patient.financial_summary": ["balance", "invoice_total"],
 *   }
 * @param getLevel resolver: field key → effective permission level for this person
 * @param opts     masked/summary/hidden behaviour
 */
export function redactObjectByFieldAccess<T extends Record<string, unknown>>(
  source: T,
  mapping: Record<string, string[]>,
  getLevel: (fieldKey: string) => StaffFieldPermissionLevel,
  opts?: RedactObjectOptions
): T {
  const clone: Record<string, unknown> = { ...source };
  for (const [fieldKey, props] of Object.entries(mapping)) {
    const level = normalizeFieldPermissionLevel(getLevel(fieldKey));
    if (canViewField(level)) continue; // read+ → leave the original value untouched
    for (const prop of props) {
      if (!(prop in clone)) continue;
      if (level === "hidden" && opts?.omitHidden) {
        delete clone[prop];
        continue;
      }
      clone[prop] = redactValueByFieldPermission(clone[prop], level, {
        ...opts,
        summary: opts?.summaries?.[fieldKey],
      });
    }
  }
  return clone as T;
}
