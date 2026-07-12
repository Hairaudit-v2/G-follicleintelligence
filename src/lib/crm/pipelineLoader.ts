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
import { pipelineOpsToBoardSearchParams } from "@/src/lib/crm/pipelineQueryCompat";
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
 *
 * Platform-admin tenant proxy is an additional mutation grant: tenant operator canMutate
 * OR a validated platform-admin proxy for this tenant (never bare platform-admin alone).
 */
export function resolvePipelinePermissions(
  input: ResolvePipelinePermissionsInput & {
    validPlatformAdminTenantProxy?: boolean;
  }
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

  const canMutate =
    input.canMutateFromOperatorContext || Boolean(input.validPlatformAdminTenantProxy);
  const canConvert =
    canMutate &&
    (input.canUseConversion || Boolean(input.validPlatformAdminTenantProxy));
  const canBookConsultation =
    input.canUseBookings || Boolean(input.validPlatformAdminTenantProxy);
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
  /**
   * True when the authenticated session is a platform-admin full session and a
   * tenant-scoped membership proxy was resolved for the selected tenant.
   */
  validPlatformAdminTenantProxy?: boolean;
  /** Optional PHI-safe diagnostic sink (tests / temporary verification). */
  onPermissionDiagnostic?: (row: PipelinePermissionDiagnostic) => void;
}): PipelineResolvedPermissions {
  const roleLower = String(opts.userRole ?? "")
    .trim()
    .toLowerCase();
  const operatorCanMutate = opts.hasCrmShellAccess
    ? canMutateClinicFromOperatorContext({
        userRole: opts.userRole,
        canUseClinicFeatures: opts.canUseClinicFeatures,
      })
    : false;
  const validProxy = Boolean(opts.validPlatformAdminTenantProxy);
  const canMutate = operatorCanMutate || (opts.hasCrmShellAccess && validProxy);
  const canUseConversion =
    canMutate &&
    (opts.canUseClinicFeatures ||
      CRM_MUTATION_ROLES_LOWER.has(roleLower) ||
      validProxy);
  const canUseBookings = opts.bookingsOperator ?? canMutate;

  const perms = resolvePipelinePermissions({
    hasCrmShellAccess: opts.hasCrmShellAccess,
    canUseClinicFeatures: opts.canUseClinicFeatures,
    canMutateFromOperatorContext: operatorCanMutate,
    canUseConversion,
    canUseBookings,
    validPlatformAdminTenantProxy: validProxy,
  });

  if (opts.onPermissionDiagnostic) {
    opts.onPermissionDiagnostic({
      hasCrmShellAccess: opts.hasCrmShellAccess,
      userRole: roleLower || null,
      canUseClinicFeatures: opts.canUseClinicFeatures,
      operatorCanMutate,
      validPlatformAdminTenantProxy: validProxy,
      canMutate: perms.canMutate,
      canCreateEnquiry: perms.canCreateEnquiry,
      denialReasonCode: !opts.hasCrmShellAccess
        ? "no_crm_shell_access"
        : !perms.canCreateEnquiry
          ? "mutation_denied"
          : null,
    });
  }

  return perms;
}

/** PHI-safe permission diagnostic row (no names/emails/lead content). */
export type PipelinePermissionDiagnostic = {
  hasCrmShellAccess: boolean;
  userRole: string | null;
  canUseClinicFeatures: boolean;
  operatorCanMutate: boolean;
  validPlatformAdminTenantProxy: boolean;
  canMutate: boolean;
  canCreateEnquiry: boolean;
  denialReasonCode: string | null;
};

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
  // OPERATIONS-1: map ops sort/owner into board window keys (shell + full identical)
  const mapped = pipelineOpsToBoardSearchParams(out);
  // Bound initial board window (default 300). Shell + full must share the same cap.
  if (mapped.boardMaxPages === undefined || mapped.boardMaxPages === "") {
    mapped.boardMaxPages = "3";
  }
  // Lazy terminal: when not explicitly requesting lost/converted lifecycle, keep default window.
  // Explicit lifecycle=closed_lost|converted may raise pages for review (still capped).
  const life = String(
    Array.isArray(mapped.lifecycle) ? mapped.lifecycle[0] : mapped.lifecycle ?? ""
  )
    .trim()
    .toLowerCase();
  if (life === "closed_lost" || life === "converted" || life === "lost") {
    // Still bounded — not full 2.5k — but allow a slightly larger window for review
    if (!out.boardMaxPages) mapped.boardMaxPages = "5";
  }
  return mapped;
}

/** Pure: default Pipeline board lead cap (pages × page size). */
export function pipelineInitialBoardMaxLeads(): number {
  return 3 * 100;
}
