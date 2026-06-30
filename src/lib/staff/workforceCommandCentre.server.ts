import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  pickStaffHrNotificationFromSourceRows,
  buildStaffHrNotificationNoLinkSummary,
} from "@/src/lib/staff/staffHrNotificationSummary";
import type { StaffHrNotificationSummary } from "@/src/lib/staff/staffHrNotificationSummary";
import { buildStaffComplianceSummaryFromSourceRows } from "@/src/lib/staffCompliance/staffComplianceSummary";
import type { FiStaffRow } from "@/src/lib/staff/staff.server";
import {
  buildTenantWorkforceReadinessOverview,
  type TenantWorkforceReadinessOverview,
} from "@/src/lib/workforce-os/workforceReadinessTenantOverview.server";
import { calculateWorkforceReadinessScore } from "@/src/lib/workforce-os/workforceReadinessEngine";
import type { WorkforceReadinessBandId } from "@/src/lib/workforce-os/workforceReadinessBands";
import {
  isSurgeryReadyStaff,
  type StaffWorkforceIntelligence,
} from "@/src/lib/staff/workforceCommandCentre";

export type WorkforceCommandCentreIntelligence = {
  perStaff: Record<string, StaffWorkforceIntelligence>;
  tenantOverview: TenantWorkforceReadinessOverview | null;
};

type SourceRow = {
  source_system: string;
  source_staff_id: string;
  source_url: string | null;
  metadata: Record<string, unknown> | null;
};

function formatNextShiftLabel(startsAt: string, shiftType: string): string {
  const d = new Date(startsAt);
  if (Number.isNaN(d.getTime())) return shiftType.replace(/_/g, " ");
  const date = d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const typeLabel = shiftType.replace(/_/g, " ");
  return `${date} · ${time} (${typeLabel})`;
}

function buildTrainingProgressLabel(
  trainingRequired: number | null,
  hr: StaffHrNotificationSummary
): string {
  if (trainingRequired != null && trainingRequired > 0) return `${trainingRequired} required`;
  if (hr.onboardingStatus === "complete") return "Complete";
  if (hr.hasHrLink) return "In progress";
  return "—";
}

async function loadUpcomingShiftByStaffId(
  tenantId: string,
  staffIds: string[]
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!staffIds.length) return out;

  const supabase = supabaseAdmin();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("fi_staff_shifts")
    .select("staff_id, starts_at, shift_type")
    .eq("tenant_id", tenantId)
    .in("staff_id", staffIds)
    .neq("status", "cancelled")
    .gte("starts_at", nowIso)
    .order("starts_at", { ascending: true })
    .limit(Math.min(staffIds.length * 3, 500));

  if (error) {
    // Table may be absent on older tenants — safe fallback for v1.
    return out;
  }

  for (const raw of data ?? []) {
    const row = raw as { staff_id: string; starts_at: string; shift_type: string };
    const sid = String(row.staff_id);
    if (out[sid]) continue;
    out[sid] = formatNextShiftLabel(String(row.starts_at), String(row.shift_type ?? "shift"));
  }

  return out;
}

/**
 * Loads per-staff workforce intelligence for the Staff / Workforce Command Centre.
 * Reuses readiness engine and HR metadata — no new persistence layer.
 */
export async function loadWorkforceCommandCentreIntelligence(
  tenantId: string,
  staff: FiStaffRow[],
  hrNotificationByStaffId: Record<string, StaffHrNotificationSummary>
): Promise<WorkforceCommandCentreIntelligence> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const staffIds = staff.map((s) => s.id);
  const now = new Date();

  let tenantOverview: TenantWorkforceReadinessOverview | null = null;
  try {
    tenantOverview = await buildTenantWorkforceReadinessOverview(tid, staff);
  } catch {
    tenantOverview = null;
  }

  const perStaff: Record<string, StaffWorkforceIntelligence> = {};
  if (!staffIds.length) {
    return { perStaff, tenantOverview };
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_source_ids")
    .select("staff_id, source_system, source_staff_id, source_url, metadata")
    .eq("tenant_id", tid)
    .in("staff_id", staffIds);

  if (error) {
    // Fallback: HR notification summaries only (no readiness scores).
    for (const s of staff) {
      const hr = hrNotificationByStaffId[s.id] ?? buildStaffHrNotificationNoLinkSummary();
      perStaff[s.id] = {
        readinessScore: null,
        readinessBand: null,
        readinessBandLabel: null,
        complianceStatus:
          hr?.required_documents_missing_count != null && hr.required_documents_missing_count > 0
            ? "missing"
            : null,
        trainingRequiredCount: hr?.training_required_count ?? null,
        trainingProgressLabel: buildTrainingProgressLabel(hr?.training_required_count ?? null, hr),
        nextShiftLabel: null,
        surgeryReady: false,
      };
    }
    return { perStaff, tenantOverview };
  }

  const rowsByStaff = new Map<string, SourceRow[]>();
  for (const raw of data ?? []) {
    const r = raw as {
      staff_id: string;
      source_system: string;
      source_staff_id: string;
      source_url: string | null;
      metadata: unknown;
    };
    const sid = String(r.staff_id);
    const list = rowsByStaff.get(sid) ?? [];
    list.push({
      source_system: String(r.source_system),
      source_staff_id: String(r.source_staff_id),
      source_url: r.source_url,
      metadata:
        r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
          ? (r.metadata as Record<string, unknown>)
          : null,
    });
    rowsByStaff.set(sid, list);
  }

  let nextShiftByStaffId: Record<string, string> = {};
  try {
    nextShiftByStaffId = await loadUpcomingShiftByStaffId(tid, staffIds);
  } catch {
    nextShiftByStaffId = {};
  }

  for (const s of staff) {
    const srcRows = rowsByStaff.get(s.id) ?? [];
    const mappedRows = srcRows.map((row) => ({
      source_system: row.source_system,
      source_staff_id: row.source_staff_id,
      metadata: row.metadata,
    }));

    const hr =
      hrNotificationByStaffId[s.id] ??
      pickStaffHrNotificationFromSourceRows(
        srcRows.map((row) => ({
          source_system: row.source_system,
          source_url: row.source_url,
          metadata: row.metadata,
        }))
      );

    const compliance = buildStaffComplianceSummaryFromSourceRows(
      srcRows.map((row) => ({
        source_system: row.source_system,
        metadata: row.metadata,
      })),
      { now }
    );

    const result = calculateWorkforceReadinessScore({
      is_active: s.is_active,
      staff_role: s.staff_role,
      working_hours: s.working_hours,
      hr,
      identityRows: mappedRows,
      compliance,
      now,
    });

    const band = result.band as WorkforceReadinessBandId;

    perStaff[s.id] = {
      readinessScore: result.score,
      readinessBand: band,
      readinessBandLabel: result.bandLabel,
      complianceStatus: compliance.overallStatus,
      trainingRequiredCount: hr.training_required_count,
      trainingProgressLabel: buildTrainingProgressLabel(hr.training_required_count, hr),
      nextShiftLabel: nextShiftByStaffId[s.id] ?? null,
      surgeryReady: isSurgeryReadyStaff({
        staffRole: s.staff_role,
        isActive: s.is_active,
        readinessBand: band,
      }),
    };
  }

  return { perStaff, tenantOverview };
}
