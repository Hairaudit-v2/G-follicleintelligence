import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";
import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import { isFiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import type {
  FiStaffFeatureTemplateRow,
  FiStaffPositionTypeRow,
} from "@/src/lib/fi-os/organisationalProfile.schema";
import { mergeFeatureAccessWithOrganisationalLayers, parseFeatureAccessJsonObject } from "@/src/lib/fi-os/organisationalProfile.merge";
import { resolveTenantOperatingModeFeatureDefaults } from "@/src/lib/fi-os/organisationalProfile.tenantMode.server";
import { loadStaffFeatureAccessOverrides } from "@/src/lib/fi-os/staffFeatureAccessOverrides.server";
import { loadStaffMemberForTenant, type FiStaffRow } from "@/src/lib/staff/staff.server";

export type { FiStaffFeatureTemplateRow, FiStaffPositionTypeRow, FiTenantOperatingModeRow } from "@/src/lib/fi-os/organisationalProfile.schema";

function mapPositionType(row: Record<string, unknown>): FiStaffPositionTypeRow {
  return {
    id: String(row.id),
    tenant_id: row.tenant_id != null ? String(row.tenant_id) : null,
    code: String(row.code ?? ""),
    title: String(row.title ?? ""),
    department: String(row.department ?? ""),
    description: row.description != null ? String(row.description) : null,
    default_workspace_profile: row.default_workspace_profile != null ? String(row.default_workspace_profile) : null,
    default_feature_template_key:
      row.default_feature_template_key != null ? String(row.default_feature_template_key) : null,
    clinical_access_level: row.clinical_access_level != null ? String(row.clinical_access_level) : null,
    is_system: Boolean(row.is_system),
    is_active: Boolean(row.is_active),
  };
}

function mapTemplate(row: Record<string, unknown>): FiStaffFeatureTemplateRow {
  return {
    id: String(row.id),
    tenant_id: row.tenant_id != null ? String(row.tenant_id) : null,
    template_key: String(row.template_key ?? ""),
    label: String(row.label ?? ""),
    description: row.description != null ? String(row.description) : null,
    feature_access: row.feature_access,
    workspace_profile: row.workspace_profile != null ? String(row.workspace_profile) : null,
    is_system: Boolean(row.is_system),
    is_active: Boolean(row.is_active),
  };
}

/** Parses `default_workspace_profile` text into a valid workspace key (excludes platform_admin). */
export function parseWorkspaceProfileFromPositionOrTemplate(raw: string | null | undefined): FiWorkspaceProfileKey | null {
  if (raw == null) return null;
  const t = String(raw).trim().toLowerCase();
  if (!t || t === "default" || t === "platform_admin") return null;
  if (!isFiWorkspaceProfileKey(t)) return null;
  return t;
}

export async function loadFiStaffPositionTypesForTenant(tenantId: string): Promise<FiStaffPositionTypeRow[]> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_position_types")
    .select("*")
    .or(`tenant_id.is.null,tenant_id.eq.${tid}`)
    .eq("is_active", true)
    .order("tenant_id", { ascending: true, nullsFirst: true })
    .order("code", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapPositionType);
}

export async function loadFiStaffFeatureTemplateByKey(
  tenantId: string,
  templateKey: string
): Promise<FiStaffFeatureTemplateRow | null> {
  const tid = tenantId.trim();
  const key = templateKey.trim();
  if (!key) return null;
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_feature_templates")
    .select("*")
    .eq("template_key", key)
    .or(`tenant_id.is.null,tenant_id.eq.${tid}`)
    .eq("is_active", true)
    .limit(10);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];
  const tenantScoped = rows.find((r) => r.tenant_id != null && String(r.tenant_id) === tid);
  if (tenantScoped) return mapTemplate(tenantScoped);
  const global = rows.find((r) => r.tenant_id == null);
  return global ? mapTemplate(global) : null;
}

export async function loadFeatureTemplateDefaultsForStaff(
  tenantId: string,
  staffId: string
): Promise<Partial<Record<FiFeatureKey, boolean>>> {
  const tid = tenantId.trim();
  const sid = staffId.trim();
  if (!tid || !sid) return {};
  const staff = await loadStaffMemberForTenant(tid, sid);
  const pid = staff?.position_type_id?.trim() ?? "";
  if (!pid) return {};
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_position_types")
    .select("default_feature_template_key")
    .eq("id", pid)
    .maybeSingle();
  if (error || !data) return {};
  const key = String((data as { default_feature_template_key: string | null }).default_feature_template_key ?? "").trim();
  if (!key) return {};
  const tpl = await loadFiStaffFeatureTemplateByKey(tid, key);
  return parseFeatureAccessJsonObject(tpl?.feature_access);
}

export type StaffOrganisationalProfileSnapshot = {
  staff: FiStaffRow;
  positionType: FiStaffPositionTypeRow | null;
  featureTemplate: FiStaffFeatureTemplateRow | null;
  tenantOperatingModeDefaults: Partial<Record<FiFeatureKey, boolean>>;
  inheritedWorkspaceProfile: FiWorkspaceProfileKey | null;
  effectiveFeatureAccess: Map<FiFeatureKey, boolean>;
  templateFeatureDefaults: Partial<Record<FiFeatureKey, boolean>>;
};

export async function loadStaffOrganisationalProfileSnapshot(
  tenantId: string,
  staffId: string
): Promise<StaffOrganisationalProfileSnapshot | null> {
  const tid = tenantId.trim();
  const sid = staffId.trim();
  if (!tid || !sid) return null;
  const staff = await loadStaffMemberForTenant(tid, sid);
  if (!staff) return null;

  let positionType: FiStaffPositionTypeRow | null = null;
  let featureTemplate: FiStaffFeatureTemplateRow | null = null;
  const posId = staff.position_type_id?.trim() ?? "";
  if (posId) {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase.from("fi_staff_position_types").select("*").eq("id", posId).maybeSingle();
    if (!error && data) positionType = mapPositionType(data as Record<string, unknown>);
  }
  const templateKey = positionType?.default_feature_template_key?.trim() ?? "";
  if (templateKey) {
    featureTemplate = await loadFiStaffFeatureTemplateByKey(tid, templateKey);
  }

  const tenantOperatingModeDefaults = await resolveTenantOperatingModeFeatureDefaults(tid);
  const templateFeatureDefaults = parseFeatureAccessJsonObject(featureTemplate?.feature_access);

  const inheritedFromPosition = parseWorkspaceProfileFromPositionOrTemplate(positionType?.default_workspace_profile ?? null);
  const inheritedFromTemplate = parseWorkspaceProfileFromPositionOrTemplate(featureTemplate?.workspace_profile ?? null);
  const inheritedWorkspaceProfile = inheritedFromPosition ?? inheritedFromTemplate ?? null;

  const staffOverrides = await loadStaffFeatureAccessOverrides(tid, sid);
  const effectiveFeatureAccess = mergeFeatureAccessWithOrganisationalLayers({
    tenantModeDefaults: tenantOperatingModeDefaults,
    templateDefaults: templateFeatureDefaults,
    staffOverrides,
  });

  return {
    staff,
    positionType,
    featureTemplate,
    tenantOperatingModeDefaults,
    inheritedWorkspaceProfile,
    effectiveFeatureAccess,
    templateFeatureDefaults,
  };
}

/**
 * Workspace derivation signals for the signed-in tenant member linked to `fi_staff`.
 */
export async function loadLinkedStaffOrganisationalSignalsForFiUser(
  tenantId: string,
  fiUserId: string
): Promise<{
  staff_role: string;
  explicitWorkspaceProfile: unknown;
  positionTypeDefaultWorkspaceProfile: string | null;
  featureTemplateWorkspaceProfile: string | null;
} | null> {
  const tid = tenantId.trim();
  const uid = fiUserId.trim();
  if (!tid || !uid) return null;
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff")
    .select("staff_role, staff_metadata, position_type_id")
    .eq("tenant_id", tid)
    .eq("fi_user_id", uid)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { staff_role: string | null; staff_metadata: unknown; position_type_id: string | null };
  const md = row.staff_metadata;
  const metaObj = md && typeof md === "object" && !Array.isArray(md) ? (md as Record<string, unknown>) : {};

  let positionTypeDefaultWorkspaceProfile: string | null = null;
  let featureTemplateWorkspaceProfile: string | null = null;
  const pid = row.position_type_id?.trim() ?? "";
  if (pid) {
    const ptRes = await supabase
      .from("fi_staff_position_types")
      .select("default_workspace_profile, default_feature_template_key")
      .eq("id", pid)
      .maybeSingle();
    if (!ptRes.error && ptRes.data) {
      const pt = ptRes.data as { default_workspace_profile: string | null; default_feature_template_key: string | null };
      positionTypeDefaultWorkspaceProfile = pt.default_workspace_profile != null ? String(pt.default_workspace_profile) : null;
      const tk = String(pt.default_feature_template_key ?? "").trim();
      if (tk) {
        const tpl = await loadFiStaffFeatureTemplateByKey(tid, tk);
        featureTemplateWorkspaceProfile = tpl?.workspace_profile ?? null;
      }
    }
  }

  return {
    staff_role: String(row.staff_role ?? "").trim() || "consultant",
    explicitWorkspaceProfile: metaObj.workspace_profile,
    positionTypeDefaultWorkspaceProfile,
    featureTemplateWorkspaceProfile,
  };
}
