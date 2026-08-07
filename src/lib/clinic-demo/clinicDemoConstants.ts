/**
 * Package B — single-clinic guided demo tenant ("Follicle Demo Clinic").
 */

export const CLINIC_DEMO_TENANT_SLUG = "follicle-demo-clinic";
export const CLINIC_DEMO_TENANT_NAME = "Follicle Demo Clinic";
export const CLINIC_DEMO_CLINIC_NAME = "Follicle Demo Clinic — Main";
export const CLINIC_DEMO_TIMEZONE = "Australia/Sydney";
export const CLINIC_DEMO_SESSION_ID = "c11c0000-d3b0-4000-8000-c11c1c0000b001";
export const CLINIC_DEMO_PACK_CODE = "enterprise_demo" as const;
export const CLINIC_DEMO_TEMPLATE_CODE = "surgical_hair_restoration" as const;

export const CLINIC_DEMO_METADATA = {
  clinic_demo_mode: true,
  demo_package: "B",
  demo_purpose: "single_clinic_operator_pitch",
  operating_mode: "clinic_simulation",
} as const;

/** Canonical Package B James Chen patient key (must match SHOWCASE_JAMES_CHEN_PATIENT_KEY). */
export const CLINIC_DEMO_SHOWCASE_JAMES_CHEN_PATIENT_KEY = "showcase-james-chen-v1" as const;

export function isClinicDemoTenantMetadata(metadata: unknown): boolean {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const m = metadata as Record<string, unknown>;
  return m.clinic_demo_mode === true || m.demo_package === "B";
}
