/**
 * FI-HAIRAUDIT-CLINIC-DISCOVERY-DATA-1 — public clinic discovery profile types.
 */

export const PUBLIC_CLINIC_AUDIT_SOURCES = ["fi_os", "hairaudit", "hybrid"] as const;
export type PublicClinicAuditSource = (typeof PUBLIC_CLINIC_AUDIT_SOURCES)[number];

export const PUBLIC_CLINIC_LINK_ORIGINS = ["fi_os", "hairaudit", "hybrid", "legacy"] as const;
export type PublicClinicLinkOrigin = (typeof PUBLIC_CLINIC_LINK_ORIGINS)[number];

export const PUBLIC_CLINIC_AUDIT_PARTICIPATION_STATUSES = [
  "not_enrolled",
  "invited",
  "active",
  "paused",
  "verified",
] as const;
export type PublicClinicAuditParticipationStatus =
  (typeof PUBLIC_CLINIC_AUDIT_PARTICIPATION_STATUSES)[number];

export type PublicClinicProfile = {
  public_clinic_profile_id: string;
  tenant_id: string | null;
  fi_clinic_id: string | null;
  hairaudit_clinic_id: string | null;
  clinic_name: string;
  public_slug: string;
  audit_source: PublicClinicAuditSource;
  audit_participation_status: PublicClinicAuditParticipationStatus;
  audit_verified: boolean;
  public_profile_enabled: boolean;
  search_visible: boolean;
  accepts_independent_hairaudit_enquiries: boolean;
  city_suburb: string | null;
  state_region: string | null;
  country: string | null;
  public_phone: string | null;
  public_email: string | null;
  public_website_url: string | null;
  public_booking_url: string | null;
  logo_brand_image_url: string | null;
  services_offered: string[];
  profile_summary: string | null;
  profile_bio: string | null;
  last_audit_activity_at: string | null;
  link_origin: PublicClinicLinkOrigin;
  created_at: string;
  updated_at: string;
};

export type PublicClinicSearchDocument = {
  public_slug: string;
  clinic_name: string;
  city_suburb: string | null;
  state_region: string | null;
  country: string | null;
  public_phone: string | null;
  public_email: string | null;
  public_website_url: string | null;
  public_booking_url: string | null;
  logo_brand_image_url: string | null;
  services_offered: string[];
  profile_summary: string | null;
  profile_bio: string | null;
  audit_verified: boolean;
  accepts_independent_hairaudit_enquiries: boolean;
};

export type FiOsClinicDiscoveryInput = {
  tenantId: string;
  fiClinicId: string;
  clinicDisplayName: string;
  organisationId?: string | null;
  hairauditClinicId?: string | null;
  settings?: {
    displayName?: string | null;
    phone?: string | null;
    email?: string | null;
    bookingUrl?: string | null;
    publicIntakeUrl?: string | null;
    address?: string | null;
    timezone?: string | null;
    metadata?: Record<string, unknown>;
  } | null;
  branding?: {
    logoUrl?: string | null;
    websiteUrl?: string | null;
  } | null;
  discoverySettings?: Partial<PublicClinicDiscoveryAdminSettings> | null;
  explicitHybridLink?: {
    hairauditClinicId: string;
    linkVerified?: boolean;
  } | null;
};

export type HairAuditStandaloneClinicInput = {
  hairauditClinicId: string;
  clinicName: string;
  citySuburb?: string | null;
  stateRegion?: string | null;
  country?: string | null;
  publicPhone?: string | null;
  publicEmail?: string | null;
  publicWebsiteUrl?: string | null;
  publicBookingUrl?: string | null;
  logoBrandImageUrl?: string | null;
  servicesOffered?: readonly string[];
  profileSummary?: string | null;
  profileBio?: string | null;
  auditVerified?: boolean;
  lastAuditActivityAt?: string | null;
  discoverySettings?: Partial<PublicClinicDiscoveryAdminSettings> | null;
  linkOrigin?: PublicClinicLinkOrigin;
};

export type PublicClinicDiscoveryAdminSettings = {
  public_profile_enabled: boolean;
  search_visible: boolean;
  accepts_independent_hairaudit_enquiries: boolean;
  clinic_name: string;
  city_suburb: string | null;
  state_region: string | null;
  country: string | null;
  public_phone: string | null;
  public_email: string | null;
  public_website_url: string | null;
  public_booking_url: string | null;
  logo_brand_image_url: string | null;
  services_offered: string[];
  profile_summary: string | null;
  profile_bio: string | null;
};

export type HybridClinicMatchInput = {
  fiProfile: PublicClinicProfile | null;
  hairauditProfile: PublicClinicProfile | null;
  explicitLink?: { fiClinicId: string; hairauditClinicId: string } | null;
  verifiedHairauditClinicId?: string | null;
};

export const PUBLIC_CLINIC_SENSITIVE_FIELD_KEYS = [
  "patient_id",
  "case_id",
  "report_id",
  "hairaudit_case_id",
  "outcome_metrics",
  "graft_count",
  "tenant_id",
] as const;
