/**
 * FI OS Stage 3.5 — typed catalogue aligned with `fi_staff_position_types`,
 * `fi_staff_feature_templates`, and `fi_tenant_operating_modes` global seeds.
 */

export const FI_STAFF_POSITION_TYPE_CODES = [
  "DIRECTOR",
  "CLINIC_MANAGER",
  "SURGEON",
  "DOCTOR",
  "RN",
  "TECHNICIAN",
  "CONSULTANT",
  "RECEPTION",
  "ACADEMY_TRAINER",
  "AUDITOR",
  "FINANCE_ADMIN",
  "DATA_SAFETY_ADMIN",
] as const;

export type FiStaffPositionTypeCode = (typeof FI_STAFF_POSITION_TYPE_CODES)[number];

export function isFiStaffPositionTypeCode(v: string): v is FiStaffPositionTypeCode {
  return (FI_STAFF_POSITION_TYPE_CODES as readonly string[]).includes(v);
}

export const FI_STAFF_FEATURE_TEMPLATE_KEYS = [
  "director_default",
  "clinic_manager_default",
  "surgeon_default",
  "doctor_default",
  "nurse_default",
  "technician_default",
  "consultant_default",
  "reception_default",
  "academy_trainer_default",
  "auditor_default",
  "finance_admin_default",
  "data_safety_admin_default",
] as const;

export type FiStaffFeatureTemplateKey = (typeof FI_STAFF_FEATURE_TEMPLATE_KEYS)[number];

export function isFiStaffFeatureTemplateKey(v: string): v is FiStaffFeatureTemplateKey {
  return (FI_STAFF_FEATURE_TEMPLATE_KEYS as readonly string[]).includes(v);
}

export const FI_TENANT_OPERATING_MODE_KEYS = [
  "hair_transplant_clinic",
  "medical_hair_clinic",
  "training_academy",
  "audit_partner",
  "full_fi_os",
] as const;

export type FiTenantOperatingModeKey = (typeof FI_TENANT_OPERATING_MODE_KEYS)[number];

export function isFiTenantOperatingModeKey(v: string): v is FiTenantOperatingModeKey {
  return (FI_TENANT_OPERATING_MODE_KEYS as readonly string[]).includes(v);
}

/** Department keys stored on `fi_staff_position_types.department` (global seeds). */
export const FI_ORG_DEPARTMENT_KEYS = [
  "leadership",
  "operations",
  "clinical_surgical",
  "clinical",
  "clinical_support",
  "clinical_consulting",
  "front_of_house",
  "training",
  "governance",
  "finance",
] as const;

export type FiOrgDepartmentKey = (typeof FI_ORG_DEPARTMENT_KEYS)[number];

export function isFiOrgDepartmentKey(v: string): v is FiOrgDepartmentKey {
  return (FI_ORG_DEPARTMENT_KEYS as readonly string[]).includes(v);
}

export const FI_CLINICAL_ACCESS_LEVELS = [
  "full_clinical",
  "limited_clinical",
  "non_clinical",
  "administrative",
  "governance",
  "financial",
  "data_safety",
] as const;

export type FiClinicalAccessLevel = (typeof FI_CLINICAL_ACCESS_LEVELS)[number];

export function isFiClinicalAccessLevel(v: string): v is FiClinicalAccessLevel {
  return (FI_CLINICAL_ACCESS_LEVELS as readonly string[]).includes(v);
}

/** Optional `fi_tenants.config_json` hook — only applied when set (Stage 3.5+). */
export const FI_TENANT_CONFIG_OS_OPERATING_MODE_KEY = "fi_os_operating_mode_key" as const;

export function assertFiOrganisationalIntelligenceRegistryComplete(): void {
  if (FI_STAFF_POSITION_TYPE_CODES.length !== 12) {
    throw new Error("Expected 12 global staff position type codes.");
  }
  if (FI_STAFF_FEATURE_TEMPLATE_KEYS.length !== 12) {
    throw new Error("Expected 12 global staff feature template keys.");
  }
  if (FI_TENANT_OPERATING_MODE_KEYS.length !== 5) {
    throw new Error("Expected 5 global tenant operating mode keys.");
  }
}
