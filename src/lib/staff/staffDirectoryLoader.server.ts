import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isFiFeatureKey, type FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { isCrmStaffManageRole } from "@/src/lib/crm/crmGatePolicy";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { resolveCanManageStaffFeatureAccessSettings } from "@/src/lib/fi-os/featureAccess.server";
import {
  loadFeatureTemplateDefaultsForStaff,
  loadFiStaffPositionTypesForTenant,
} from "@/src/lib/fi-os/organisationalProfile.server";
import type { FiStaffPositionTypeRow } from "@/src/lib/fi-os/organisationalProfile.schema";
import {
  loadStaffIntelligenceViewsForTenantStaff,
  type StaffIntelligenceViewModel,
} from "@/src/lib/fi-os/staffIntelligence.server";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsElevatedOsOperatorRole } from "@/src/lib/fiOs/fiOsRoles";
import { loadAllStaffForTenant, type FiStaffRow } from "@/src/lib/staff/staff.server";
import {
  buildStaffPayrollSourceDisplay,
  type StaffPayrollSourceDisplay,
} from "@/src/lib/staff/staffPayrollSourceDisplay";
import { loadStaffPinMetadataMap, type StaffPinMetadata } from "@/src/lib/staffPin/staffPin.server";
import { loadHrNotificationByStaffId } from "@/src/lib/staff/staffHrNotificationLoader.server";
import type { StaffHrNotificationSummary } from "@/src/lib/staff/staffHrNotificationSummary";
import { EVOLVED_PAYROLL_SOURCE_SYSTEM } from "@/src/lib/staffImport/evolvedPayrollStaffImportConstants";
import { normalizeFiStaffSourceSystem } from "@/src/lib/staff/staffSourceIdsNormalize";
import {
  loadWorkforceCommandCentreIntelligence,
  type WorkforceCommandCentreIntelligence,
} from "@/src/lib/staff/workforceCommandCentre.server";
import {
  loadWorkforceOperationalMetrics,
  type WorkforceOperationalMetrics,
} from "@/src/lib/workforce/workforceOperationalMetrics.server";

export type StaffDirectoryClinicOption = {
  id: string;
  display_name: string;
};

export type StaffDirectoryPageResult = {
  staff: FiStaffRow[];
  canManageStaff: boolean;
  /** Tenant admins / FI admins — can edit FI OS feature visibility per staff row. */
  canManageStaffFeatureVisibility: boolean;
  /** Sparse DB overrides keyed by staff id (only when `canManageStaffFeatureVisibility`). */
  staffFeatureAccessByStaffId: Record<string, Partial<Record<FiFeatureKey, boolean>>>;
  /** Stage 3.5: template-derived defaults before per-staff overrides (same gate as feature visibility). */
  staffFeatureTemplateDefaultsByStaffId: Record<string, Partial<Record<FiFeatureKey, boolean>>>;
  /** Global + tenant-specific position types for admin dropdown. */
  staffPositionTypes: FiStaffPositionTypeRow[];
  /** Stage 3.75: manager intelligence snapshots per staff (same gate as feature visibility). */
  canViewStaffOrganisationalIntelligence: boolean;
  staffOrganisationalIntelligenceByStaffId: Record<string, StaffIntelligenceViewModel>;
  /** Staff profile id linked to the signed-in tenant user (`fi_staff.fi_user_id` = `fi_users.id`), if any. */
  viewerStaffId: string | null;
  fiUsersForLink: { id: string; email: string | null }[];
  pinMetadataByStaffId: Record<string, StaffPinMetadata>;
  payrollByStaffId: Record<string, StaffPayrollSourceDisplay | null>;
  hrNotificationByStaffId: Record<string, StaffHrNotificationSummary>;
  clinics: StaffDirectoryClinicOption[];
  /** Workforce Command Centre v1 — derived readiness, compliance, and shift intelligence. */
  workforceIntelligence: WorkforceCommandCentreIntelligence;
  /** WorkforceOS Phase 1C Sprint 2 — HR operational metrics for command centre cards. */
  workforceOperationalMetrics: WorkforceOperationalMetrics | null;
};

async function loadFiUserRow(
  tenantId: string,
  authUserId: string
): Promise<{ id: string; role: string } | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_users")
    .select("id, role")
    .eq("tenant_id", tenantId.trim())
    .eq("auth_user_id", authUserId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: String((data as { id: string }).id),
    role: String((data as { role: string | null }).role ?? "member"),
  };
}

async function loadPayrollSourceByStaffId(
  tenantId: string,
  staffIds: string[]
): Promise<Record<string, StaffPayrollSourceDisplay | null>> {
  const out: Record<string, StaffPayrollSourceDisplay | null> = {};
  for (const id of staffIds) out[id] = null;
  if (!staffIds.length) return out;

  const supabase = supabaseAdmin();
  const payrollSys = normalizeFiStaffSourceSystem(EVOLVED_PAYROLL_SOURCE_SYSTEM);
  const { data, error } = await supabase
    .from("fi_staff_source_ids")
    .select("staff_id, source_system, source_staff_id, metadata")
    .eq("tenant_id", tenantId)
    .in("staff_id", staffIds)
    .eq("source_system", payrollSys);
  if (error) throw new Error(error.message);

  for (const raw of data ?? []) {
    const r = raw as {
      staff_id: string;
      source_system: string;
      source_staff_id: string;
      metadata: unknown;
    };
    const md =
      r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
        ? (r.metadata as Record<string, unknown>)
        : null;
    out[String(r.staff_id)] = buildStaffPayrollSourceDisplay({
      source_system: String(r.source_system),
      source_staff_id: String(r.source_staff_id),
      metadata: md,
    });
  }
  return out;
}

async function loadClinicsForTenant(tenantId: string): Promise<StaffDirectoryClinicOption[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_clinics")
    .select("id, display_name")
    .eq("tenant_id", tenantId)
    .order("display_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const row = r as { id: string; display_name: string };
    return { id: String(row.id), display_name: String(row.display_name ?? "").trim() || "Clinic" };
  });
}

export async function loadStaffDirectoryPage(tenantId: string): Promise<StaffDirectoryPageResult> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = supabaseAdmin();
  const [staffRes, usersRes, clinics] = await Promise.all([
    loadAllStaffForTenant(tid),
    supabase
      .from("fi_users")
      .select("id, email")
      .eq("tenant_id", tid)
      .order("email", { ascending: true })
      .limit(200),
    loadClinicsForTenant(tid),
  ]);
  if (usersRes.error) throw new Error(usersRes.error.message);

  const fiUsersForLink = ((usersRes.data ?? []) as { id: string; email: string | null }[]).map(
    (r) => ({
      id: String(r.id),
      email: r.email != null ? String(r.email) : null,
    })
  );

  const authId = await resolveAuthUserId(null);
  let canManageStaff = false;
  let viewerStaffId: string | null = null;
  if (authId) {
    const row = await loadFiUserRow(tid, authId);
    if (row && isCrmStaffManageRole(row.role)) canManageStaff = true;
    if (!canManageStaff) {
      const os = await loadFiOsIdentity(authId);
      if (isFiOsElevatedOsOperatorRole(os?.osRole)) canManageStaff = true;
    }
    if (row) {
      const mine = staffRes.find((s) => (s.fi_user_id?.trim() ?? "") === row.id);
      viewerStaffId = mine?.id ?? null;
    }
  }

  const pinMap = canManageStaff
    ? await loadStaffPinMetadataMap(
        tid,
        staffRes.map((s) => s.id)
      )
    : new Map<string, StaffPinMetadata>();
  const pinMetadataByStaffId = Object.fromEntries(pinMap.entries());
  const staffIds = staffRes.map((s) => s.id);
  const canManageStaffFeatureVisibility = await resolveCanManageStaffFeatureAccessSettings(tid);

  const staffFeatureAccessByStaffId: Record<string, Partial<Record<FiFeatureKey, boolean>>> = {};
  const staffFeatureTemplateDefaultsByStaffId: Record<
    string,
    Partial<Record<FiFeatureKey, boolean>>
  > = {};
  let staffPositionTypes: FiStaffPositionTypeRow[] = [];
  let staffOrganisationalIntelligenceByStaffId: Record<string, StaffIntelligenceViewModel> = {};

  if (canManageStaffFeatureVisibility && staffIds.length) {
    const { data: faRows, error: faErr } = await supabase
      .from("fi_staff_feature_access")
      .select("staff_id, feature_key, enabled")
      .eq("tenant_id", tid)
      .in("staff_id", staffIds);
    if (!faErr && faRows) {
      for (const raw of faRows) {
        const r = raw as { staff_id: string; feature_key: string; enabled: boolean };
        const sid = String(r.staff_id ?? "");
        const fk = String(r.feature_key ?? "");
        if (!sid || !isFiFeatureKey(fk)) continue;
        if (!staffFeatureAccessByStaffId[sid]) staffFeatureAccessByStaffId[sid] = {};
        staffFeatureAccessByStaffId[sid][fk] = Boolean(r.enabled);
      }
    }

    try {
      staffPositionTypes = await loadFiStaffPositionTypesForTenant(tid);
    } catch {
      staffPositionTypes = [];
    }

    await Promise.all(
      staffIds.map(async (sid) => {
        try {
          staffFeatureTemplateDefaultsByStaffId[sid] = await loadFeatureTemplateDefaultsForStaff(
            tid,
            sid
          );
        } catch {
          staffFeatureTemplateDefaultsByStaffId[sid] = {};
        }
      })
    );

    try {
      staffOrganisationalIntelligenceByStaffId = await loadStaffIntelligenceViewsForTenantStaff(
        tid,
        staffRes,
        staffPositionTypes
      );
    } catch {
      staffOrganisationalIntelligenceByStaffId = {};
    }
  }

  const [payrollByStaffId, hrNotificationByStaffId] = await Promise.all([
    loadPayrollSourceByStaffId(tid, staffIds),
    loadHrNotificationByStaffId(tid, staffIds),
  ]);

  let workforceIntelligence: WorkforceCommandCentreIntelligence = {
    perStaff: {},
    tenantOverview: null,
  };
  try {
    workforceIntelligence = await loadWorkforceCommandCentreIntelligence(
      tid,
      staffRes,
      hrNotificationByStaffId
    );
  } catch {
    workforceIntelligence = { perStaff: {}, tenantOverview: null };
  }

  let workforceOperationalMetrics: WorkforceOperationalMetrics | null = null;
  if (canManageStaff) {
    try {
      workforceOperationalMetrics = await loadWorkforceOperationalMetrics(tid);
    } catch {
      workforceOperationalMetrics = null;
    }
  }

  return {
    staff: staffRes,
    canManageStaff,
    canManageStaffFeatureVisibility,
    staffFeatureAccessByStaffId,
    staffFeatureTemplateDefaultsByStaffId,
    staffPositionTypes,
    canViewStaffOrganisationalIntelligence: canManageStaffFeatureVisibility,
    staffOrganisationalIntelligenceByStaffId,
    viewerStaffId,
    fiUsersForLink,
    pinMetadataByStaffId,
    payrollByStaffId,
    hrNotificationByStaffId,
    clinics,
    workforceIntelligence,
    workforceOperationalMetrics,
  };
}
