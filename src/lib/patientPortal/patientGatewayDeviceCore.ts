/**
 * FI-PATIENT-APP-2G — provider-neutral notification device model (pure).
 * Domain concept is NotificationDevice; Expo/FCM/APNs are provider values only.
 */

import { createHash } from "node:crypto";

export const PATIENT_NOTIFICATION_DEVICE_PLATFORMS = ["android", "ios", "web"] as const;
export type PatientNotificationDevicePlatform =
  (typeof PATIENT_NOTIFICATION_DEVICE_PLATFORMS)[number];

export const PATIENT_NOTIFICATION_PROVIDERS = ["expo", "fcm", "apns"] as const;
export type PatientNotificationProvider = (typeof PATIENT_NOTIFICATION_PROVIDERS)[number];

export const PATIENT_NOTIFICATION_ENVIRONMENTS = [
  "development",
  "preview",
  "production",
] as const;
export type PatientNotificationEnvironment =
  (typeof PATIENT_NOTIFICATION_ENVIRONMENTS)[number];

export type NotificationDevice = {
  id: string;
  tenantId: string;
  patientId: string;
  platform: PatientNotificationDevicePlatform;
  provider: PatientNotificationProvider;
  /** Sensitive — never log or return to unrelated clients. */
  providerToken: string;
  tokenFingerprint: string;
  deviceLabel: string | null;
  appVersion: string | null;
  environment: PatientNotificationEnvironment;
  createdAt: string;
  lastSeenAt: string;
  disabledAt: string | null;
};

/** Public device DTO — never includes providerToken. */
export type PatientGatewayDevicePublic = {
  id: string;
  platform: PatientNotificationDevicePlatform;
  provider: PatientNotificationProvider;
  appVersion: string | null;
  environment: PatientNotificationEnvironment;
  createdAt: string;
  lastSeenAt: string;
  disabledAt: string | null;
};

export type RegisterPatientDeviceInput = {
  platform: string;
  provider: string;
  token: string;
  appVersion?: string | null;
  deviceLabel?: string | null;
  environment?: string | null;
};

export type RegisterPatientDeviceValidation =
  | {
      ok: true;
      platform: PatientNotificationDevicePlatform;
      provider: PatientNotificationProvider;
      token: string;
      tokenFingerprint: string;
      appVersion: string | null;
      deviceLabel: string | null;
      environment: PatientNotificationEnvironment;
    }
  | { ok: false; reason: string };

const EXPO_PUSH_TOKEN_RE = /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/;

export function fingerprintProviderToken(token: string): string {
  return createHash("sha256").update(token.trim(), "utf8").digest("hex");
}

export function isValidExpoPushToken(token: string): boolean {
  return EXPO_PUSH_TOKEN_RE.test(token.trim());
}

export function validateRegisterPatientDeviceInput(
  raw: RegisterPatientDeviceInput
): RegisterPatientDeviceValidation {
  const platformRaw = typeof raw.platform === "string" ? raw.platform.trim().toLowerCase() : "";
  const providerRaw = typeof raw.provider === "string" ? raw.provider.trim().toLowerCase() : "";
  const token = typeof raw.token === "string" ? raw.token.trim() : "";

  if (
    !(PATIENT_NOTIFICATION_DEVICE_PLATFORMS as readonly string[]).includes(platformRaw)
  ) {
    return { ok: false, reason: "invalid_platform" };
  }
  if (!(PATIENT_NOTIFICATION_PROVIDERS as readonly string[]).includes(providerRaw)) {
    return { ok: false, reason: "invalid_provider" };
  }
  if (!token || token.length > 4096) {
    return { ok: false, reason: "invalid_token" };
  }

  const provider = providerRaw as PatientNotificationProvider;
  if (provider === "expo" && !isValidExpoPushToken(token)) {
    return { ok: false, reason: "invalid_token_format" };
  }
  // FCM/APNs accepted structurally for future adapters; reject empty already handled.
  if ((provider === "fcm" || provider === "apns") && token.length < 16) {
    return { ok: false, reason: "invalid_token_format" };
  }

  let environment: PatientNotificationEnvironment = "production";
  if (raw.environment != null && String(raw.environment).trim()) {
    const env = String(raw.environment).trim().toLowerCase();
    if (!(PATIENT_NOTIFICATION_ENVIRONMENTS as readonly string[]).includes(env)) {
      return { ok: false, reason: "invalid_environment" };
    }
    environment = env as PatientNotificationEnvironment;
  }

  const appVersion =
    raw.appVersion != null && String(raw.appVersion).trim()
      ? String(raw.appVersion).trim().slice(0, 64)
      : null;
  const deviceLabel =
    raw.deviceLabel != null && String(raw.deviceLabel).trim()
      ? String(raw.deviceLabel).trim().slice(0, 128)
      : null;

  return {
    ok: true,
    platform: platformRaw as PatientNotificationDevicePlatform,
    provider,
    token,
    tokenFingerprint: fingerprintProviderToken(token),
    appVersion,
    deviceLabel,
    environment,
  };
}

export function mapDeviceRowToPublic(row: NotificationDevice): PatientGatewayDevicePublic {
  return {
    id: row.id,
    platform: row.platform,
    provider: row.provider,
    appVersion: row.appVersion,
    environment: row.environment,
    createdAt: row.createdAt,
    lastSeenAt: row.lastSeenAt,
    disabledAt: row.disabledAt,
  };
}

export function mapDeviceDbRow(raw: Record<string, unknown>): NotificationDevice {
  return {
    id: String(raw.id),
    tenantId: String(raw.tenant_id),
    patientId: String(raw.patient_id),
    platform: raw.platform as PatientNotificationDevicePlatform,
    provider: raw.provider as PatientNotificationProvider,
    providerToken: String(raw.provider_token),
    tokenFingerprint: String(raw.token_fingerprint),
    deviceLabel: raw.device_label != null ? String(raw.device_label) : null,
    appVersion: raw.app_version != null ? String(raw.app_version) : null,
    environment: (raw.environment as PatientNotificationEnvironment) ?? "production",
    createdAt: String(raw.created_at),
    lastSeenAt: String(raw.last_seen_at),
    disabledAt: raw.disabled_at != null ? String(raw.disabled_at) : null,
  };
}

/**
 * Build privacy-safe Expo/APNs data payload. Never includes patientId, tenantId,
 * bearer tokens, clinical body, or financial amounts.
 */
export function buildSafePushDataPayload(input: {
  eventType: string;
  resourceId?: string | null;
}): Record<string, string> {
  const data: Record<string, string> = {
    eventType: input.eventType,
  };
  if (input.resourceId?.trim()) {
    data.resourceId = input.resourceId.trim();
  }
  return data;
}

/** Dedupe key: patient-scoped event + source entity + optional version. */
export function buildNotificationDedupeKey(input: {
  eventType: string;
  sourceEntity: string;
  stateVersion?: string | null;
}): string {
  const parts = [input.eventType.trim(), input.sourceEntity.trim()];
  if (input.stateVersion?.trim()) parts.push(input.stateVersion.trim());
  return parts.join(":");
}
