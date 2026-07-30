/**
 * FI-PATIENT-APP-2B — pure Patient App pilot pause / access control helpers.
 *
 * Storage contracts (no migrations required):
 * - Tenant: `fi_tenant_settings.metadata.patient_app_pilot`
 * - Patient: `fi_patients.metadata.patient_app_access`
 * - Global env: `FI_PATIENT_APP_PILOT_GLOBAL` = off|paused → blocks all tenants
 */

export const PATIENT_APP_PILOT_TENANT_METADATA_KEY = "patient_app_pilot" as const;
export const PATIENT_APP_ACCESS_PATIENT_METADATA_KEY = "patient_app_access" as const;

export type PatientAppPilotTenantStatus = "enabled" | "paused" | "disabled";

export type PatientAppPilotTenantState = {
  status: PatientAppPilotTenantStatus;
  pausedAt: string | null;
  reason: string | null;
  updatedBy: string | null;
};

export type PatientAppAccessStatus = "active" | "deactivated" | "withdrawn";

export type PatientAppAccessState = {
  status: PatientAppAccessStatus;
  reasonCategory: string | null;
  reasonDetail: string | null;
  changedAt: string | null;
  changedBy: string | null;
  invitationReuseBlocked: boolean;
};

export type PatientAppAccessDecision =
  | { ok: true }
  | {
      ok: false;
      code: "pilot_paused" | "patient_deactivated" | "patient_withdrawn";
      message: string;
    };

export const PATIENT_APP_PILOT_PAUSED_MESSAGE =
  "The patient app pilot is temporarily unavailable. Please contact your clinic using their usual channel.";

export const PATIENT_APP_DEACTIVATED_MESSAGE =
  "Patient app access for this account is no longer active. Please contact your clinic using their usual channel.";

export const PATIENT_APP_WITHDRAWN_MESSAGE =
  "You have withdrawn from the patient app pilot. Please contact your clinic if you need support through their usual channel.";

export function parsePatientAppPilotTenantState(
  metadata: unknown
): PatientAppPilotTenantState {
  const root =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  const raw = root[PATIENT_APP_PILOT_TENANT_METADATA_KEY];
  const pilot =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const statusRaw = String(pilot.status ?? "").trim().toLowerCase();
  let status: PatientAppPilotTenantStatus = "enabled";
  if (statusRaw === "paused" || pilot.paused === true) status = "paused";
  else if (statusRaw === "disabled" || pilot.enabled === false) status = "disabled";
  else if (statusRaw === "enabled" || pilot.enabled === true) status = "enabled";
  // Missing tenant flag: do not break existing linked portal users.

  return {
    status,
    pausedAt:
      typeof pilot.paused_at === "string"
        ? pilot.paused_at
        : typeof pilot.pausedAt === "string"
          ? pilot.pausedAt
          : null,
    reason: typeof pilot.reason === "string" ? pilot.reason : null,
    updatedBy:
      typeof pilot.updated_by === "string"
        ? pilot.updated_by
        : typeof pilot.updatedBy === "string"
          ? pilot.updatedBy
          : null,
  };
}

export function parsePatientAppAccessState(metadata: unknown): PatientAppAccessState {
  const root =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  const raw = root[PATIENT_APP_ACCESS_PATIENT_METADATA_KEY];
  const access = accessObject(raw) ? raw : {};

  const statusRaw = String(access.status ?? "active").trim().toLowerCase();
  let status: PatientAppAccessStatus = "active";
  if (statusRaw === "deactivated") status = "deactivated";
  else if (statusRaw === "withdrawn") status = "withdrawn";

  return {
    status,
    reasonCategory:
      typeof access.reason_category === "string"
        ? access.reason_category
        : typeof access.reasonCategory === "string"
          ? access.reasonCategory
          : null,
    reasonDetail:
      typeof access.reason_detail === "string"
        ? access.reason_detail
        : typeof access.reasonDetail === "string"
          ? access.reasonDetail
          : null,
    changedAt:
      typeof access.changed_at === "string"
        ? access.changed_at
        : typeof access.changedAt === "string"
          ? access.changedAt
          : null,
    changedBy:
      typeof access.changed_by === "string"
        ? access.changed_by
        : typeof access.changedBy === "string"
          ? access.changedBy
          : null,
    invitationReuseBlocked: access.invitation_reuse_blocked !== false,
  };
}

function accessObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Global kill switch via env.
 * - unset / "on" / "enabled": allow tenant/patient checks to decide
 * - "off" / "0" / "false" / "paused" / "disabled": block all patient app journey access
 */
export function isGlobalPatientAppPilotPaused(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  const raw = String(env.FI_PATIENT_APP_PILOT_GLOBAL ?? "")
    .trim()
    .toLowerCase();
  if (!raw) return false;
  return (
    raw === "off" ||
    raw === "0" ||
    raw === "false" ||
    raw === "no" ||
    raw === "paused" ||
    raw === "disabled"
  );
}

export function decidePatientAppAccess(input: {
  globalPaused: boolean;
  tenant: PatientAppPilotTenantState;
  patient: PatientAppAccessState;
}): PatientAppAccessDecision {
  if (input.patient.status === "withdrawn") {
    return { ok: false, code: "patient_withdrawn", message: PATIENT_APP_WITHDRAWN_MESSAGE };
  }
  if (input.patient.status === "deactivated") {
    return {
      ok: false,
      code: "patient_deactivated",
      message: PATIENT_APP_DEACTIVATED_MESSAGE,
    };
  }
  if (input.globalPaused || input.tenant.status === "paused" || input.tenant.status === "disabled") {
    return { ok: false, code: "pilot_paused", message: PATIENT_APP_PILOT_PAUSED_MESSAGE };
  }
  return { ok: true };
}

/** Merge tenant metadata with a pilot pause/resume update (pure). */
export function mergePatientAppPilotTenantMetadata(
  existingMetadata: unknown,
  update: {
    status: PatientAppPilotTenantStatus;
    reason?: string | null;
    updatedBy?: string | null;
    atIso: string;
  }
): Record<string, unknown> {
  const root =
    existingMetadata && typeof existingMetadata === "object" && !Array.isArray(existingMetadata)
      ? { ...(existingMetadata as Record<string, unknown>) }
      : {};
  root[PATIENT_APP_PILOT_TENANT_METADATA_KEY] = {
    status: update.status,
    enabled: update.status === "enabled",
    paused: update.status === "paused",
    paused_at: update.status === "paused" ? update.atIso : null,
    reason: update.reason ?? null,
    updated_by: update.updatedBy ?? null,
    updated_at: update.atIso,
  };
  return root;
}

/** Merge patient metadata with access change (pure). Preserves unrelated keys. */
export function mergePatientAppAccessMetadata(
  existingMetadata: unknown,
  update: {
    status: PatientAppAccessStatus;
    reasonCategory?: string | null;
    reasonDetail?: string | null;
    changedBy?: string | null;
    atIso: string;
    invitationReuseBlocked?: boolean;
  }
): Record<string, unknown> {
  const root =
    existingMetadata && typeof existingMetadata === "object" && !Array.isArray(existingMetadata)
      ? { ...(existingMetadata as Record<string, unknown>) }
      : {};
  root[PATIENT_APP_ACCESS_PATIENT_METADATA_KEY] = {
    status: update.status,
    reason_category: update.reasonCategory ?? null,
    reason_detail: update.reasonDetail ?? null,
    changed_at: update.atIso,
    changed_by: update.changedBy ?? null,
    invitation_reuse_blocked: update.invitationReuseBlocked !== false,
  };
  return root;
}

/** Whether push fan-out should be suppressed for pilot/access state. */
export function shouldSuppressPatientAppPush(input: {
  globalPaused: boolean;
  tenant: PatientAppPilotTenantState;
  patient: PatientAppAccessState;
}): boolean {
  return !decidePatientAppAccess(input).ok;
}
