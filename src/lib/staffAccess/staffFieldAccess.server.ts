import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import {
  getStaffEffectiveAccess,
  type StaffAccessPrincipal,
} from "./staffAccess.server";
import {
  normalizeStaffRoleKey,
  STAFF_ACCESS_MODULE_KEYS,
  type StaffAccessLevel,
  type StaffAccessModuleKey,
  type StaffRoleKey,
} from "./staffAccessRegistry";
import { computeEffectiveAccess } from "./staffAccessCore";
import {
  canApproveField as coreCanApproveField,
  canEditField as coreCanEditField,
  canExportField as coreCanExportField,
  canViewField as coreCanViewField,
  computeEffectiveFieldAccess,
  getFieldPermission as coreGetFieldPermission,
  redactObjectByFieldAccess,
  type EffectiveFieldAccessMap,
  type EffectiveFieldPermission,
  type StaffFieldGrantInput,
  type StaffFieldScope,
} from "./staffFieldAccessCore";
import {
  isStaffFieldPermissionLevel,
  STAFF_ROLE_FIELD_TEMPLATE_DEFAULTS,
  type RoleFieldTemplateMap,
  type StaffFieldPermissionLevel,
} from "./staffFieldAccessRegistry";

/**
 * SA-2 server engine. Resolves the viewer's (or a named staff member's) effective FIELD access by:
 *
 *   1. Reusing SA-1 to resolve the principal and the effective MODULE access map.
 *   2. Loading the role field templates and the explicit field grants from the database.
 *   3. Delegating to the pure {@link computeEffectiveFieldAccess}, which clamps field access to
 *      module access (field access can never exceed module access).
 *
 * Field access is a SECOND gate inside module access — never a replacement for it.
 */

// ---------------------------------------------------------------------------
// DB loaders
// ---------------------------------------------------------------------------

/**
 * Load role field templates from `fi_role_field_permission_templates` for a role. Tenant-specific
 * rows override the global baseline (tenant_id NULL). Falls back to the static registry baseline
 * when the DB has no rows (fresh tenant / local dev / tests).
 */
export async function loadRoleFieldTemplateFromDb(
  tenantId: string,
  roleKey: StaffRoleKey | null
): Promise<RoleFieldTemplateMap> {
  if (!roleKey) return {};
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_role_field_permission_templates")
    .select("tenant_id, field_key, permission_level")
    .eq("role_key", roleKey)
    .or(`tenant_id.is.null,tenant_id.eq.${tid}`);
  if (error || !data || data.length === 0) {
    return { ...(STAFF_ROLE_FIELD_TEMPLATE_DEFAULTS[roleKey] ?? {}) };
  }

  const out: RoleFieldTemplateMap = {};
  // Apply global rows first, then tenant rows so tenant overrides win.
  const rows = (data as Array<Record<string, unknown>>).slice().sort((a, b) => {
    const at = a.tenant_id ? 1 : 0;
    const bt = b.tenant_id ? 1 : 0;
    return at - bt;
  });
  for (const r of rows) {
    const fieldKey = String(r.field_key ?? "");
    const level = String(r.permission_level ?? "hidden");
    if (!fieldKey || !isStaffFieldPermissionLevel(level)) continue;
    out[fieldKey] = level;
  }
  return out;
}

/** Load active + revoked field grants for one staff member (core ignores revoked). */
export async function loadStaffFieldAccessGrants(
  tenantId: string,
  staffMemberId: string | null
): Promise<StaffFieldGrantInput[]> {
  const tid = tenantId.trim();
  const sid = staffMemberId?.trim();
  if (!tid || !sid) return [];
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_field_access_grants")
    .select("module_key, field_key, permission_level, scope, revoked_at")
    .eq("tenant_id", tid)
    .eq("staff_member_id", sid);
  if (error || !data) return [];
  const out: StaffFieldGrantInput[] = [];
  for (const r of data as Array<Record<string, unknown>>) {
    const fieldKey = String(r.field_key ?? "");
    const level = String(r.permission_level ?? "hidden");
    if (!fieldKey || !isStaffFieldPermissionLevel(level)) continue;
    out.push({
      moduleKey: String(r.module_key ?? ""),
      fieldKey,
      permissionLevel: level,
      scope: (String(r.scope ?? "tenant") as StaffFieldScope) ?? "tenant",
      revokedAt: r.revoked_at ? String(r.revoked_at) : null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Effective field access
// ---------------------------------------------------------------------------

export type StaffEffectiveFieldAccessResult = {
  principal: StaffAccessPrincipal | null;
  /** SA-1 module level per module. */
  moduleLevels: Partial<Record<StaffAccessModuleKey, StaffAccessLevel>>;
  fieldAccess: EffectiveFieldAccessMap;
};

function moduleLevelsFromAccess(
  access: ReturnType<typeof computeEffectiveAccess>
): Partial<Record<StaffAccessModuleKey, StaffAccessLevel>> {
  const out: Partial<Record<StaffAccessModuleKey, StaffAccessLevel>> = {};
  for (const m of STAFF_ACCESS_MODULE_KEYS) out[m] = access[m]?.level ?? "none";
  return out;
}

/**
 * Effective FIELD access for the current viewer in a tenant. Reuses SA-1 module access for the
 * clamp. When no principal can be resolved, returns a null principal with an empty access map —
 * callers decide whether to fall back (loaders typically do, to avoid breaking rendering).
 */
export async function getStaffEffectiveFieldAccess(
  tenantId: string
): Promise<StaffEffectiveFieldAccessResult> {
  const { principal, access } = await getStaffEffectiveAccess(tenantId);
  const moduleLevels = moduleLevelsFromAccess(access);
  if (!principal) {
    return { principal: null, moduleLevels, fieldAccess: {} };
  }
  const [roleTemplate, grants] = await Promise.all([
    loadRoleFieldTemplateFromDb(tenantId, principal.roleKey),
    loadStaffFieldAccessGrants(tenantId, principal.staffMemberId),
  ]);
  const fieldAccess = computeEffectiveFieldAccess({
    moduleLevels,
    roleTemplate,
    grants,
    isAdminOverride: principal.isAdminOverride,
  });
  return { principal, moduleLevels, fieldAccess };
}

/**
 * Effective field access for a SPECIFIC staff member (admin preview on the Staff Access page).
 * No session override is applied — this reflects what that staff member would actually see.
 */
export async function getStaffEffectiveFieldAccessForStaffMember(
  tenantId: string,
  staffMemberId: string,
  rawRole: string | null
): Promise<StaffEffectiveFieldAccessResult> {
  const roleKey = normalizeStaffRoleKey(rawRole);
  // Reuse SA-1 module access for this staff member (no session override).
  const moduleAccessMap = computeEffectiveAccess({
    roleKey,
    roleTemplate: await loadRoleModuleTemplate(tenantId, roleKey),
    grants: await loadModuleGrants(tenantId, staffMemberId),
  });
  const moduleLevels = moduleLevelsFromAccess(moduleAccessMap);
  const [roleTemplate, grants] = await Promise.all([
    loadRoleFieldTemplateFromDb(tenantId, roleKey),
    loadStaffFieldAccessGrants(tenantId, staffMemberId),
  ]);
  const fieldAccess = computeEffectiveFieldAccess({ moduleLevels, roleTemplate, grants });
  return { principal: null, moduleLevels, fieldAccess };
}

// Thin re-exports of SA-1 module loaders so the staff-member preview can reuse them without
// duplicating the SQL (kept private to this module).
async function loadRoleModuleTemplate(tenantId: string, roleKey: StaffRoleKey | null) {
  const { loadRoleTemplateFromDb } = await import("./staffAccess.server");
  return loadRoleTemplateFromDb(tenantId, roleKey);
}
async function loadModuleGrants(tenantId: string, staffMemberId: string) {
  const { loadStaffAccessGrants } = await import("./staffAccess.server");
  return loadStaffAccessGrants(tenantId, staffMemberId);
}

// ---------------------------------------------------------------------------
// Convenience predicates for the current viewer
// ---------------------------------------------------------------------------

/** Effective permission for one field for the current viewer. */
export async function getStaffFieldPermission(
  tenantId: string,
  fieldKey: string
): Promise<EffectiveFieldPermission> {
  const { fieldAccess } = await getStaffEffectiveFieldAccess(tenantId);
  return coreGetFieldPermission(fieldAccess, fieldKey);
}

export async function canViewStaffField(tenantId: string, fieldKey: string): Promise<boolean> {
  const perm = await getStaffFieldPermission(tenantId, fieldKey);
  return coreCanViewField(perm.level);
}

export async function canEditStaffField(tenantId: string, fieldKey: string): Promise<boolean> {
  const perm = await getStaffFieldPermission(tenantId, fieldKey);
  return coreCanEditField(perm.level);
}

export async function canApproveStaffField(tenantId: string, fieldKey: string): Promise<boolean> {
  const perm = await getStaffFieldPermission(tenantId, fieldKey);
  return coreCanApproveField(perm.level);
}

export async function canExportStaffField(tenantId: string, fieldKey: string): Promise<boolean> {
  const perm = await getStaffFieldPermission(tenantId, fieldKey);
  return coreCanExportField(perm.level);
}

// ---------------------------------------------------------------------------
// Redaction helpers (do not mutate the input)
// ---------------------------------------------------------------------------

/**
 * Redact an arbitrary object using a field-key → property-names mapping against the current
 * viewer's effective field access. Returns a shallow clone; the original is never mutated.
 */
export async function redactObjectForStaffAccess<T extends Record<string, unknown>>(
  tenantId: string,
  source: T,
  mapping: Record<string, string[]>,
  opts?: { summaries?: Record<string, unknown>; omitHidden?: boolean }
): Promise<T> {
  const { fieldAccess } = await getStaffEffectiveFieldAccess(tenantId);
  return redactObjectByFieldAccess(
    source,
    mapping,
    (fieldKey) => coreGetFieldPermission(fieldAccess, fieldKey).level,
    opts
  );
}

/** Convenience overload that redacts against a pre-resolved access map (avoids re-querying). */
export function redactObjectWithFieldAccess<T extends Record<string, unknown>>(
  fieldAccess: EffectiveFieldAccessMap,
  source: T,
  mapping: Record<string, string[]>,
  opts?: { summaries?: Record<string, unknown>; omitHidden?: boolean }
): T {
  return redactObjectByFieldAccess(
    source,
    mapping,
    (fieldKey) => coreGetFieldPermission(fieldAccess, fieldKey).level,
    opts
  );
}

/** Default PatientOS field → property mapping (callers may override). */
export const PATIENT_FIELD_MAPPING: Record<string, string[]> = {
  "patient.identity": ["first_name", "last_name", "full_name", "date_of_birth", "dob"],
  "patient.contact_details": ["email", "phone", "mobile", "address"],
  "patient.medical_history": ["medical_history", "history", "intake"],
  "patient.medications": ["medications"],
  "patient.financial_summary": ["balance", "invoice_total", "financial_summary", "outstanding"],
  "patient.internal_notes": ["internal_notes"],
};

export async function redactPatientForStaffAccess<T extends Record<string, unknown>>(
  tenantId: string,
  patient: T,
  opts?: { mapping?: Record<string, string[]>; summaries?: Record<string, unknown> }
): Promise<T> {
  return redactObjectForStaffAccess(tenantId, patient, opts?.mapping ?? PATIENT_FIELD_MAPPING, {
    summaries: opts?.summaries,
  });
}

export const CONSULTATION_FIELD_MAPPING: Record<string, string[]> = {
  "consultation.clinical_notes": ["clinical_notes", "notes"],
  "consultation.diagnosis": ["diagnosis"],
  "consultation.treatment_plan": ["treatment_plan", "plan"],
  "consultation.quote": ["quote", "quote_total", "price"],
  "consultation.consent": ["consent", "consent_status"],
  "consultation.private_practitioner_notes": ["private_notes", "practitioner_notes"],
};

export async function redactConsultationForStaffAccess<T extends Record<string, unknown>>(
  tenantId: string,
  consultation: T,
  opts?: { mapping?: Record<string, string[]>; summaries?: Record<string, unknown> }
): Promise<T> {
  return redactObjectForStaffAccess(
    tenantId,
    consultation,
    opts?.mapping ?? CONSULTATION_FIELD_MAPPING,
    { summaries: opts?.summaries }
  );
}

export const SURGERY_FIELD_MAPPING: Record<string, string[]> = {
  "surgery.graft_count": ["graft_count", "grafts"],
  "surgery.hair_count": ["hair_count", "hairs"],
  "surgery.punch_size": ["punch_size"],
  "surgery.transection_rate": ["transection_rate"],
  "surgery.team_members": ["team_members", "team"],
  "surgery.medications": ["medications"],
  "surgery.surgical_notes": ["surgical_notes", "notes"],
  "surgery.complications": ["complications"],
  "surgery.outcome_metrics": ["outcome_metrics", "outcomes"],
};

export async function redactSurgeryCaseForStaffAccess<T extends Record<string, unknown>>(
  tenantId: string,
  surgeryCase: T,
  opts?: { mapping?: Record<string, string[]>; summaries?: Record<string, unknown> }
): Promise<T> {
  return redactObjectForStaffAccess(tenantId, surgeryCase, opts?.mapping ?? SURGERY_FIELD_MAPPING, {
    summaries: opts?.summaries,
  });
}

export const FINANCIAL_FIELD_MAPPING: Record<string, string[]> = {
  "financial.invoice": ["invoice", "invoice_total", "invoices"],
  "financial.payment_status": ["payment_status", "status"],
  "financial.refunds": ["refunds"],
  "financial.revenue": ["revenue"],
  "financial.margin": ["margin"],
  "financial.practitioner_commission": ["practitioner_commission", "commission"],
};

export async function redactFinancialSummaryForStaffAccess<T extends Record<string, unknown>>(
  tenantId: string,
  financial: T,
  opts?: { mapping?: Record<string, string[]>; summaries?: Record<string, unknown> }
): Promise<T> {
  return redactObjectForStaffAccess(tenantId, financial, opts?.mapping ?? FINANCIAL_FIELD_MAPPING, {
    summaries: opts?.summaries,
  });
}

// ---------------------------------------------------------------------------
// Admin-page state + grant mutations
// ---------------------------------------------------------------------------

export type FieldAccessAdminFieldRow = {
  moduleKey: StaffAccessModuleKey;
  fieldKey: string;
  label: string;
  description: string;
  sensitivity: string;
  /** Effective (module-clamped) permission for the selected staff member. */
  effectiveLevel: StaffFieldPermissionLevel;
  /** Inherited (template/default) level before grant — for display. */
  inheritedLevel: StaffFieldPermissionLevel;
  scope: StaffFieldScope;
  source: EffectiveFieldPermission["source"];
  clamped: boolean;
  moduleLevel: StaffAccessLevel;
  /** Active grant id, if any (for the Revoke action). */
  activeGrantId: string | null;
  activeGrantLevel: StaffFieldPermissionLevel | null;
  activeGrantScope: StaffFieldScope | null;
};

export type FieldAccessAdminState = {
  moduleLevels: Partial<Record<StaffAccessModuleKey, StaffAccessLevel>>;
  fieldsByModule: Record<string, FieldAccessAdminFieldRow[]>;
};

/**
 * Build the Field Access admin state for one staff member: per-module fields with their
 * inherited vs effective permission, custom-grant info, and the module-clamp flag.
 */
export async function loadFieldAccessAdminState(
  tenantId: string,
  staffMemberId: string,
  rawRole: string | null
): Promise<FieldAccessAdminState> {
  const roleKey = normalizeStaffRoleKey(rawRole);
  const moduleAccessMap = computeEffectiveAccess({
    roleKey,
    roleTemplate: await loadRoleModuleTemplate(tenantId, roleKey),
    grants: await loadModuleGrants(tenantId, staffMemberId),
  });
  const moduleLevels = moduleLevelsFromAccess(moduleAccessMap);

  const [roleTemplate, grants] = await Promise.all([
    loadRoleFieldTemplateFromDb(tenantId, roleKey),
    loadStaffFieldAccessGrants(tenantId, staffMemberId),
  ]);

  // Effective WITH grants (real) and WITHOUT grants (inherited baseline) for the diff display.
  const effective = computeEffectiveFieldAccess({ moduleLevels, roleTemplate, grants });
  const inherited = computeEffectiveFieldAccess({ moduleLevels, roleTemplate, grants: [] });

  const grantRows = await loadStaffFieldAccessGrantRows(tenantId, staffMemberId);
  const activeByField = new Map<string, (typeof grantRows)[number]>();
  for (const g of grantRows) {
    if (!g.revokedAt) activeByField.set(g.fieldKey, g);
  }

  const { STAFF_ACCESS_FIELDS } = await import("./staffFieldAccessRegistry");
  const fieldsByModule: Record<string, FieldAccessAdminFieldRow[]> = {};
  for (const field of STAFF_ACCESS_FIELDS) {
    const eff = effective[field.fieldKey];
    const inh = inherited[field.fieldKey];
    const active = activeByField.get(field.fieldKey) ?? null;
    (fieldsByModule[field.moduleKey] ??= []).push({
      moduleKey: field.moduleKey,
      fieldKey: field.fieldKey,
      label: field.label,
      description: field.description,
      sensitivity: field.sensitivity,
      effectiveLevel: eff?.level ?? "hidden",
      inheritedLevel: inh?.level ?? "hidden",
      scope: eff?.scope ?? "tenant",
      source: eff?.source ?? "default",
      clamped: eff?.clamped ?? false,
      moduleLevel: moduleLevels[field.moduleKey] ?? "none",
      activeGrantId: active?.id ?? null,
      activeGrantLevel: active?.permissionLevel ?? null,
      activeGrantScope: active?.scope ?? null,
    });
  }

  return { moduleLevels, fieldsByModule };
}

export type StaffFieldAccessGrantRow = {
  id: string;
  clinicId: string | null;
  moduleKey: string;
  fieldKey: string;
  permissionLevel: StaffFieldPermissionLevel;
  scope: StaffFieldScope;
  grantedBy: string | null;
  grantedAt: string;
  revokedAt: string | null;
  reason: string | null;
};

export async function loadStaffFieldAccessGrantRows(
  tenantId: string,
  staffMemberId: string
): Promise<StaffFieldAccessGrantRow[]> {
  const tid = tenantId.trim();
  const sid = staffMemberId.trim();
  if (!tid || !sid) return [];
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_field_access_grants")
    .select(
      "id, clinic_id, module_key, field_key, permission_level, scope, granted_by, granted_at, revoked_at, reason"
    )
    .eq("tenant_id", tid)
    .eq("staff_member_id", sid)
    .order("granted_at", { ascending: false });
  if (error || !data) return [];
  const out: StaffFieldAccessGrantRow[] = [];
  for (const r of data as Array<Record<string, unknown>>) {
    const level = String(r.permission_level ?? "hidden");
    if (!isStaffFieldPermissionLevel(level)) continue;
    out.push({
      id: String(r.id),
      clinicId: r.clinic_id ? String(r.clinic_id) : null,
      moduleKey: String(r.module_key ?? ""),
      fieldKey: String(r.field_key ?? ""),
      permissionLevel: level,
      scope: (String(r.scope ?? "tenant") as StaffFieldScope) ?? "tenant",
      grantedBy: r.granted_by ? String(r.granted_by) : null,
      grantedAt: String(r.granted_at),
      revokedAt: r.revoked_at ? String(r.revoked_at) : null,
      reason: r.reason ? String(r.reason) : null,
    });
  }
  return out;
}

export type UpsertStaffFieldAccessGrantInput = {
  tenantId: string;
  staffMemberId: string;
  moduleKey: string;
  fieldKey: string;
  permissionLevel: StaffFieldPermissionLevel;
  scope: StaffFieldScope;
  clinicId?: string | null;
  reason?: string | null;
  actorAuthUserId: string | null;
};

/**
 * Create or update the single active field grant for (staff, module, field, scope, clinic).
 * Writes a SA-2 audit row capturing previous vs new permission. Returns the grant id on success.
 */
export async function upsertStaffFieldAccessGrant(
  input: UpsertStaffFieldAccessGrantInput
): Promise<{ ok: true; grantId: string } | { ok: false; error: string }> {
  const tid = input.tenantId.trim();
  const sid = input.staffMemberId.trim();
  if (!tid || !sid) return { ok: false, error: "Missing tenant or staff member." };
  const supabase = supabaseAdmin();
  const clinicId = input.clinicId?.trim() || null;

  let existingQuery = supabase
    .from("fi_staff_field_access_grants")
    .select("id, permission_level, scope")
    .eq("tenant_id", tid)
    .eq("staff_member_id", sid)
    .eq("module_key", input.moduleKey)
    .eq("field_key", input.fieldKey)
    .eq("scope", input.scope)
    .is("revoked_at", null);
  existingQuery = clinicId
    ? existingQuery.eq("clinic_id", clinicId)
    : existingQuery.is("clinic_id", null);
  const { data: existing } = await existingQuery.maybeSingle();

  const newPermission = {
    permission_level: input.permissionLevel,
    scope: input.scope,
    clinic_id: clinicId,
  };

  const { tryInsertStaffFieldAccessAuditEvent } = await import("./staffFieldAccessAudit.server");

  if (existing) {
    const prev = existing as { id: string; permission_level: string; scope: string };
    const { error } = await supabase
      .from("fi_staff_field_access_grants")
      .update({
        permission_level: input.permissionLevel,
        scope: input.scope,
        granted_by: input.actorAuthUserId,
        reason: input.reason?.trim() || null,
        metadata: input.reason?.trim() ? { reason: input.reason.trim() } : {},
      })
      .eq("id", prev.id)
      .eq("tenant_id", tid);
    if (error) return { ok: false, error: error.message };

    await tryInsertStaffFieldAccessAuditEvent({
      tenantId: tid,
      clinicId,
      staffMemberId: sid,
      moduleKey: input.moduleKey,
      fieldKey: input.fieldKey,
      changedBy: input.actorAuthUserId,
      previousPermission: { permission_level: prev.permission_level, scope: prev.scope },
      newPermission,
      reason: input.reason?.trim() || null,
    });
    return { ok: true, grantId: prev.id };
  }

  const { data: inserted, error } = await supabase
    .from("fi_staff_field_access_grants")
    .insert({
      tenant_id: tid,
      clinic_id: clinicId,
      staff_member_id: sid,
      module_key: input.moduleKey,
      field_key: input.fieldKey,
      permission_level: input.permissionLevel,
      scope: input.scope,
      granted_by: input.actorAuthUserId,
      reason: input.reason?.trim() || null,
      metadata: input.reason?.trim() ? { reason: input.reason.trim() } : {},
    })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  const grantId = inserted ? String((inserted as { id: string }).id) : "";

  await tryInsertStaffFieldAccessAuditEvent({
    tenantId: tid,
    clinicId,
    staffMemberId: sid,
    moduleKey: input.moduleKey,
    fieldKey: input.fieldKey,
    changedBy: input.actorAuthUserId,
    previousPermission: null,
    newPermission,
    reason: input.reason?.trim() || null,
  });
  return { ok: true, grantId };
}

export async function revokeStaffFieldAccessGrant(input: {
  tenantId: string;
  grantId: string;
  reason?: string | null;
  actorAuthUserId: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const tid = input.tenantId.trim();
  if (!tid) return { ok: false, error: "Missing tenant." };
  const supabase = supabaseAdmin();
  const { data: existing, error: findErr } = await supabase
    .from("fi_staff_field_access_grants")
    .select("id, clinic_id, staff_member_id, module_key, field_key, permission_level, scope, revoked_at")
    .eq("id", input.grantId)
    .eq("tenant_id", tid)
    .maybeSingle();
  if (findErr) return { ok: false, error: findErr.message };
  if (!existing) return { ok: false, error: "Grant not found." };
  const row = existing as {
    id: string;
    clinic_id: string | null;
    staff_member_id: string;
    module_key: string;
    field_key: string;
    permission_level: string;
    scope: string;
    revoked_at: string | null;
  };
  if (row.revoked_at) return { ok: true };

  const { error } = await supabase
    .from("fi_staff_field_access_grants")
    .update({ revoked_at: new Date().toISOString(), revoked_by: input.actorAuthUserId })
    .eq("id", row.id)
    .eq("tenant_id", tid);
  if (error) return { ok: false, error: error.message };

  const { tryInsertStaffFieldAccessAuditEvent } = await import("./staffFieldAccessAudit.server");
  await tryInsertStaffFieldAccessAuditEvent({
    tenantId: tid,
    clinicId: row.clinic_id,
    staffMemberId: row.staff_member_id,
    moduleKey: row.module_key,
    fieldKey: row.field_key,
    changedBy: input.actorAuthUserId,
    previousPermission: { permission_level: row.permission_level, scope: row.scope },
    newPermission: null,
    reason: input.reason?.trim() || null,
  });
  return { ok: true };
}

export {
  loadStaffFieldAccessAuditHistory,
} from "./staffFieldAccessAudit.server";
