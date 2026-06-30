/**
 * OnboardingOS Phase B — clinic deployment template catalog (pure data, test-safe).
 */

import type {
  AcademyTrainingAssignment,
  ClinicDeploymentTemplate,
  ClinicDeploymentTemplateCode,
  ModuleBundle,
  RolePack,
  SandboxSeedOption,
  ServiceTemplate,
  WorkflowTemplate,
} from "./tenantProvisioningTypes";
import { CLINIC_DEPLOYMENT_TEMPLATE_CODES } from "./tenantProvisioningTypes";

export { CLINIC_DEPLOYMENT_TEMPLATE_CODES };

const CORE_SERVICES: ServiceTemplate[] = [
  {
    code: "consultation",
    name: "Consultation",
    bookingType: "consultation",
    durationMinutes: 45,
    category: "Clinical",
    basePrice: 0,
    color: "#0ea5e9",
  },
  {
    code: "follow_up",
    name: "Follow-up",
    bookingType: "follow_up",
    durationMinutes: 30,
    category: "Clinical",
    basePrice: 0,
    color: "#f97316",
  },
];

const SURGICAL_SERVICES: ServiceTemplate[] = [
  ...CORE_SERVICES,
  {
    code: "ht_consultation",
    name: "Hair Transplant Consultation",
    bookingType: "hair_transplant_consultation",
    durationMinutes: 60,
    category: "Clinical",
    basePrice: 0,
    color: "#22c55e",
  },
  {
    code: "surgery",
    name: "Hair Transplant Surgery",
    bookingType: "surgery",
    durationMinutes: 480,
    category: "Surgery",
    basePrice: 0,
    color: "#a855f7",
  },
  {
    code: "prp",
    name: "PRP Treatment",
    bookingType: "prp",
    durationMinutes: 60,
    category: "Treatment",
    basePrice: 0,
    color: "#14b8a6",
  },
];

const GROWTH_SERVICES: ServiceTemplate[] = [
  ...CORE_SERVICES,
  {
    code: "trichology",
    name: "Trichology Assessment",
    bookingType: "trichology",
    durationMinutes: 60,
    category: "Clinical",
    basePrice: 0,
    color: "#8b5cf6",
  },
  {
    code: "prp",
    name: "PRP Treatment",
    bookingType: "prp",
    durationMinutes: 60,
    category: "Treatment",
    basePrice: 0,
    color: "#14b8a6",
  },
  {
    code: "mesotherapy",
    name: "Mesotherapy",
    bookingType: "mesotherapy",
    durationMinutes: 45,
    category: "Treatment",
    basePrice: 0,
    color: "#ec4899",
  },
];

const STANDARD_WORKFLOWS: WorkflowTemplate[] = [
  {
    code: "crm_pipeline_standard",
    name: "Standard lead pipeline",
    type: "crm_pipeline",
    config: {
      stages: [
        "new_lead",
        "contacted",
        "consultation_booked",
        "consultation_complete",
        "treatment_plan",
        "won",
        "lost",
      ],
    },
  },
  {
    code: "reminder_24h",
    name: "24h appointment confirmation",
    type: "reminder",
    config: { triggerEvent: "booking_24h_before", channel: "email" },
  },
  {
    code: "reminder_48h",
    name: "48h appointment reminder",
    type: "reminder",
    config: { triggerEvent: "booking_48h_before", channel: "email" },
  },
];

const SURGICAL_WORKFLOWS: WorkflowTemplate[] = [
  ...STANDARD_WORKFLOWS,
  {
    code: "surgery_clearance_checklist",
    name: "Pre-operative clearance checklist",
    type: "consultation_checklist",
    config: { checklistKey: "surgery_preop_clearance" },
  },
  {
    code: "surgery_day_workflow",
    name: "Surgery day theatre workflow",
    type: "booking_workflow",
    config: { bookingType: "surgery", requiresRoom: true },
  },
];

const GROWTH_WORKFLOWS: WorkflowTemplate[] = [
  ...STANDARD_WORKFLOWS,
  {
    code: "consultation_nurture",
    name: "Post-consultation nurture sequence",
    type: "reminder",
    config: { triggerEvent: "post_consult", channel: "email" },
  },
];

const ENTERPRISE_WORKFLOWS: WorkflowTemplate[] = [
  ...SURGICAL_WORKFLOWS,
  {
    code: "multi_clinic_routing",
    name: "Multi-clinic lead routing",
    type: "crm_pipeline",
    config: {
      stages: [
        "intake",
        "clinic_assignment",
        "consultation_booked",
        "treatment_plan",
        "won",
        "lost",
      ],
      multiClinic: true,
    },
  },
];

const STANDARD_ACADEMY: AcademyTrainingAssignment[] = [
  {
    trackCode: "fi_clinical_foundations",
    trackName: "FI Clinical Foundations",
    targetRoles: ["consultant", "nurse"],
    mandatory: true,
  },
  {
    trackCode: "reception_excellence",
    trackName: "Reception Excellence",
    targetRoles: ["crm_operator"],
    mandatory: false,
  },
];

const SURGICAL_ACADEMY: AcademyTrainingAssignment[] = [
  ...STANDARD_ACADEMY,
  {
    trackCode: "theatre_privileges_fue",
    trackName: "Theatre Privileges — FUE",
    targetRoles: ["doctor", "nurse"],
    mandatory: true,
  },
  {
    trackCode: "graft_counting_competency",
    trackName: "Graft Counting Competency",
    targetRoles: ["nurse"],
    mandatory: true,
  },
];

const GROWTH_ACADEMY: AcademyTrainingAssignment[] = [
  {
    trackCode: "consultation_mastery",
    trackName: "Consultation Mastery",
    targetRoles: ["consultant"],
    mandatory: true,
  },
  {
    trackCode: "trichology_basics",
    trackName: "Trichology Basics",
    targetRoles: ["consultant", "nurse"],
    mandatory: false,
  },
];

const ENTERPRISE_ACADEMY: AcademyTrainingAssignment[] = [
  ...SURGICAL_ACADEMY,
  {
    trackCode: "multi_clinic_ops",
    trackName: "Multi-Clinic Operations",
    targetRoles: ["clinic_admin", "operations_admin"],
    mandatory: true,
  },
  {
    trackCode: "data_safety_compliance",
    trackName: "Data Safety & Compliance",
    targetRoles: ["data_safety_admin"],
    mandatory: true,
  },
];

export const MODULE_BUNDLES: Readonly<Record<string, ModuleBundle>> = {
  core_clinic: {
    code: "core_clinic",
    displayName: "Core Clinic",
    subscriptionStatus: "trialing",
    verificationStatus: "verified",
    enabledModules: ["reception_os", "consultation_os", "patient_os", "analytics_os"],
  },
  surgical_clinic: {
    code: "surgical_clinic",
    displayName: "Surgical Clinic",
    subscriptionStatus: "trialing",
    verificationStatus: "verified",
    enabledModules: [
      "reception_os",
      "consultation_os",
      "patient_os",
      "surgery_os",
      "imaging_os",
      "financial_os",
      "analytics_os",
      "academy_os",
    ],
  },
  growth_clinic: {
    code: "growth_clinic",
    displayName: "Growth & Consultation",
    subscriptionStatus: "trialing",
    verificationStatus: "verified",
    enabledModules: [
      "reception_os",
      "consultation_os",
      "patient_os",
      "financial_os",
      "analytics_os",
    ],
  },
  enterprise_group: {
    code: "enterprise_group",
    displayName: "Enterprise Multi-Clinic",
    subscriptionStatus: "trialing",
    verificationStatus: "enterprise_verified",
    enabledModules: [
      "reception_os",
      "consultation_os",
      "patient_os",
      "surgery_os",
      "financial_os",
      "imaging_os",
      "audit_os",
      "academy_os",
      "analytics_os",
      "hr_os",
    ],
  },
};

export const ROLE_PACKS: Readonly<Record<string, RolePack>> = {
  standard_clinic_roles: {
    code: "standard_clinic_roles",
    displayName: "Standard Clinic Roles",
    primaryAdminRole: "clinic_admin",
    additionalRoles: ["operations_admin", "dashboard_viewer"],
    staffRoleSeeds: ["consultant", "crm_operator", "nurse"],
  },
  surgical_clinic_roles: {
    code: "surgical_clinic_roles",
    displayName: "Surgical Clinic Roles",
    primaryAdminRole: "clinic_admin",
    additionalRoles: ["operations_admin", "finance_admin", "data_safety_admin"],
    staffRoleSeeds: ["doctor", "consultant", "nurse", "crm_operator"],
  },
  growth_clinic_roles: {
    code: "growth_clinic_roles",
    displayName: "Growth Clinic Roles",
    primaryAdminRole: "clinic_admin",
    additionalRoles: ["finance_admin", "dashboard_viewer"],
    staffRoleSeeds: ["consultant", "crm_operator"],
  },
  enterprise_group_roles: {
    code: "enterprise_group_roles",
    displayName: "Enterprise Group Roles",
    primaryAdminRole: "clinic_admin",
    additionalRoles: ["finance_admin", "operations_admin", "data_safety_admin", "dashboard_viewer"],
    staffRoleSeeds: ["doctor", "consultant", "nurse", "crm_operator", "hr_manager"],
  },
};

function sandboxSeed(enabled: boolean, opts?: Partial<SandboxSeedOption>): SandboxSeedOption {
  return {
    enabled,
    includeDemoPatients: enabled,
    includeDemoBookings: enabled,
    includeDemoStaff: enabled,
    ...opts,
  };
}

export const CLINIC_DEPLOYMENT_TEMPLATES: Readonly<
  Record<ClinicDeploymentTemplateCode, ClinicDeploymentTemplate>
> = {
  standard_hair_restoration: {
    code: "standard_hair_restoration",
    displayName: "Standard Hair Restoration Clinic",
    description:
      "Core reception, consultation, and patient workflows for a single-site hair restoration clinic.",
    rolePackCode: "standard_clinic_roles",
    moduleBundleCode: "core_clinic",
    serviceTemplates: [
      ...CORE_SERVICES,
      {
        code: "prp",
        name: "PRP Treatment",
        bookingType: "prp",
        durationMinutes: 60,
        category: "Treatment",
        basePrice: 0,
        color: "#14b8a6",
      },
    ],
    workflowTemplates: STANDARD_WORKFLOWS,
    academyAssignments: STANDARD_ACADEMY,
    sandboxSeed: sandboxSeed(true),
  },
  surgical_hair_restoration: {
    code: "surgical_hair_restoration",
    displayName: "Surgical Hair Restoration Clinic",
    description:
      "Full surgical stack with theatre workflows, imaging, financial clearance, and AcademyOS privileges.",
    rolePackCode: "surgical_clinic_roles",
    moduleBundleCode: "surgical_clinic",
    serviceTemplates: SURGICAL_SERVICES,
    workflowTemplates: SURGICAL_WORKFLOWS,
    academyAssignments: SURGICAL_ACADEMY,
    sandboxSeed: sandboxSeed(false),
  },
  growth_consultation: {
    code: "growth_consultation",
    displayName: "Growth / Consultation Clinic",
    description:
      "Consultation-led growth clinic with trichology and non-surgical treatment pathways.",
    rolePackCode: "growth_clinic_roles",
    moduleBundleCode: "growth_clinic",
    serviceTemplates: GROWTH_SERVICES,
    workflowTemplates: GROWTH_WORKFLOWS,
    academyAssignments: GROWTH_ACADEMY,
    sandboxSeed: sandboxSeed(true, { includeDemoBookings: false }),
  },
  enterprise_multi_clinic: {
    code: "enterprise_multi_clinic",
    displayName: "Enterprise Multi-Clinic Group",
    description:
      "Enterprise verification, HR OS, audit, and multi-clinic routing for clinic groups.",
    rolePackCode: "enterprise_group_roles",
    moduleBundleCode: "enterprise_group",
    serviceTemplates: SURGICAL_SERVICES,
    workflowTemplates: ENTERPRISE_WORKFLOWS,
    academyAssignments: ENTERPRISE_ACADEMY,
    sandboxSeed: sandboxSeed(false),
  },
};

/** Map legacy Phase A template code to Phase B deployment template. */
export const LEGACY_TEMPLATE_CODE_MAP: Readonly<Record<string, ClinicDeploymentTemplateCode>> = {
  standard_clinic: "standard_hair_restoration",
};

export function isClinicDeploymentTemplateCode(
  value: string | null | undefined
): value is ClinicDeploymentTemplateCode {
  return CLINIC_DEPLOYMENT_TEMPLATE_CODES.includes(
    String(value ?? "").trim() as ClinicDeploymentTemplateCode
  );
}

export function listClinicDeploymentTemplateSummaries(): readonly {
  code: ClinicDeploymentTemplateCode;
  displayName: string;
  description: string;
}[] {
  return CLINIC_DEPLOYMENT_TEMPLATE_CODES.map((code) => {
    const t = CLINIC_DEPLOYMENT_TEMPLATES[code];
    return { code, displayName: t.displayName, description: t.description };
  });
}
