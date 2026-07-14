/**
 * FI-HAIRAUDIT-CLINIC-DISCOVERY-DATA-1 — dry-run public clinic profile sync planner.
 */

import {
  buildPublicClinicProfileFromFiOsClinic,
  mergePublicClinicProfileAdditive,
} from "./publicClinicProfileCore";
import type { FiOsClinicDiscoveryInput, PublicClinicProfile } from "./publicClinicProfileTypes";

export type PublicClinicProfileSyncItemInput = {
  tenantId: string;
  fiClinicId: string;
  clinicDisplayName: string;
  hairauditClinicId?: string | null;
  existingProfile?: PublicClinicProfile | null;
  discoveryInput: FiOsClinicDiscoveryInput;
  dryRun: boolean;
};

export type PublicClinicProfileSyncItemOutcome =
  | { kind: "dry_run_would_create" }
  | { kind: "dry_run_would_update" }
  | { kind: "created"; dryRun: boolean }
  | { kind: "updated"; dryRun: boolean }
  | { kind: "skipped_already_current" }
  | { kind: "skipped_opt_out"; reason: string };

export type PublicClinicProfileSyncSummary = {
  dryRun: boolean;
  scanned: number;
  wouldCreate: number;
  wouldUpdate: number;
  created: number;
  updated: number;
  skippedAlreadyCurrent: number;
  skippedOptOut: number;
};

function profilesEquivalent(a: PublicClinicProfile, b: PublicClinicProfile): boolean {
  return (
    a.clinic_name === b.clinic_name &&
    a.public_slug === b.public_slug &&
    a.city_suburb === b.city_suburb &&
    a.state_region === b.state_region &&
    a.country === b.country &&
    a.public_phone === b.public_phone &&
    a.public_email === b.public_email &&
    a.public_booking_url === b.public_booking_url &&
    a.hairaudit_clinic_id === b.hairaudit_clinic_id &&
    a.public_profile_enabled === b.public_profile_enabled &&
    a.search_visible === b.search_visible
  );
}

export function planPublicClinicProfileSyncItem(input: PublicClinicProfileSyncItemInput): {
  outcome: PublicClinicProfileSyncItemOutcome;
  nextProfile?: PublicClinicProfile;
} {
  const incoming = buildPublicClinicProfileFromFiOsClinic(input.discoveryInput);

  if (!input.existingProfile) {
    if (input.dryRun) {
      return { outcome: { kind: "dry_run_would_create" }, nextProfile: incoming };
    }
    return { outcome: { kind: "created", dryRun: false }, nextProfile: incoming };
  }

  const existing = input.existingProfile;
  if (!existing.public_profile_enabled && !incoming.public_profile_enabled) {
    return {
      outcome: {
        kind: "skipped_opt_out",
        reason: "Clinic has not opted in to public discovery.",
      },
    };
  }

  const merged = mergePublicClinicProfileAdditive({
    existing: {
      ...existing,
      public_clinic_profile_id: existing.public_clinic_profile_id,
      created_at: existing.created_at,
    },
    incoming: {
      ...incoming,
      public_clinic_profile_id: existing.public_clinic_profile_id,
      public_profile_enabled: existing.public_profile_enabled,
      search_visible: existing.search_visible,
      accepts_independent_hairaudit_enquiries: existing.accepts_independent_hairaudit_enquiries,
      created_at: existing.created_at,
    },
    preserveHairAuditOwned: true,
  });

  if (profilesEquivalent(existing, merged)) {
    return { outcome: { kind: "skipped_already_current" } };
  }

  if (input.dryRun) {
    return { outcome: { kind: "dry_run_would_update" }, nextProfile: merged };
  }

  return { outcome: { kind: "updated", dryRun: false }, nextProfile: merged };
}

export function aggregatePublicClinicProfileSyncSummary(
  outcomes: readonly PublicClinicProfileSyncItemOutcome[],
  dryRun: boolean
): PublicClinicProfileSyncSummary {
  const summary: PublicClinicProfileSyncSummary = {
    dryRun,
    scanned: outcomes.length,
    wouldCreate: 0,
    wouldUpdate: 0,
    created: 0,
    updated: 0,
    skippedAlreadyCurrent: 0,
    skippedOptOut: 0,
  };

  for (const outcome of outcomes) {
    if (outcome.kind === "dry_run_would_create") summary.wouldCreate += 1;
    if (outcome.kind === "dry_run_would_update") summary.wouldUpdate += 1;
    if (outcome.kind === "created") summary.created += 1;
    if (outcome.kind === "updated") summary.updated += 1;
    if (outcome.kind === "skipped_already_current") summary.skippedAlreadyCurrent += 1;
    if (outcome.kind === "skipped_opt_out") summary.skippedOptOut += 1;
  }

  return summary;
}
