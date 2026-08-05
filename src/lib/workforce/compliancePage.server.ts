import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { resolveStaffIdentities } from "@/src/lib/team/identity/server";
import type { StaffComplianceAttentionReason } from "@/src/lib/team/compliance";
import { projectStaffComplianceEntry } from "@/src/lib/team/compliance";
import type { ComplianceAlertRecord } from "@/src/lib/workforce/workforceClinicalTypes";

export type CompliancePageAlertRow = ComplianceAlertRecord & {
  staffName: string;
  attentionReasons: StaffComplianceAttentionReason[];
};

/**
 * Compliance alerts page — batch-resolves alert subjects by staffMemberId
 * so names and identity attention come from the canonical resolver.
 */
export async function loadCompliancePageModel(tenantId: string): Promise<{
  alerts: CompliancePageAlertRow[];
  recentRuns: Array<{
    id: string;
    startedAt: string;
    completedAt: string | null;
    staffChecked: number;
    alertsGenerated: number;
    status: string;
  }>;
}> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = supabaseAdmin();

  const { data: alertRows, error: alertErr } = await supabase
    .from("fi_staff_compliance_alerts")
    .select("*")
    .eq("tenant_id", tid)
    .eq("resolved", false)
    .order("created_at", { ascending: false })
    .limit(200);
  if (alertErr) throw new Error(alertErr.message);

  const memberIds = [
    ...new Set(
      ((alertRows ?? []) as { staff_member_id: string }[]).map((r) => String(r.staff_member_id))
    ),
  ];

  const identityBatch = await resolveStaffIdentities(
    {
      tenantId: tid,
      by: "staffMemberId",
      staffMemberIds: memberIds,
    },
    { client: supabase }
  );

  const alerts: CompliancePageAlertRow[] = ((alertRows ?? []) as Record<string, unknown>[]).map(
    (raw) => {
      const mid = String(raw.staff_member_id);
      const identity = identityBatch.byKey.get(mid) ?? null;
      const entry = identity
        ? projectStaffComplianceEntry(identity, {
            credentials: [],
            certifications: [],
            canUpload: false,
            canVerify: false,
            canReject: false,
            canRequestReplacement: false,
          })
        : null;
      return {
        id: String(raw.id),
        staffMemberId: mid,
        alertType: String(raw.alert_type),
        severity: String(raw.severity) as ComplianceAlertRecord["severity"],
        message: raw.message != null ? String(raw.message) : null,
        resolved: Boolean(raw.resolved ?? false),
        createdAt: String(raw.created_at),
        staffName: identity?.displayName ?? "Unknown",
        attentionReasons: entry?.attentionReasons ?? (["identity_invalid"] as StaffComplianceAttentionReason[]),
      };
    }
  );

  const { data: runs, error: runsErr } = await supabase
    .from("fi_workforce_compliance_runs")
    .select("*")
    .eq("tenant_id", tid)
    .order("started_at", { ascending: false })
    .limit(10);
  if (runsErr) throw new Error(runsErr.message);

  const recentRuns = ((runs ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    startedAt: String(r.started_at),
    completedAt: r.completed_at != null ? String(r.completed_at) : null,
    staffChecked: Number(r.staff_checked ?? 0),
    alertsGenerated: Number(r.alerts_generated ?? 0),
    status: String(r.status),
  }));

  return { alerts, recentRuns };
}
