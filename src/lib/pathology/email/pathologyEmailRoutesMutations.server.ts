import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PathologyEmailRouteRow } from "@/src/lib/pathology/email/pathologyEmailIngestionTypes";
import {
  isValidPathologyInboundEmail,
  normalizePathologyInboundEmail,
  type PathologyEmailRouteStatusValue,
} from "@/src/lib/pathology/email/pathologyEmailRoutesCore";

function mapRouteRow(row: Record<string, unknown>): PathologyEmailRouteRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    inbound_email: String(row.inbound_email),
    route_status: String(row.route_status) as PathologyEmailRouteRow["route_status"],
    source_label: row.source_label != null ? String(row.source_label) : null,
    default_source_channel: String(
      row.default_source_channel ?? "email"
    ) as PathologyEmailRouteRow["default_source_channel"],
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export class PathologyEmailRouteValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathologyEmailRouteValidationError";
  }
}

export class PathologyEmailRouteDuplicateError extends Error {
  constructor() {
    super("An inbound email route with this address already exists.");
    this.name = "PathologyEmailRouteDuplicateError";
  }
}

export class PathologyEmailRouteMutationNotFoundError extends Error {
  constructor() {
    super("Pathology email route not found.");
    this.name = "PathologyEmailRouteMutationNotFoundError";
  }
}

async function findRouteByNormalizedEmail(
  supabase: SupabaseClient,
  inboundEmail: string
): Promise<PathologyEmailRouteRow | null> {
  const normalized = normalizePathologyInboundEmail(inboundEmail);
  const { data, error } = await supabase
    .from("fi_pathology_email_routes")
    .select("*")
    .ilike("inbound_email", normalized)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapRouteRow(data as Record<string, unknown>);
}

async function findRouteByIdForTenant(
  supabase: SupabaseClient,
  tenantId: string,
  routeId: string
): Promise<PathologyEmailRouteRow | null> {
  const { data, error } = await supabase
    .from("fi_pathology_email_routes")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .eq("id", routeId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapRouteRow(data as Record<string, unknown>);
}

export type CreatePathologyEmailRouteInput = {
  tenantId: string;
  inboundEmail: string;
  sourceLabel?: string | null;
  routeStatus?: PathologyEmailRouteStatusValue;
};

export async function createPathologyEmailRoute(
  input: CreatePathologyEmailRouteInput,
  client?: SupabaseClient
): Promise<PathologyEmailRouteRow> {
  const supabase = client ?? supabaseAdmin();
  const tenantId = input.tenantId.trim();
  const inboundEmail = normalizePathologyInboundEmail(input.inboundEmail);

  if (!isValidPathologyInboundEmail(inboundEmail)) {
    throw new PathologyEmailRouteValidationError("inbound_email must be a valid email address.");
  }

  const routeStatus = input.routeStatus ?? "active";
  if (routeStatus !== "active" && routeStatus !== "disabled") {
    throw new PathologyEmailRouteValidationError("route_status must be active or disabled.");
  }

  const existing = await findRouteByNormalizedEmail(supabase, inboundEmail);
  if (existing) {
    throw new PathologyEmailRouteDuplicateError();
  }

  const sourceLabel = input.sourceLabel?.trim() ? input.sourceLabel.trim() : null;

  const { data, error } = await supabase
    .from("fi_pathology_email_routes")
    .insert({
      tenant_id: tenantId,
      inbound_email: inboundEmail,
      route_status: routeStatus,
      source_label: sourceLabel,
      default_source_channel: "email",
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new PathologyEmailRouteDuplicateError();
    }
    throw new Error(error.message);
  }

  return mapRouteRow(data as Record<string, unknown>);
}

export type UpdatePathologyEmailRouteStatusInput = {
  tenantId: string;
  routeId: string;
  routeStatus: PathologyEmailRouteStatusValue;
};

export async function updatePathologyEmailRouteStatus(
  input: UpdatePathologyEmailRouteStatusInput,
  client?: SupabaseClient
): Promise<PathologyEmailRouteRow> {
  const supabase = client ?? supabaseAdmin();
  const tenantId = input.tenantId.trim();
  const routeId = input.routeId.trim();

  if (input.routeStatus !== "active" && input.routeStatus !== "disabled") {
    throw new PathologyEmailRouteValidationError("route_status must be active or disabled.");
  }

  const existing = await findRouteByIdForTenant(supabase, tenantId, routeId);
  if (!existing) {
    throw new PathologyEmailRouteMutationNotFoundError();
  }

  const { data, error } = await supabase
    .from("fi_pathology_email_routes")
    .update({ route_status: input.routeStatus })
    .eq("tenant_id", tenantId)
    .eq("id", routeId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new PathologyEmailRouteMutationNotFoundError();

  return mapRouteRow(data as Record<string, unknown>);
}
