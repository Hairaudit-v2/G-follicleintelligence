/**
 * FI-TRICHOSCOPY-1A — capability keys and commercial tier packages.
 * Clinical logic must use capabilities, never plan name strings.
 */

export const HLI_TRICHOSCOPY_MODULE_KEY = "hli_trichoscopy" as const;

export const TRICHOSCOPY_CAPABILITIES = [
  "trichoscopy.view",
  "trichoscopy.request",
  "trichoscopy.capture",
  "trichoscopy.review",
  "trichoscopy.confirmed_evidence",
  "trichoscopy.quantitative_metrics",
  "trichoscopy.longitudinal",
  "trichoscopy.treatment_response",
  "trichoscopy.surgical_planning",
  "trichoscopy.procedure_day",
  "trichoscopy.patient_reports",
  "trichoscopy.fios_integration",
] as const;

export type TrichoscopyCapability = (typeof TRICHOSCOPY_CAPABILITIES)[number];

export const TRICHOSCOPY_CAPABILITY_TIERS = [
  "capture",
  "clinical",
  "longitudinal",
  "surgical",
  "complete",
] as const;

export type TrichoscopyCapabilityTier = (typeof TRICHOSCOPY_CAPABILITY_TIERS)[number];

export const TRICHOSCOPY_ENTITLEMENT_STATUSES = [
  "active",
  "trial",
  "grace_period",
  "expired",
  "suspended",
  "cancelled",
  "not_entitled",
] as const;

export type TrichoscopyEntitlementStatus = (typeof TRICHOSCOPY_ENTITLEMENT_STATUSES)[number];

const CAPTURE_CAPABILITIES: readonly TrichoscopyCapability[] = [
  "trichoscopy.view",
  "trichoscopy.request",
  "trichoscopy.capture",
  "trichoscopy.confirmed_evidence",
  "trichoscopy.fios_integration",
];

const CLINICAL_CAPABILITIES: readonly TrichoscopyCapability[] = [
  ...CAPTURE_CAPABILITIES,
  "trichoscopy.review",
  "trichoscopy.quantitative_metrics",
  "trichoscopy.patient_reports",
];

const LONGITUDINAL_CAPABILITIES: readonly TrichoscopyCapability[] = [
  ...CLINICAL_CAPABILITIES,
  "trichoscopy.longitudinal",
  "trichoscopy.treatment_response",
];

const SURGICAL_CAPABILITIES: readonly TrichoscopyCapability[] = [
  ...CLINICAL_CAPABILITIES,
  "trichoscopy.surgical_planning",
  "trichoscopy.procedure_day",
];

const COMPLETE_CAPABILITIES: readonly TrichoscopyCapability[] = [...TRICHOSCOPY_CAPABILITIES];

export const TRICHOSCOPY_TIER_CAPABILITIES: Readonly<
  Record<TrichoscopyCapabilityTier, readonly TrichoscopyCapability[]>
> = {
  capture: CAPTURE_CAPABILITIES,
  clinical: CLINICAL_CAPABILITIES,
  longitudinal: LONGITUDINAL_CAPABILITIES,
  surgical: SURGICAL_CAPABILITIES,
  complete: COMPLETE_CAPABILITIES,
};

/** Capabilities that remain readable after expiry/cancellation (historical evidence). */
export const TRICHOSCOPY_HISTORICAL_READ_CAPABILITIES: readonly TrichoscopyCapability[] = [
  "trichoscopy.view",
  "trichoscopy.confirmed_evidence",
];

/** Capabilities that create new billable / clinical work. */
export const TRICHOSCOPY_NEW_USAGE_CAPABILITIES: readonly TrichoscopyCapability[] = [
  "trichoscopy.request",
  "trichoscopy.capture",
  "trichoscopy.review",
  "trichoscopy.quantitative_metrics",
  "trichoscopy.longitudinal",
  "trichoscopy.treatment_response",
  "trichoscopy.surgical_planning",
  "trichoscopy.procedure_day",
  "trichoscopy.patient_reports",
];

const CAPABILITY_SET = new Set<string>(TRICHOSCOPY_CAPABILITIES);

export function isTrichoscopyCapability(value: string | null | undefined): value is TrichoscopyCapability {
  return CAPABILITY_SET.has(String(value ?? "").trim());
}

export function isTrichoscopyCapabilityTier(
  value: string | null | undefined
): value is TrichoscopyCapabilityTier {
  return (TRICHOSCOPY_CAPABILITY_TIERS as readonly string[]).includes(String(value ?? "").trim());
}

export function capabilitiesForTier(tier: TrichoscopyCapabilityTier): readonly TrichoscopyCapability[] {
  return TRICHOSCOPY_TIER_CAPABILITIES[tier];
}

export function intersectCapabilities(
  ...lists: Array<readonly TrichoscopyCapability[] | TrichoscopyCapability[] | null | undefined>
): TrichoscopyCapability[] {
  const nonEmpty = lists.filter((l): l is readonly TrichoscopyCapability[] => Boolean(l?.length));
  if (!nonEmpty.length) return [];
  let result = new Set(nonEmpty[0]);
  for (let i = 1; i < nonEmpty.length; i++) {
    const next = new Set(nonEmpty[i]);
    result = new Set([...result].filter((c) => next.has(c)));
  }
  return TRICHOSCOPY_CAPABILITIES.filter((c) => result.has(c));
}

export function hasCapability(
  enabled: readonly TrichoscopyCapability[] | null | undefined,
  capability: TrichoscopyCapability
): boolean {
  return Boolean(enabled?.includes(capability));
}

/** Map tenant config toggles onto capability allow-list (cannot expand beyond entitlement). */
export type TrichoscopyModuleSettings = {
  allowPatientUploads?: boolean;
  allowClinicCapture?: boolean;
  allowLongitudinalMonitoring?: boolean;
  allowSurgicalPlanning?: boolean;
  allowProcedureDayCapture?: boolean;
  allowPatientReports?: boolean;
  defaultReviewerRole?: string;
  defaultCaptureProtocol?: string;
  defaultDeviceId?: string;
};

export function capabilitiesFromModuleSettings(
  settings: TrichoscopyModuleSettings | null | undefined
): TrichoscopyCapability[] {
  if (!settings) return [...TRICHOSCOPY_CAPABILITIES];
  const out = new Set<TrichoscopyCapability>([
    "trichoscopy.view",
    "trichoscopy.request",
    "trichoscopy.review",
    "trichoscopy.confirmed_evidence",
    "trichoscopy.quantitative_metrics",
    "trichoscopy.fios_integration",
  ]);
  if (settings.allowClinicCapture !== false) out.add("trichoscopy.capture");
  if (settings.allowLongitudinalMonitoring) {
    out.add("trichoscopy.longitudinal");
    out.add("trichoscopy.treatment_response");
  }
  if (settings.allowSurgicalPlanning) out.add("trichoscopy.surgical_planning");
  if (settings.allowProcedureDayCapture) out.add("trichoscopy.procedure_day");
  if (settings.allowPatientReports) out.add("trichoscopy.patient_reports");
  return TRICHOSCOPY_CAPABILITIES.filter((c) => out.has(c));
}

export function isEntitlementStatusUsableForNewWork(
  status: TrichoscopyEntitlementStatus | null | undefined
): boolean {
  const s = String(status ?? "").trim();
  return s === "active" || s === "trial";
}

export function isEntitlementStatusHistoricalReadable(
  status: TrichoscopyEntitlementStatus | null | undefined
): boolean {
  const s = String(status ?? "").trim();
  return (
    s === "active" ||
    s === "trial" ||
    s === "grace_period" ||
    s === "expired" ||
    s === "cancelled"
  );
}

export function isEntitlementStatusGrace(
  status: TrichoscopyEntitlementStatus | null | undefined
): boolean {
  return String(status ?? "").trim() === "grace_period";
}

export type FiosTrichoscopyAccessDenialReason =
  | "platform_disabled"
  | "subscription_not_included"
  | "entitlement_inactive"
  | "tenant_module_disabled"
  | "capability_not_included"
  | "user_not_permitted"
  | "resource_not_accessible"
  | "subscription_expired"
  | "trial_expired"
  | "account_suspended";

export type FiosTrichoscopyAccessResult = {
  allowed: boolean;
  platformEnabled: boolean;
  tenantEntitled: boolean;
  tenantModuleEnabled: boolean;
  userPermitted: boolean;
  capabilityIncluded: boolean;
  resourceAccessible: boolean;
  subscriptionPlan?: string;
  entitlementStatus?: TrichoscopyEntitlementStatus;
  capabilityTier?: TrichoscopyCapabilityTier;
  enabledCapabilities: TrichoscopyCapability[];
  denialReason?: FiosTrichoscopyAccessDenialReason;
  /** When true, only historical confirmed evidence may be read. */
  historicalReadOnly?: boolean;
};

export function evaluateTrichoscopyAccessLayers(input: {
  platformEnabled: boolean;
  entitlementStatus: TrichoscopyEntitlementStatus | null;
  capabilityTier: TrichoscopyCapabilityTier | null;
  subscribedCapabilities: readonly TrichoscopyCapability[];
  tenantModuleEnabled: boolean;
  tenantConfigCapabilities: readonly TrichoscopyCapability[];
  platformCapabilities: readonly TrichoscopyCapability[];
  overrideCapabilities?: readonly TrichoscopyCapability[] | null;
  userPermitted: boolean;
  resourceAccessible: boolean;
  requestedCapability: TrichoscopyCapability;
  now?: Date;
  trialEndsAt?: string | null;
  expiresAt?: string | null;
  gracePeriodEndsAt?: string | null;
}): FiosTrichoscopyAccessResult {
  const now = input.now ?? new Date();
  const subscribed = intersectCapabilities(
    input.subscribedCapabilities,
    capabilitiesForTier(input.capabilityTier ?? "capture")
  );
  const baseEnabled = intersectCapabilities(
    subscribed,
    input.tenantConfigCapabilities,
    input.platformCapabilities
  );
  // Platform overrides grant temporary capabilities without silently rewriting the paid subscription.
  // They still cannot bypass the global platform flag (checked below).
  const enabledCapabilities = input.overrideCapabilities?.length
    ? Array.from(new Set([...baseEnabled, ...input.overrideCapabilities.filter((c) => input.platformCapabilities.includes(c))]))
    : baseEnabled;

  const base: FiosTrichoscopyAccessResult = {
    allowed: false,
    platformEnabled: input.platformEnabled,
    tenantEntitled: false,
    tenantModuleEnabled: input.tenantModuleEnabled,
    userPermitted: input.userPermitted,
    capabilityIncluded: false,
    resourceAccessible: input.resourceAccessible,
    entitlementStatus: input.entitlementStatus ?? undefined,
    capabilityTier: input.capabilityTier ?? undefined,
    enabledCapabilities,
  };

  if (!input.platformEnabled) {
    return { ...base, denialReason: "platform_disabled" };
  }

  let status = input.entitlementStatus;
  if (status === "trial" && input.trialEndsAt && new Date(input.trialEndsAt) < now) {
    status = "expired";
  }
  if (
    (status === "active" || status === "grace_period") &&
    input.expiresAt &&
    new Date(input.expiresAt) < now &&
    !(input.gracePeriodEndsAt && new Date(input.gracePeriodEndsAt) >= now)
  ) {
    status = "expired";
  }
  if (
    status === "grace_period" &&
    input.gracePeriodEndsAt &&
    new Date(input.gracePeriodEndsAt) < now
  ) {
    status = "expired";
  }

  base.entitlementStatus = status ?? undefined;

  if (!status || status === "not_entitled") {
    return { ...base, denialReason: "subscription_not_included" };
  }
  if (status === "suspended") {
    return { ...base, denialReason: "account_suspended" };
  }
  if (status === "expired") {
    const historical =
      TRICHOSCOPY_HISTORICAL_READ_CAPABILITIES.includes(input.requestedCapability) &&
      hasCapability(enabledCapabilities, input.requestedCapability);
    return {
      ...base,
      tenantEntitled: false,
      historicalReadOnly: true,
      allowed: false,
      denialReason: input.trialEndsAt ? "trial_expired" : "subscription_expired",
      capabilityIncluded: historical,
    };
  }
  if (status === "cancelled") {
    return {
      ...base,
      tenantEntitled: false,
      historicalReadOnly: true,
      denialReason: "entitlement_inactive",
    };
  }

  const entitledForNew = isEntitlementStatusUsableForNewWork(status);
  const grace = isEntitlementStatusGrace(status);
  base.tenantEntitled = entitledForNew || grace;

  if (!input.tenantModuleEnabled) {
    return { ...base, denialReason: "tenant_module_disabled" };
  }

  const capabilityIncluded = hasCapability(enabledCapabilities, input.requestedCapability);
  base.capabilityIncluded = capabilityIncluded;

  if (!capabilityIncluded) {
    return { ...base, denialReason: "capability_not_included" };
  }

  if (!input.userPermitted) {
    return { ...base, denialReason: "user_not_permitted" };
  }

  if (!input.resourceAccessible) {
    return { ...base, denialReason: "resource_not_accessible" };
  }

  if (grace && TRICHOSCOPY_NEW_USAGE_CAPABILITIES.includes(input.requestedCapability)) {
    return {
      ...base,
      allowed: false,
      historicalReadOnly: true,
      denialReason: "entitlement_inactive",
    };
  }

  return { ...base, allowed: true };
}
