import type { SupabaseClient } from "@supabase/supabase-js";

import { ENTERPRISE_DEMO_CLINICS } from "@/src/lib/enterprise-demo/enterpriseDemoConstants";
import {
  assertEnterpriseDemoSeedAllowed,
  seedEnterpriseDemoTenant,
  type EnterpriseDemoSeedResult,
} from "@/src/lib/enterprise-demo/enterpriseDemoSeed.server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { seedIhrgDemoExpansion, type IhrgDemoExpansionSeedResult } from "./ihrgDemoExpansionSeed.server";
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

export async function seedIhrgDemoData(opts?: IhrgDemoSeedOptions): Promise<IhrgDemoSeedResult> {
  const env = opts?.env ?? process.env;
  const profile = opts?.profile ?? IHRG_DEMO_DEFAULT_PROFILE;
  const profileConfig = ihrgDemoProfileConfig(profile);
  const tenantSlug = resolveIhrgDemoTenantSlug(opts?.tenantSlug ?? "ihrg-demo");

  const guard = assertEnterpriseDemoSeedAllowed(env);
  if (!guard.ok) {
    const base = await seedEnterpriseDemoTenant({ env, supabase: opts?.supabase });
    return {
      ...base,
      ...emptyExpansion(),
      profile,
      patientsTarget: ENTERPRISE_DEMO_CLINICS.length * profileConfig.patientsPerClinic,
      surgeriesTarget: ENTERPRISE_DEMO_CLINICS.length * profileConfig.surgeriesPerClinic,
      warnings: [guard.reason, ...base.warnings],
    };
  }

  const core = await seedEnterpriseDemoTenant({
    supabase: opts?.supabase,
    env,
    volume: profileConfig,
  });

  if (!core.ok || !core.tenantId) {
    return {
      ...core,
      ...emptyExpansion(),
      profile,
      patientsTarget: ENTERPRISE_DEMO_CLINICS.length * profileConfig.patientsPerClinic,
      surgeriesTarget: ENTERPRISE_DEMO_CLINICS.length * profileConfig.surgeriesPerClinic,
    };
  }

  const expansion = await seedIhrgDemoExpansion(
    opts?.supabase ?? supabaseAdmin(),
    core.tenantId,
    profileConfig
  );

  return {
    ...core,
    ...expansion,
    profile,
    patientsTarget: ENTERPRISE_DEMO_CLINICS.length * profileConfig.patientsPerClinic,
    surgeriesTarget: ENTERPRISE_DEMO_CLINICS.length * profileConfig.surgeriesPerClinic,
    warnings: [...core.warnings, ...expansion.warnings],
  };
}

export { parseIhrgDemoProfile, resolveIhrgDemoTenantSlug };
