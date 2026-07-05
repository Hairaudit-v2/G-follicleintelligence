/**
 * FI-HAIRAUDIT-CLINIC-DISCOVERY-DATA-1 — pure public clinic discovery mappers and dedup.
 */

import type {
  FiOsClinicDiscoveryInput,
  HairAuditStandaloneClinicInput,
  HybridClinicMatchInput,
  PublicClinicAuditParticipationStatus,
  PublicClinicAuditSource,
  PublicClinicDiscoveryAdminSettings,
  PublicClinicLinkOrigin,
  PublicClinicProfile,
  PublicClinicSearchDocument,
} from "./publicClinicProfileTypes";
import { PUBLIC_CLINIC_SENSITIVE_FIELD_KEYS } from "./publicClinicProfileTypes";

const HAIRAUDIT_OWNED_FIELDS = new Set([
  "audit_verified",
  "audit_participation_status",
  "last_audit_activity_at",
  "hairaudit_clinic_id",
] as const);

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function uniqueServices(values: readonly string[] | undefined): string[] {
  const out: string[] = [];
  for (const value of values ?? []) {
    const trimmed = value.trim();
    if (trimmed && !out.includes(trimmed)) out.push(trimmed);
  }
  return out;
}

function parseAddressParts(address: string | null | undefined): {
  citySuburb: string | null;
  stateRegion: string | null;
  country: string | null;
} {
  const raw = readString(address);
  if (!raw) return { citySuburb: null, stateRegion: null, country: null };
  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return {
      citySuburb: parts[parts.length - 3] ?? null,
      stateRegion: parts[parts.length - 2] ?? null,
      country: parts[parts.length - 1] ?? null,
    };
  }
  if (parts.length === 2) {
    return { citySuburb: parts[0], stateRegion: parts[1], country: null };
  }
  return { citySuburb: parts[0] ?? null, stateRegion: null, country: null };
}

export function defaultPublicClinicDiscoveryAdminSettings(
  clinicName: string
): PublicClinicDiscoveryAdminSettings {
  return {
    public_profile_enabled: false,
    search_visible: false,
    accepts_independent_hairaudit_enquiries: false,
    clinic_name: clinicName,
    city_suburb: null,
    state_region: null,
    country: null,
    public_phone: null,
    public_email: null,
    public_website_url: null,
    public_booking_url: null,
    logo_brand_image_url: null,
    services_offered: [],
    profile_summary: null,
    profile_bio: null,
  };
}

export function derivePublicClinicSlug(input: {
  clinicName: string;
  fiClinicId?: string | null;
  hairauditClinicId?: string | null;
}): string {
  const base = normalizeSlug(input.clinicName) || "clinic";
  const suffix = readString(input.hairauditClinicId)?.slice(0, 8) ??
    readString(input.fiClinicId)?.slice(0, 8);
  return suffix ? `${base}-${suffix}` : base;
}

function applyDiscoverySettings(
  base: PublicClinicDiscoveryAdminSettings,
  overrides?: Partial<PublicClinicDiscoveryAdminSettings> | null
): PublicClinicDiscoveryAdminSettings {
  if (!overrides) return base;
  return {
    ...base,
    ...overrides,
    services_offered: uniqueServices(overrides.services_offered ?? base.services_offered),
  };
}

function buildProfileShell(input: {
  publicClinicProfileId?: string;
  tenantId?: string | null;
  fiClinicId?: string | null;
  hairauditClinicId?: string | null;
  clinicName: string;
  publicSlug: string;
  auditSource: PublicClinicAuditSource;
  linkOrigin: PublicClinicLinkOrigin;
  settings: PublicClinicDiscoveryAdminSettings;
  auditParticipationStatus?: PublicClinicAuditParticipationStatus;
  auditVerified?: boolean;
  lastAuditActivityAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}): PublicClinicProfile {
  const now = new Date().toISOString();
  return {
    public_clinic_profile_id: input.publicClinicProfileId ?? "00000000-0000-4000-8000-000000000001",
    tenant_id: input.tenantId ?? null,
    fi_clinic_id: input.fiClinicId ?? null,
    hairaudit_clinic_id: input.hairauditClinicId ?? null,
    clinic_name: input.settings.clinic_name,
    public_slug: input.publicSlug,
    audit_source: input.auditSource,
    audit_participation_status: input.auditParticipationStatus ?? "not_enrolled",
    audit_verified: input.auditVerified ?? false,
    public_profile_enabled: input.settings.public_profile_enabled,
    search_visible: input.settings.search_visible,
    accepts_independent_hairaudit_enquiries:
      input.settings.accepts_independent_hairaudit_enquiries,
    city_suburb: input.settings.city_suburb,
    state_region: input.settings.state_region,
    country: input.settings.country,
    public_phone: input.settings.public_phone,
    public_email: input.settings.public_email,
    public_website_url: input.settings.public_website_url,
    public_booking_url: input.settings.public_booking_url,
    logo_brand_image_url: input.settings.logo_brand_image_url,
    services_offered: input.settings.services_offered,
    profile_summary: input.settings.profile_summary,
    profile_bio: input.settings.profile_bio,
    last_audit_activity_at: input.lastAuditActivityAt ?? null,
    link_origin: input.linkOrigin,
    created_at: input.createdAt ?? now,
    updated_at: input.updatedAt ?? now,
  };
}

export function buildPublicClinicProfileFromFiOsClinic(
  input: FiOsClinicDiscoveryInput
): PublicClinicProfile {
  const clinicName =
    readString(input.discoverySettings?.clinic_name) ??
    readString(input.settings?.displayName) ??
    input.clinicDisplayName.trim();
  const addressParts = parseAddressParts(input.settings?.address);
  const baseSettings = applyDiscoverySettings(
    {
      ...defaultPublicClinicDiscoveryAdminSettings(clinicName),
      city_suburb: addressParts.citySuburb,
      state_region: addressParts.stateRegion,
      country: addressParts.country,
      public_phone: readString(input.settings?.phone),
      public_email: readString(input.settings?.email),
      public_booking_url:
        readString(input.settings?.bookingUrl) ?? readString(input.settings?.publicIntakeUrl),
      public_website_url: readString(input.branding?.websiteUrl),
      logo_brand_image_url: readString(input.branding?.logoUrl),
    },
    input.discoverySettings
  );

  const hairauditClinicId =
    readString(input.explicitHybridLink?.hairauditClinicId) ??
    readString(input.hairauditClinicId);

  const auditSource: PublicClinicAuditSource = hairauditClinicId ? "hybrid" : "fi_os";
  const linkOrigin: PublicClinicLinkOrigin = hairauditClinicId ? "hybrid" : "fi_os";

  return buildProfileShell({
    tenantId: input.tenantId,
    fiClinicId: input.fiClinicId,
    hairauditClinicId,
    clinicName,
    publicSlug: derivePublicClinicSlug({
      clinicName,
      fiClinicId: input.fiClinicId,
      hairauditClinicId,
    }),
    auditSource,
    linkOrigin,
    settings: baseSettings,
    auditVerified: input.explicitHybridLink?.linkVerified ?? false,
  });
}

export function buildPublicClinicProfileFromHairAuditClinic(
  input: HairAuditStandaloneClinicInput
): PublicClinicProfile {
  const clinicName = input.clinicName.trim();
  const baseSettings = applyDiscoverySettings(
    {
      ...defaultPublicClinicDiscoveryAdminSettings(clinicName),
      city_suburb: readString(input.citySuburb),
      state_region: readString(input.stateRegion),
      country: readString(input.country),
      public_phone: readString(input.publicPhone),
      public_email: readString(input.publicEmail),
      public_website_url: readString(input.publicWebsiteUrl),
      public_booking_url: readString(input.publicBookingUrl),
      logo_brand_image_url: readString(input.logoBrandImageUrl),
      services_offered: uniqueServices(input.servicesOffered),
      profile_summary: readString(input.profileSummary),
      profile_bio: readString(input.profileBio),
    },
    input.discoverySettings
  );

  return buildProfileShell({
    hairauditClinicId: input.hairauditClinicId.trim(),
    clinicName,
    publicSlug: derivePublicClinicSlug({
      clinicName,
      hairauditClinicId: input.hairauditClinicId,
    }),
    auditSource: "hairaudit",
    linkOrigin: input.linkOrigin ?? "hairaudit",
    settings: baseSettings,
    auditVerified: input.auditVerified ?? false,
    lastAuditActivityAt: readString(input.lastAuditActivityAt),
    auditParticipationStatus: input.auditVerified ? "verified" : "active",
  });
}

export function mergePublicClinicProfileAdditive(input: {
  existing: PublicClinicProfile;
  incoming: PublicClinicProfile;
  preserveHairAuditOwned?: boolean;
}): PublicClinicProfile {
  const preserve = input.preserveHairAuditOwned ?? true;
  const merged: PublicClinicProfile = {
    ...input.existing,
    clinic_name: input.incoming.clinic_name || input.existing.clinic_name,
    city_suburb: input.incoming.city_suburb ?? input.existing.city_suburb,
    state_region: input.incoming.state_region ?? input.existing.state_region,
    country: input.incoming.country ?? input.existing.country,
    public_phone: input.incoming.public_phone ?? input.existing.public_phone,
    public_email: input.incoming.public_email ?? input.existing.public_email,
    public_website_url: input.incoming.public_website_url ?? input.existing.public_website_url,
    public_booking_url: input.incoming.public_booking_url ?? input.existing.public_booking_url,
    logo_brand_image_url:
      input.incoming.logo_brand_image_url ?? input.existing.logo_brand_image_url,
    services_offered:
      input.incoming.services_offered.length > 0
        ? input.incoming.services_offered
        : input.existing.services_offered,
    profile_summary: input.incoming.profile_summary ?? input.existing.profile_summary,
    profile_bio: input.incoming.profile_bio ?? input.existing.profile_bio,
    public_profile_enabled: input.incoming.public_profile_enabled,
    search_visible: input.incoming.search_visible,
    accepts_independent_hairaudit_enquiries:
      input.incoming.accepts_independent_hairaudit_enquiries,
    updated_at: new Date().toISOString(),
  };

  if (input.incoming.tenant_id) merged.tenant_id = input.incoming.tenant_id;
  if (input.incoming.fi_clinic_id) merged.fi_clinic_id = input.incoming.fi_clinic_id;

  if (!preserve || !input.existing.hairaudit_clinic_id) {
    merged.hairaudit_clinic_id =
      input.incoming.hairaudit_clinic_id ?? input.existing.hairaudit_clinic_id;
  }

  for (const field of HAIRAUDIT_OWNED_FIELDS) {
    if (preserve && input.existing[field] != null && input.existing[field] !== false) {
      (merged as Record<string, unknown>)[field] = input.existing[field];
    }
  }

  if (merged.tenant_id && merged.hairaudit_clinic_id) {
    merged.audit_source = "hybrid";
    merged.link_origin = merged.link_origin === "legacy" ? "legacy" : "hybrid";
  }

  return merged;
}

export function resolveHybridPublicClinicProfile(
  input: HybridClinicMatchInput
): PublicClinicProfile | null {
  const { fiProfile, hairauditProfile } = input;

  if (input.explicitLink?.fiClinicId && input.explicitLink.hairauditClinicId) {
    if (fiProfile && hairauditProfile) {
      return mergePublicClinicProfileAdditive({
        existing: hairauditProfile,
        incoming: {
          ...fiProfile,
          fi_clinic_id: input.explicitLink.fiClinicId,
          hairaudit_clinic_id: input.explicitLink.hairauditClinicId,
          audit_source: "hybrid",
          link_origin: hairauditProfile.link_origin === "legacy" ? "legacy" : "hybrid",
        },
        preserveHairAuditOwned: true,
      });
    }

    const base = fiProfile ?? hairauditProfile;
    if (!base) return null;
    return mergePublicClinicProfileAdditive({
      existing: base,
      incoming: {
        ...base,
        tenant_id: fiProfile?.tenant_id ?? base.tenant_id,
        fi_clinic_id: input.explicitLink.fiClinicId,
        hairaudit_clinic_id: input.explicitLink.hairauditClinicId,
        audit_source: "hybrid",
        link_origin: base.link_origin === "legacy" ? "legacy" : "hybrid",
      },
      preserveHairAuditOwned: Boolean(hairauditProfile),
    });
  }

  const verifiedId = readString(input.verifiedHairauditClinicId);
  if (verifiedId && fiProfile?.hairaudit_clinic_id === verifiedId && hairauditProfile) {
    return mergePublicClinicProfileAdditive({
      existing: hairauditProfile,
      incoming: fiProfile,
      preserveHairAuditOwned: true,
    });
  }

  if (
    fiProfile?.hairaudit_clinic_id &&
    hairauditProfile?.hairaudit_clinic_id &&
    fiProfile.hairaudit_clinic_id === hairauditProfile.hairaudit_clinic_id
  ) {
    return mergePublicClinicProfileAdditive({
      existing: hairauditProfile,
      incoming: fiProfile,
      preserveHairAuditOwned: true,
    });
  }

  return fiProfile ?? hairauditProfile ?? null;
}

export function toPublicClinicSearchDocument(
  profile: PublicClinicProfile
): PublicClinicSearchDocument | null {
  if (!profile.public_profile_enabled || !profile.search_visible) return null;
  return {
    public_slug: profile.public_slug,
    clinic_name: profile.clinic_name,
    city_suburb: profile.city_suburb,
    state_region: profile.state_region,
    country: profile.country,
    public_phone: profile.public_phone,
    public_email: profile.public_email,
    public_website_url: profile.public_website_url,
    public_booking_url: profile.public_booking_url,
    logo_brand_image_url: profile.logo_brand_image_url,
    services_offered: profile.services_offered,
    profile_summary: profile.profile_summary,
    profile_bio: profile.profile_bio,
    audit_verified: profile.audit_verified,
    accepts_independent_hairaudit_enquiries: profile.accepts_independent_hairaudit_enquiries,
  };
}

export function assertPublicClinicSearchDocumentHasNoSensitiveFields(
  document: Record<string, unknown>
): string[] {
  const violations: string[] = [];
  for (const key of PUBLIC_CLINIC_SENSITIVE_FIELD_KEYS) {
    if (key in document) violations.push(key);
  }
  return violations;
}

export function buildPublicClinicDiscoveryPreview(
  profile: PublicClinicProfile
): {
  profile: PublicClinicProfile;
  searchDocument: PublicClinicSearchDocument | null;
  publishReady: boolean;
  blockingReasons: string[];
} {
  const blockingReasons: string[] = [];
  if (!profile.public_profile_enabled) blockingReasons.push("public_profile_disabled");
  if (!profile.clinic_name.trim()) blockingReasons.push("missing_clinic_name");
  if (!profile.public_slug.trim()) blockingReasons.push("missing_public_slug");
  if (profile.search_visible && !profile.city_suburb && !profile.state_region) {
    blockingReasons.push("missing_public_location");
  }

  const searchDocument = toPublicClinicSearchDocument(profile);
  const sensitive =
    searchDocument != null
      ? assertPublicClinicSearchDocumentHasNoSensitiveFields(
          searchDocument as unknown as Record<string, unknown>
        )
      : [];

  return {
    profile,
    searchDocument,
    publishReady: blockingReasons.length === 0 && sensitive.length === 0,
    blockingReasons: [...blockingReasons, ...sensitive.map((key) => `sensitive:${key}`)],
  };
}