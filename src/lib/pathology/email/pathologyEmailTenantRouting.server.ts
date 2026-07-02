import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PathologyEmailRouteRow } from "@/src/lib/pathology/email/pathologyEmailIngestionTypes";

function normalizeEmailAddress(email: string): string {
  return email.trim().toLowerCase();
}

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

export class PathologyEmailRouteNotFoundError extends Error {
  constructor() {
    super("Unknown inbound email route.");
    this.name = "PathologyEmailRouteNotFoundError";
  }
}

export class PathologyEmailRouteDisabledError extends Error {
  constructor() {
    super("Inbound email route is disabled.");
    this.name = "PathologyEmailRouteDisabledError";
  }
}

export async function resolvePathologyEmailRouteForAddress(
  toEmail: string,
  client?: SupabaseClient
): Promise<PathologyEmailRouteRow> {
  const normalized = normalizeEmailAddress(toEmail);
  if (!normalized) throw new PathologyEmailRouteNotFoundError();

  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_pathology_email_routes")
    .select("*")
    .ilike("inbound_email", normalized)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new PathologyEmailRouteNotFoundError();

  const route = mapRouteRow(data as Record<string, unknown>);
  if (route.route_status !== "active") throw new PathologyEmailRouteDisabledError();
  return route;
}

/** Pick the first routable `to` address from a normalized payload. */
export async function resolvePathologyEmailRouteFromPayload(
  toEmails: string[],
  client?: SupabaseClient
): Promise<{ route: PathologyEmailRouteRow; matchedToEmail: string }> {
  for (const raw of toEmails) {
    const email = raw?.trim();
    if (!email) continue;
    try {
      const route = await resolvePathologyEmailRouteForAddress(email, client);
      return { route, matchedToEmail: email };
    } catch (e) {
      if (
        e instanceof PathologyEmailRouteNotFoundError ||
        e instanceof PathologyEmailRouteDisabledError
      ) {
        continue;
      }
      throw e;
    }
  }
  throw new PathologyEmailRouteNotFoundError();
}
