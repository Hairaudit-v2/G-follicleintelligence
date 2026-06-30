import type { SupabaseClient } from "@supabase/supabase-js";

import { ENTERPRISE_DEMO_CLINICS } from "@/src/lib/enterprise-demo/enterpriseDemoConstants";
import {
  assertEnterpriseDemoSeedAllowed,
  seedEnterpriseDemoTenant,
  type EnterpriseDemoSeedResult,
} from "@/src/lib/enterprise-demo/enterpriseDemoSeed.server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  seedIhrgDemoExpansion,
  type IhrgDemoExpansionSeedResult,
} from "./ihrgDemoExpansionSeed.server";
import {
  IHRG_DEMO_DEFAULT_PROFILE,
  ihrgDemoProfileConfig,
  parseIhrgDemoProfile,
  resolveIhrgDemoTenantSlug,
  type IhrgDemoProfile,
} from "./ihrgDemoProfiles";

export type IhrgDemoSeedResult = EnterpriseDemoSeedResult &
  IhrgDemoExpansionSeedResult & {
    profile: IhrgDemoProfile;
    patientsTarget: number;
    surgeriesTarget: number;
  };

export type IhrgDemoSeedOptions = {
  tenantSlug?: string;
  profile?: IhrgDemoProfile;
  supabase?: SupabaseClient;
  env?: NodeJS.ProcessEnv;
};

function emptyExpansion(): IhrgDemoExpansionSeedResult {
  return {
    createdCrmLeads: 0,
    existingCrmLeads: 0,
    createdLeadflowLeads: 0,
    existingLeadflowLeads: 0,
    createdCrmTasks: 0,
    existingCrmTasks: 0,
    createdCalendarEvents: 0,
    existingCalendarEvents: 0,
    createdAnalyticsEvents: 0,
    existingAnalyticsEvents: 0,
    createdReceptionTasks: 0,
    existingReceptionTasks: 0,
    createdCompetencyProjections: 0,
    existingCompetencyProjections: 0,
    warnings: [],
  };
}

function mergeIhrgResult(
  core: EnterpriseDemoSeedResult,
  expansion: IhrgDemoExpansionSeedResult,
  profile: IhrgDemoProfile,
  profileConfig: ReturnType<typeof ihrgDemoProfileConfig>
): IhrgDemoSeedResult {
  return {
    ...emptyExpansion(),
    ...core,
    ...expansion,
    profile,
    patientsTarget: ENTERPRISE_DEMO_CLINICS.length * profileConfig.patientsPerClinic,
    surgeriesTarget: ENTERPRISE_DEMO_CLINICS.length * profileConfig.surgeriesPerClinic,
    warnings: [...core.warnings, ...expansion.warnings],
  };
}

export async function seedIhrgDemoData(opts?: IhrgDemoSeedOptions): Promise<IhrgDemoSeedResult> {
  const env = opts?.env ?? process.env;
  const profile = opts?.profile ?? IHRG_DEMO_DEFAULT_PROFILE;
  const profileConfig = ihrgDemoProfileConfig(profile);
  const tenantSlug = resolveIhrgDemoTenantSlug(opts?.tenantSlug ?? "ihrg-demo");

  const guard = assertEnterpriseDemoSeedAllowed(env);
  if (!guard.ok) {
    console.error("[ihrg-demo] Environment guard blocked seed:", guard.reason);
    return {
      ...mergeIhrgResult(
        {
          ok: false,
          error: guard.reason,
          tenantSlug,
          createdTenant: false,
          createdClinics: 0,
          existingClinics: 0,
          createdStaff: 0,
          existingStaff: 0,
          updatedStaffLinks: 0,
          createdPatients: 0,
          existingPatients: 0,
          createdConsultations: 0,
          existingConsultations: 0,
          createdClinicalDetails: 0,
          existingClinicalDetails: 0,
          createdCases: 0,
          existingCases: 0,
          createdBookings: 0,
          existingBookings: 0,
          createdSurgeries: 0,
          existingSurgeries: 0,
          createdTeamAssignments: 0,
          existingTeamAssignments: 0,
          createdGraftSessions: 0,
          existingGraftSessions: 0,
          createdGraftEvents: 0,
          existingGraftEvents: 0,
          createdImages: 0,
          existingImages: 0,
          createdProtocolSessions: 0,
          existingProtocolSessions: 0,
          createdOutcomeAudits: 0,
          existingOutcomeAudits: 0,
          createdInvoices: 0,
          existingInvoices: 0,
          createdInvoiceItems: 0,
          createdPaymentRequests: 0,
          existingPaymentRequests: 0,
          createdPayments: 0,
          existingPayments: 0,
          updatedCaseFranchiseRisk: 0,
          existingCaseFranchiseRisk: 0,
          updatedBookingFinancialStatus: 0,
          linkedConsultations: 0,
          createdDemoUsers: 0,
          warnings: [guard.reason],
        },
        emptyExpansion(),
        profile,
        profileConfig
      ),
    };
  }

  console.log("[ihrg-demo] Starting core seed (profile:", profile, ", tenant:", tenantSlug, ")");
  const core = await seedEnterpriseDemoTenant({
    supabase: opts?.supabase,
    env,
    volume: profileConfig,
  });
  console.log(
    "[ihrg-demo] Core seed completed: ok=",
    core.ok,
    core.tenantId ? `tenantId=${core.tenantId}` : "no tenantId",
    core.error ? `error=${core.error}` : ""
  );

  if (!core.ok || !core.tenantId) {
    const failureReason =
      core.error ?? core.warnings[0] ?? "Core enterprise demo seed failed without a reason.";
    console.error("[ihrg-demo] Core seed failed:", failureReason);
    return mergeIhrgResult(
      { ...core, error: core.error ?? failureReason },
      emptyExpansion(),
      profile,
      profileConfig
    );
  }

  console.log("[ihrg-demo] Starting expansion seed for tenant", core.tenantId);
  const expansion = await seedIhrgDemoExpansion(
    opts?.supabase ?? supabaseAdmin(),
    core.tenantId,
    profileConfig
  );
  console.log("[ihrg-demo] Expansion seed completed");

  return mergeIhrgResult(core, expansion, profile, profileConfig);
}

export { parseIhrgDemoProfile, resolveIhrgDemoTenantSlug };
