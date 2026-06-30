import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CRM_TASK_ACTIVE_STATUS_VALUES } from "@/src/lib/crm/crmTaskPolicy";
import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import type { FiStaffRow } from "@/src/lib/staff/staff.server";
import type { FiStaffPositionTypeRow } from "@/src/lib/fi-os/organisationalProfile.schema";
import { resolveWorkspaceProfileKeyFromSignals } from "@/src/lib/fi-os/workspaceProfileDerivation";
import { resolveCanManageStaffFeatureAccessSettings } from "@/src/lib/fi-os/featureAccess.server";
import {
  buildStaffSignalCards,
  type FiStaffSignalCountMap,
} from "@/src/lib/fi-os/staffIntelligenceSignals";
import { buildStaffIntelligenceRecommendations } from "@/src/lib/fi-os/staffIntelligenceRecommendations";

const CRM_TERMINAL_LEAD_STATUSES = ["archived", "lost", "converted"] as const;

export type StaffIntelligenceViewModel = {
  workspaceProfileHint: FiWorkspaceProfileKey;
  positionTypeCode: string | null;
  positionTypeTitle: string | null;
  featureTemplateKey: string | null;
  signalCards: ReturnType<typeof buildStaffSignalCards>;
  recommendations: ReturnType<typeof buildStaffIntelligenceRecommendations>;
  latestProfile: { computed_at: string; visibility_scope: string } | null;
};

export async function resolveCanViewStaffOrganisationalIntelligencePanel(
  tenantId: string
): Promise<boolean> {
  return resolveCanManageStaffFeatureAccessSettings(tenantId);
}

async function safeCount(
  fn: () => Promise<{ count: number | null; error: { message: string } | null }>
): Promise<number> {
  try {
    const { count, error } = await fn();
    if (error) return 0;
    return Math.max(0, count ?? 0);
  } catch {
    return 0;
  }
}

async function loadRawCountsForStaff(
  tenantId: string,
  staff: FiStaffRow
): Promise<FiStaffSignalCountMap> {
  const tid = tenantId.trim();
  const sid = staff.id.trim();
  const uid = staff.fi_user_id?.trim() ?? "";
  const supabase = supabaseAdmin();
  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);

  const counts: FiStaffSignalCountMap = {};

  if (uid) {
    counts.follow_ups_due = await safeCount(async () => {
      const q = supabase
        .from("fi_crm_tasks")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tid)
        .eq("assignee_user_id", uid)
        .eq("task_type", "follow_up")
        .in("status", [...CRM_TASK_ACTIVE_STATUS_VALUES]);
      return await q;
    });

    const crmActive = await safeCount(async () => {
      const q = supabase
        .from("fi_crm_tasks")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tid)
        .eq("assignee_user_id", uid)
        .in("status", [...CRM_TASK_ACTIVE_STATUS_VALUES]);
      return await q;
    });

    const crmOverdue = await safeCount(async () => {
      const q = supabase
        .from("fi_crm_tasks")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tid)
        .eq("assignee_user_id", uid)
        .in("status", [...CRM_TASK_ACTIVE_STATUS_VALUES])
        .not("due_at", "is", null)
        .lt("due_at", nowIso);
      return await q;
    });

    counts.leads_assigned = await safeCount(async () => {
      const q = supabase
        .from("fi_crm_leads")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tid)
        .eq("primary_owner_user_id", uid)
        .not("status", "in", `(${CRM_TERMINAL_LEAD_STATUSES.join(",")})`);
      return await q;
    });

    counts.leads_stale = 0;
    counts.consultations_completed = 0;

    counts.productivity_attention = Math.min(200, crmActive + crmOverdue);
  } else {
    counts.follow_ups_due = 0;
    counts.leads_assigned = 0;
    counts.leads_stale = 0;
    counts.consultations_completed = 0;
    counts.productivity_attention = 0;
  }

  counts.consultations_assigned = await safeCount(async () => {
    const q = supabase
      .from("fi_consultations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .eq("consultant_staff_id", sid)
      .in("status", ["draft", "in_progress"]);
    return await q;
  });

  counts.consultations_overdue = await safeCount(async () => {
    const q = supabase
      .from("fi_consultations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .eq("consultant_staff_id", sid)
      .in("status", ["draft", "in_progress"])
      .not("consultation_date", "is", null)
      .lt("consultation_date", today);
    return await q;
  });

  counts.conversion_attention = counts.consultations_overdue ?? 0;

  counts.surgery_cases_assigned = 0;
  counts.surgery_readiness_alerts = 0;
  counts.post_op_pending = 0;
  counts.imaging_uploads_pending = 0;
  counts.training_due = 0;
  counts.certification_expiring = 0;
  counts.audit_reviews_pending = 0;
  counts.patient_satisfaction_low = 0;
  counts.clinical_readiness_attention = 0;

  counts.productivity_attention = Math.min(
    200,
    (counts.productivity_attention ?? 0) +
      (counts.consultations_assigned ?? 0) +
      (counts.consultations_overdue ?? 0)
  );

  return counts;
}

async function loadLatestPerformanceProfile(
  tenantId: string,
  staffId: string
): Promise<StaffIntelligenceViewModel["latestProfile"]> {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("fi_staff_performance_profiles")
      .select("computed_at, visibility_scope")
      .eq("tenant_id", tenantId.trim())
      .eq("staff_id", staffId.trim())
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as { computed_at: string; visibility_scope: string };
    return {
      computed_at: String(row.computed_at),
      visibility_scope: String(row.visibility_scope ?? "manager_only"),
    };
  } catch {
    return null;
  }
}

export async function loadStaffIntelligenceViewModel(
  tenantId: string,
  staff: FiStaffRow,
  positionType: FiStaffPositionTypeRow | null
): Promise<StaffIntelligenceViewModel> {
  const counts = await loadRawCountsForStaff(tenantId, staff);
  const workspaceProfileHint = resolveWorkspaceProfileKeyFromSignals({
    explicitWorkspaceProfile: staff.staff_metadata.workspace_profile,
    positionTypeDefaultWorkspaceProfile: positionType?.default_workspace_profile ?? null,
    featureTemplateWorkspaceProfile: null,
    staffRole: staff.staff_role,
    tenantAdminRole: null,
    fiOsRole: null,
  });

  const signalCards = buildStaffSignalCards(counts);
  const recommendations = buildStaffIntelligenceRecommendations({
    counts,
    workspaceProfileHint,
    positionTypeCode: positionType?.code ?? null,
  });
  const latestProfile = await loadLatestPerformanceProfile(tenantId, staff.id);

  return {
    workspaceProfileHint,
    positionTypeCode: positionType?.code ?? null,
    positionTypeTitle: positionType?.title ?? null,
    featureTemplateKey: positionType?.default_feature_template_key ?? null,
    signalCards,
    recommendations,
    latestProfile,
  };
}

export async function loadStaffIntelligenceViewsForTenantStaff(
  tenantId: string,
  staffRows: FiStaffRow[],
  positionTypes: FiStaffPositionTypeRow[]
): Promise<Record<string, StaffIntelligenceViewModel>> {
  const out: Record<string, StaffIntelligenceViewModel> = {};
  const posById = new Map(positionTypes.map((p) => [p.id, p]));
  const limit = Math.min(staffRows.length, 48);
  for (let i = 0; i < limit; i++) {
    const s = staffRows[i]!;
    const pt = s.position_type_id ? (posById.get(s.position_type_id) ?? null) : null;
    try {
      out[s.id] = await loadStaffIntelligenceViewModel(tenantId, s, pt);
    } catch {
      /* soft fail per staff */
    }
  }
  return out;
}
