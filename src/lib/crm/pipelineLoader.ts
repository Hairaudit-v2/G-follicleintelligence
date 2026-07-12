/**
 * FI-UX-REBUILD-1 S4.4 — pure Pipeline loader helpers (permissions, stages, identity, refresh).
 * Safe to import from unit tests; no server-only / Supabase.
 */

import {
  CRM_MUTATION_ROLES_LOWER,
  canMutateClinicFromOperatorContext,
} from "@/src/lib/crm/crmGatePolicy";
import type { PipelineMoveStageDefinition } from "@/src/lib/crm/pipelineMoveTarget";
import type {
  PipelinePresentation,
  PipelinePresentationPermissions,
} from "@/src/lib/crm/pipelinePresentation.types";
import type { FiCrmPipelineStageRow } from "@/src/lib/crm/types";
import type {
  PipelineResolvedPermissions,
  PipelineTierIdentityResult,
} from "@/src/lib/crm/pipelineLoader.types";

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

export type ResolvePipelinePermissionsInput = {
  hasCrmShellAccess: boolean;
  canUseClinicFeatures: boolean;
  canMutateFromOperatorContext: boolean;
  canUseConversion: boolean;
  canUseBookings: boolean;
};

/**
 * Pure permission resolver — callers supply booleans from authoritative session helpers.
 * Fails closed: read-only when access or mutation is denied.
 */
export function resolvePipelinePermissions(
  input: ResolvePipelinePermissionsInput
): PipelineResolvedPermissions {
  if (!input.hasCrmShellAccess) {
    return {
      canView: false,
      canMutate: false,
      canConvert: false,
      canBookConsultation: false,
      canCreateEnquiry: false,
    };
  }

  const canMutate = input.canMutateFromOperatorContext;
  const canConvert = canMutate && input.canUseConversion;
  const canBookConsultation = input.canUseBookings;
  const canCreateEnquiry = canMutate;

  return {
    canView: true,
    canMutate,
    canConvert,
    canBookConsultation,
    canCreateEnquiry,
  };
}

/** Build resolver input from a CRM shell session row + optional bookings eligibility. */
export function resolvePipelinePermissionsFromSession(opts: {
  hasCrmShellAccess: boolean;
  userRole: string;
  canUseClinicFeatures: boolean;
  bookingsOperator?: boolean;
}): PipelineResolvedPermissions {
  const roleLower = String(opts.userRole ?? "")
    .trim()
    .toLowerCase();
  const canMutate = opts.hasCrmShellAccess
    ? canMutateClinicFromOperatorContext({
        userRole: opts.userRole,
        canUseClinicFeatures: opts.canUseClinicFeatures,
      })
    : false;
  const canUseConversion =
    canMutate && (opts.canUseClinicFeatures || CRM_MUTATION_ROLES_LOWER.has(roleLower));
  const canUseBookings = opts.bookingsOperator ?? canMutate;

  return resolvePipelinePermissions({
    hasCrmShellAccess: opts.hasCrmShellAccess,
    canUseClinicFeatures: opts.canUseClinicFeatures,
    canMutateFromOperatorContext: canMutate,
    canUseConversion,
    canUseBookings,
  });
}

export function toPipelinePresentationPermissions(
  perms: PipelineResolvedPermissions
): PipelinePresentationPermissions {
  return {
    canMutate: perms.canMutate,
    canConvert: perms.canConvert,
    canBookConsultation: perms.canBookConsultation,
  };
}

// ---------------------------------------------------------------------------
// Stage adapter
// ---------------------------------------------------------------------------

function stageArchivedFromMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const m = metadata as Record<string, unknown>;
  return Boolean(m.archived);
}

/** Adapt tenant pipeline stage rows to move-target definitions (all stages). */
export function toPipelineMoveStageDefinitions(
  rows: readonly FiCrmPipelineStageRow[]
): PipelineMoveStageDefinition[] {
  return rows.map((r) => ({
    id: String(r.id),
    slug: String(r.slug ?? "").trim(),
    label: String(r.label ?? r.slug ?? "").trim(),
    sortOrder: Number(r.sort_order ?? 0),
    isEntry: Boolean(r.is_entry),
    isWon: Boolean(r.is_won),
    isLost: Boolean(r.is_lost),
    archived: stageArchivedFromMetadata(r.metadata),
  }));
}

/** Client-safe movement destinations — non-archived stages only. */
export function toPipelineMoveStageDefinitionsForClient(
  rows: readonly FiCrmPipelineStageRow[]
): PipelineMoveStageDefinition[] {
  return toPipelineMoveStageDefinitions(rows).filter((s) => !s.archived);
}

// ---------------------------------------------------------------------------
// Shell / full identity
// ---------------------------------------------------------------------------

/** Visible board lead IDs (archived lifecycle excluded from columns). */
export function extractVisiblePipelineLeadIds(
  presentation: PipelinePresentation
): string[] {
  const ids: string[] = [];
  for (const col of presentation.columns) {
    for (const card of col.cards) {
      ids.push(card.leadId);
    }
  }
  return ids.sort((a, b) => a.localeCompare(b));
}

export function comparePipelineTierIdentity(
  shell: PipelinePresentation,
  full: PipelinePresentation
): PipelineTierIdentityResult {
  const shellIds = new Set(extractVisiblePipelineLeadIds(shell));
  const fullIdList = extractVisiblePipelineLeadIds(full);
  const fullIds = new Set(fullIdList);

  const missingFromFull: string[] = [];
  const extraInFull: string[] = [];

  for (const id of shellIds) {
    if (!fullIds.has(id)) missingFromFull.push(id);
  }
  for (const id of fullIdList) {
    if (!shellIds.has(id)) extraInFull.push(id);
  }

  missingFromFull.sort((a, b) => a.localeCompare(b));
  extraInFull.sort((a, b) => a.localeCompare(b));

  if (missingFromFull.length === 0 && extraInFull.length === 0) {
    return { ok: true };
  }
  return { ok: false, missingFromFull, extraInFull };
}

// ---------------------------------------------------------------------------
// Refresh ownership (single in-flight guard for S4.5 adapter wiring)
// ---------------------------------------------------------------------------

export type PipelineRefreshCoordinator = {
  refresh: () => Promise<PipelinePresentation>;
  isRefreshing: () => boolean;
};

/**
 * Wraps a refresh fn so only one call runs at a time and stale responses cannot win.
 */
export function createPipelineRefreshCoordinator(
  refreshFn: () => Promise<PipelinePresentation>
): PipelineRefreshCoordinator {
  let inFlight: Promise<PipelinePresentation> | null = null;
  let seq = 0;
  let inFlightSeq = 0;

  return {
    isRefreshing: () => inFlight !== null,
    refresh: async () => {
      if (inFlight) return inFlight;

      const mySeq = ++seq;
      inFlightSeq = mySeq;
      inFlight = (async () => {
        try {
          const result = await refreshFn();
          if (inFlightSeq !== mySeq) {
            throw new Error("stale_refresh");
          }
          return result;
        } finally {
          inFlight = null;
        }
      })();
      return inFlight;
    },
  };
}

// ---------------------------------------------------------------------------
// Query-state normalization (harness / future S4.5 boundary)
// ---------------------------------------------------------------------------

export function normalizePipelineSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): Record<string, string | string[] | undefined> {
  const out: Record<string, string | string[] | undefined> = { ...searchParams };
  const q = out.q ?? out.search;
  if (q !== undefined && out.search === undefined) {
    out.search = q;
  }
  return out;
}
