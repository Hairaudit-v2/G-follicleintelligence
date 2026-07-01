import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runStaffComplianceAudit } from "@/src/lib/workforce/complianceAutomation.server";

export type WorkforceComplianceCronResult = {
  tenantsProcessed: number;
  results: Array<{
    tenantId: string;
    ok: boolean;
    staffChecked?: number;
    alertsGenerated?: number;
    error?: string;
  }>;
};

export async function runWorkforceComplianceAuditCron(): Promise<WorkforceComplianceCronResult> {
  const supabase = supabaseAdmin();
  // tenant-guard-allow: cron enumerates all active tenants; fi_tenants is the tenant registry (no tenant_id column). Per-tenant work below is scoped.
  const { data, error } = await supabase.from("fi_tenants").select("id").eq("is_active", true);
  if (error) throw new Error(error.message);

  const results: WorkforceComplianceCronResult["results"] = [];

  for (const row of data ?? []) {
    const tenantId = String((row as { id: string }).id);
    try {
      const audit = await runStaffComplianceAudit(tenantId, supabase);
      results.push({
        tenantId,
        ok: true,
        staffChecked: audit.staffChecked,
        alertsGenerated: audit.alertsGenerated,
      });
    } catch (e) {
      results.push({
        tenantId,
        ok: false,
        error: e instanceof Error ? e.message : "Audit failed",
      });
    }
  }

  return { tenantsProcessed: results.length, results };
}