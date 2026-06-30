import type { EnterpriseDemoVolumeOptions } from "@/src/lib/enterprise-demo/enterpriseDemoVolumeOptions";
import { ENTERPRISE_DEMO_TENANT_SLUG } from "@/src/lib/enterprise-demo/enterpriseDemoConstants";

export type IhrgDemoProfile = "light" | "standard" | "alive" | "enterprise";

export const IHRG_DEMO_DEFAULT_PROFILE: IhrgDemoProfile = "alive";

/** CLI / docs alias → canonical enterprise demo tenant slug. */
export const IHRG_DEMO_TENANT_SLUG_ALIASES: Record<string, string> = {
  "ihrg-demo": ENTERPRISE_DEMO_TENANT_SLUG,
  [ENTERPRISE_DEMO_TENANT_SLUG]: ENTERPRISE_DEMO_TENANT_SLUG,
};

export function resolveIhrgDemoTenantSlug(input: string): string {
  const key = input.trim().toLowerCase();
  return IHRG_DEMO_TENANT_SLUG_ALIASES[key] ?? key;
}

export type IhrgDemoProfileConfig = EnterpriseDemoVolumeOptions & {
  profile: IhrgDemoProfile;
  /** Standalone LeadFlow-native leads per clinic (pre-patient acquisition). */
  leadflowLeadsPerClinic: number;
  /** CRM pipeline leads per clinic (includes patient-linked). */
  crmLeadsPerClinic: number;
  calendarEventsPerClinic: number;
  analyticsEventsTotal: number;
  receptionTasksPerClinic: number;
  competencyProjectionsPerStaff: number;
  crmTasksPerClinic: number;
};

const PROFILE_CONFIGS: Record<IhrgDemoProfile, Omit<IhrgDemoProfileConfig, "profile">> = {
  light: {
    patientsPerClinic: 10,
    surgeriesPerClinic: 3,
    leadflowLeadsPerClinic: 4,
    crmLeadsPerClinic: 8,
    calendarEventsPerClinic: 6,
    analyticsEventsTotal: 40,
    receptionTasksPerClinic: 3,
    competencyProjectionsPerStaff: 1,
    crmTasksPerClinic: 2,
  },
  standard: {
    patientsPerClinic: 12,
    surgeriesPerClinic: 5,
    leadflowLeadsPerClinic: 6,
    crmLeadsPerClinic: 10,
    calendarEventsPerClinic: 10,
    analyticsEventsTotal: 80,
    receptionTasksPerClinic: 5,
    competencyProjectionsPerStaff: 2,
    crmTasksPerClinic: 4,
  },
  alive: {
    patientsPerClinic: 15,
    surgeriesPerClinic: 9,
    leadflowLeadsPerClinic: 8,
    crmLeadsPerClinic: 12,
    calendarEventsPerClinic: 14,
    analyticsEventsTotal: 120,
    receptionTasksPerClinic: 7,
    competencyProjectionsPerStaff: 3,
    crmTasksPerClinic: 6,
  },
  enterprise: {
    patientsPerClinic: 19,
    surgeriesPerClinic: 12,
    leadflowLeadsPerClinic: 10,
    crmLeadsPerClinic: 15,
    calendarEventsPerClinic: 18,
    analyticsEventsTotal: 200,
    receptionTasksPerClinic: 9,
    competencyProjectionsPerStaff: 4,
    crmTasksPerClinic: 8,
  },
};

export function ihrgDemoProfileConfig(profile: IhrgDemoProfile): IhrgDemoProfileConfig {
  return { profile, ...PROFILE_CONFIGS[profile] };
}

export function parseIhrgDemoProfile(value: string | undefined): IhrgDemoProfile {
  const raw = (value ?? IHRG_DEMO_DEFAULT_PROFILE).trim().toLowerCase();
  if (raw === "light" || raw === "standard" || raw === "alive" || raw === "enterprise") {
    return raw;
  }
  throw new Error(
    `Unknown IHRG demo profile "${value}". Use light, standard, alive, or enterprise.`
  );
}
