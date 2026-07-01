import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import type { ComplianceAlertRecord } from "@/src/lib/workforce/workforceClinicalTypes";

export type CompliancePageAlertRow = ComplianceAlertRecord & {
  staffName: string;
};

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
      ((alertRows ?? []) as { staff_member_id: string }[]).map((r) =>
        String(r.staff_member_id)
      )
    ),
  ];
  const nameById = new Map<string, string>();
  if (memberIds.length) {
    const { data: memberRows, error: memberErr } = await supabase
      .from("fi_staff_members")
      .select("id, full_name")
      .eq("tenant_id", tid)
      .in("id", memberIds);
    if (memberErr) throw new Error(memberErr.message);
    for (const m of memberRows ?? []) {
      const row = m as { id: string; full_name: string };
      nameById.set(String(row.id), String(row.full_name));
    }
  }

  const alerts: CompliancePageAlertRow[] = ((alertRows ?? []) as Record<string, unknown>[]).map(
    (raw) => ({
      id: String(raw.id),
      staffMemberId: String(raw.staff_member_id),
      alertType: String(raw.alert_type),
      severity: String(raw.severity) as ComplianceAlertRecord["severity"],
      message: raw.message != null ? String(raw.message) : null,
      resolved: Boolean(raw.resolved ?? false),
      createdAt: String(raw.created_at),
      staffName: nameById.get(String(raw.staff_member_id)) ?? "Unknown",
    })
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