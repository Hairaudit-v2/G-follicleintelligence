/**
 * Batch payroll staff context loader (FI-TEAM-COHESION-B1.8A).
 *
 * Query budget:
 * 1. one active members / wage-profile population load
 * 2. one resolveStaffIdentities({ by: "staffMemberId" }) batch
 * 3. in-memory projection — no per-staff identity or wage query loops
 *
 * Financial amounts stay in wageProfile / timesheet / shift-cost DTOs.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { resolveStaffIdentities } from "@/src/lib/team/identity/server";
import type { StaffIdentity } from "@/src/lib/team/identity/types";
import { projectPayrollStaffEntry } from "@/src/lib/team/payroll/projectPayrollStaffEntry";
import type { PayrollStaffEntry } from "@/src/lib/team/payroll/types";
import {
  listActiveStaffForWageProfiles,
  listWorkforceWageProfiles,
} from "@/src/lib/workforce/wageProfile.server";

export type PayrollStaffContextModel = {
  tenantId: string;
  staff: PayrollStaffEntry[];
  identitiesByMemberId: Map<string, StaffIdentity>;
  missingWageProfileCount: number;
  payrollReadyCount: number;
};

export type LoadPayrollStaffContextOptions = {
  client?: SupabaseClient;
  canManage?: boolean;
};

export async function loadPayrollStaffContext(
  tenantId: string,
  options?: LoadPayrollStaffContextOptions
): Promise<PayrollStaffContextModel> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const client = options?.client ?? supabaseAdmin();
  const canManage = options?.canManage !== false;

  const [staffOptions, profiles] = await Promise.all([
    listActiveStaffForWageProfiles(tid, client),
    listWorkforceWageProfiles(tid, client),
  ]);

  const memberIds = staffOptions.map((s) => s.id);
  const identityBatch = await resolveStaffIdentities(
    {
      tenantId: tid,
      by: "staffMemberId",
      staffMemberIds: memberIds,
    },
    { client }
  );

  const profileByMember = new Map(profiles.map((p) => [p.staffMemberId, p]));
  const identitiesByMemberId = new Map<string, StaffIdentity>();
  const staff: PayrollStaffEntry[] = [];

  for (const option of staffOptions) {
    const identity = identityBatch.byKey.get(option.id) ?? null;
    if (!identity) continue;
    identitiesByMemberId.set(option.id, identity);

    const profile = profileByMember.get(option.id) ?? null;
    staff.push(
      projectPayrollStaffEntry(identity, {
        wageProfileId: profile?.id ?? null,
        rateType: profile?.rateType ?? null,
        canEditPayrollProfile: canManage,
        canApproveTimesheet: canManage,
      })
    );
  }

  return {
    tenantId: tid,
    staff,
    identitiesByMemberId,
    missingWageProfileCount: staff.filter((s) => !s.payroll.payrollReady).length,
    payrollReadyCount: staff.filter((s) => s.payroll.payrollReady).length,
  };
}
