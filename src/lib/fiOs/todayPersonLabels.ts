/**
 * FI OS Today — shared person label resolution.
 *
 * Prefers real person names over email local-parts across feed copy, headers,
 * chips, and entity attention rows.
 */

export type TodayPersonLabelInput = {
  first_name?: string | null;
  firstName?: string | null;
  display_name?: string | null;
  displayName?: string | null;
  full_name?: string | null;
  fullName?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  actor_type?: string | null;
  actorType?: string | null;
};

const WEAK_LABELS = new Set(["unknown", "—", "-", "n/a", "na", "unnamed patient"]);

const ROLE_LABELS: Record<string, string> = {
  auditor: "Auditor",
  fi_auditor: "Auditor",
  staff: "Staff member",
  staff_member: "Staff member",
  clinician: "Clinician",
  doctor: "Clinician",
  nurse: "Clinician",
  surgeon: "Clinician",
  consultant: "Clinician",
  admin: "Admin",
  fi_admin: "Admin",
  reception: "Reception",
  clinic_manager: "Clinic manager",
  director: "Director",
  platform_admin: "Platform admin",
};

function pickString(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

/** True when the value is empty, placeholder, or otherwise unusable as a person name. */
export function isWeakPersonLabel(value: string | null | undefined): boolean {
  if (!value?.trim()) return true;
  return WEAK_LABELS.has(value.trim().toLowerCase());
}

/** True when the entire string looks like an email address. */
export function isEmailLike(value: string): boolean {
  const trimmed = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function emailLocalPart(email: string): string | null {
  const trimmed = email.trim();
  if (!isEmailLike(trimmed)) return null;
  const local = trimmed.split("@")[0]?.trim();
  return local || null;
}

function firstTokenFromPersonName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed || isEmailLike(trimmed)) return null;
  const first = trimmed.split(/\s+/)[0]?.trim() ?? "";
  if (!first || isEmailLike(first)) return null;
  return first;
}

function humanizeRoleToken(role: string): string {
  const key = role.trim().toLowerCase();
  if (ROLE_LABELS[key]) return ROLE_LABELS[key]!;
  return key
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

/** Maps role / actor_type tokens to safe human labels (e.g. auditor → Auditor). */
export function resolveTodayRoleLabel(
  role: string | null | undefined,
  actorType?: string | null | undefined
): string | null {
  const token = pickString(role, actorType);
  if (!token || isWeakPersonLabel(token)) return null;
  return humanizeRoleToken(token);
}

/**
 * Resolves a first-name token for Today feed copy.
 *
 * Order: explicit first_name → first token of display/full/name → role label → email local-part.
 */
export function resolvePersonFirstNameLabel(
  input: TodayPersonLabelInput,
  opts: { defaultLabel?: string } = {}
): string {
  const defaultLabel = opts.defaultLabel ?? "Patient";

  const explicitFirst = pickString(input.first_name, input.firstName);
  if (explicitFirst && !isWeakPersonLabel(explicitFirst) && !isEmailLike(explicitFirst)) {
    return explicitFirst;
  }

  for (const candidate of [
    input.display_name,
    input.displayName,
    input.full_name,
    input.fullName,
    input.name,
  ]) {
    const token = candidate ? firstTokenFromPersonName(candidate) : null;
    if (token) return token;
  }

  const roleLabel = resolveTodayRoleLabel(input.role, input.actor_type ?? input.actorType);
  if (roleLabel) return roleLabel;

  const email = pickString(input.email);
  if (email) {
    const local = emailLocalPart(email);
    if (local) return local;
  }

  return defaultLabel;
}

/**
 * Resolves a full display label for Today personLabel fields.
 *
 * Order: first_name (+ optional last) → display/full/name → role label → email local-part.
 */
export function resolvePersonDisplayNameForToday(
  input: TodayPersonLabelInput,
  opts: { defaultLabel?: string } = {}
): string {
  const defaultLabel = opts.defaultLabel ?? "";

  const explicitFirst = pickString(input.first_name, input.firstName);
  if (explicitFirst && !isWeakPersonLabel(explicitFirst) && !isEmailLike(explicitFirst)) {
    return explicitFirst;
  }

  for (const candidate of [
    input.full_name,
    input.fullName,
    input.display_name,
    input.displayName,
    input.name,
  ]) {
    const trimmed = candidate?.trim();
    if (trimmed && !isWeakPersonLabel(trimmed) && !isEmailLike(trimmed)) {
      return trimmed;
    }
  }

  const roleLabel = resolveTodayRoleLabel(input.role, input.actor_type ?? input.actorType);
  if (roleLabel) return roleLabel;

  const email = pickString(input.email);
  if (email) {
    const local = emailLocalPart(email);
    if (local) return local;
  }

  return defaultLabel;
}

/**
 * Derives a first-name token from an existing Today personLabel string,
 * optionally enriched with structured profile fields when available.
 */
export function todayFirstNameFromLabel(
  label: string,
  input: TodayPersonLabelInput = {}
): string {
  const trimmed = label.trim();
  const merged: TodayPersonLabelInput = {
    ...input,
    first_name: input.first_name ?? input.firstName,
    full_name:
      input.full_name ??
      input.fullName ??
      (trimmed && !isEmailLike(trimmed) ? trimmed : undefined),
    display_name:
      input.display_name ??
      input.displayName ??
      (trimmed && !isEmailLike(trimmed) ? trimmed : undefined),
    email: input.email ?? (trimmed && isEmailLike(trimmed) ? trimmed : undefined),
  };

  return resolvePersonFirstNameLabel(merged);
}
