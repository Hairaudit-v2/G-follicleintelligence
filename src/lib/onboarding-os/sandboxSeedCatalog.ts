/**
 * OnboardingOS Phase C — deterministic sandbox demo data packs (pure data, test-safe).
 */

import type {
  ClinicDeploymentTemplateCode,
  SandboxSeedEntityType,
  SandboxSeedPack,
} from "./tenantProvisioningTypes";
import { SANDBOX_SEED_PACK_CODES } from "./tenantProvisioningTypes";

export { SANDBOX_SEED_PACK_CODES };

export const SANDBOX_SEED_SOURCE = "onboarding_os_sandbox_seed" as const;
export const SANDBOX_SEED_EMAIL_DOMAIN = "sandbox.fi-demo.invalid" as const;
export const SANDBOX_SEED_PHONE_PREFIX = "+1-555-01" as const;

const LIGHT_COUNTS: SandboxSeedPack["counts"] = {
  patients: 5,
  leads: 4,
  appointments: 6,
  consultations: 4,
  surgeries: 0,
  invoices: 3,
  payments: 2,
  staff: 3,
  academy_readiness: 2,
  surgery_os_metrics: 0,
  financial_os_metrics: 2,
};

const STANDARD_COUNTS: SandboxSeedPack["counts"] = {
  patients: 12,
  leads: 10,
  appointments: 15,
  consultations: 10,
  surgeries: 3,
  invoices: 8,
  payments: 6,
  staff: 5,
  academy_readiness: 4,
  surgery_os_metrics: 3,
  financial_os_metrics: 5,
};

const ENTERPRISE_COUNTS: SandboxSeedPack["counts"] = {
  patients: 25,
  leads: 20,
  appointments: 30,
  consultations: 18,
  surgeries: 8,
  invoices: 15,
  payments: 12,
  staff: 10,
  academy_readiness: 8,
  surgery_os_metrics: 8,
  financial_os_metrics: 10,
};

export const SANDBOX_SEED_PACKS: Readonly<
  Record<(typeof SANDBOX_SEED_PACK_CODES)[number], SandboxSeedPack>
> = {
  light_demo: {
    code: "light_demo",
    displayName: "Light demo",
    description:
      "Minimal walkthrough dataset for consultation-led clinics and quick training sessions.",
    counts: LIGHT_COUNTS,
    recommendedTemplateCodes: ["growth_consultation", "standard_hair_restoration"],
  },
  standard_demo: {
    code: "standard_demo",
    displayName: "Standard demo",
    description:
      "Balanced dataset with patients, bookings, consultations, and light surgical/financial samples.",
    counts: STANDARD_COUNTS,
    recommendedTemplateCodes: ["standard_hair_restoration", "surgical_hair_restoration"],
  },
  enterprise_demo: {
    code: "enterprise_demo",
    displayName: "Enterprise demo",
    description:
      "Rich multi-workflow dataset for enterprise groups exploring SurgeryOS and FinancialOS.",
    counts: ENTERPRISE_COUNTS,
    recommendedTemplateCodes: ["enterprise_multi_clinic", "surgical_hair_restoration"],
  },
};

/** Default pack when none is specified for a deployment template. */
export const SANDBOX_SEED_DEFAULT_PACK_BY_TEMPLATE: Readonly<
  Record<ClinicDeploymentTemplateCode, (typeof SANDBOX_SEED_PACK_CODES)[number]>
> = {
  standard_hair_restoration: "standard_demo",
  surgical_hair_restoration: "standard_demo",
  growth_consultation: "light_demo",
  enterprise_multi_clinic: "enterprise_demo",
};

export const SANDBOX_SEED_ENTITY_LABELS: Readonly<Record<SandboxSeedEntityType, string>> = {
  patients: "Patients",
  leads: "CRM leads",
  appointments: "Appointments / bookings",
  consultations: "Consultations",
  surgeries: "Surgeries",
  invoices: "Invoices",
  payments: "Payments",
  staff: "Staff roster",
  academy_readiness: "Academy readiness placeholders",
  surgery_os_metrics: "SurgeryOS metric placeholders",
  financial_os_metrics: "FinancialOS metric placeholders",
};

export function isSandboxSeedPackCode(
  value: string | null | undefined
): value is (typeof SANDBOX_SEED_PACK_CODES)[number] {
  return SANDBOX_SEED_PACK_CODES.includes(
    String(value ?? "").trim() as (typeof SANDBOX_SEED_PACK_CODES)[number]
  );
}

export function listSandboxSeedPackSummaries(): readonly {
  code: (typeof SANDBOX_SEED_PACK_CODES)[number];
  displayName: string;
  description: string;
  totalRecords: number;
}[] {
  return SANDBOX_SEED_PACK_CODES.map((code) => {
    const pack = SANDBOX_SEED_PACKS[code];
    const totalRecords = Object.values(pack.counts).reduce((sum, n) => sum + n, 0);
    return {
      code,
      displayName: pack.displayName,
      description: pack.description,
      totalRecords,
    };
  });
}
