import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import type { FiStaffSourceIdRow } from "@/src/lib/staff/staffSourceIdsNormalize";
import {
  normalizeFiStaffSourceMetadata,
  normalizeFiStaffSourceStaffId,
  normalizeFiStaffSourceUrl,
} from "@/src/lib/staff/staffSourceIdsNormalize";
import {
  mergeWorkforceIdentityMetadata,
  sanitizeWorkforceIdentityMetadata,
} from "@/src/lib/workforce-os/workforceIdentityMetadata";
import { canonicaliseWorkforceSourceSystem } from "@/src/lib/workforce-os/workforceIdentitySources";
import {
  buildWorkforceIdentitySummaryFromSourceRows,
  type WorkforceIdentitySummary,
} from "@/src/lib/workforce-os/workforceIdentitySummary";

export type StaffIdentityLinkRow = {
  id: string;
  tenantId: string;
  staffId: string;
  sourceSystem: string;
  sourceStaffId: string;
  sourceUrl: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type UpsertStaffIdentityLinkInput = {
  tenantId: string;
  staffId: string;
  sourceSystem: string;
  sourceStaffId: string;
  sourceUrl?: string | null;
  metadata?: Record<string, unknown>;
  /** When set, stamps `last_synced_at` on metadata. */
  lastSyncedAt?: string;
};

export type ResolveExternalIdentityInput = {
  tenantId: string;
  sourceSystem: string;
  sourceStaffId: string;
};

function mapRow(raw: Record<string, unknown>): StaffIdentityLinkRow {
  return {
    id: String(raw.id),
    tenantId: String(raw.tenant_id),
    staffId: String(raw.staff_id),
    sourceSystem: String(raw.source_system),
    sourceStaffId: String(raw.source_staff_id),
    sourceUrl: raw.source_url != null ? String(raw.source_url) : null,
    metadata: normalizeFiStaffSourceMetadata(raw.metadata),
    createdAt: String(raw.created_at),
    updatedAt: String(raw.updated_at),
  };
}

function buildMetadataForUpsert(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown> | undefined,
  lastSyncedAt?: string
): Record<string, unknown> {
  const merged = mergeWorkforceIdentityMetadata(existing, incoming ?? {});
  if (lastSyncedAt) {
    return mergeWorkforceIdentityMetadata(merged, { last_synced_at: lastSyncedAt });
  }
  return merged;
}

/**
 * Lists all identity links for a staff member (tenant-scoped).
 */
export async function getStaffIdentityLinksForStaff(
  tenantId: string,
  staffId: string,
  client?: SupabaseClient
): Promise<StaffIdentityLinkRow[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const sid = assertNonEmptyUuid(staffId, "staffId");
  const supabase = client ?? supabaseAdmin();

  const { data, error } = await supabase
    .from("fi_staff_source_ids")
    .select("id, tenant_id, staff_id, source_system, source_staff_id, source_url, metadata, created_at, updated_at")
    .eq("tenant_id", tid)
    .eq("staff_id", sid)
    .order("source_system", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapRow);
}

/**
 * Finds an identity link by external id (tenant-scoped). `source_system` is canonicalised before query.
 */
export async function getStaffIdentityLinksByExternalId(
  tenantId: string,
  sourceSystem: string,
  sourceStaffId: string,
  client?: SupabaseClient
): Promise<StaffIdentityLinkRow | null> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const sys = canonicaliseWorkforceSourceSystem(sourceSystem);
  const extId = normalizeFiStaffSourceStaffId(sourceStaffId);
  if (!extId) return null;

  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_source_ids")
    .select("id, tenant_id, staff_id, source_system, source_staff_id, source_url, metadata, created_at, updated_at")
    .eq("tenant_id", tid)
    .eq("source_system", sys)
    .eq("source_staff_id", extId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

/**
 * Creates or updates a workforce identity link. Canonicalises `source_system` and sanitises metadata.
 */
export async function upsertStaffIdentityLink(
  input: UpsertStaffIdentityLinkInput,
  client?: SupabaseClient
): Promise<StaffIdentityLinkRow> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const sid = assertNonEmptyUuid(input.staffId, "staffId");
  const sys = canonicaliseWorkforceSourceSystem(input.sourceSystem);
  const extId = normalizeFiStaffSourceStaffId(input.sourceStaffId);
  if (!extId) throw new Error("sourceStaffId is required.");

  const supabase = client ?? supabaseAdmin();
  const now = new Date().toISOString();

  const byStaff = await supabase
    .from("fi_staff_source_ids")
    .select("id, metadata")
    .eq("tenant_id", tid)
    .eq("staff_id", sid)
    .eq("source_system", sys)
    .maybeSingle();

  if (byStaff.error) throw new Error(byStaff.error.message);

  const byExternal = await supabase
    .from("fi_staff_source_ids")
    .select("id, staff_id, metadata")
    .eq("tenant_id", tid)
    .eq("source_system", sys)
    .eq("source_staff_id", extId)
    .maybeSingle();

  if (byExternal.error) throw new Error(byExternal.error.message);

  if (byExternal.data && String((byExternal.data as { staff_id: string }).staff_id) !== sid) {
    throw new Error(
      `External identity ${sys}:${extId} is already linked to a different staff member in this tenant.`
    );
  }

  const existingId = (byStaff.data as { id: string } | null)?.id ?? (byExternal.data as { id: string } | null)?.id;
  const existingMeta = normalizeFiStaffSourceMetadata(
    (byStaff.data as { metadata?: unknown } | null)?.metadata ??
      (byExternal.data as { metadata?: unknown } | null)?.metadata
  );

  const metadata = buildMetadataForUpsert(existingMeta, input.metadata, input.lastSyncedAt);
  const sourceUrl =
    input.sourceUrl !== undefined ? normalizeFiStaffSourceUrl(input.sourceUrl) : undefined;

  if (existingId) {
    const patch: Record<string, unknown> = { metadata, updated_at: now };
    if (sourceUrl !== undefined) patch.source_url = sourceUrl;
    patch.source_staff_id = extId;

    const { data, error } = await supabase
      .from("fi_staff_source_ids")
      .update(patch)
      .eq("id", existingId)
      .eq("tenant_id", tid)
      .select("id, tenant_id, staff_id, source_system, source_staff_id, source_url, metadata, created_at, updated_at")
      .single();

    if (error) throw new Error(error.message);
    return mapRow(data as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from("fi_staff_source_ids")
    .insert({
      tenant_id: tid,
      staff_id: sid,
      source_system: sys,
      source_staff_id: extId,
      source_url: sourceUrl ?? null,
      metadata,
      created_at: now,
      updated_at: now,
    })
    .select("id, tenant_id, staff_id, source_system, source_staff_id, source_url, metadata, created_at, updated_at")
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}

/**
 * Resolves `fi_staff.id` from an external identity (tenant-scoped).
 */
export async function resolveFiStaffIdFromExternalIdentity(
  input: ResolveExternalIdentityInput,
  client?: SupabaseClient
): Promise<string | null> {
  const link = await getStaffIdentityLinksByExternalId(
    input.tenantId,
    input.sourceSystem,
    input.sourceStaffId,
    client
  );
  return link?.staffId ?? null;
}

/**
 * Bounded external identity summary for admin surfaces — no raw metadata dump.
 */
export async function getPrimaryExternalIdentitySummary(
  tenantId: string,
  staffId: string,
  client?: SupabaseClient
): Promise<WorkforceIdentitySummary> {
  const links = await getStaffIdentityLinksForStaff(tenantId, staffId, client);
  return buildWorkforceIdentitySummaryFromSourceRows(
    links.map((l) => ({
      source_system: l.sourceSystem,
      source_staff_id: l.sourceStaffId,
      metadata: l.metadata,
    }))
  );
}

/**
 * Optional Academy profile link — does not duplicate certification data in FI OS.
 */
export async function linkAcademyProfileToFiStaff(
  input: {
    tenantId: string;
    staffId: string;
    academyProfileId: string;
    iiohrUserId?: string | null;
    lastSyncedAt?: string;
  },
  client?: SupabaseClient
): Promise<StaffIdentityLinkRow> {
  const profileId = normalizeFiStaffSourceStaffId(input.academyProfileId);
  if (!profileId) throw new Error("academyProfileId is required.");

  const metadata = sanitizeWorkforceIdentityMetadata({
    iiohr_academy_profile_id: profileId,
    training_source: "iiohr_academy",
    certification_source: "iiohr_academy",
    sync_status: "active",
    ...(input.iiohrUserId?.trim() ? { iiohr_user_id: input.iiohrUserId.trim() } : {}),
  });

  return upsertStaffIdentityLink(
    {
      tenantId: input.tenantId,
      staffId: input.staffId,
      sourceSystem: "iiohr_academy",
      sourceStaffId: profileId,
      metadata,
      lastSyncedAt: input.lastSyncedAt ?? new Date().toISOString(),
    },
    client
  );
}

export type { FiStaffSourceIdRow };
