import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildEnterpriseDemoStaffHierarchy,
  type EnterpriseDemoStaffHierarchyNode,
  validateEnterpriseDemoStaffHierarchy,
} from "./enterpriseDemoStaffHierarchy";
import { ENTERPRISE_DEMO_CLINICS } from "./enterpriseDemoConstants";

export const ENTERPRISE_DEMO_STAFF_METADATA_FLAG = "enterprise_demo_staff";
export const ENTERPRISE_DEMO_STAFF_KEY_METADATA = "demo_staff_key";

export type EnterpriseDemoStaffSeedResult = {
  createdStaff: number;
  existingStaff: number;
  updatedStaffLinks: number;
  warnings: string[];
};

type ClinicRow = {
  id: string;
  metadata: Record<string, unknown> | null;
};

type StaffRow = {
  id: string;
  email: string | null;
  staff_metadata: Record<string, unknown> | null;
};

const DEFAULT_WORKING_HOURS = {
  weekly: {
    mon: { enabled: true, start: "08:30", end: "17:30" },
    tue: { enabled: true, start: "08:30", end: "17:30" },
    wed: { enabled: true, start: "08:30", end: "17:30" },
    thu: { enabled: true, start: "08:30", end: "17:30" },
    fri: { enabled: true, start: "08:30", end: "17:30" },
    sat: { enabled: false },
    sun: { enabled: false },
  },
} as const;

function clinicMetadataSlug(row: ClinicRow): string | null {
  const slug = row.metadata?.slug;
  return typeof slug === "string" && slug.trim() ? slug.trim() : null;
}

function isEnterpriseDemoStaffMetadata(metadata: unknown): boolean {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  return (metadata as Record<string, unknown>)[ENTERPRISE_DEMO_STAFF_METADATA_FLAG] === true;
}

function demoStaffKeyFromMetadata(metadata: unknown): string | null {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const key = (metadata as Record<string, unknown>)[ENTERPRISE_DEMO_STAFF_KEY_METADATA];
  return typeof key === "string" && key.trim() ? key.trim() : null;
}

function buildStaffMetadata(
  node: EnterpriseDemoStaffHierarchyNode,
  reportsToStaffId: string | null
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    [ENTERPRISE_DEMO_STAFF_METADATA_FLAG]: true,
    [ENTERPRISE_DEMO_STAFF_KEY_METADATA]: node.key,
    hierarchy_scope: node.hierarchyScope,
    hierarchy_level: node.hierarchyLevel,
    reports_to_demo_key: node.reportsToKey,
  };
  if (node.clinicSlug) metadata.demo_clinic_slug = node.clinicSlug;
  if (reportsToStaffId) metadata.reports_to_staff_id = reportsToStaffId;
  return metadata;
}

function buildWorkingHours(
  node: EnterpriseDemoStaffHierarchyNode,
  clinicId: string | null
): Record<string, unknown> {
  const doc: Record<string, unknown> = { ...DEFAULT_WORKING_HOURS };
  const profile: Record<string, unknown> = { position_title: node.positionTitle };
  if (clinicId) profile.primary_clinic_id = clinicId;
  doc._profile = profile;
  return doc;
}

async function loadClinicIdBySlug(
  supabase: SupabaseClient,
  tenantId: string
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("fi_clinics")
    .select("id, metadata")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const clinic = row as ClinicRow;
    const slug = clinicMetadataSlug(clinic);
    if (slug) map.set(slug, String(clinic.id));
  }
  return map;
}

async function loadGlobalPositionTypeIds(supabase: SupabaseClient): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("fi_staff_position_types")
    .select("id, code")
    .is("tenant_id", null)
    .eq("is_active", true);
  if (error) throw new Error(error.message);

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const code = String((row as { code: string }).code ?? "").trim();
    const id = String((row as { id: string }).id ?? "").trim();
    if (code && id) map.set(code, id);
  }
  return map;
}

async function loadExistingStaff(supabase: SupabaseClient, tenantId: string): Promise<StaffRow[]> {
  const { data, error } = await supabase
    .from("fi_staff")
    .select("id, email, staff_metadata")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const raw = row as { id: string; email: string | null; staff_metadata: unknown };
    const metadata =
      raw.staff_metadata &&
      typeof raw.staff_metadata === "object" &&
      !Array.isArray(raw.staff_metadata)
        ? (raw.staff_metadata as Record<string, unknown>)
        : null;
    return {
      id: String(raw.id),
      email: raw.email != null ? String(raw.email) : null,
      staff_metadata: metadata,
    };
  });
}

function findStaffByEmail(rows: StaffRow[], email: string): StaffRow | undefined {
  const normalized = email.trim().toLowerCase();
  return rows.find((row) => row.email?.trim().toLowerCase() === normalized);
}

function findStaffByDemoKey(rows: StaffRow[], key: string): StaffRow | undefined {
  return rows.find((row) => demoStaffKeyFromMetadata(row.staff_metadata) === key);
}

export async function seedEnterpriseDemoStaffHierarchy(
  supabase: SupabaseClient,
  tenantId: string
): Promise<EnterpriseDemoStaffSeedResult> {
  const warnings: string[] = [];
  let createdStaff = 0;
  let existingStaff = 0;
  let updatedStaffLinks = 0;

  const nodes = buildEnterpriseDemoStaffHierarchy();
  const validation = validateEnterpriseDemoStaffHierarchy(nodes);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  const clinicIdBySlug = await loadClinicIdBySlug(supabase, tenantId);
  for (const clinic of ENTERPRISE_DEMO_CLINICS) {
    if (!clinicIdBySlug.has(clinic.slug)) {
      warnings.push(
        `Clinic slug "${clinic.slug}" not found under demo tenant; staff for that clinic will lack primary_clinic_id until clinics are seeded.`
      );
    }
  }

  const positionTypeIds = await loadGlobalPositionTypeIds(supabase);
  const existingRows = await loadExistingStaff(supabase, tenantId);
  const idByKey = new Map<string, string>();
  const now = new Date().toISOString();

  for (const node of nodes) {
    const positionTypeId = positionTypeIds.get(node.positionTypeCode);
    if (!positionTypeId) {
      warnings.push(
        `Global position type "${node.positionTypeCode}" not found; staff "${node.key}" will omit position_type_id.`
      );
    }

    const byEmail = findStaffByEmail(existingRows, node.email);
    const byKey = findStaffByDemoKey(existingRows, node.key);
    const hit = byKey ?? byEmail;

    if (hit) {
      if (!isEnterpriseDemoStaffMetadata(hit.staff_metadata)) {
        warnings.push(
          `Staff email "${node.email}" exists but is not marked as enterprise demo staff; skipped.`
        );
        existingStaff += 1;
        idByKey.set(node.key, hit.id);
        continue;
      }
      existingStaff += 1;
      idByKey.set(node.key, hit.id);
      continue;
    }

    const clinicId = node.clinicSlug ? (clinicIdBySlug.get(node.clinicSlug) ?? null) : null;
    const workingHours = buildWorkingHours(node, clinicId);
    const staffMetadata = buildStaffMetadata(node, null);

    const { data: inserted, error: insErr } = await supabase
      .from("fi_staff")
      .insert({
        tenant_id: tenantId,
        full_name: node.fullName,
        staff_role: node.staffRole,
        position_type_id: positionTypeId ?? null,
        email: node.email,
        mobile: null,
        default_timezone: node.defaultTimezone,
        working_hours: workingHours,
        staff_metadata: staffMetadata,
        is_active: true,
        calendar_color: node.calendarColor,
        calendar_visible: true,
        fi_user_id: null,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    const staffId = String((inserted as { id: string }).id);
    idByKey.set(node.key, staffId);
    existingRows.push({
      id: staffId,
      email: node.email,
      staff_metadata: staffMetadata,
    });
    createdStaff += 1;
  }

  for (const node of nodes) {
    const staffId = idByKey.get(node.key);
    if (!staffId) continue;

    const reportsToStaffId = node.reportsToKey ? (idByKey.get(node.reportsToKey) ?? null) : null;
    if (node.reportsToKey && !reportsToStaffId) {
      warnings.push(`Could not resolve reports_to for "${node.key}" → "${node.reportsToKey}".`);
      continue;
    }

    const row = existingRows.find((r) => r.id === staffId);
    if (!row || !isEnterpriseDemoStaffMetadata(row.staff_metadata)) continue;

    const currentReportsTo = row.staff_metadata?.reports_to_staff_id;
    const expectedReportsTo = reportsToStaffId ?? null;
    if (currentReportsTo === expectedReportsTo) continue;

    const nextMetadata = {
      ...row.staff_metadata,
      reports_to_demo_key: node.reportsToKey,
      reports_to_staff_id: expectedReportsTo,
    };

    const { error: updErr } = await supabase
      .from("fi_staff")
      .update({
        staff_metadata: nextMetadata,
        updated_at: now,
      })
      .eq("tenant_id", tenantId)
      .eq("id", staffId);
    if (updErr) throw new Error(updErr.message);

    row.staff_metadata = nextMetadata;
    updatedStaffLinks += 1;
  }

  return { createdStaff, existingStaff, updatedStaffLinks, warnings };
}
