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
  seedIhrgDemoDayAlignment,
  type IhrgDemoDayAlignmentResult,
} from "./ihrgDemoDayAlignmentSeed.server";
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
    demoDay: IhrgDemoDayAlignmentResult | null;
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

function emptyDemoDay(): IhrgDemoDayAlignmentResult {
  return {
    ok: true,
    clinicId: null,
    todayYmd: null,
    timezoneSet: false,
    createdBookings: 0,
    updatedBookings: 0,
    createdDeposits: 0,
    existingDeposits: 0,
    createdCalendarEvents: 0,
    updatedCalendarEvents: 0,
    createdReceptionTasks: 0,
    existingReceptionTasks: 0,
    warnings: [],
  };
}

function mergeIhrgResult(
  core: EnterpriseDemoSeedResult,
  expansion: IhrgDemoExpansionSeedResult,
  profile: IhrgDemoProfile,
  profileConfig: ReturnType<typeof ihrgDemoProfileConfig>,
  demoDay: IhrgDemoDayAlignmentResult | null = null
): IhrgDemoSeedResult {
  const day = demoDay ?? emptyDemoDay();
  return {
    ...emptyExpansion(),
    ...core,
    ...expansion,
    profile,
    patientsTarget: ENTERPRISE_DEMO_CLINICS.length * profileConfig.patientsPerClinic,
    surgeriesTarget: ENTERPRISE_DEMO_CLINICS.length * profileConfig.surgeriesPerClinic,
    demoDay: day,
    warnings: [
      ...core.warnings,
      ...expansion.warnings,
      ...(day.warnings ?? []),
      ...(day.ok === false && day.error ? [day.error] : []),
    ],
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

  const sb = opts?.supabase ?? supabaseAdmin();
  console.log("[ihrg-demo] Starting expansion seed for tenant", core.tenantId);
  const expansion = await seedIhrgDemoExpansion(sb, core.tenantId, profileConfig);
  console.log("[ihrg-demo] Expansion seed completed");

  console.log("[ihrg-demo] Starting Sydney Demo Day alignment");
  const demoDay = await seedIhrgDemoDayAlignment(sb, core.tenantId);
  console.log(
    "[ihrg-demo] Demo Day alignment completed: ok=",
    demoDay.ok,
    demoDay.todayYmd ? `today=${demoDay.todayYmd}` : "",
    demoDay.error ? `error=${demoDay.error}` : ""
  );

  const merged = mergeIhrgResult(core, expansion, profile, profileConfig, demoDay);
  // Demo Day failure should warn but not fail the broader showcase seed —
  // GCC / franchise data remain usable; Reception deep-dive may be thin.
  if (!demoDay.ok) {
    merged.warnings.push(
      `Demo Day alignment incomplete: ${demoDay.error ?? "unknown error"}. GCC still usable.`
    );
  }
  return merged;
}

export { parseIhrgDemoProfile, resolveIhrgDemoTenantSlug };
