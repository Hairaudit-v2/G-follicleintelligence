import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { evaluateCertificationExpiry, evaluateCredentialExpiry } from "@/src/lib/workforce/credentialExpiryCore";
import { syncStaffCertificationStatusesForMember } from "@/src/lib/workforce/staffCertification.server";
import {
  checkExpiringCredentials,
  syncStaffCredentialStatusesForMember,
} from "@/src/lib/workforce/staffCredentials.server";
import type {
  ComplianceAlertRecord,
  ComplianceAlertSeverity,
} from "@/src/lib/workforce/workforceClinicalTypes";
import {
  WORKFORCE_PHASE_1C_AUDIT_EVENTS,
  WORKFORCE_PHASE_1C_AUDIT_SOURCE,
} from "@/src/lib/workforce/workforcePhase1cAudit";

export type StaffComplianceAuditResult = {
  runId: string;
  staffChecked: number;
  alertsGenerated: number;
  credentialsUpdated: number;
  certificationsUpdated: number;
};

function mapAlertRow(raw: Record<string, unknown>): ComplianceAlertRecord {
  return {
    id: String(raw.id),
    staffMemberId: String(raw.staff_member_id),
    alertType: String(raw.alert_type),
    severity: String(raw.severity) as ComplianceAlertSeverity,
    message: raw.message != null ? String(raw.message) : null,
    resolved: Boolean(raw.resolved ?? false),
    createdAt: String(raw.created_at),
  };
}

export async function loadOpenComplianceAlertsForMember(
  tenantId: string,
  staffMemberId: string,
  client?: SupabaseClient
): Promise<ComplianceAlertRecord[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const sid = assertNonEmptyUuid(staffMemberId, "staffMemberId");
  const supabase = client ?? supabaseAdmin();

  const { data, error } = await supabase
    .from("fi_staff_compliance_alerts")
    .select("*")
    .eq("tenant_id", tid)
    .eq("staff_member_id", sid)
    .eq("resolved", false)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapAlertRow);
}

async function upsertComplianceAlert(
  supabase: SupabaseClient,
  row: {
    tenant_id: string;
    staff_member_id: string;
    alert_type: string;
    severity: ComplianceAlertSeverity;
    message: string;
  }
): Promise<boolean> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("fi_staff_compliance_alerts").upsert(
    {
      tenant_id: row.tenant_id,
      staff_member_id: row.staff_member_id,
      alert_type: row.alert_type,
      severity: row.severity,
      message: row.message,
      resolved: false,
      updated_at: now,
    },
    { onConflict: "tenant_id,staff_member_id,alert_type" }
  );
  if (error) throw new Error(error.message);
  return true;
}

async function resolveComplianceAlert(
  supabase: SupabaseClient,
  tenantId: string,
  staffMemberId: string,
  alertType: string
): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from("fi_staff_compliance_alerts")
    .update({ resolved: true, updated_at: now })
    .eq("tenant_id", tenantId)
    .eq("staff_member_id", staffMemberId)
    .eq("alert_type", alertType)
    .eq("resolved", false);
}

async function auditMemberCompliance(
  supabase: SupabaseClient,
  tenantId: string,
  staffMemberId: string,
  member: {
    employment_status: string;
    fi_staff_id: string | null;
    full_name: string | null;
  }
): Promise<number> {
  let alerts = 0;
  const name = member.full_name?.trim() || "Staff member";
  const status = String(member.employment_status ?? "active").toLowerCase();

  await syncStaffCredentialStatusesForMember(tenantId, staffMemberId, supabase);
  await syncStaffCertificationStatusesForMember(tenantId, staffMemberId, supabase);

  const [credRes, certRes] = await Promise.all([
    supabase
      .from("fi_staff_credentials")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("staff_member_id", staffMemberId)
      .is("archived_at", null),
    supabase
      .from("fi_staff_certifications")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("staff_member_id", staffMemberId)
      .is("archived_at", null),
  ]);
  if (credRes.error) throw new Error(credRes.error.message);
  if (certRes.error) throw new Error(certRes.error.message);

  for (const raw of (credRes.data ?? []) as Record<string, unknown>[]) {
    const evaluation = evaluateCredentialExpiry({
      expiresAt: raw.expires_at != null ? String(raw.expires_at) : null,
      revoked: String(raw.status) === "revoked",
      suspended: String(raw.status) === "suspended",
      blocksClinicalWork: Boolean(raw.blocks_clinical_work ?? true),
    });
    const displayName = String(raw.display_name ?? raw.credential_type);
    if (evaluation.isExpired) {
      if (
        await upsertComplianceAlert(supabase, {
          tenant_id: tenantId,
          staff_member_id: staffMemberId,
          alert_type: `credential_expired:${String(raw.credential_key)}`,
          severity: "critical",
          message: `${displayName} expired`,
        })
      ) {
        alerts += 1;
      }
    } else if (evaluation.isDueSoon) {
      const days = evaluation.daysUntilExpiry ?? 30;
      if (
        await upsertComplianceAlert(supabase, {
          tenant_id: tenantId,
          staff_member_id: staffMemberId,
          alert_type: `credential_expiring:${String(raw.credential_key)}`,
          severity: days <= 7 ? "high" : "medium",
          message: `${displayName} expires in ${days} day(s)`,
        })
      ) {
        alerts += 1;
      }
    } else {
      await resolveComplianceAlert(
        supabase,
        tenantId,
        staffMemberId,
        `credential_expired:${String(raw.credential_key)}`
      );
      await resolveComplianceAlert(
        supabase,
        tenantId,
        staffMemberId,
        `credential_expiring:${String(raw.credential_key)}`
      );
    }
  }

  for (const raw of (certRes.data ?? []) as Record<string, unknown>[]) {
    const evaluation = evaluateCertificationExpiry({
      expiresAt: raw.expires_at != null ? String(raw.expires_at) : null,
    });
    const displayName = String(raw.certification_name ?? raw.display_name);
    if (evaluation.isExpired) {
      if (
        await upsertComplianceAlert(supabase, {
          tenant_id: tenantId,
          staff_member_id: staffMemberId,
          alert_type: `certification_expired:${String(raw.certification_key)}`,
          severity: "high",
          message: `${displayName} certification expired`,
        })
      ) {
        alerts += 1;
      }
    } else {
      await resolveComplianceAlert(
        supabase,
        tenantId,
        staffMemberId,
        `certification_expired:${String(raw.certification_key)}`
      );
    }
  }

  if (["terminated", "resigned", "contract_ended", "offboarded"].includes(status)) {
    if (member.fi_staff_id) {
      const { count } = await supabase
        .from("fi_staff_feature_access")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("staff_id", member.fi_staff_id);
      if ((count ?? 0) > 0) {
        if (
          await upsertComplianceAlert(supabase, {
            tenant_id: tenantId,
            staff_member_id: staffMemberId,
            alert_type: "offboarded_with_permissions",
            severity: "critical",
            message: `${name} is offboarded but still has active permissions`,
          })
        ) {
          alerts += 1;
        }
      } else {
        await resolveComplianceAlert(
          supabase,
          tenantId,
          staffMemberId,
          "offboarded_with_permissions"
        );
      }

      const { count: shiftCount } = await supabase
        .from("fi_staff_shifts")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("staff_id", member.fi_staff_id)
        .gte("starts_at", new Date().toISOString())
        .neq("status", "cancelled");
      if ((shiftCount ?? 0) > 0) {
        if (
          await upsertComplianceAlert(supabase, {
            tenant_id: tenantId,
            staff_member_id: staffMemberId,
            alert_type: "calendar_assignment_inactive",
            severity: "high",
            message: `${name} has future calendar shifts but is inactive/offboarded`,
          })
        ) {
          alerts += 1;
        }
      } else {
        await resolveComplianceAlert(
          supabase,
          tenantId,
          staffMemberId,
          "calendar_assignment_inactive"
        );
      }
    }
  } else {
    await resolveComplianceAlert(
      supabase,
      tenantId,
      staffMemberId,
      "offboarded_with_permissions"
    );
    await resolveComplianceAlert(
      supabase,
      tenantId,
      staffMemberId,
      "calendar_assignment_inactive"
    );
  }

  if (status === "suspended") {
    const { count: surgeryCount } = member.fi_staff_id
      ? await supabase
          .from("fi_staff_event_assignments")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("staff_id", member.fi_staff_id)
          .eq("event_source", "surgery")
          .neq("assignment_status", "cancelled")
      : { count: 0 };
    if ((surgeryCount ?? 0) > 0) {
      if (
        await upsertComplianceAlert(supabase, {
          tenant_id: tenantId,
          staff_member_id: staffMemberId,
          alert_type: "suspended_on_surgery",
          severity: "critical",
          message: `${name} is suspended but assigned to surgery`,
        })
      ) {
        alerts += 1;
      }
    }
  } else {
    await resolveComplianceAlert(supabase, tenantId, staffMemberId, "suspended_on_surgery");
  }

  return alerts;
}

export async function runStaffComplianceAudit(
  tenantId: string,
  client?: SupabaseClient
): Promise<StaffComplianceAuditResult> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const startedAt = new Date().toISOString();

  const { data: runRow, error: runErr } = await supabase
    .from("fi_workforce_compliance_runs")
    .insert({
      tenant_id: tid,
      started_at: startedAt,
      status: "running",
    })
    .select("id")
    .single();
  if (runErr) throw new Error(runErr.message);
  const runId = String((runRow as { id: string }).id);

  try {
    const credSync = await checkExpiringCredentials(tid, supabase);

    const { data: members, error: membersErr } = await supabase
      .from("fi_staff_members")
      .select("id, employment_status, fi_staff_id, full_name")
      .eq("tenant_id", tid)
      .is("archived_at", null)
      .is("merged_into", null);
    if (membersErr) throw new Error(membersErr.message);

    let alertsGenerated = 0;
    let certificationsUpdated = 0;

    for (const raw of members ?? []) {
      const member = raw as {
        id: string;
        employment_status: string;
        fi_staff_id: string | null;
        full_name: string | null;
      };
      const memberId = String(member.id);
      certificationsUpdated += await syncStaffCertificationStatusesForMember(
        tid,
        memberId,
        supabase
      );
      alertsGenerated += await auditMemberCompliance(supabase, tid, memberId, member);
    }

    const completedAt = new Date().toISOString();
    await supabase
      .from("fi_workforce_compliance_runs")
      .update({
        completed_at: completedAt,
        staff_checked: (members ?? []).length,
        alerts_generated: alertsGenerated,
        status: "completed",
      })
      .eq("id", runId);

    const firstMember = (members ?? [])[0] as { id: string } | undefined;
    const firstMemberId = firstMember ? String(firstMember.id) : null;
    if (firstMemberId) {
      await supabase.from("fi_staff_member_audit_events").insert({
        tenant_id: tid,
        staff_member_id: firstMemberId,
        event_type: WORKFORCE_PHASE_1C_AUDIT_EVENTS.COMPLIANCE_AUTOMATION_RUN,
        source: WORKFORCE_PHASE_1C_AUDIT_SOURCE,
        metadata: {
          run_id: runId,
          staff_checked: (members ?? []).length,
          alerts_generated: alertsGenerated,
        },
      });
    }

    return {
      runId,
      staffChecked: (members ?? []).length,
      alertsGenerated,
      credentialsUpdated: credSync.updated,
      certificationsUpdated,
    };
  } catch (e) {
    await supabase
      .from("fi_workforce_compliance_runs")
      .update({ status: "failed", completed_at: new Date().toISOString() })
      .eq("id", runId);
    throw e;
  }
}

/** @deprecated Use loadOpenComplianceAlertsForMember */
export async function loadOpenComplianceObligationsForMember(
  tenantId: string,
  staffMemberId: string,
  client?: SupabaseClient
): Promise<
  Array<{
    id: string;
    obligationKey: string;
    obligationType: string;
    title: string;
    status: string;
    severity: string;
    dueAt: string | null;
  }>
> {
  const alerts = await loadOpenComplianceAlertsForMember(tenantId, staffMemberId, client);
  return alerts.map((a) => ({
    id: a.id,
    obligationKey: a.alertType,
    obligationType: a.alertType.split(":")[0] ?? a.alertType,
    title: a.message ?? a.alertType,
    status: "overdue",
    severity: a.severity === "critical" ? "blocking" : "warning",
    dueAt: null,
  }));
}

/** @deprecated Use runStaffComplianceAudit */
export async function runComplianceAutomationForTenant(
  tenantId: string,
  client?: SupabaseClient
): Promise<{
  staffScanned: number;
  credentialsUpdated: number;
  certificationsUpdated: number;
  obligationsUpserted: number;
  obligationsResolved: number;
}> {
  const result = await runStaffComplianceAudit(tenantId, client);
  return {
    staffScanned: result.staffChecked,
    credentialsUpdated: result.credentialsUpdated,
    certificationsUpdated: result.certificationsUpdated,
    obligationsUpserted: result.alertsGenerated,
    obligationsResolved: 0,
  };
}