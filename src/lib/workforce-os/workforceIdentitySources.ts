/**
 * Canonical workforce identity source systems for `fi_staff_source_ids.source_system`.
 * All new writes must use these values — never ambiguous aliases like "hr" or "academy".
 */

import { normalizeFiStaffSourceSystem } from "@/src/lib/staff/staffSourceIdsNormalize";

/** Canonical source_system values for workforce identity links. */
export const WORKFORCE_IDENTITY_SOURCE_SYSTEMS = {
  IIOHR_HR: "iiohr_hr",
  IIOHR_ACADEMY: "iiohr_academy",
  IIOHR_NEXUS: "iiohr_nexus",
  FI_OS: "fi_os",
  LEGACY_IMPORT: "legacy_import",
  /** Evolved payroll CSV import (existing producer). */
  EVOLVED_PAYROLL: "evolved_payroll",
} as const;

export type WorkforceIdentitySourceSystem =
  (typeof WORKFORCE_IDENTITY_SOURCE_SYSTEMS)[keyof typeof WORKFORCE_IDENTITY_SOURCE_SYSTEMS];

const CANONICAL_SET = new Set<string>(Object.values(WORKFORCE_IDENTITY_SOURCE_SYSTEMS));

/** Legacy aliases accepted on read; never written by new sync code. */
const LEGACY_ALIASES: Record<string, WorkforceIdentitySourceSystem> = {
  hr: WORKFORCE_IDENTITY_SOURCE_SYSTEMS.IIOHR_HR,
  iiohr: WORKFORCE_IDENTITY_SOURCE_SYSTEMS.IIOHR_HR,
  academy: WORKFORCE_IDENTITY_SOURCE_SYSTEMS.IIOHR_ACADEMY,
  nexus: WORKFORCE_IDENTITY_SOURCE_SYSTEMS.IIOHR_NEXUS,
  payroll: WORKFORCE_IDENTITY_SOURCE_SYSTEMS.EVOLVED_PAYROLL,
  evolved_payroll: WORKFORCE_IDENTITY_SOURCE_SYSTEMS.EVOLVED_PAYROLL,
};

export const WORKFORCE_IDENTITY_SOURCE_SYSTEM_LABELS: Record<
  WorkforceIdentitySourceSystem,
  string
> = {
  iiohr_hr: "IIOHR HR",
  iiohr_academy: "IIOHR Academy",
  iiohr_nexus: "Nexus global professional",
  fi_os: "FI OS",
  legacy_import: "Legacy import",
  evolved_payroll: "Evolved payroll",
};

export function isWorkforceIdentitySourceSystem(
  value: string
): value is WorkforceIdentitySourceSystem {
  return CANONICAL_SET.has(normalizeFiStaffSourceSystem(value));
}

/**
 * Maps ambiguous producer slugs to canonical `source_system` values for writes and lookups.
 * Unknown values are lowercased trimmed — callers should validate with {@link isWorkforceIdentitySourceSystem}.
 */
export function canonicaliseWorkforceSourceSystem(raw: string): string {
  const norm = normalizeFiStaffSourceSystem(raw);
  const alias = LEGACY_ALIASES[norm];
  if (alias) return alias;
  return norm;
}

export function workforceIdentitySourceSystemLabel(sourceSystem: string): string {
  const canon = canonicaliseWorkforceSourceSystem(sourceSystem);
  if (isWorkforceIdentitySourceSystem(canon)) {
    return WORKFORCE_IDENTITY_SOURCE_SYSTEM_LABELS[canon];
  }
  return canon;
}

/** True when the canonical system is an IIOHR-owned domain (HR, Academy, Nexus). */
export function isIiohrOwnedWorkforceSourceSystem(sourceSystem: string): boolean {
  const canon = canonicaliseWorkforceSourceSystem(sourceSystem);
  return (
    canon === WORKFORCE_IDENTITY_SOURCE_SYSTEMS.IIOHR_HR ||
    canon === WORKFORCE_IDENTITY_SOURCE_SYSTEMS.IIOHR_ACADEMY ||
    canon === WORKFORCE_IDENTITY_SOURCE_SYSTEMS.IIOHR_NEXUS
  );
}
