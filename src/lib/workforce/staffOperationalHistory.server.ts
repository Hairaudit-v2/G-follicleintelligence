import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  computeTotalActivityCount,
  daysSince,
  isIiohrSourceSystem,
  isManuallyCreatedStaff,
  type StaffOperationalHistory,
} from "@/src/lib/workforce/staffOperationalHistoryCore";

const INACTIVE_STATUSES = new Set([
  "terminated",
  "resigned",
  "contract_ended",
  "contract_expired",
  "merged",
  "offboarded",
  "inactive",
]);

async function safeCount(
  supabase: SupabaseClient,
  table: string,
  filters: (q: ReturnType<SupabaseClient["from"]>) => ReturnType<SupabaseClient["from"]>
): Promise<number> {
  try {
    let q = supabase.from(table).select("id", { count: "exact", head: true });
    q = filters(q) as ReturnType<SupabaseClient["from"]>;
    const { count, error } = await q;
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function loadStaffOperationalHistory(
  tenantId: string,
  staffMemberId: string,
  client?: SupabaseClient,
  options?: { identityLinkCount?: number }
): Promise<StaffOperationalHistory> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const sid = assertNonEmptyUuid(staffMemberId, "staffMemberId");
  const supabase = client ?? supabaseAdmin();

  const { data: member, error } = await supabase
    .from("fi_staff_members")
    .select(
      "id, full_name, email, role_code, employment_status, fi_staff_id, source_system, source_external_id, created_at"
    )
    .eq("tenant_id", tid)
    .eq("id", sid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!member) {
    throw new Error("Staff member not found.");
  }

  const row = member as Record<string, unknown>;
  const fiStaffId = row.fi_staff_id != null ? String(row.fi_staff_id) : null;
  const sourceSystem = row.source_system != null ? String(row.source_system) : null;
  const employmentStatus = String(row.employment_status ?? "active");
  const createdAt = row.created_at != null ? String(row.created_at) : null;

  let identityLinkCount = options?.identityLinkCount ?? 0;
  if (options?.identityLinkCount === undefined) {
    identityLinkCount = await safeCount(supabase, "fi_staff_identity_links", (q) =>
      q.eq("tenant_id", tid).eq("staff_member_id", sid)
    );
  }

  const isIiohrLinked =
    identityLinkCount > 0 ||
    isIiohrSourceSystem(sourceSystem) ||
    Boolean(row.source_external_id != null && String(row.source_external_id).trim());

  let trainingCount = 0;
  let sopAcknowledgementCount = 0;
  if (fiStaffId) {
    trainingCount = await safeCount(supabase, "fi_staff_competency_projections", (q) =>
      q.eq("tenant_id", tid).eq("staff_id", fiStaffId)
    );

    const { data: sourceRows } = await supabase
      .from("fi_staff_source_ids")
      .select("metadata")
      .eq("tenant_id", tid)
      .eq("staff_id", fiStaffId)
      .limit(5);
    for (const raw of sourceRows ?? []) {
      const md = (raw as { metadata?: Record<string, unknown> }).metadata;
      if (!md || typeof md !== "object") continue;
      const completed = Number(md.training_modules_completed ?? md.training_completed_count ?? 0);
      if (Number.isFinite(completed) && completed > 0) {
        trainingCount += completed;
      }
      const sop = Number(md.sop_acknowledgements_count ?? md.sop_acknowledged_count ?? 0);
      if (Number.isFinite(sop) && sop > 0) {
        sopAcknowledgementCount += sop;
      }
    }
  }

  let surgeryAssignmentCount = 0;
  let calendarAssignmentCount = 0;
  if (fiStaffId) {
    surgeryAssignmentCount = await safeCount(supabase, "fi_staff_event_assignments", (q) =>
      q
        .eq("tenant_id", tid)
        .eq("staff_id", fiStaffId)
        .eq("event_source", "surgery")
        .neq("assignment_status", "cancelled")
    );
    const shiftCount = await safeCount(supabase, "fi_staff_shifts", (q) =>
      q.eq("tenant_id", tid).eq("staff_id", fiStaffId).neq("status", "cancelled")
    );
    const eventCount = await safeCount(supabase, "fi_staff_event_assignments", (q) =>
      q
        .eq("tenant_id", tid)
        .eq("staff_id", fiStaffId)
        .neq("event_source", "surgery")
        .neq("assignment_status", "cancelled")
    );
    calendarAssignmentCount = shiftCount + eventCount;
  }

  let patientAssignmentCount = 0;
  if (fiStaffId) {
    patientAssignmentCount = await safeCount(supabase, "fi_bookings", (q) =>
      q
        .eq("tenant_id", tid)
        .eq("assigned_staff_id", fiStaffId)
        .neq("booking_status", "cancelled")
        .neq("booking_status", "no_show")
    );
  }

  const auditCount = await safeCount(supabase, "fi_staff_member_audit_events", (q) =>
    q.eq("tenant_id", tid).eq("staff_member_id", sid)
  );
  const alertCount = await safeCount(supabase, "fi_staff_compliance_alerts", (q) =>
    q.eq("tenant_id", tid).eq("staff_member_id", sid)
  );
  const complianceHistoryCount = auditCount + alertCount;

  const academyCompetencyCount = trainingCount;

  const credentialCount = await safeCount(supabase, "fi_staff_credentials", (q) =>
    q.eq("tenant_id", tid).eq("staff_member_id", sid).is("archived_at", null)
  );

  let verifiedCredentialCount = 0;
  try {
    const { count } = await supabase
      .from("fi_staff_credentials")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .eq("staff_member_id", sid)
      .is("archived_at", null)
      .eq("verification_status", "verified");
    verifiedCredentialCount = count ?? 0;
  } catch {
    verifiedCredentialCount = 0;
  }

  const certificationCount = await safeCount(supabase, "fi_staff_certifications", (q) =>
    q.eq("tenant_id", tid).eq("staff_member_id", sid).is("archived_at", null)
  );

  const history: StaffOperationalHistory = {
    staffMemberId: sid,
    fiStaffId,
    fullName: String(row.full_name ?? ""),
    email: row.email != null ? String(row.email) : null,
    roleCode: row.role_code != null ? String(row.role_code) : null,
    employmentStatus,
    createdAt,
    sourceSystem,
    isIiohrLinked,
    isManuallyCreated: isManuallyCreatedStaff(sourceSystem),
    isInactive: INACTIVE_STATUSES.has(employmentStatus.toLowerCase()),
    trainingCount,
    sopAcknowledgementCount,
    surgeryAssignmentCount,
    calendarAssignmentCount,
    patientAssignmentCount,
    complianceHistoryCount,
    academyCompetencyCount,
    credentialCount,
    verifiedCredentialCount,
    certificationCount,
    identityLinkCount,
    daysSinceCreated: daysSince(createdAt),
    totalActivityCount: 0,
  };

  history.totalActivityCount = computeTotalActivityCount(history);
  return history;
}

export async function loadStaffOperationalHistoryBatch(
  tenantId: string,
  staffMemberIds: string[],
  client?: SupabaseClient
): Promise<Map<string, StaffOperationalHistory>> {
  const out = new Map<string, StaffOperationalHistory>();
  for (const id of staffMemberIds) {
    out.set(id, await loadStaffOperationalHistory(tenantId, id, client));
  }
  return out;
}

export async function buildIiohrShadowOperationalHistory(input: {
  tenantId: string;
  externalId: string;
  externalEmail: string | null;
  externalName: string | null;
  linkedStaffMemberId?: string | null;
  client?: SupabaseClient;
}): Promise<StaffOperationalHistory | null> {
  if (input.linkedStaffMemberId) {
    return loadStaffOperationalHistory(
      input.tenantId,
      input.linkedStaffMemberId,
      input.client
    );
  }

  return {
    staffMemberId: `iiohr:${input.externalId}`,
    fiStaffId: null,
    fullName: input.externalName ?? input.externalId,
    email: input.externalEmail,
    roleCode: null,
    employmentStatus: "active",
    createdAt: null,
    sourceSystem: "iiohr_hr",
    isIiohrLinked: true,
    isManuallyCreated: false,
    isInactive: false,
    trainingCount: 0,
    sopAcknowledgementCount: 0,
    surgeryAssignmentCount: 0,
    calendarAssignmentCount: 0,
    patientAssignmentCount: 0,
    complianceHistoryCount: 0,
    academyCompetencyCount: 0,
    credentialCount: 0,
    verifiedCredentialCount: 0,
    certificationCount: 0,
    identityLinkCount: 1,
    daysSinceCreated: 0,
    totalActivityCount: 1,
  };
}