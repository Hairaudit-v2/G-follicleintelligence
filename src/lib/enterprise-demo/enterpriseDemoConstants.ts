export const ENTERPRISE_DEMO_TENANT_SLUG = "ihrg-global";

export const ENTERPRISE_DEMO_TENANT_NAME = "International Hair Restoration Group";

export const ENTERPRISE_DEMO_CODE_NAME = "TITAN";

export const ENTERPRISE_DEMO_OPERATING_MODE = "enterprise_simulation";

export const ENTERPRISE_DEMO_VERSION = "phase_1f";

export const ENTERPRISE_DEMO_CASE_KEY_METADATA = "demo_case_key";
export const ENTERPRISE_DEMO_BOOKING_KEY_METADATA = "demo_booking_key";
export const ENTERPRISE_DEMO_SURGERY_KEY_METADATA = "demo_surgery_key";
export const ENTERPRISE_DEMO_GRAFT_SESSION_KEY_METADATA = "demo_graft_session_key";
export const ENTERPRISE_DEMO_GRAFT_EVENT_KEY_METADATA = "demo_graft_event_key";
export const ENTERPRISE_DEMO_IMAGE_KEY_METADATA = "demo_image_key";
export const ENTERPRISE_DEMO_AUDIT_KEY_METADATA = "demo_audit_key";
export const ENTERPRISE_DEMO_PROTOCOL_SESSION_KEY_METADATA = "demo_protocol_session_key";
export const ENTERPRISE_DEMO_INVOICE_KEY_METADATA = "demo_invoice_key";
export const ENTERPRISE_DEMO_PAYMENT_KEY_METADATA = "demo_payment_key";
export const ENTERPRISE_DEMO_FINANCIAL_RISK_KEY_METADATA = "demo_financial_risk_key";

export const ENTERPRISE_DEMO_PURPOSE = "enterprise_franchise_sales";

export type EnterpriseDemoTenantSettings = {
  enterprise_demo_mode: true;
  demo_codename: typeof ENTERPRISE_DEMO_CODE_NAME;
  demo_purpose: typeof ENTERPRISE_DEMO_PURPOSE;
  demo_version: typeof ENTERPRISE_DEMO_VERSION;
};

export type EnterpriseDemoTenantMetadata = {
  operating_mode: typeof ENTERPRISE_DEMO_OPERATING_MODE;
} & EnterpriseDemoTenantSettings;

export const ENTERPRISE_DEMO_CLINICS = [
  {
    name: "London Central Institute",
    slug: "london-central-institute",
    timezone: "Europe/London",
    country: "United Kingdom",
    city: "London",
  },
  {
    name: "Dubai Hair Institute",
    slug: "dubai-hair-institute",
    timezone: "Asia/Dubai",
    country: "United Arab Emirates",
    city: "Dubai",
  },
  {
    name: "Sydney Hair Institute",
    slug: "sydney-hair-institute",
    timezone: "Australia/Sydney",
    country: "Australia",
    city: "Sydney",
  },
  {
    name: "Bangkok Restoration Centre",
    slug: "bangkok-restoration-centre",
    timezone: "Asia/Bangkok",
    country: "Thailand",
    city: "Bangkok",
  },
  {
    name: "Athens Medical Institute",
    slug: "athens-medical-institute",
    timezone: "Europe/Athens",
    country: "Greece",
    city: "Athens",
  },
  {
    name: "Los Angeles Hair Institute",
    slug: "los-angeles-hair-institute",
    timezone: "America/Los_Angeles",
    country: "United States",
    city: "Los Angeles",
  },
  {
    name: "Mumbai Hair Sciences",
    slug: "mumbai-hair-sciences",
    timezone: "Asia/Kolkata",
    country: "India",
    city: "Mumbai",
  },
  {
    name: "São Paulo Hair Institute",
    slug: "sao-paulo-hair-institute",
    timezone: "America/Sao_Paulo",
    country: "Brazil",
    city: "São Paulo",
  },
] as const;

export function buildEnterpriseDemoTenantMetadata(): EnterpriseDemoTenantMetadata {
  return {
    operating_mode: ENTERPRISE_DEMO_OPERATING_MODE,
    enterprise_demo_mode: true,
    demo_codename: ENTERPRISE_DEMO_CODE_NAME,
    demo_purpose: ENTERPRISE_DEMO_PURPOSE,
    demo_version: ENTERPRISE_DEMO_VERSION,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** True when tenant settings metadata identifies the IHRG enterprise simulation tenant. */
export function isEnterpriseDemoTenantMetadata(metadata: unknown): boolean {
  const m = asRecord(metadata);
  if (!m) return false;

  const operatingMode = m.operating_mode;
  if (operatingMode !== ENTERPRISE_DEMO_OPERATING_MODE) return false;

  if (m.enterprise_demo_mode === true) return true;

  const nested = asRecord(m.settings);
  return nested?.enterprise_demo_mode === true;
}

export function isEnterpriseDemoOperatingMode(mode: string | null | undefined): boolean {
  return mode?.trim() === ENTERPRISE_DEMO_OPERATING_MODE;
}
